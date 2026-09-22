import 'server-only';
import type { Taxonomy } from '@/lib/data/taxonomy';
import type { City, District, Neighborhood } from '@/types/database';

export interface ResolvedRegion {
  city: City;
  district?: District;
  neighborhood?: Neighborhood;
  name: string;
  fullName: string;
  path: string;
}

export function regionPath(city: string, district?: string, neighborhood?: string): string {
  return `/${[city, district, neighborhood].filter(Boolean).join('-')}`;
}

/**
 * "ankara-etimesgut-elvankent" gibi bölge slug'ını il/ilçe/mahalleye çözer.
 * Slug'lar tire içerebildiği için olası tüm bölmeler denenir.
 */
export function resolveRegionFromTaxonomy(slug: string, tax: Taxonomy): ResolvedRegion | null {
  for (const city of tax.cities) {
    if (slug === city.slug) {
      return { city, name: city.name, fullName: city.name, path: regionPath(city.slug) };
    }
    if (!slug.startsWith(`${city.slug}-`)) continue;
    const rest = slug.slice(city.slug.length + 1);
    for (const district of tax.districts.filter((d) => d.city_id === city.id)) {
      if (rest === district.slug) {
        return {
          city,
          district,
          name: district.name,
          fullName: `${city.name} ${district.name}`,
          path: regionPath(city.slug, district.slug),
        };
      }
      if (!rest.startsWith(`${district.slug}-`)) continue;
      const nSlug = rest.slice(district.slug.length + 1);
      const neighborhood = tax.neighborhoods.find((n) => n.district_id === district.id && n.slug === nSlug);
      if (neighborhood) {
        return {
          city,
          district,
          neighborhood,
          name: neighborhood.name,
          fullName: `${city.name} ${district.name} ${neighborhood.name}`,
          path: regionPath(city.slug, district.slug, neighborhood.slug),
        };
      }
    }
  }
  return null;
}
