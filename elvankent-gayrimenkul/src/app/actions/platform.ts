'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { cacheTags } from '@/lib/cache-tags';
import { slugify } from '@/lib/slug';
import { isUuid } from '@/lib/utils';
import { createServiceClient } from '@/lib/supabase/server';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import { requireSuperAdmin } from '@/platform/auth/session';

/**
 * Süper admin işlemleri. Yetki hem burada (requireSuperAdmin) hem de her
 * veritabanı fonksiyonunun içinde (assert_super_admin) doğrulanır.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function temporaryPassword(): string {
  for (;;) {
    const value = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')).join('-');
    if (/\d/.test(value) && /[a-z]/.test(value) && /[A-Z]/.test(value)) return value;
  }
}

function refreshTenants(orgId?: string) {
  updateTag(cacheTags.tenants);
  if (orgId) updateTag(cacheTags.org(orgId));
  revalidatePath('/platform', 'layout');
}

const RESERVED_SLUGS = new Set(['admin', 'api', 'platform', 'www', 'app', 'mail', 'static', 'assets', 't', 'onizleme', 'koleksiyon']);

const orgSchema = z.object({
  name: z
    .string()
    .max(200)
    .transform((v) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, { error: 'Organizasyon adı en az 2 karakter olmalıdır.' }).max(80, { error: 'Organizasyon adı en fazla 80 karakter olabilir.' })),
  slug: z
    .string()
    .max(60)
    .transform((v) => slugify(v, 40))
    .pipe(
      z
        .string()
        .min(3, { error: 'Kısa ad en az 3 karakter olmalıdır (harf, rakam, tire).' })
        .refine((v) => !RESERVED_SLUGS.has(v), { error: 'Bu kısa ad sistem tarafından kullanılıyor.' }),
    ),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, { error: 'İlan no öneki 2–5 büyük harf olmalıdır (ör. ABC).' }),
  plan: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, { error: 'Plan seçin.' }),
  owner_email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .pipe(z.email({ error: 'Sahip için geçerli bir e-posta girin.' })),
  owner_name: z
    .string()
    .max(200)
    .transform((v) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, { error: 'Sahip adı en az 2 karakter olmalıdır.' }).max(100)),
});

export type CreateOrgInput = z.input<typeof orgSchema>;

/** Yeni organizasyon + sahip hesabı (yoksa geçici şifreyle oluşturulur) */
export async function createOrganization(raw: CreateOrgInput): Promise<ActionResult<{ id: string; temporaryPassword: string | null; ownerEmail: string }>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    const input = orgSchema.parse(raw);
    const service = createServiceClient();
    if (!service) throw new ActionError('Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY tanımlı değil.', 'config');

    // Sahip hesabı: varsa mevcut hesap, yoksa geçici şifreyle yeni hesap
    const { data: found } = await session.supabase.rpc('platform_users', { p_search: input.owner_email, p_limit: 20 });
    let ownerId = (found ?? []).find((u) => u.email?.toLowerCase() === input.owner_email)?.user_id ?? null;
    let password: string | null = null;
    let createdUser = false;
    if (!ownerId) {
      password = temporaryPassword();
      const { data, error } = await service.auth.admin.createUser({
        email: input.owner_email,
        password,
        email_confirm: true,
        user_metadata: { full_name: input.owner_name },
      });
      if (error || !data.user) throw new ActionError('Sahip hesabı oluşturulamadı. Lütfen tekrar deneyin.');
      ownerId = data.user.id;
      createdUser = true;
      await service.from('profiles').update({ full_name: input.owner_name, password_change_required: true }).eq('id', ownerId);
    }

    const { data: orgId, error } = await session.supabase.rpc('platform_create_organization', {
      p_slug: input.slug,
      p_name: input.name,
      p_prefix: input.prefix,
      p_plan: input.plan,
      p_owner: ownerId,
    });
    if (error) {
      if (createdUser) await service.auth.admin.deleteUser(ownerId);
      if (error.code === '23505') throw new ActionError('Lütfen işaretli alanları kontrol edin.', 'validation', { slug: ['Bu kısa ad veya önek başka bir organizasyonda kullanılıyor.'] });
      assertNoDbError(error);
    }
    if (createdUser) {
      await logSecurityEvent({ orgId: orgId as string, action: 'user.created', actorId: session.user.id, targetType: 'user', targetId: ownerId, targetLabel: input.owner_name, metadata: { role: 'owner' } });
    }
    refreshTenants();
    return { id: orgId as string, temporaryPassword: password, ownerEmail: input.owner_email };
  });
}

