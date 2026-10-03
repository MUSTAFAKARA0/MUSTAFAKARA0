import 'server-only';
import type { SearchOptions } from '@/modules/properties/search-types';
import { getRegionCounts } from '@/modules/properties/queries';
import { getTaxonomy } from '@/modules/properties/taxonomy';

/** Arama formları için seçenekler: yalnızca bu kiracının yayında ilanı olan konumlar */
export async function getSearchOptions(orgId: string): Promise<SearchOptions> {
  const [tax, counts] = await Promise.all([getTaxonomy(), getRegionCounts(orgId)]);
  const districts = new Map<string, { slug: string; name: string; citySlug: string; count: number }>();
  const neighborhoods = new Map<string, { slug: string; name: string; districtSlug: string; count: number }>();
  const cities = new Map<string, { slug: string; name: string }>();

  for (const r of counts) {
    cities.set(r.citySlug, { slug: r.citySlug, name: r.cityName });
    const dKey = `${r.citySlug}/${r.districtSlug}`;
    const d = districts.get(dKey) ?? { slug: r.districtSlug, name: r.districtName, citySlug: r.citySlug, count: 0 };
    d.count += r.count;
    districts.set(dKey, d);
    if (r.neighborhoodSlug && r.neighborhoodName) {
      const nKey = `${dKey}/${r.neighborhoodSlug}`;
      const n = neighborhoods.get(nKey) ?? { slug: r.neighborhoodSlug, name: r.neighborhoodName, districtSlug: r.districtSlug, count: 0 };
      n.count += r.count;
      neighborhoods.set(nKey, n);
    }
  }

  const collator = new Intl.Collator('tr');
  return {
    cities: [...cities.values()].sort((a, b) => collator.compare(a.name, b.name)),
    districts: [...districts.values()].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name)),
    neighborhoods: [...neighborhoods.values()].sort((a, b) => collator.compare(a.name, b.name)),
    types: tax.propertyTypes.map((t) => ({ slug: t.slug, name: t.name, category: t.category })),
  };
}
