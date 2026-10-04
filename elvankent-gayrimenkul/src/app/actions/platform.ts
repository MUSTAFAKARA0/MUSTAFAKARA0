'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { getDomainProvider } from '@/modules/domains';
import { cacheTags } from '@/lib/cache-tags';
import { isUuid } from '@/lib/utils';
import { createServiceClient } from '@/lib/supabase/server';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { requireSuperAdmin } from '@/platform/auth/session';
import { hostnameSchema, type CreateOrgInput } from '@/modules/platform/org-schema';
import { provisionOrganization } from '@/modules/platform/provisioning';

/**
 * Süper admin işlemleri. Yetki hem burada (requireSuperAdmin) hem de her
 * veritabanı fonksiyonunun içinde (assert_super_admin) doğrulanır.
 */

function refreshTenants(orgId?: string) {
  updateTag(cacheTags.tenants);
  if (orgId) updateTag(cacheTags.org(orgId));
  revalidatePath('/platform', 'layout');
}

/** Yeni organizasyon + sahip hesabı (yoksa geçici şifreyle oluşturulur) */
export async function createOrganization(raw: CreateOrgInput): Promise<ActionResult<{ id: string; temporaryPassword: string | null; ownerEmail: string }>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    const created = await provisionOrganization(session, raw);
    refreshTenants();
    return created;
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

export async function addDomain(orgId: string, hostname: string, primary: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    if (!isUuid(orgId)) throw new ActionError('Organizasyon bulunamadı.');
    const host = hostnameSchema.parse(hostname);
    const { error } = await session.supabase.rpc('platform_add_domain', { p_org: orgId, p_hostname: host, p_primary: primary });
    if (error?.code === '23505') throw new ActionError('Bu alan adı başka bir organizasyona bağlı.', 'validation', { hostname: ['Bu alan adı zaten kullanılıyor.'] });
    assertNoDbError(error);
    refreshTenants(orgId);
    // Barındırma tarafı: manual → DNS talimatı sayfada gösterilir; vercel → projeye otomatik eklenir
    const provider = getDomainProvider();
    const hosted = await provider.add(host);
    if (!hosted.ok) throw new ActionError(`Alan adı kaydedildi ancak barındırmaya eklenemedi: ${hosted.error} Vercel panelinden elle ekleyebilirsiniz.`);
    return null;
  }, 'Alan adı eklendi. Sayfadaki DNS kaydını alan adı sağlayıcınızda tanımlayın.');
}

export async function removeDomain(domainId: string, orgId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    // Süper admin doğrulandıktan sonra alan adı adı hizmet istemcisiyle okunur (barındırmadan kaldırmak için)
    const { data: domain } = (await createServiceClient()?.from('organization_domains').select('hostname').eq('id', domainId).maybeSingle()) ?? { data: null };
    const { error } = await session.supabase.rpc('platform_remove_domain', { p_id: domainId });
    assertNoDbError(error);
    if (domain?.hostname) await getDomainProvider().remove(domain.hostname);
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
