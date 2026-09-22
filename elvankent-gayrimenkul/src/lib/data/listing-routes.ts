import 'server-only';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS } from '@/lib/constants';
import { CATEGORY_SLUGS, LISTING_TYPE_SLUGS, type ListingPreset } from '@/lib/listing-filters';
import { getTaxonomy } from '@/lib/data/taxonomy';
import { resolveRegionFromTaxonomy, type ResolvedRegion } from '@/lib/data/regions';

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

const REGION_TEXT = 'Etimesgut, Elvankent, Eryaman ve Ankara genelinde';

/**
 * Tek segmentli yolları çözer:
 *  /ilanlar, /satilik, /kiralik, /konut, /arsa, /isyeri,
 *  /satilik-konut, /kiralik-isyeri, /satilik-daire, /kiralik-ofis …
 *  /ankara, /ankara-etimesgut, /ankara-etimesgut-elvankent (bölge sayfaları)
 */
export async function resolveListingRoute(slug: string): Promise<ListingRoute | null> {
  const path = `/${slug}`;

  if (slug === 'ilanlar') {
    return {
      kind: 'listing',
      path,
      preset: {},
      heading: 'Tüm Emlak İlanları',
      label: 'Tüm İlanlar',
      description: `${REGION_TEXT} satılık ve kiralık konut, iş yeri ve arsa ilanları.`,
    };
  }

  const lt = LISTING_TYPE_SLUGS[slug];
  if (lt) {
    const l = LISTING_TYPE_LABELS[lt];
    return {
      kind: 'listing',
      path,
      preset: { listingType: lt },
      heading: `${l} Emlak İlanları`,
      label: l,
      description: `${REGION_TEXT} ${l.toLocaleLowerCase('tr-TR')} daire, müstakil ev, iş yeri ve arsa ilanları.`,
    };
  }

  const cat = CATEGORY_SLUGS[slug];
  if (cat) {
    const c = CATEGORY_LABELS[cat];
    return {
      kind: 'listing',
      path,
      preset: { category: cat },
      heading: `${c} İlanları`,
      label: c,
      description: `${REGION_TEXT} satılık ve kiralık ${c.toLocaleLowerCase('tr-TR')} ilanları.`,
    };
  }

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
        heading: `${l} ${c} İlanları`,
        label: `${l} ${c}`,
        description: `${REGION_TEXT} ${l.toLocaleLowerCase('tr-TR')} ${c.toLocaleLowerCase('tr-TR')} ilanları.`,
      };
    }
    const tax = await getTaxonomy();
    const type = tax.propertyTypes.find((t) => t.slug === rest);
    if (type) {
      return {
        kind: 'listing',
        path,
        preset: { listingType, typeSlug: type.slug },
        heading: `${l} ${type.name} İlanları`,
        label: `${l} ${type.name}`,
        description: `${REGION_TEXT} ${l.toLocaleLowerCase('tr-TR')} ${type.name.toLocaleLowerCase('tr-TR')} ilanları.`,
      };
    }
    return null;
  }

  const tax = await getTaxonomy();
  const region = resolveRegionFromTaxonomy(slug, tax);
  if (region) {
    return {
      kind: 'region',
      path: region.path,
      preset: {
        city: region.city.slug,
        district: region.district?.slug,
        neighborhood: region.neighborhood?.slug,
      },
      heading: `${region.name} Satılık ve Kiralık Emlak İlanları`,
      label: region.name,
      description: `${region.fullName} bölgesindeki satılık ve kiralık daire, ev, iş yeri ve arsa ilanları. Güncel fiyatlar ve detaylı bilgiler.`,
      region,
    };
  }
  return null;
}
