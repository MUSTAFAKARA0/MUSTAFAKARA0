'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import * as domains from '@/modules/domains/service';
import { cacheTags } from '@/lib/cache-tags';
import { isUuid } from '@/lib/utils';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { requireSuperAdmin } from '@/platform/auth/session';
import type { CreateOrgInput } from '@/modules/platform/org-schema';
import { provisionOrganization, type OwnerAccountState } from '@/modules/platform/provisioning';
import { revokeOwnerInvitation, sendOwnerInvitation } from '@/modules/platform/invitations/service';

/**
 * Süper admin işlemleri. Yetki hem burada (requireSuperAdmin) hem de her
 * veritabanı fonksiyonunun içinde (assert_super_admin) doğrulanır.
 */

function refreshTenants(orgId?: string) {
  updateTag(cacheTags.tenants);
  if (orgId) updateTag(cacheTags.org(orgId));
  revalidatePath('/platform', 'layout');
}

/** Yeni organizasyon + sahip hesabı (yoksa etkinleştirilmemiş açılır ve bekleyen davet oluşturulur) */
export async function createOrganization(raw: CreateOrgInput): Promise<ActionResult<{ id: string; ownerEmail: string; ownerAccount: OwnerAccountState }>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    const created = await provisionOrganization(session, raw);
    refreshTenants();
    return created;
  });
}

/**
 * Sahip davetini gönderir / tekrar gönderir / iptal edilmişse yeniden açar (P0.4). İstemciden
 * yalnızca organizasyon kimliği gelir; e-posta, kullanıcı ve rol veritabanında belirlenir.
 */
export async function sendOwnerInvitationAction(orgId: string): Promise<ActionResult<{ email: string; expiresAt: string }>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    if (!isUuid(orgId)) throw new ActionError('Organizasyon bulunamadı.');
    const sent = await sendOwnerInvitation(session, orgId);
    revalidatePath(`/platform/organizasyonlar/${orgId}`);
    return sent;
  }, 'Davet e-postası gönderildi. Önceki davet bağlantıları artık geçersiz.');
}

/** Bekleyen sahip davetini iptal eder (bağlantı geçersiz olur; hesap ve organizasyon silinmez) */
export async function revokeOwnerInvitationAction(orgId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    if (!isUuid(orgId)) throw new ActionError('Organizasyon bulunamadı.');
    await revokeOwnerInvitation(session, orgId);
    revalidatePath(`/platform/organizasyonlar/${orgId}`);
    return null;
  }, 'Davet iptal edildi. Bağlantı artık çalışmaz.');
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

/**
 * Özel alan adı (P0.5) — KARAY tarafı. Aynı yaşam döngüsü ofis paneliyle ortaktır
 * (modules/domains/service): ekle (bekliyor) → TXT doğrulama → bağlantı → birincil / kaldır.
 * Süper admin ek olarak bağlantıyı (barındırmada kontrol ettikten sonra) elle onaylayabilir.
 * Organizasyon kimliği yalnızca hangi ofis için işlem yapıldığını seçer; yetki sunucuda ve
 * veritabanında doğrulanır.
 */
async function platformDomainActor(orgId: string) {
  const session = await requireSuperAdmin();
  if (!isUuid(orgId)) throw new ActionError('Organizasyon bulunamadı.');
  return { userId: session.user.id, platform: true };
}

export async function addDomain(orgId: string, hostname: string): Promise<ActionResult<{ id: string; hostname: string }>> {
  return runAction(async () => {
    const actor = await platformDomainActor(orgId);
    const added = await domains.addDomain(actor, orgId, hostname);
    revalidatePath('/platform', 'layout');
    return added;
  }, 'Alan adı eklendi. Doğrulama için gösterilen TXT kaydını alan adı sağlayıcısında tanımlayın.');
}

export async function verifyDomainAction(orgId: string, domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await platformDomainActor(orgId);
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.verifyDomain(actor, orgId, domainId);
    revalidatePath('/platform', 'layout');
    return null;
  }, 'Alan adının sahipliği doğrulandı.');
}

export async function connectDomainAction(orgId: string, domainId: string, manual?: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await platformDomainActor(orgId);
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.connectDomain(actor, orgId, domainId, { manual: manual === true });
    revalidatePath('/platform', 'layout');
    return null;
  }, 'Alan adı aktif; site bu adreste açılır.');
}

export async function rotateDomainVerificationAction(orgId: string, domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await platformDomainActor(orgId);
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.rotateVerification(actor, orgId, domainId);
    revalidatePath('/platform', 'layout');
    return null;
  }, 'Yeni doğrulama kodu oluşturuldu; önceki kod artık geçersiz.');
}

export async function setPrimaryDomainAction(orgId: string, domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await platformDomainActor(orgId);
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.setPrimaryDomain(actor, orgId, domainId);
    revalidatePath('/platform', 'layout');
    return null;
  }, 'Birincil alan adı güncellendi.');
}

export async function connectDomainManualAction(orgId: string, domainId: string): Promise<ActionResult<null>> {
  return connectDomainAction(orgId, domainId, true);
}

export async function removeDomainAction(orgId: string, domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await platformDomainActor(orgId);
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.removeDomain(actor, orgId, domainId);
    revalidatePath('/platform', 'layout');
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
