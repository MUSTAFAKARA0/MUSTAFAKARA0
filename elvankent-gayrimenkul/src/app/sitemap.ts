import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/env';
import { getRegionCounts, getSitemapProperties } from '@/lib/data/properties';
import { regionPath } from '@/lib/data/regions';

export const revalidate = 3600;

/**
 * Site haritası: sabit sayfalar, kategori sayfaları, ilanı olan bölge
 * sayfaları ve yayındaki tüm ilanlar. Boş/ince sayfalar eklenmez.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1, lastModified: now },
    ...['/satilik', '/kiralik', '/konut', '/arsa', '/isyeri', '/ilanlar', '/satilik-daire', '/kiralik-daire'].map((p) => ({
      url: absoluteUrl(p),
      changeFrequency: 'daily' as const,
      priority: 0.8,
      lastModified: now,
    })),
    ...['/hakkimizda', '/hizmetlerimiz', '/iletisim'].map((p) => ({ url: absoluteUrl(p), changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...['/kvkk', '/gizlilik-politikasi', '/cerez-politikasi', '/kullanim-kosullari'].map((p) => ({
      url: absoluteUrl(p),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
  ];

  const [properties, regions] = await Promise.all([getSitemapProperties(), getRegionCounts()]);

  const regionUrls = new Set<string>();
  for (const r of regions) {
    regionUrls.add(regionPath(r.city_slug));
    regionUrls.add(regionPath(r.city_slug, r.district_slug));
    if (r.neighborhood_slug) regionUrls.add(regionPath(r.city_slug, r.district_slug, r.neighborhood_slug));
  }

  return [
    ...staticPages,
    ...[...regionUrls].map((p) => ({ url: absoluteUrl(p), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...properties.map((p) => ({
      url: absoluteUrl(`/ilan/${p.slug}`),
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
