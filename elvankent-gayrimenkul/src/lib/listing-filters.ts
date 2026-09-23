import { ROOM_FILTER_OPTIONS, SORT_OPTIONS, type SortValue } from '@/lib/constants';
import { firstParam, parsePositiveInt } from '@/lib/utils';
import type { ListingType, PropertyCategory } from '@/types/database';

/**
 * İlan arama filtreleri. URL'de Türkçe, kısa ve okunabilir parametrelerle
 * taşınır: /satilik?ilce=etimesgut&mahalle=elvankent&oda=3%2B1&fiyat_max=5000000
 */
export interface ListingFilters {
  listingType?: ListingType;
  category?: PropertyCategory;
  typeSlug?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  minM2?: number;
  maxM2?: number;
  rooms?: string[];
  maxAge?: number;
  furnished?: boolean;
  credit?: boolean;
  complex?: boolean;
  elevator?: boolean;
  parking?: boolean;
  q?: string;
  sort: SortValue;
  page: number;
}

/** URL yolu tarafından sabitlenen filtreler (ör. /satilik-daire) */
export type ListingPreset = Pick<ListingFilters, 'listingType' | 'category' | 'typeSlug' | 'city' | 'district' | 'neighborhood'>;

export const LISTING_TYPE_SLUGS: Record<string, ListingType> = { satilik: 'sale', kiralik: 'rent' };
export const LISTING_TYPE_TO_SLUG: Record<ListingType, string> = { sale: 'satilik', rent: 'kiralik' };
export const CATEGORY_SLUGS: Record<string, PropertyCategory> = { konut: 'konut', isyeri: 'isyeri', arsa: 'arsa' };

type SearchParams = Record<string, string | string[] | undefined>;

const MAX_PRICE = 1_000_000_000_000;

/** Arama sorgusunu PostgREST filtre sözdizimine zarar vermeyecek şekilde temizler. */
function sanitizeQuery(q: string | undefined): string | undefined {
  if (!q) return undefined;
  const cleaned = q
    .replace(/[^\p{L}\p{N}\s\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return cleaned.length >= 2 ? cleaned : undefined;
}

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const safeSlug = (v: string | undefined) => (v && slugPattern.test(v) && v.length <= 80 ? v : undefined);

export function parseListingFilters(sp: SearchParams, preset: ListingPreset = {}): ListingFilters {
  const tip = firstParam(sp.tip);
  const kategori = firstParam(sp.kategori);
  const sortRaw = firstParam(sp.sirala);
  const roomsRaw = firstParam(sp.oda);
  const rooms = roomsRaw
    ?.split(',')
    .map((r) => r.trim())
    .filter((r): r is (typeof ROOM_FILTER_OPTIONS)[number] => (ROOM_FILTER_OPTIONS as readonly string[]).includes(r));
  const flag = (key: string) => (firstParam(sp[key]) === '1' ? true : undefined);

  return {
    listingType: preset.listingType ?? (tip ? LISTING_TYPE_SLUGS[tip] : undefined),
    category: preset.category ?? (kategori ? CATEGORY_SLUGS[kategori] : undefined),
    typeSlug: preset.typeSlug ?? safeSlug(firstParam(sp.emlak)),
    city: preset.city ?? safeSlug(firstParam(sp.il)),
    district: preset.district ?? safeSlug(firstParam(sp.ilce)),
    neighborhood: preset.neighborhood ?? safeSlug(firstParam(sp.mahalle)),
    minPrice: parsePositiveInt(firstParam(sp.fiyat_min), MAX_PRICE),
    maxPrice: parsePositiveInt(firstParam(sp.fiyat_max), MAX_PRICE),
    minM2: parsePositiveInt(firstParam(sp.m2_min), 10_000_000),
    maxM2: parsePositiveInt(firstParam(sp.m2_max), 10_000_000),
    rooms: rooms && rooms.length ? Array.from(new Set(rooms)) : undefined,
    maxAge: parsePositiveInt(firstParam(sp.yas_max), 200),
    furnished: flag('esyali'),
    credit: flag('kredi'),
    complex: flag('site'),
    elevator: flag('asansor'),
    parking: flag('otopark'),
    q: sanitizeQuery(firstParam(sp.q)),
    sort: SORT_OPTIONS.some((o) => o.value === sortRaw) ? (sortRaw as SortValue) : 'yeni',
    page: Math.min(parsePositiveInt(firstParam(sp.sayfa), 10_000) || 1, 10_000) || 1,
  };
}

/**
 * Filtreleri URL arama parametrelerine çevirir. `preset` ile sabitlenmiş
 * alanlar URL'ye yazılmaz (zaten yol içindedir).
 */
export function filtersToSearchParams(f: Partial<ListingFilters>, preset: ListingPreset = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (f.listingType && !preset.listingType) p.set('tip', LISTING_TYPE_TO_SLUG[f.listingType]);
  if (f.category && !preset.category) p.set('kategori', f.category);
  if (f.typeSlug && !preset.typeSlug) p.set('emlak', f.typeSlug);
  if (f.city && !preset.city) p.set('il', f.city);
  if (f.district && !preset.district) p.set('ilce', f.district);
  if (f.neighborhood && !preset.neighborhood) p.set('mahalle', f.neighborhood);
  if (f.minPrice) p.set('fiyat_min', String(f.minPrice));
  if (f.maxPrice) p.set('fiyat_max', String(f.maxPrice));
  if (f.minM2) p.set('m2_min', String(f.minM2));
  if (f.maxM2) p.set('m2_max', String(f.maxM2));
  if (f.rooms?.length) p.set('oda', f.rooms.join(','));
  if (f.maxAge !== undefined && f.maxAge !== null && !Number.isNaN(f.maxAge)) p.set('yas_max', String(f.maxAge));
  if (f.furnished) p.set('esyali', '1');
  if (f.credit) p.set('kredi', '1');
  if (f.complex) p.set('site', '1');
  if (f.elevator) p.set('asansor', '1');
  if (f.parking) p.set('otopark', '1');
  if (f.q) p.set('q', f.q);
  if (f.sort && f.sort !== 'yeni') p.set('sirala', f.sort);
  if (f.page && f.page > 1) p.set('sayfa', String(f.page));
  return p;
}

/** Kullanıcının yol dışında seçtiği filtre sayısı (mobil "Filtrele (3)" rozeti için) */
export function countActiveFilters(f: ListingFilters, preset: ListingPreset = {}): number {
  const p = filtersToSearchParams({ ...f, sort: 'yeni', page: 1 }, preset);
  let n = 0;
  p.forEach(() => n++);
  return n;
}

/**
 * Filtrelere göre en uygun SEO yolunu seçer (ör. satılık + daire → /satilik-daire).
 */
export function canonicalListingPath(f: Pick<ListingFilters, 'listingType' | 'category' | 'typeSlug'>): { path: string; preset: ListingPreset } {
  const lt = f.listingType ? LISTING_TYPE_TO_SLUG[f.listingType] : undefined;
  if (lt && f.typeSlug) return { path: `/${lt}-${f.typeSlug}`, preset: { listingType: f.listingType, typeSlug: f.typeSlug } };
  if (lt && f.category) return { path: `/${lt}-${f.category}`, preset: { listingType: f.listingType, category: f.category } };
  if (lt) return { path: `/${lt}`, preset: { listingType: f.listingType } };
  if (f.category) return { path: `/${f.category}`, preset: { category: f.category } };
  return { path: '/ilanlar', preset: {} };
}