export async function setOrganizationStatus(orgId: string, status: 'active' | 'suspended' | 'cancelled'): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    if (!isUuid(orgId)) throw new ActionError('Organizasyon bulunamadı.');
    const next = z.enum(['active', 'suspended', 'cancelled']).parse(status);
    const { error } = await session.supabase.rpc('platform_set_org_status', { p_org: orgId, p_status: next });
    assertNoDbError(error);
    refreshTenants(orgId);
    return null;
  }, 'Organizasyon durumu güncellendi.');
}

export async function setOrganizationPlan(orgId: string, plan: string, status: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    if (!isUuid(orgId)) throw new ActionError('Organizasyon bulunamadı.');
    const planId = z.string().regex(/^[a-z][a-z0-9_]{1,30}$/).parse(plan);
    const subStatus = z.enum(['trialing', 'active', 'past_due']).parse(status);
    const { error } = await session.supabase.rpc('platform_set_org_plan', { p_org: orgId, p_plan: planId, p_status: subStatus });
    assertNoDbError(error);
    refreshTenants(orgId);
    return null;
  }, 'Plan güncellendi.');
}

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  .pipe(z.string().regex(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, { error: 'Geçerli bir alan adı girin (ör. www.ornekemlak.com).' }));

export async function addDomain(orgId: string, hostname: string, primary: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    if (!isUuid(orgId)) throw new ActionError('Organizasyon bulunamadı.');
    const host = hostnameSchema.parse(hostname);
    const { error } = await session.supabase.rpc('platform_add_domain', { p_org: orgId, p_hostname: host, p_primary: primary });
    if (error?.code === '23505') throw new ActionError('Bu alan adı başka bir organizasyona bağlı.', 'validation', { hostname: ['Bu alan adı zaten kullanılıyor.'] });
    assertNoDbError(error);
    refreshTenants(orgId);
    return null;
  }, 'Alan adı eklendi. DNS kaydı ve barındırma (Vercel) tarafında da tanımlanmalıdır.');
}

export async function removeDomain(domainId: string, orgId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    const { error } = await session.supabase.rpc('platform_remove_domain', { p_id: domainId });
    assertNoDbError(error);
    refreshTenants(isUuid(orgId) ? orgId : undefined);
    return null;
  }, 'Alan adı kaldırıldı.');
}

const limit = z
  .union([z.number(), z.string()])
  .transform((v) => (v === '' || v === null ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 1_000_000), { error: 'Pozitif bir tam sayı girin veya sınırsız için boş bırakın.' });

const planSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  name: z
    .string()
    .trim()
    .transform((v) => v.replace(/[<>]/g, ''))
    .pipe(z.string().min(2, { error: 'Plan adı en az 2 karakter olmalıdır.' }).max(60)),
  max_users: limit,
  max_properties: limit,
  max_storage_mb: limit,
  crm: z.boolean(),
  analytics: z.boolean(),
  pdf: z.boolean(),
  custom_domain: z.boolean(),
  price: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 10_000_000), { error: 'Geçerli bir fiyat girin.' }),
});

export type PlanInput = z.input<typeof planSchema>;

export async function updatePlan(raw: PlanInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    const p = planSchema.parse(raw);
    // Tüm parametreler gönderilir (boş olanlar null): PostgREST imza eşleşmesi için gerekli
    const { error } = await session.supabase.rpc('platform_update_plan', {
      p_id: p.id,
      p_name: p.name,
      p_max_users: p.max_users as number,
      p_max_properties: p.max_properties as number,
      p_max_storage_mb: p.max_storage_mb as number,
      p_crm: p.crm,
      p_analytics: p.analytics,
      p_pdf: p.pdf,
      p_custom_domain: p.custom_domain,
      p_price: p.price as number,
    });
    assertNoDbError(error);
    refreshTenants();
    return null;
  }, 'Plan kaydedildi.');
}
