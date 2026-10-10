'use server';

import { revalidatePath } from 'next/cache';
import { runAction, type ActionResult } from '@/platform/actions';
import { requirePermission } from '@/platform/auth/session';
import { selectableFamilies } from '@/modules/platform/design-access';
import type { SiteSection } from '@/site-config/schema';
import type { BrandInput } from '@/site-editor/brand-input';
import type { SavedDraft } from '@/site-editor/types';
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
 * OFİS PANELİ › Site yönetimi (/admin/site). KARAY Site Builder ile AYNI servis
 * (@/site-editor/service) ve aynı veritabanı fonksiyonları kullanılır; burada yalnızca yetki ve
 * organizasyon kaynağı farklıdır:
 *
 *   • organizasyon İSTEMCİDEN ALINMAZ: hiçbir işlem organizasyon/ site kimliği parametresi almaz;
 *     kimlik oturumdan gelir (requirePermission → ctx.org.id)
 *   • yetki: settings.manage (sahip, yönetici). Veritabanı (assert_site_editor) aynı yetkiyi
 *     oturumun üyeliğine karşı ikinci kez doğrular
 *   • tasarım ailesi: yalnızca KARAY'ın bu ofise izin verdiği ve global açık aileler
 *     (org_design_family_access); veritabanı taslağa izinsiz aile yazılmasını ayrıca reddeder
 *   • durum, özellikler, alan adı ekleme/silme, aile yetkileri ve planlar KARAY'a aittir; burada yok
 */

const PANEL = '/admin/site';

async function editor() {
  return requirePermission('settings.manage');
}

export async function saveOfficeSiteSection(section: SiteSection, value: unknown, expected?: string | null): Promise<ActionResult<SavedDraft>> {
  return runAction(async () => {
    const ctx = await editor();
    const draftToken = await saveDraftSection(ctx.supabase, ctx.org.id, section, value, expected);
    revalidatePath(PANEL, 'layout');
    return { draftToken };
  }, 'Taslağa kaydedildi. Sitede görünmesi için "Yayınla"ya basın.');
}

export async function updateOfficeSiteBrand(input: BrandInput, expected?: string | null): Promise<ActionResult<SavedDraft>> {
  return runAction(async () => {
    const ctx = await editor();
    const draftToken = await saveBrandDraft(ctx.supabase, ctx.org.id, input, expected);
    revalidatePath(PANEL, 'layout');
    return { draftToken };
  }, 'Taslağa kaydedildi. Sitede görünmesi için "Yayınla"ya basın.');
}

export async function applyOfficeDesignFamily(familyId: string, expected?: string | null): Promise<ActionResult<SavedDraft>> {
  return runAction(async () => {
    const ctx = await editor();
    const access = await selectableFamilies(ctx.supabase, ctx.org.id);
    const draftToken = await applyFamilyToDraft(ctx.supabase, ctx.org.id, familyId, access.families, expected);
    revalidatePath(PANEL, 'layout');
    return { draftToken };
  }, 'Tasarım taslağa uygulandı. Önizleyip "Yayınla"ya basın.');
}

export async function publishOfficeSite(note?: string): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const ctx = await editor();
    const version = await publishDraft(ctx.supabase, ctx.org.id, note);
    refreshPublicSite(ctx.org.id);
    revalidatePath(PANEL, 'layout');
    return { version };
  }, 'Değişiklikler yayınlandı.');
}

export async function rollbackOfficeSite(version: number): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const ctx = await editor();
    const next = await rollbackToVersion(ctx.supabase, ctx.org.id, version);
    refreshPublicSite(ctx.org.id);
    revalidatePath(PANEL, 'layout');
    return { version: next };
  }, 'Seçilen sürüm geri yüklendi ve yayınlandı.');
}

export async function discardOfficeSiteDraft(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await editor();
    await discardDraft(ctx.supabase, ctx.org.id);
    revalidatePath(PANEL, 'layout');
    return null;
  }, 'Yayınlanmamış değişiklikler geri alındı.');
}

export async function createOfficeSitePreviewLink(path = '/'): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const ctx = await editor();
    return { url: await createPreviewUrl(ctx.supabase, ctx.org.id, path) };
  });
}
