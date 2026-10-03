'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { cacheTags } from '@/lib/cache-tags';
import { createServiceClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { requireSuperAdmin } from '@/platform/auth/session';
import { createPreviewToken } from '@/site-config/preview';
import { FEATURE_KEYS, SECTION_SCHEMAS, parseSiteConfig, type BrandDraft, type BrandField, type SiteSection } from '@/site-config/schema';
import { getTenant } from '@/platform/tenant/tenant';
import type { Json } from '@/types/supabase';

/**
 * KARAY Web Sitesi Yönetimi işlemleri (yalnızca süper admin, platform oturumu).
 * Yetki burada (requireSuperAdmin) ve veritabanı fonksiyonlarının içinde
 * (assert_super_admin) iki kez doğrulanır; her işlem denetim kaydına yazılır.
 * Kiracı kimliği yalnızca platform yöneticisinin seçtiği değerdir; kiracı
 * kullanıcıları bu işlemleri çağıramaz.
 */

function assertOrg(orgId: string) {
  if (!isUuid(orgId)) throw new ActionError('Geçersiz site.');
}

/** Yayın/durum değişikliği sonrası kiracı sitesinin önbelleği yenilenir */
function refreshSite(orgId: string) {
  updateTag(cacheTags.tenants);
  updateTag(cacheTags.org(orgId));
  revalidatePath(`/platform/siteler/${orgId}`, 'layout');
  revalidatePath('/platform/siteler');
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.filter((p) => typeof p === 'string' || typeof p === 'number').join(' › ');
  return `${issue?.message ?? 'Geçersiz değer.'}${path ? ` (${path})` : ''}`;
}

/** Taslağın bir bölümünü kaydeder (canlı site değişmez; yayınlanınca değişir) */
export async function saveSiteSection(orgId: string, section: SiteSection, value: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    const schema = SECTION_SCHEMAS[section];
    if (!schema) throw new ActionError('Geçersiz bölüm.');
    const parsed = (schema as z.ZodType).safeParse(value);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));
    const session = await requireSuperAdmin();
    const { error } = await session.supabase.rpc('site_save_draft', { p_org: orgId, p_section: section, p_value: parsed.data as Json });
    assertNoDbError(error);
    revalidatePath(`/platform/siteler/${orgId}`, 'layout');
    return null;
  }, 'Taslağa kaydedildi. Canlı sitede görünmesi için "Değişiklikleri yayınla"ya basın.');
}

export async function publishSite(orgId: string, note?: string): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    const { data, error } = await session.supabase.rpc('site_publish', { p_org: orgId, p_note: (note ?? '').slice(0, 200) || undefined });
    assertNoDbError(error);
    refreshSite(orgId);
    return { version: data as number };
  }, 'Değişiklikler yayınlandı.');
}

export async function rollbackSite(orgId: string, version: number): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    assertOrg(orgId);
    if (!Number.isInteger(version) || version < 1) throw new ActionError('Geçersiz sürüm.');
    const session = await requireSuperAdmin();
    const { data, error } = await session.supabase.rpc('site_rollback', { p_org: orgId, p_version: version });
    assertNoDbError(error);
    refreshSite(orgId);
    return { version: data as number };
  }, 'Seçilen sürüm geri yüklendi ve yayınlandı.');
}

export async function discardSiteDraft(orgId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    const { error } = await session.supabase.rpc('site_discard_draft', { p_org: orgId });
    assertNoDbError(error);
    revalidatePath(`/platform/siteler/${orgId}`, 'layout');
    return null;
  }, 'Yayınlanmamış değişiklikler geri alındı.');
}

const statusSchema = z.object({
  status: z.enum(['active', 'maintenance', 'draft']),
  message: z.string().trim().max(300).optional(),
});

export async function setSiteStatus(orgId: string, input: { status: string; message?: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));
    const session = await requireSuperAdmin();
    const { error } = await session.supabase.rpc('site_set_status', { p_org: orgId, p_status: parsed.data.status, p_message: parsed.data.message || undefined });
    assertNoDbError(error);
    refreshSite(orgId);
    return null;
  }, 'Site durumu güncellendi.');
}

