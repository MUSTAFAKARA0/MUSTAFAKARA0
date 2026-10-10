import 'server-only';
import { notFound } from 'next/navigation';
import { getPublishedPosts, getRegionPages } from '@/modules/content/queries';
import { parseListingQuery } from '@/modules/properties/filters';
import { getInventoryCounts, getLatestProperties, getMapPoints, getPublicPropertyBySlug, getRegionCounts, getShowcaseProperties, getSimilarProperties, searchProperties } from '@/modules/properties/queries';
import { resolveListingRoute } from '@/modules/properties/routes';
import { getSearchOptions } from '@/modules/properties/search-options';
import { patternNeeds } from '@/components/patterns/resolver';
import { selectableFamilies } from '@/modules/platform/design-access';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant, type Tenant } from '@/platform/tenant/tenant';
import { publishedSiteView, type SiteView } from '@/site-config/load';
import { parseSiteConfig } from '@/site-config/schema';
import { compileDesign } from '@/site-factory/compile';
import { findDesignFamily } from '@/site-factory/families';
import type { PreviewContent } from '@/site-preview/render';
import type { PreviewSurface } from '@/site-preview/surfaces';
import { resolveStyle } from '@/theme-engine/themes';

/**
 * OFİS TASARIM ÖNİZLEMESİ (D7.2): ofis yöneticisi, KARAY'ın kendisine açtığı bir tasarım ailesini
 * YAYINLAMADAN kendi sitesinin GERÇEK verisiyle görür.
 *
 * Güvenlik:
 *  - Kiracı istemciden ALINMAZ: oturumun ofisi (requirePagePermission('settings.manage')).
 *    KARAY (platform) oturumu ofis bağlamı alamaz → süper admin bu yoldan hiçbir ofisi göremez.
 *  - Aile yalnızca ofise izinli ve global açık ailelerden biri olabilir (org_design_family_access;
 *    üyelik veritabanında doğrulanır). Değilse 404.
 *  - Veri: yalnızca bu ofisin herkese açık (yayındaki) ilanları ve içerikleri. Örnek/uydurma ilan,
 *    danışman veya yorum üretilmez; gösterilecek ilan yoksa boş durum gösterilir.
 *  - Hiçbir şey yazılmaz (taslak veya yayın değişmez).
 */
export interface OfficePreview {
  tenant: Tenant;
  view: SiteView;
  family: { id: string; name: string };
  regions: { slug: string; name: string }[];
  hasBlog: boolean;
  content: PreviewContent;
}

export async function loadOfficePreview(familyId: unknown, surface: PreviewSurface): Promise<OfficePreview> {
  const ctx = await requirePagePermission('settings.manage');
  const family = typeof familyId === 'string' ? findDesignFamily(familyId) : null;
  if (!family) notFound();
  const [access, site, tenant] = await Promise.all([
    selectableFamilies(ctx.supabase, ctx.org.id),
    ctx.supabase.from('site_configs').select('published').eq('organization_id', ctx.org.id).maybeSingle(),
    getTenant(ctx.org.slug),
  ]);
  if (!access.families.includes(family.id) || !tenant || tenant.id !== ctx.org.id) notFound();

  // Uygulandığında yayına çıkacak yapılandırmanın AYNISI (applyOfficeDesign ile aynı derleme)
  const current = parseSiteConfig(site.data?.published ?? tenant.site.published);
  const config = parseSiteConfig({ ...current, ...compileDesign(family, current) });
  const view: SiteView = { ...publishedSiteView(tenant), config, style: resolveStyle(config), status: 'active', maintenanceMessage: null, preview: true };

  const [posts, regionPages] = await Promise.all([getPublishedPosts(tenant.id, 3), getRegionPages(tenant.id)]);
  const content: PreviewContent = {};
  if (surface === 'ana-sayfa') {
    const [showcase, latestPool, inventory, options, regionCounts] = await Promise.all([
      getShowcaseProperties(tenant.id, 4),
      getLatestProperties(tenant.id, 24),
      getInventoryCounts(tenant.id),
      getSearchOptions(tenant.id),
      getRegionCounts(tenant.id),
    ]);
    content.home = { showcase, latestPool, inventory, options, regions: regionPages, regionCounts, posts };
  } else if (surface === 'ilanlar') {
    const route = (await resolveListingRoute('ilanlar', tenant.settings.service_area))!;
    const query = parseListingQuery({}, route.preset);
    const [result, options] = await Promise.all([searchProperties(tenant.id, query), getSearchOptions(tenant.id)]);
    const mapPoints = patternNeeds(view, 'map-points') ? await getMapPoints(tenant.id, result.items.map((i) => i.id)) : undefined;
    content.listing = { route, query, options, result, regionPage: null, hrefFor: () => route.path, mapPoints };
  } else {
    // Ofisin en son yayınlanan ilanı (gerçek veri); yoksa boş durum
    const [latest] = await getLatestProperties(tenant.id, 1);
    const property = latest ? await getPublicPropertyBySlug(tenant.id, latest.slug) : null;
    content.detail = property ? { property, similar: await getSimilarProperties(tenant.id, property.id, 4) } : null;
  }
  return {
    tenant,
    view,
    family: { id: family.id, name: family.name },
    regions: regionPages.map((r) => ({ slug: r.slug, name: r.name })),
    hasBlog: posts.length > 0 && view.features.blog,
    content,
  };
}
