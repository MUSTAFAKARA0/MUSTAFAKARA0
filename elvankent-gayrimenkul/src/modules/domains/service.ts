import 'server-only';
import { randomUUID } from 'node:crypto';
import { updateTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';
import { createServiceClient } from '@/lib/supabase/server';
import { ActionError, assertNoDbError } from '@/platform/actions';
import { domainConfig } from '@/modules/domains/config';
import { getDnsResolver, type DnsResolver } from '@/modules/domains/dns';
import { parseDomainInput } from '@/modules/domains/hostname';
import { isApexDomain } from '@/modules/domains/provider';
import { hashVerificationValue, newVerification, verificationValue } from '@/modules/domains/verification';

/**
 * Özel alan adı yaşam döngüsü (P0.5): ekle (pending) → TXT ile doğrula (verified) → DNS
 * yönlendirmesi KARAY'a bağlı (active) → birincil / kaldır. Ofis paneli ve KARAY konsolu AYNI
 * çekirdeği kullanır.
 *
 * Kimlik: `actor` sunucuda doğrulanmış oturumdan gelir (ofis: requirePermission('settings.manage'),
 * organizasyon ctx.org.id; KARAY: requireSuperAdmin). Veritabanı fonksiyonları yalnızca sunucu
 * anahtarıyla çağrılabilir ve aynı kişinin yetkisini AYRICA doğrular.
 */
export interface DomainActor {
  userId: string;
  /** true: KARAY süper admin (plan sınırı yok, elle bağlantı onayı yapabilir) */
  platform: boolean;
}

export type DomainStatus = 'pending' | 'verified' | 'active';

export interface DnsInstruction {
  type: 'TXT' | 'CNAME' | 'A';
  host: string;
  value: string;
}

export interface DomainView {
  id: string;
  hostname: string;
  status: DomainStatus;
  isPrimary: boolean;
  verifiedAt: string | null;
  activatedAt: string | null;
  verificationExpiresAt: string | null;
  /** Bekleyen alan adının süresi geçmiş kodu (yeni kod gerekir) */
  verificationExpired: boolean;
  /** pending: sahiplik TXT kaydı (değer sunucuda yeniden üretilir) */
  verification: DnsInstruction | null;
  /** verified/active: KARAY'a yönlendirme kayıtları; hedef yapılandırılmamışsa boş */
  connection: DnsInstruction[];
}

function db() {
  const service = createServiceClient();
  if (!service) throw new ActionError('Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY tanımlı değil.', 'config');
  return service;
}

const DB_MESSAGES: Record<string, string> = {
  forbidden: 'Bu alan adını yönetme yetkiniz yok.',
  invalid_organization: 'Organizasyon bulunamadı veya aktif değil.',
  plan_feature_disabled: 'Planınız özel alan adını içermiyor. Planınızı yükseltmek için KARAY ile iletişime geçin.',
  domain_limit: 'En fazla 5 alan adı eklenebilir.',
  domain_taken: 'Bu alan adı başka bir sitede doğrulanmış / kullanımda.',
  domain_exists: 'Bu alan adı zaten ekli.',
  verification_failed: 'Doğrulama kaydı bulunamadı veya kodun süresi doldu. DNS kaydını kontrol edin (yayılması birkaç dakika sürebilir) ve tekrar deneyin.',
  not_verified: 'Önce alan adının sahipliği doğrulanmalı.',
  not_active: 'Yalnızca aktif (bağlı) alan adı birincil yapılabilir.',
  not_found: 'Alan adı bulunamadı.',
  rate_limited: 'Kısa sürede çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.',
  invalid_verification: 'Doğrulama kodu oluşturulamadı.',
};

function fail(error: { code?: string; message?: string } | null): never {
  const key = error?.message ?? '';
  if (DB_MESSAGES[key]) throw new ActionError(DB_MESSAGES[key], key);
  if (error?.code === '23505') throw new ActionError(DB_MESSAGES.domain_taken, 'domain_taken');
  assertNoDbError(error);
  throw new ActionError('İşlem tamamlanamadı. Lütfen tekrar deneyin.');
}

function refresh(orgId: string) {
  updateTag(cacheTags.tenants);
  updateTag(cacheTags.org(orgId));
}

function connectionRecords(hostname: string): DnsInstruction[] {
  const cfg = domainConfig();
  if (isApexDomain(hostname)) return cfg.targetA.map((ip) => ({ type: 'A' as const, host: '@', value: ip }));
  return cfg.targetCname ? [{ type: 'CNAME', host: hostname.split('.')[0], value: cfg.targetCname }] : [];
}

const actorArgs = (actor: DomainActor, orgId: string) => ({ p_actor: actor.userId, p_org: orgId, p_platform: actor.platform });

export async function listDomains(actor: DomainActor, orgId: string): Promise<DomainView[]> {
  const { data, error } = await db().rpc('domain_list', actorArgs(actor, orgId));
  if (error) fail(error);
  const record = domainConfig().verificationRecord;
  const now = Date.now();
  return (data ?? []).map((d) => {
    const expired = d.status === 'pending' && (!d.verification_expires_at || new Date(d.verification_expires_at).getTime() <= now);
    const value = d.status === 'pending' && d.verification_nonce && !expired ? verificationValue({ id: d.id, orgId, hostname: d.hostname, nonce: d.verification_nonce }) : null;
    return {
      id: d.id,
      hostname: d.hostname,
      status: d.status as DomainStatus,
      isPrimary: d.is_primary,
      verifiedAt: d.verified_at,
      activatedAt: d.activated_at,
      verificationExpiresAt: d.verification_expires_at,
      verificationExpired: expired,
      verification: value ? { type: 'TXT', host: `${record}.${d.hostname}`, value } : null,
      connection: d.status === 'pending' ? [] : connectionRecords(d.hostname),
    };
  });
}

export async function addDomain(actor: DomainActor, orgId: string, input: unknown): Promise<{ id: string; hostname: string }> {
  const parsed = parseDomainInput(input, domainConfig().policy);
  if (!parsed.ok) throw new ActionError(parsed.message, 'validation', { hostname: [parsed.message] });
  const id = randomUUID();
  const v = newVerification({ id, orgId, hostname: parsed.hostname });
  if (!v) throw new ActionError('Sunucu imza anahtarı tanımlı değil; doğrulama kodu üretilemiyor.', 'config');
  const { error } = await db().rpc('domain_add', { ...actorArgs(actor, orgId), p_id: id, p_hostname: parsed.hostname, p_nonce: v.nonce, p_token_hash: v.hash });
  if (error) fail(error);
  refresh(orgId);
  return { id, hostname: parsed.hostname };
}

export async function rotateVerification(actor: DomainActor, orgId: string, domainId: string): Promise<void> {
  const rows = await listDomains(actor, orgId);
  const row = rows.find((d) => d.id === domainId && d.status === 'pending');
  if (!row) throw new ActionError(DB_MESSAGES.not_found, 'not_found');
  const v = newVerification({ id: row.id, orgId, hostname: row.hostname });
  if (!v) throw new ActionError('Sunucu imza anahtarı tanımlı değil; doğrulama kodu üretilemiyor.', 'config');
  const { error } = await db().rpc('domain_rotate_verification', { ...actorArgs(actor, orgId), p_id: domainId, p_nonce: v.nonce, p_token_hash: v.hash });
  if (error) fail(error);
}

/** Sahiplik: _karay-verification.<alan adı> TXT kayıtları okunur; eşleşmeyi veritabanı karar verir */
export async function verifyDomain(actor: DomainActor, orgId: string, domainId: string, resolver: DnsResolver = getDnsResolver()): Promise<string> {
  const { data, error } = await db().rpc('domain_check_begin', { ...actorArgs(actor, orgId), p_id: domainId });
  if (error) fail(error);
  const row = data?.[0];
  if (!row) throw new ActionError(DB_MESSAGES.not_found, 'not_found');
  if (row.status !== 'pending') return row.hostname;
  const txt = await resolver.txt(`${domainConfig().verificationRecord}.${row.hostname}`);
  const found = [...new Set(txt.map((t) => hashVerificationValue(t)))].slice(0, 20);
  const res = await db().rpc('domain_mark_verified', { ...actorArgs(actor, orgId), p_id: domainId, p_found_hashes: found });
  if (res.error) fail(res.error);
  refresh(orgId);
  return row.hostname;
}

/**
 * Bağlantı: alan adının DNS'i yapılandırılmış KARAY hedefine yönleniyor mu? (alt alan adı →
 * CNAME, kök → A). Hedef tanımlı değilse yalnızca süper admin elle onaylayabilir (barındırma
 * tarafında bağlantıyı kendisi kontrol ettikten sonra).
 */
export async function connectDomain(actor: DomainActor, orgId: string, domainId: string, options: { manual?: boolean } = {}, resolver: DnsResolver = getDnsResolver()): Promise<string> {
  const manual = options.manual === true;
  if (manual && !actor.platform) throw new ActionError(DB_MESSAGES.forbidden, 'forbidden');
  const { data, error } = await db().rpc('domain_check_begin', { ...actorArgs(actor, orgId), p_id: domainId });
  if (error) fail(error);
  const row = data?.[0];
  if (!row) throw new ActionError(DB_MESSAGES.not_found, 'not_found');
  if (row.status === 'pending') throw new ActionError(DB_MESSAGES.not_verified, 'not_verified');
  if (row.status === 'active') return row.hostname;
  if (!manual) {
    const cfg = domainConfig();
    let ok = false;
    if (isApexDomain(row.hostname)) {
      const ips = await resolver.a(row.hostname);
      ok = cfg.targetA.length > 0 && ips.length > 0 && ips.every((ip) => cfg.targetA.includes(ip));
    } else {
      const cnames = await resolver.cname(row.hostname);
      ok = cfg.targetCname !== null && cnames.some((c) => c.replace(/\.$/, '').toLowerCase() === cfg.targetCname);
    }
    if (!ok) {
      throw new ActionError(
        cfg.targetCname || cfg.targetA.length
          ? 'Alan adı henüz KARAY\'a yönlendirilmiyor. Gösterilen DNS kaydını ekleyin; yayılması birkaç dakika ile birkaç saat sürebilir.'
          : 'Bağlantı hedefi yapılandırılmamış; bağlantıyı KARAY ekibi onaylayacak.',
        'not_connected',
      );
    }
  }
  const res = await db().rpc('domain_mark_active', { ...actorArgs(actor, orgId), p_id: domainId, p_manual: manual });
  if (res.error) fail(res.error);
  refresh(orgId);
  return row.hostname;
}

export async function setPrimaryDomain(actor: DomainActor, orgId: string, domainId: string): Promise<void> {
  const { error } = await db().rpc('domain_set_primary', { ...actorArgs(actor, orgId), p_id: domainId });
  if (error) fail(error);
  refresh(orgId);
}

export async function removeDomain(actor: DomainActor, orgId: string, domainId: string): Promise<string> {
  const { data, error } = await db().rpc('domain_remove', { ...actorArgs(actor, orgId), p_id: domainId });
  if (error) fail(error);
  refresh(orgId);
  return data as string;
}
