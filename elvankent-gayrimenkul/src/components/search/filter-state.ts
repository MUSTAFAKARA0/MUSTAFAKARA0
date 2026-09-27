import type { ListingQuery } from '@/modules/properties/filters';
import type { ListingType, PropertyCategory, RoomFilter } from '@/modules/properties/constants';

/** Form taslağı: kullanıcı "Sonuçları göster" diyene kadar URL değişmez */
export interface FilterDraft {
  listingType: '' | ListingType;
  category: '' | PropertyCategory;
  types: string[];
  city: string;
  district: string;
  neighborhood: string;
  minPrice: string;
  maxPrice: string;
  minM2: string;
  maxM2: string;
  rooms: RoomFilter[];
  maxAge: string;
  heating: string;
  deed: string;
  floor: string;
  flags: Record<FlagKey, boolean>;
  q: string;
}

export const FLAG_KEYS = [
  'credit',
  'furnished',
  'complex',
  'elevator',
  'parking',
  'balcony',
  'seaView',
  'investment',
  'isNew',
  'priceDrop',
  'featured',
] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export const FLAG_LABELS: Record<FlagKey, string> = {
  credit: 'Krediye uygun',
  furnished: 'Eşyalı',
  complex: 'Site içinde',
  elevator: 'Asansörlü',
  parking: 'Otoparklı',
  balcony: 'Balkonlu',
  seaView: 'Deniz manzaralı',
  investment: 'Yatırıma uygun',
  isNew: 'Yeni ilanlar',
  priceDrop: 'Fiyatı düşenler',
  featured: 'Öne çıkanlar',
};

export function toDraft(q: ListingQuery): FilterDraft {
  return {
    listingType: q.listingType ?? '',
    category: q.category ?? '',
    types: q.types ?? [],
    city: q.city ?? '',
    district: q.district ?? '',
    neighborhood: q.neighborhood ?? '',
    minPrice: q.minPrice ? String(q.minPrice) : '',
    maxPrice: q.maxPrice ? String(q.maxPrice) : '',
    minM2: q.minM2 ? String(q.minM2) : '',
    maxM2: q.maxM2 ? String(q.maxM2) : '',
    rooms: q.rooms ?? [],
    maxAge: q.maxAge !== undefined ? String(q.maxAge) : '',
    heating: q.heating ?? '',
    deed: q.deed ?? '',
    floor: q.floor ?? '',
    flags: Object.fromEntries(FLAG_KEYS.map((k) => [k, Boolean(q[k])])) as Record<FlagKey, boolean>,
    q: q.q ?? '',
  };
}

const num = (v: string) => (v ? Number(v) : undefined);

export function fromDraft(d: FilterDraft, sort: ListingQuery['sort']): ListingQuery {
  const minPrice = num(d.minPrice);
  const maxPrice = num(d.maxPrice);
  const minM2 = num(d.minM2);
  const maxM2 = num(d.maxM2);
  return {
    listingType: d.listingType || undefined,
    category: d.types.length ? undefined : d.category || undefined,
    types: d.types.length ? d.types : undefined,
    city: d.city || undefined,
    district: d.district || undefined,
    neighborhood: d.neighborhood || undefined,
    // Min > max girilirse kullanıcı hatası düzeltilir
    minPrice: minPrice && maxPrice && minPrice > maxPrice ? maxPrice : minPrice,
    maxPrice: minPrice && maxPrice && minPrice > maxPrice ? minPrice : maxPrice,
    minM2: minM2 && maxM2 && minM2 > maxM2 ? maxM2 : minM2,
    maxM2: minM2 && maxM2 && minM2 > maxM2 ? minM2 : maxM2,
    rooms: d.rooms.length ? d.rooms : undefined,
    maxAge: d.maxAge ? Number(d.maxAge) : undefined,
    heating: d.heating || undefined,
    deed: d.deed || undefined,
    floor: d.floor || undefined,
    ...Object.fromEntries(FLAG_KEYS.map((k) => [k, d.flags[k] || undefined])),
    q: d.q.trim() || undefined,
    sort,
    page: 1,
  };
}