export async function setSiteFeatures(orgId: string, overrides: Record<string, boolean | null>): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    // null = plan varsayılanına dön (kayıttan çıkarılır)
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(overrides)) {
      if ((FEATURE_KEYS as readonly string[]).includes(k) && typeof v === 'boolean') clean[k] = v;
    }
    const session = await requireSuperAdmin();
    const { error } = await session.supabase.rpc('site_set_features', { p_org: orgId, p_overrides: clean });
    assertNoDbError(error);
    refreshSite(orgId);
    return null;
  }, 'Özellikler güncellendi.');
}

// --------------------------------------------------------------------------- Marka ve iletişim
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v.replace(/[<>]/g, '')));
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), { message: 'Bağlantı https:// ile başlamalıdır.' })
  .transform((v) => (v === '' ? null : v));

const brandSchema = z.object({
  display_name: z.string().trim().min(2, { message: 'Firma adı en az 2 karakter olmalıdır.' }).max(80),
  short_name: optional(40),
  legal_name: optional(160),
  tagline: optional(160),
  description: optional(2000),
  phone: optional(30),
  whatsapp: optional(30),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Geçerli bir e-posta adresi girin.' })
    .transform((v) => (v === '' ? null : v.toLowerCase())),
  address_line: optional(240),
  address_district: optional(80),
  address_city: optional(80),
  maps_url: optionalUrl,
  instagram_url: optionalUrl,
  facebook_url: optionalUrl,
  x_url: optionalUrl,
  youtube_url: optionalUrl,
  linkedin_url: optionalUrl,
  tiktok_url: optionalUrl,
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, { message: 'Renk #RRGGBB biçiminde olmalıdır.' }).transform((v) => v.toLowerCase()),
  accent_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, { message: 'Renk #RRGGBB biçiminde olmalıdır.' }).transform((v) => v.toLowerCase()),
});
export type BrandInput = z.input<typeof brandSchema>;

/**
 * Marka ve iletişim bilgileri TASLAĞA yazılır (site_configs.draft.brand; yalnızca canlıdan
 * farklı alanlar). Canlı site "Değişiklikleri yayınla" ile değişir; önizlemede görünür.
 * Yayında ofisin ayar kaydına (organization_settings) uygulanır, sürüm kaydına anlık
 * görüntü yazılır; geri almada eski marka geri gelir.
 */
export async function updateSiteBrand(orgId: string, input: BrandInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    const parsed = brandSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstIssue(parsed.error));
    const session = await requireSuperAdmin();
    const [settings, site] = await Promise.all([
      session.supabase.from('organization_settings').select('*').eq('organization_id', orgId).maybeSingle(),
      session.supabase.from('site_configs').select('draft').eq('organization_id', orgId).maybeSingle(),
    ]);
    if (!settings.data) throw new ActionError('Site bulunamadı.');
    const live = settings.data as unknown as Record<string, unknown>;
    const draft: BrandDraft = { ...parseSiteConfig(site.data?.draft).brand };
    for (const [k, v] of Object.entries(parsed.data) as [BrandField, string | null][]) {
      // Canlıyla aynıysa taslaktan çıkar (bekleyen değişiklik yok)
      if ((live[k] ?? null) === v) delete draft[k];
      else draft[k] = v;
    }
    const { error } = await session.supabase.rpc('site_save_draft', { p_org: orgId, p_section: 'brand', p_value: draft as Json });
    assertNoDbError(error);
    revalidatePath(`/platform/siteler/${orgId}`, 'layout');
    return null;
  }, 'Marka taslağa kaydedildi. Canlı sitede görünmesi için "Değişiklikleri yayınla"ya basın.');
}

/** Taslak önizleme bağlantısı (1 saat geçerli; yalnızca bağlantıyı açan tarayıcı taslağı görür) */
export async function createSitePreviewLink(orgId: string, path = '/'): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    assertOrg(orgId);
    await requireSuperAdmin();
    const service = createServiceClient();
    const { data: org } = service ? await service.from('organizations').select('slug, status').eq('id', orgId).maybeSingle() : { data: null };
    if (!org) throw new ActionError('Site bulunamadı.');
    if (org.status !== 'active') throw new ActionError('Askıdaki sitenin önizlemesi açılamaz.');
    const tenant = await getTenant(org.slug);
    const token = createPreviewToken(orgId);
    if (!tenant || !token) throw new ActionError('Önizleme bağlantısı oluşturulamadı.');
    const to = path.startsWith('/') && !path.startsWith('//') ? path : '/';
    return { url: `${tenant.baseUrl}/api/site-preview?token=${encodeURIComponent(token)}&to=${encodeURIComponent(to)}` };
  });
}
