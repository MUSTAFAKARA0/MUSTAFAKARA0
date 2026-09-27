import { getPublishedPosts, getRegionPages } from '@/modules/content/queries';
import { LISTING_TYPE_TO_SLUG, type ListingType } from '@/modules/properties/constants';
import { getInventoryCounts, getRegionCounts, getSitemapProperties } from '@/modules/properties/queries';
import { regionListingPath } from '@/modules/properties/routes';
import { getTenant, tenantUrl } from '@/platform/tenant/tenant';

interface Entry {
  path: string;
  lastModified?: string;
  priority?: number;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Kiracıya özel site haritası (/sitemap.xml → proxy → /t/{kiracı}/sitemap.xml).
 * Yalnızca dizine eklenmesi istenen, içeriği olan sayfalar listelenir: demo,
 * satılmış/kiralanmış ilanlar, favoriler, karşılaştırma, özel seçkiler ve
 * filtre kombinasyonları dahil edilmez.
 */
export async function GET(_request: Request, { params }: RouteContext<'/t/[tenant]/sitemap.xml'>) {
  const tenant = await getTenant(decodeURIComponent((await params).tenant));
  if (!tenant) return new Response('Not found', { status: 404 });

  const [properties, inventory, regionCounts, regions, posts] = await Promise.all([
    getSitemapProperties(tenant.id),
    getInventoryCounts(tenant.id),
    getRegionCounts(tenant.id),
    getRegionPages(tenant.id),
    getPublishedPosts(tenant.id, 500),
  ]);

  const entries: Entry[] = [{ path: '/', priority: 1 }];
  if (inventory.total > 0) entries.push({ path: '/ilanlar', priority: 0.9 });

  for (const lt of ['sale', 'rent'] as ListingType[]) {
    const ltSlug = LISTING_TYPE_TO_SLUG[lt];
    if (inventory.byListingType[lt] > 0) entries.push({ path: `/${ltSlug}`, priority: 0.8 });
    for (const [key, count] of Object.entries(inventory.combos)) {
      const [comboType, slug] = key.split(':');
      if (comboType === lt && count > 0) entries.push({ path: `/${ltSlug}-${slug}`, priority: 0.7 });
    }
  }
  for (const [category, count] of Object.entries(inventory.byCategory)) {
    if (count > 0) entries.push({ path: `/${category}`, priority: 0.7 });
  }

  const districts = new Set<string>();
  for (const c of regionCounts) {
    if (c.count <= 0) continue;
    const districtPath = regionListingPath(c.citySlug, c.districtSlug);
    if (!districts.has(districtPath)) {
      districts.add(districtPath);
      entries.push({ path: districtPath, priority: 0.6 });
    }
    if (c.neighborhoodSlug) entries.push({ path: regionListingPath(c.citySlug, c.districtSlug, c.neighborhoodSlug), priority: 0.5 });
  }

  if (regions.length > 0) {
    entries.push({ path: '/bolgeler', priority: 0.6 });
    for (const r of regions) entries.push({ path: `/bolgeler/${r.slug}`, priority: 0.6 });
  }

  for (const p of properties) entries.push({ path: `/ilan/${p.slug}`, lastModified: p.updated_at, priority: 0.8 });

  if (posts.length > 0) {
    entries.push({ path: '/blog', priority: 0.5 });
    for (const post of posts) entries.push({ path: `/blog/${post.slug}`, lastModified: post.publishedAt, priority: 0.5 });
  }

  for (const path of ['/hakkimizda', '/hizmetlerimiz', '/iletisim', '/degerleme']) entries.push({ path, priority: 0.5 });
  for (const path of ['/kvkk', '/gizlilik-politikasi', '/cerez-politikasi', '/kullanim-kosullari']) entries.push({ path, priority: 0.2 });

  const seen = new Set<string>();
  const urls = entries
    .filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)))
    .map((e) => {
      const lastmod = e.lastModified ? `<lastmod>${new Date(e.lastModified).toISOString()}</lastmod>` : '';
      const priority = e.priority !== undefined ? `<priority>${e.priority.toFixed(1)}</priority>` : '';
      return `<url><loc>${escapeXml(tenantUrl(tenant, e.path))}</loc>${lastmod}${priority}</url>`;
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
