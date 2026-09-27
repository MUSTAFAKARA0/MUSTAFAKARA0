import 'server-only';
import {
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  LISTING_TYPE_LABELS,
  LISTING_TYPE_SLUGS,
} from '@/modules/properties/constants';
import type { ListingPreset } from '@/modules/properties/filters';
import { getTaxonomy, type City, type District, type Neighborhood, type Taxonomy } from '@/modules/properties/taxonomy';

export interface ResolvedRegion {
  city: City;
  district?: District;
  neighborhood?: Neighborhood;
  name: string;
  fullName: string;
  path: string;
}

export interface ListingRoute {
  kind: 'listing' | 'region';
  path: string;
  preset: ListingPreset;
  /** Sayfa başlığı (h1) */
  heading: string;
  /** Kısa başlık (breadcrumb, meta) */
  label: string;
  description: string;
  region?: ResolvedRegion;
}

export function regionListingPath(city: string, district?: string | null, neighborhood?: string | null): string {
  return `/${[city, district, neighborhood].filter(Boolean).join('-')}`;
}

/** "ankara-etimesgut-elvankent" → il/ilçe/mahalle (slug'lar tire içerebildiği için tüm bölmeler denenir) */
export function resolveRegionSlug(slug: string, tax: Taxonomy): ResolvedRegion | null {
  for (const city of tax.cities) {
    if (slug === city.slug) return { city, name: city.name, fullName: city.name, path: regionListingPath(city.slug) };
    if (!slug.startsWith(`${city.slug}-`)) continue;
    const rest = slug.slice(city.slug.length + 1);
    for (const district of tax.districts.filter((d) => d.city_id === city.id)) {
      if (rest === district.slug) {
        return { city, district, name: district.name, fullName: `${city.name} ${district.name}`, path: regionListingPath(city.slug, district.slug) };
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
          fullName: `${district.name}, ${neighborhood.name}`,
          path: regionListingPath(city.slug, district.slug, neighborhood.slug),
        };
      }
    }
  }
  return null;
}

const lower = (s: string) => s.toLocaleLowerCase('tr-TR');

/**
 * Tek segmentli listeleme yollarını çözer:
 *   /ilanlar, /satilik, /kiralik, /konut, /ticari, /arsa, /diger,
 *   /satilik-konut, /kiralik-ticari, /satilik-daire, /kiralik-ofis …
 *   /ankara, /ankara-etimesgut, /ankara-etimesgut-elvankent (bölge filtreleri)
 * `serviceArea`: kiracının hizmet bölgesi metni (ör. "Etimesgut ve Ankara genelinde").
 */
export async function resolveListingRoute(slug: string, serviceArea: string | null): Promise<ListingRoute | null> {
  const path = `/${slug}`;
  const area = serviceArea ? `${serviceArea} ` : '';

  if (slug === 'ilanlar') {
    return {
      kind: 'listing',
      path,
      preset: {},
      heading: 'Tüm ilanlar',
      label: 'Tüm ilanlar',
      description: `${area}satılık ve kiralık konut, ticari gayrimenkul ve arsa ilanları.`.trim(),
    };
  }

  const lt = LISTING_TYPE_SLUGS[slug];
  if (lt) {
    const l = LISTING_TYPE_LABELS[lt];
    return {
      kind: 'listing',
      path,
      preset: { listingType: lt },
      heading: `${l} gayrimenkuller`,
      label: l,
      description: `${area}${lower(l)} daire, villa, müstakil ev, ticari gayrimenkul ve arsa ilanları.`,
    };
  }

  const cat = CATEGORY_SLUGS[slug];
  if (cat) {
    const c = CATEGORY_LABELS[cat];
    return {
      kind: 'listing',
      path,
      preset: { category: cat },
      heading: `${c} ilanları`,
      label: c,
      description: `${area}satılık ve kiralık ${lower(c)} ilanları.`,
    };
  }

  const tax = await getTaxonomy();
  const m = /^(satilik|kiralik)-(.+)$/.exec(slug);
  if (m) {
    const listingType = LISTING_TYPE_SLUGS[m[1]];
    const l = LISTING_TYPE_LABELS[listingType];
    const rest = m[2];
    const category = CATEGORY_SLUGS[rest];
    if (category) {
      const c = CATEGORY_LABELS[category];
      return {
        kind: 'listing',
        path,
        preset: { listingType, category },
        heading: `${l} ${lower(c)} ilanları`,
        label: `${l} ${lower(c)}`,
        description: `${area}${lower(l)} ${lower(c)} ilanları.`,
      };
    }
    const type = tax.propertyTypes.find((t) => t.slug === rest);
    if (type) {
      return {
        kind: 'listing',
        path,
        preset: { listingType, types: [type.slug] },
        heading: `${l} ${lower(type.name)}`,
        label: `${l} ${lower(type.name)}`,
        description: `${area}${lower(l)} ${lower(type.name)} ilanları: fiyat, m², oda sayısı ve konum bilgileriyle.`,
      };
    }
    return null;
  }

  const region = resolveRegionSlug(slug, tax);
  if (region) {
    return {
      kind: 'region',
      path: region.path,
      preset: { city: region.city.slug, district: region.district?.slug, neighborhood: region.neighborhood?.slug },
      heading: `${region.name} satılık ve kiralık ilanlar`,
      label: region.name,
      description: `${region.fullName} bölgesindeki satılık ve kiralık daire, ev, ticari gayrimenkul ve arsa ilanları.`,
      region,
    };
  }
  return null;
}
