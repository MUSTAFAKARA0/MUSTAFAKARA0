'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { requirePermission } from '@/platform/auth/session';
import { parseSiteConfig } from '@/site-config/schema';
import { compileDesign } from '@/site-factory/compile';
import { findDesignFamily } from '@/site-factory/families';
import type { Json } from '@/types/supabase';

/**
 * OFİS YÖNETİCİSİ: kendi sitesinin tasarımını KARAY'ın izin verdiği bir aileyle değiştirir.
 *
 * Kiracı kimliği istemciden ALINMAZ (oturumun ofisi). Yetki üç katmanda doğrulanır:
 * requirePermission('settings.manage') → aile kapalı katalogda mı → veritabanı (site_apply_design):
 * settings.manage + aile bu ofise izinli ve global açık + yalnızca tasarım bölümleri. Tasarım
 * hemen yayınlanır; marka, menü, sayfalar, SEO ve KARAY'ın bekleyen taslağı değişmez.
 */
export async function applyOfficeDesign(familyId: string): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const family = typeof familyId === 'string' ? findDesignFamily(familyId) : null;
    if (!family) throw new ActionError('Geçersiz tasarım.');
    const ctx = await requirePermission('settings.manage');
    const { data: site, error: readError } = await ctx.supabase.from('site_configs').select('published').eq('organization_id', ctx.org.id).maybeSingle();
    assertNoDbError(readError);
    if (!site) throw new ActionError('Site bulunamadı.');
    const sections = compileDesign(family, parseSiteConfig(site.published));
    const { data, error } = await ctx.supabase.rpc('site_apply_design', { p_org: ctx.org.id, p_family: family.id, p_sections: sections as unknown as Json });
    if (error?.code === '42501') throw new ActionError('Bu tasarım ofisiniz için açık değil.');
    assertNoDbError(error);
    updateTag(cacheTags.org(ctx.org.id));
    updateTag(cacheTags.tenants);
    revalidatePath('/admin/tasarim');
    return { version: data as number };
  }, 'Tasarım uygulandı ve sitenizde yayınlandı.');
}
