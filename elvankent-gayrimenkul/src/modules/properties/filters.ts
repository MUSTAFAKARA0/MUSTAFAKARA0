import { firstParam, parsePositiveInt } from '@/lib/utils';
import {
  CATEGORY_SLUGS,
  DEED_STATUS_OPTIONS,
  FLOOR_FILTER_OPTIONS,
  HEATING_OPTIONS,
  LISTING_TYPE_SLUGS,
  LISTING_TYPE_TO_SLUG,
  ROOM_FILTER_OPTIONS,
  SORT_OPTIONS,
  type ListingType,
  type PropertyCategory,
  type RoomFilter,
  type SortValue,
} from '@/modules/properties/constants';

/**
 * İlan arama sorgusu. URL ile birebir senkronizedir (paylaşılabilir,
 * yer imine eklenebilir). Parametreler Türkçe ve kısadır:
 *
 *   /ilanlar?tip=satilik&ilce=cankaya&mahalle=kizilay&oda=3%2B1,4%2B1
 *           &fiyat_min=3000000&fiyat_max=6000000&kredi=1&sirala=fiyat-artan
 *
 * Bu tip, ileride doğal dil araması ("Kızılay'da 3+1, 4 milyon civarı")
 * eklendiğinde ayrıştırıcının üreteceği yapıdır (bkz. modules/search).
 */
export interface ListingQuery {
  listingType?: ListingType;
  category?: PropertyCategory;
  /** Emlak tipi slug'ları (daire, villa, ofis...) */
  types?: string[];
  city?: string;
  district?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  minM2?: number;
  maxM2?: number;
  rooms?: RoomFilter[];
  maxAge?: number;
  heating?: string;
  deed?: string;
  floor?: string;
  furnished?: boolean;
  credit?: boolean;
  complex?: boolean;
  elevator?: boolean;
  parking?: boolean;
  balcony?: boolean;
  seaView?: boolean;
  investment?: boolean;
  isNew?: boolean;
  priceDrop?: boolean;
  featured?: boolean;
  q?: string;
  sort: SortValue;
  page: number;
}

/** URL yolunda sabitlenen alanlar (ör. /satilik-daire, /ankara-cankaya) */
export type ListingPreset = Pick<ListingQuery, 'listingType' | 'category' | 'types' | 'city' | 'district' | 'neighborhood'>;

type SearchParams = Record<string, string | string[] | undefined>;

const MAX_PRICE = 1_000_000_000_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const safeSlug = (v: string | undefined) => (v && SLUG.test(v) && v.length <= 80 ? v : undefined);
const inOptions = (v: string | undefined, options: { value: string }[]) =>
  v && options.some((o) => o.value === v) ? v : undefined;

/**
 * Serbest metni PostgREST filtre sözdizimine zarar vermeyecek şekilde temizler:
 * yalnızca harf, rakam, boşluk ve tire kalır (virgül/parantez/nokta yok).
 */
export function sanitizeSearchText(q: string | undefined, max = 60): string | undefined {
  if (!q) return undefined;
  const cleaned = q
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return cleaned.length >= 2 ? cleaned : undefined;
}

/** İlan numarası (EKG-2026-0001) biçiminde mi? */
export function asReferenceNo(q: string | undefined): string | undefined {
  if (!q) return undefined;
  const v = q.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]{2,5}-\d{4}-\d{4,}$/.test(v) ? v : undefined;
}

export function parseListingQuery(sp: SearchParams, preset: ListingPreset = {}): ListingQuery {
  const tip = firstParam(sp.tip);
  const kategori = firstParam(sp.kategori);
  const sortRaw = firstParam(sp.sirala);
  const rooms = firstParam(sp.oda)
    ?.split(',')
    .map((r) => r.trim().replace(' ', '+'))
    .filter((r): r is RoomFilter => (ROOM_FILTER_OPTIONS as readonly string[]).includes(r));
  const types = firstParam(sp.emlak)
    ?.split(',')
    .map((t) => safeSlug(t.trim()))
    .filter((t): t is string => Boolean(t))
    .slice(0, 8);
  const flag = (key: string) => (firstParam(sp[key]) === '1' ? true : undefined);
  const rawQ = firstParam(sp.q);

  return {
    listingType: preset.listingType ?? (tip ? LISTING_TYPE_SLUGS[tip] : undefined),
    category: preset.category ?? (kategori ? CATEGORY_SLUGS[kategori] : undefined),
    types: preset.types ?? (types?.length ? Array.from(new Set(types)) : undefined),
    city: preset.city ?? safeSlug(firstParam(sp.il)),
    district: preset.district ?? safeSlug(firstParam(sp.ilce)),
    neighborhood: preset.neighborhood ?? safeSlug(firstParam(sp.mahalle)),
    minPrice: parsePositiveInt(firstParam(sp.fiyat_min), MAX_PRICE),
    maxPrice: parsePositiveInt(firstParam(sp.fiyat_max), MAX_PRICE),
    minM2: parsePositiveInt(firstParam(sp.m2_min), 10_000_000),
    maxM2: parsePositiveInt(firstParam(sp.m2_max), 10_000_000),
    rooms: rooms?.length ? Array.from(new Set(rooms)) : undefined,
    maxAge: parsePositiveInt(firstParam(sp.yas_max), 200),
    heating: inOptions(firstParam(sp.isitma), HEATING_OPTIONS),
    deed: inOptions(firstParam(sp.tapu), DEED_STATUS_OPTIONS),
    floor: inOptions(firstParam(sp.kat), FLOOR_FILTER_OPTIONS),
    furnished: flag('esyali'),
    credit: flag('kredi'),
    complex: flag('site'),
    elevator: flag('asansor'),
    parking: flag('otopark'),
    balcony: flag('balkon'),
    seaView: flag('deniz'),
    investment: flag('yatirim'),
    isNew: flag('yeni'),
    priceDrop: flag('fiyat_dustu'),
    featured: flag('one_cikan'),
    q: asReferenceNo(rawQ) ?? sanitizeSearchText(rawQ),
    sort: SORT_OPTIONS.some((o) => o.value === sortRaw) ? (sortRaw as SortValue) : 'yeni',
    page: Math.min(parsePositiveInt(firstParam(sp.sayfa), 10_000) || 1, 10_000) || 1,
  };
}

