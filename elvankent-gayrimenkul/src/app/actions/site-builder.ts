'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isUuid } from '@/lib/utils';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { requireSuperAdmin } from '@/platform/auth/session';
import { FEATURE_KEYS, type SiteSection } from '@/site-config/schema';
import { findDesignFamily } from '@/site-factory/families';
import { firstIssue, type BrandInput } from '@/site-editor/brand-input';
import {
  applyFamilyToDraft,
  discardDraft,
  publishDraft,
  rollbackToVersion,
  saveBrandDraft,
  saveDraftSection,
} from '@/site-editor/service';
import { refreshPublicSite } from '@/site-editor/cache';
import { createPreviewUrl } from '@/site-editor/preview-link';

/**
 * KARAY Web Sitesi Yönetimi işlemleri (yalnızca süper admin, platform oturumu).
 * Taslak / yayın / geri alma / önizleme ORTAK servistir (@/site-editor/service); ofis paneli
 * (/admin/site, app/actions/admin-site.ts) aynı servisi kendi yetkisiyle çağırır. Yetki burada
 * (requireSuperAdmin) ve veritabanı fonksiyonlarının içinde (assert_site_editor / assert_super_admin)
 * iki kez doğrulanır; her işlem denetim kaydına yazılır. Durum, özellikler ve aile yetkileri
 * yalnızca KARAY'a aittir.
 */

function assertOrg(orgId: string) {
  if (!isUuid(orgId)) throw new ActionError('Geçersiz site.');
}

/** Yayın/durum değişikliği sonrası kiracı sitesinin önbelleği yenilenir */
function refreshSite(orgId: string) {
  refreshPublicSite(orgId);
  revalidatePath(`/platform/siteler/${orgId}`, 'layout');
  revalidatePath('/platform/siteler');
}

/** Taslağın bir bölümünü kaydeder (canlı site değişmez; yayınlanınca değişir) */
export async function saveSiteSection(orgId: string, section: SiteSection, value: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    await saveDraftSection(session.supabase, orgId, section, value);
    revalidatePath(`/platform/siteler/${orgId}`, 'layout');
    return null;
  }, 'Taslağa kaydedildi. Canlı sitede görünmesi için "Değişiklikleri yayınla"ya basın.');
}

/**
 * Site Factory: seçilen tasarım ailesini taslağa derler (ortak servis: applyFamilyToDraft).
 * KARAY katalogdaki her aileyi uygulayabilir. Canlı site değişmez.
 */
export async function applyDesignFamily(orgId: string, familyId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    await applyFamilyToDraft(session.supabase, orgId, familyId);
    revalidatePath(`/platform/siteler/${orgId}`, 'layout');
    return null;
  }, 'Tasarım ailesi taslağa uygulandı. Önizleyip "Değişiklikleri yayınla"ya basın.');
}

export async function publishSite(orgId: string, note?: string): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    const version = await publishDraft(session.supabase, orgId, note);
    refreshSite(orgId);
    return { version };
  }, 'Değişiklikler yayınlandı.');
}

export async function rollbackSite(orgId: string, version: number): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    const next = await rollbackToVersion(session.supabase, orgId, version);
    refreshSite(orgId);
    return { version: next };
  }, 'Seçilen sürüm geri yüklendi ve yayınlandı.');
}

export async function discardSiteDraft(orgId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    await discardDraft(session.supabase, orgId);
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
export type { BrandInput };

/** Marka ve iletişim TASLAĞA yazılır (ortak servis: saveBrandDraft) */
export async function updateSiteBrand(orgId: string, input: BrandInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    await saveBrandDraft(session.supabase, orgId, input);
    revalidatePath(`/platform/siteler/${orgId}`, 'layout');
    return null;
  }, 'Marka taslağa kaydedildi. Canlı sitede görünmesi için "Değişiklikleri yayınla"ya basın.');
}

/** Taslak önizleme bağlantısı (1 saat geçerli; yalnızca bağlantıyı açan tarayıcı taslağı görür) */
export async function createSitePreviewLink(orgId: string, path = '/'): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    assertOrg(orgId);
    const session = await requireSuperAdmin();
    return { url: await createPreviewUrl(session.supabase, orgId, path) };
  });
}

// --------------------------------------------------------------------------- Tasarım ailesi yetkileri
/**
 * KARAY: kiracının (ofis yöneticisinin) seçebileceği tasarım aileleri. Kimlikler kapalı katalogdan
 * doğrulanır; veritabanı (platform_set_org_design_families) ayrıca süper admin yetkisini doğrular.
 */
export async function setOrgDesignFamilies(orgId: string, families: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    assertOrg(orgId);
    if (!Array.isArray(families) || families.some((f) => typeof f !== 'string' || !findDesignFamily(f))) throw new ActionError('Geçersiz tasarım ailesi.');
    const session = await requireSuperAdmin();
    const { error } = await session.supabase.rpc('platform_set_org_design_families', { p_org: orgId, p_families: [...new Set(families)] });
    assertNoDbError(error);
    revalidatePath(`/platform/siteler/${orgId}`, 'layout');
    return null;
  }, 'Ofisin seçebileceği aileler güncellendi.');
}

/** KARAY: aileyi tüm kiracılar için aç / kapat (kullanan sitelerin yayındaki görünümü değişmez) */
export async function setDesignFamilyEnabled(familyId: string, enabled: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (typeof familyId !== 'string' || !findDesignFamily(familyId) || typeof enabled !== 'boolean') throw new ActionError('Geçersiz tasarım ailesi.');
    const session = await requireSuperAdmin();
    const { error } = await session.supabase.rpc('platform_set_design_family', { p_family: familyId, p_enabled: enabled });
    assertNoDbError(error);
    revalidatePath('/platform/siteler', 'layout');
    return null;
  }, enabled ? 'Aile açıldı.' : 'Aile kapatıldı; ofislere yeni seçenek olarak gösterilmez.');
}