/** Sorguyu URL parametrelerine çevirir. Yolda sabitlenmiş alanlar yazılmaz. */
export function listingQueryToParams(f: Partial<ListingQuery>, preset: ListingPreset = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (f.listingType && !preset.listingType) p.set('tip', LISTING_TYPE_TO_SLUG[f.listingType]);
  if (f.category && !preset.category) p.set('kategori', f.category);
  if (f.types?.length && !preset.types) p.set('emlak', f.types.join(','));
  if (f.city && !preset.city) p.set('il', f.city);
  if (f.district && !preset.district) p.set('ilce', f.district);
  if (f.neighborhood && !preset.neighborhood) p.set('mahalle', f.neighborhood);
  if (f.minPrice) p.set('fiyat_min', String(f.minPrice));
  if (f.maxPrice) p.set('fiyat_max', String(f.maxPrice));
  if (f.minM2) p.set('m2_min', String(f.minM2));
  if (f.maxM2) p.set('m2_max', String(f.maxM2));
  if (f.rooms?.length) p.set('oda', f.rooms.join(','));
  if (f.maxAge !== undefined && Number.isFinite(f.maxAge)) p.set('yas_max', String(f.maxAge));
  if (f.heating) p.set('isitma', f.heating);
  if (f.deed) p.set('tapu', f.deed);
  if (f.floor) p.set('kat', f.floor);
  if (f.furnished) p.set('esyali', '1');
  if (f.credit) p.set('kredi', '1');
  if (f.complex) p.set('site', '1');
  if (f.elevator) p.set('asansor', '1');
  if (f.parking) p.set('otopark', '1');
  if (f.balcony) p.set('balkon', '1');
  if (f.seaView) p.set('deniz', '1');
  if (f.investment) p.set('yatirim', '1');
  if (f.isNew) p.set('yeni', '1');
  if (f.priceDrop) p.set('fiyat_dustu', '1');
  if (f.featured) p.set('one_cikan', '1');
  if (f.q) p.set('q', f.q);
  if (f.sort && f.sort !== 'yeni') p.set('sirala', f.sort);
  if (f.page && f.page > 1) p.set('sayfa', String(f.page));
  return p;
}

/** Kullanıcının yol dışında seçtiği filtre sayısı ("Filtreler (3)" rozeti) */
export function countActiveFilters(f: ListingQuery, preset: ListingPreset = {}): number {
  const p = listingQueryToParams({ ...f, sort: 'yeni', page: 1, q: undefined }, preset);
  let n = 0;
  p.forEach(() => n++);
  return n;
}

/** Filtrelere göre en uygun SEO yolu (satılık + daire → /satilik-daire) */
export function canonicalListingPath(f: Pick<ListingQuery, 'listingType' | 'category' | 'types'>): {
  path: string;
  preset: ListingPreset;
} {
  const lt = f.listingType ? LISTING_TYPE_TO_SLUG[f.listingType] : undefined;
  const singleType = f.types?.length === 1 ? f.types[0] : undefined;
  if (lt && singleType) return { path: `/${lt}-${singleType}`, preset: { listingType: f.listingType, types: [singleType] } };
  if (lt && f.category) return { path: `/${lt}-${f.category}`, preset: { listingType: f.listingType, category: f.category } };
  if (lt) return { path: `/${lt}`, preset: { listingType: f.listingType } };
  if (f.category) return { path: `/${f.category}`, preset: { category: f.category } };
  return { path: '/ilanlar', preset: {} };
}

/** Listeleme sayfasının adresi (yol + sorgu) */
export function listingHref(f: Partial<ListingQuery>): string {
  const { path, preset } = canonicalListingPath({ listingType: f.listingType, category: f.category, types: f.types });
  const qs = listingQueryToParams({ ...f, sort: f.sort ?? 'yeni', page: f.page ?? 1 }, preset).toString();
  return qs ? `${path}?${qs}` : path;
}
