import 'server-only';
import { cache } from 'react';
import { cacheTags } from '@/lib/cache-tags';
import { isSupabaseConfigured } from '@/lib/env';
import { createPublicClient, type DB } from '@/lib/supabase/server';
import { isUuid, one, toNumber } from '@/lib/utils';
import {
  NEW_LISTING_DAYS,
  PAGE_SIZE,
  PRICE_DROP_DAYS,
  type CurrencyCode,
  type ListingStatus,
  type ListingType,
  type LocationPrecision,
  type PropertyCategory,
} from '@/modules/properties/constants';
import type { ListingQuery } from '@/modules/properties/filters';
import { getTaxonomy, resolveLocation, type Feature } from '@/modules/properties/taxonomy';
import type { PropertyCard, PropertyDetail, PropertyImage } from '@/modules/properties/types';

const MEDIA_FIELDS = 'id, public_base, legacy_path, variant_widths, width, height, blur_data_url, alt_text, sort_order, is_cover';

const CARD_SELECT = [
  'id, slug, reference_no, title, listing_type, category, status, is_featured, is_demo, price, currency',
  'price_previous, price_dropped_at, gross_m2, net_m2, room_count, rooms_label, floor, total_floors, building_age',
  'published_at, in_complex, has_elevator, credit_eligible, is_furnished, parking, investment_suitable, balcony_count',
  'type:property_types(name, slug), city:cities(name, slug), district:districts(name, slug), neighborhood:neighborhoods(name, slug)',
  `cover:media_assets!media_assets_property_id_fkey(${MEDIA_FIELDS})`,
  // Fotoğraf sayısı: anonim rol için yalnızca izinli sütun (id) seçilir; PostgREST'in
  // gömülü count toplaması tablo düzeyinde yetki ister (bkz. 20260927000001 migration)
  'images:media_assets!media_assets_property_id_fkey(id)',
].join(', ');

type Named = { name: string; slug: string };

interface CardRow {
  id: string;
  slug: string;
  reference_no: string;
  title: string;
  listing_type: ListingType;
  category: PropertyCategory;
  status: ListingStatus;
  is_featured: boolean;
  is_demo: boolean;
  price: number | string | null;
  currency: CurrencyCode;
  price_previous: number | string | null;
  price_dropped_at: string | null;
  gross_m2: number | null;
  net_m2: number | null;
  room_count: number | null;
  rooms_label: string | null;
  floor: string | null;
  total_floors: number | null;
  building_age: number | null;
  published_at: string | null;
  in_complex: boolean | null;
  has_elevator: boolean | null;
  credit_eligible: boolean | null;
  is_furnished: boolean | null;
  parking: string | null;
  investment_suitable: boolean | null;
  balcony_count: number | null;
  type: Named | Named[] | null;
  city: Named | Named[] | null;
  district: Named | Named[] | null;
  neighborhood: Named | Named[] | null;
  cover: PropertyImage[] | null;
  images: { id: string }[] | null;
}

function daysAgo(date: string | null, days: number, now: number): boolean {
  return Boolean(date) && now - new Date(date as string).getTime() <= days * 86_400_000;
}

function highlightsOf(row: CardRow): string[] {
  const list: string[] = [];
  if (row.in_complex) list.push('Site içinde');
  if (row.credit_eligible && row.listing_type === 'sale') list.push('Krediye uygun');
  if (row.is_furnished) list.push('Eşyalı');
  if (row.has_elevator) list.push('Asansörlü');
  if (row.parking && row.parking !== 'yok') list.push('Otoparklı');
  if (row.investment_suitable) list.push('Yatırıma uygun');
  return list.slice(0, 3);
}

export function toCard(row: CardRow, now = Date.now()): PropertyCard {
  const price = toNumber(row.price);
  const pricePrevious = toNumber(row.price_previous);
  const type = one(row.type);
  return {
    id: row.id,
    slug: row.slug,
    referenceNo: row.reference_no,
    title: row.title,
    listingType: row.listing_type,
    category: row.category,
    status: row.status,
    isFeatured: row.is_featured,
    isDemo: row.is_demo,
    price,
    currency: row.currency,
    pricePrevious,
    grossM2: row.gross_m2,
    netM2: row.net_m2,
    roomsLabel: row.rooms_label,
    roomCount: row.room_count,
    floor: row.floor,
    totalFloors: row.total_floors,
    buildingAge: row.building_age,
    publishedAt: row.published_at,
    typeName: type?.name ?? '',
    typeSlug: type?.slug ?? '',
    cityName: one(row.city)?.name ?? '',
    districtName: one(row.district)?.name ?? '',
    neighborhoodName: one(row.neighborhood)?.name ?? null,
    cover: row.cover?.[0] ?? null,
    imageCount: row.images?.length ?? 0,
    highlights: highlightsOf(row),
    isNew: row.status === 'published' && daysAgo(row.published_at, NEW_LISTING_DAYS, now),
    hasPriceDrop:
      row.status === 'published' &&
      price !== null &&
      pricePrevious !== null &&
      price < pricePrevious &&
      daysAgo(row.price_dropped_at, PRICE_DROP_DAYS, now),
  };
}

function client(orgId: string, revalidate = 300) {
  return createPublicClient([cacheTags.properties(orgId)], revalidate);
}

function baseCardQuery(orgId: string, withCount = false) {
  return client(orgId)
    .from('properties')
    .select(CARD_SELECT, withCount ? { count: 'exact' } : undefined)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .eq('cover.is_cover', true);
}

export interface SearchResult {
  items: PropertyCard[];
  total: number;
  page: number;
  pageCount: number;
}

const EMPTY_RESULT = (page = 1): SearchResult => ({ items: [], total: 0, page, pageCount: 0 });

/** Filtrelere göre sayfalı ilan araması (yalnızca yayındaki ilanlar) */
export async function searchProperties(orgId: string, f: ListingQuery, pageSize = PAGE_SIZE): Promise<SearchResult> {
  if (!isSupabaseConfigured()) return EMPTY_RESULT(f.page);
  const tax = await getTaxonomy();
  let query = baseCardQuery(orgId, true).eq('status', 'published');

  if (f.listingType) query = query.eq('listing_type', f.listingType);
  if (f.category) query = query.eq('category', f.category);
  if (f.types?.length) {
    const ids = tax.propertyTypes.filter((t) => f.types?.includes(t.slug)).map((t) => t.id);
    if (!ids.length) return EMPTY_RESULT(f.page);
    query = query.in('property_type_id', ids);
  }

  const loc = resolveLocation(tax, f.city, f.district, f.neighborhood);
  if (loc.invalid) return EMPTY_RESULT(f.page);
  if (loc.city) query = query.eq('city_id', loc.city.id);
  if (loc.district) query = query.eq('district_id', loc.district.id);
  if (loc.neighborhood) query = query.eq('neighborhood_id', loc.neighborhood.id);

  if (f.minPrice !== undefined) query = query.gte('price', f.minPrice);
  if (f.maxPrice !== undefined) query = query.lte('price', f.maxPrice);
  if (f.minM2 !== undefined) query = query.gte('gross_m2', f.minM2);
  if (f.maxM2 !== undefined) query = query.lte('gross_m2', f.maxM2);
  if (f.maxAge !== undefined) query = query.lte('building_age', f.maxAge);
  if (f.heating) query = query.eq('heating', f.heating);
  if (f.deed) query = query.eq('deed_status', f.deed);
  if (f.floor) query = query.eq('floor_position', f.floor);
  if (f.furnished) query = query.eq('is_furnished', true);
  if (f.credit) query = query.eq('credit_eligible', true);
  if (f.complex) query = query.eq('in_complex', true);
  if (f.elevator) query = query.eq('has_elevator', true);
  if (f.parking) query = query.not('parking', 'is', null).neq('parking', 'yok');
  if (f.balcony) query = query.gt('balcony_count', 0);
  if (f.seaView) query = query.contains('views', ['deniz']);
  if (f.investment) query = query.eq('investment_suitable', true);
  if (f.featured) query = query.eq('is_featured', true);
  if (f.isNew) query = query.gte('published_at', new Date(Date.now() - NEW_LISTING_DAYS * 86_400_000).toISOString());
  if (f.priceDrop) query = query.gte('price_dropped_at', new Date(Date.now() - PRICE_DROP_DAYS * 86_400_000).toISOString());

  if (f.rooms?.length) {
    const exact = f.rooms.filter((r) => r !== '5+');
    const parts: string[] = [];
    if (exact.length) parts.push(`rooms_label.in.(${exact.join(',')})`);
    if (f.rooms.includes('5+')) parts.push('room_count.gte.5');
    query = query.or(parts.join(','));
  }

  if (f.q) {
    if (/^[A-Z]{2,5}-\d{4}-\d{4,}$/.test(f.q)) {
      query = query.eq('reference_no', f.q);
    } else {
      // Metin filtreleri parseListingQuery'de temizlenir (yalnızca harf/rakam/boşluk/tire)
      query = query.or(`title.ilike.*${f.q}*,description.ilike.*${f.q}*`);
    }
  }

  switch (f.sort) {
    case 'fiyat-artan':
      query = query.order('price', { ascending: true, nullsFirst: false });
      break;
    case 'fiyat-azalan':
      query = query.order('price', { ascending: false, nullsFirst: false });
      break;
    case 'm2-azalan':
      query = query.order('gross_m2', { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order('published_at', { ascending: false, nullsFirst: false });
  }
  query = query.order('id', { ascending: true });

  const from = (f.page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) {
    if (error.code === 'PGRST103') return { ...EMPTY_RESULT(f.page), total: count ?? 0, pageCount: Math.ceil((count ?? 0) / pageSize) };
    throw new Error(`İlanlar yüklenemedi: ${error.message}`);
  }
  const total = count ?? 0;
  const now = Date.now();
  return {
    items: ((data ?? []) as unknown as CardRow[]).map((r) => toCard(r, now)),
    total,
    page: f.page,
    pageCount: Math.ceil(total / pageSize),
  };
}

/** Ana sayfa vitrini: "ana sayfada göster" veya öne çıkan ilanlar */
export async function getShowcaseProperties(orgId: string, limit = 6): Promise<PropertyCard[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await baseCardQuery(orgId)
    .eq('status', 'published')
    .or('show_on_homepage.eq.true,is_featured.eq.true')
    .order('show_on_homepage', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Vitrin ilanları yüklenemedi: ${error.message}`);
  const now = Date.now();
  return ((data ?? []) as unknown as CardRow[]).map((r) => toCard(r, now));
}

export async function getLatestProperties(orgId: string, limit = 8, excludeIds: string[] = []): Promise<PropertyCard[]> {
  if (!isSupabaseConfigured()) return [];
  let query = baseCardQuery(orgId).eq('status', 'published');
  if (excludeIds.length) query = query.not('id', 'in', `(${excludeIds.filter(isUuid).join(',')})`);
  const { data, error } = await query.order('published_at', { ascending: false, nullsFirst: false }).limit(limit);
  if (error) throw new Error(`Yeni ilanlar yüklenemedi: ${error.message}`);
  const now = Date.now();
  return ((data ?? []) as unknown as CardRow[]).map((r) => toCard(r, now));
}

/** Favoriler / karşılaştırma: tarayıcıda tutulan kimliklere göre (verilen sırayla) */
export async function getPropertiesByIds(orgId: string, ids: string[]): Promise<PropertyCard[]> {
  const valid = ids.filter(isUuid).slice(0, 100);
  if (!valid.length || !isSupabaseConfigured()) return [];
  const { data, error } = await baseCardQuery(orgId).in('status', ['published', 'sold', 'rented']).in('id', valid);
  if (error) throw new Error(`İlanlar yüklenemedi: ${error.message}`);
  const now = Date.now();
  const cards = ((data ?? []) as unknown as CardRow[]).map((r) => toCard(r, now));
  return valid.map((id) => cards.find((c) => c.id === id)).filter((c): c is PropertyCard => Boolean(c));
}

const DETAIL_SELECT = [
  '*',
  'type:property_types(id, name, slug, category)',
  'city:cities(id, name, slug)',
  'district:districts(id, name, slug)',
  'neighborhood:neighborhoods(id, name, slug)',
  `images:media_assets!media_assets_property_id_fkey(${MEDIA_FIELDS})`,
  'features:property_features(feature:features(id, key, label, feature_group, sort_order))',
].join(', ');

type DetailRow = CardRow &
  Record<string, unknown> & {
    organization_id: string;
    description: string | null;
    seo_title: string | null;
    seo_description: string | null;
    created_at: string;
    updated_at: string;
    price_negotiable: boolean;
    dues: number | string | null;
    deposit: number | string | null;
    city_id: number | null;
    district_id: number | null;
    neighborhood_id: number | null;
    public_latitude: number | string | null;
    public_longitude: number | string | null;
    location_precision: LocationPrecision;
    living_room_count: number | null;
    bathroom_count: number | null;
    heating: string | null;
    complex_name: string | null;
    has_air_conditioning: boolean | null;
    deed_status: string | null;
    usage_status: string | null;
    facades: string[];
    views: string[];
    swap_available: boolean | null;
    zoning_status: string | null;
    floor_area_ratio: number | string | null;
    height_limit: string | null;
    og_media_id: string | null;
    images: PropertyImage[] | null;
    features: { feature: Feature | Feature[] | null }[] | null;
  };

export function sortImages(images: PropertyImage[]): PropertyImage[] {
  return [...images].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
}

export function toDetail(row: DetailRow, now = Date.now()): PropertyDetail {
  const card = toCard({ ...row, cover: null, images: row.images }, now);
  const images = sortImages(row.images ?? []);
  const city = one(row.city);
  const district = one(row.district);
  const neighborhood = one(row.neighborhood);
  return {
    ...card,
    cover: images[0] ?? null,
    organizationId: row.organization_id,
    description: row.description,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    priceNegotiable: row.price_negotiable,
    dues: toNumber(row.dues),
    deposit: toNumber(row.deposit),
    cityId: row.city_id,
    districtId: row.district_id,
    neighborhoodId: row.neighborhood_id,
    citySlug: city?.slug ?? null,
    districtSlug: district?.slug ?? null,
    neighborhoodSlug: neighborhood?.slug ?? null,
    latitude: toNumber(row.public_latitude),
    longitude: toNumber(row.public_longitude),
    locationPrecision: row.location_precision,
    livingRoomCount: row.living_room_count,
    bathroomCount: row.bathroom_count,
    balconyCount: row.balcony_count,
    heating: row.heating,
    hasElevator: row.has_elevator,
    parking: row.parking,
    isFurnished: row.is_furnished,
    inComplex: row.in_complex,
    complexName: row.complex_name,
    hasAirConditioning: row.has_air_conditioning,
    creditEligible: row.credit_eligible,
    investmentSuitable: row.investment_suitable,
    deedStatus: row.deed_status,
    usageStatus: row.usage_status,
    facades: row.facades ?? [],
    views: row.views ?? [],
    swapAvailable: row.swap_available,
    zoningStatus: row.zoning_status,
    floorAreaRatio: toNumber(row.floor_area_ratio),
    heightLimit: row.height_limit,
    images,
    features: (row.features ?? [])
      .map((f) => one(f.feature))
      .filter((f): f is Feature => Boolean(f))
      .sort((a, b) => a.sort_order - b.sort_order),
    ogImage: images.find((i) => i.id === row.og_media_id) ?? null,
    priceDroppedAt: row.price_dropped_at,
  };
}

/** Herkese açık ilan (yayında / satıldı / kiralandı) — istek başına tekilleştirilir */
export const getPublicPropertyBySlug = cache(async (orgId: string, slug: string): Promise<PropertyDetail | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await client(orgId)
    .from('properties')
    .select(DETAIL_SELECT)
    .eq('organization_id', orgId)
    .eq('slug', slug)
    .in('status', ['published', 'sold', 'rented'])
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(`İlan yüklenemedi: ${error.message}`);
  return data ? toDetail(data as unknown as DetailRow) : null;
});

/**
 * Yönetim paneli önizlemesi: oturum istemcisiyle (RLS → properties.read yetkisi)
 * her durumdaki ilan. Yalnızca işlenmiş (ready) fotoğraflar gösterilir.
 */
export async function getPropertyForPreview(db: DB, id: string): Promise<{ property: PropertyDetail; deletedAt: string | null } | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db.from('properties').select(DETAIL_SELECT).eq('id', id).eq('images.status', 'ready').maybeSingle();
  if (error) throw new Error(`İlan yüklenemedi: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow & { deleted_at: string | null };
  return { property: toDetail(row), deletedAt: row.deleted_at };
}

/** Karşılaştırma: kimliklere göre ayrıntılı ilanlar (verilen sırayla) */
export async function getPropertyDetailsByIds(orgId: string, ids: string[]): Promise<PropertyDetail[]> {
  const valid = ids.filter(isUuid).slice(0, 4);
  if (!valid.length || !isSupabaseConfigured()) return [];
  const { data, error } = await client(orgId)
    .from('properties')
    .select(DETAIL_SELECT)
    .eq('organization_id', orgId)
    .in('id', valid)
    .in('status', ['published', 'sold', 'rented'])
    .is('deleted_at', null);
  if (error) throw new Error(`İlanlar yüklenemedi: ${error.message}`);
  const now = Date.now();
  const details = ((data ?? []) as unknown as DetailRow[]).map((r) => toDetail(r, now));
  return valid.map((id) => details.find((d) => d.id === id)).filter((d): d is PropertyDetail => Boolean(d));
}

/**
 * Harita konumları (Map First ilan listesi): verilen ilanların HERKESE AÇIK konumu. Yalnızca
 * veritabanının yayın için ürettiği public_latitude/public_longitude okunur (ilan detayındaki
 * haritayla aynı veri ve aynı hassasiyet kuralı: kesin değilse yaklaşık nokta + bölge dairesi).
 */
export async function getMapPoints(orgId: string, ids: string[]): Promise<{ id: string; lat: number; lng: number; precision: LocationPrecision }[]> {
  const valid = ids.filter(isUuid).slice(0, 60);
  if (!valid.length || !isSupabaseConfigured()) return [];
  const { data, error } = await client(orgId)
    .from('properties')
    .select('id, public_latitude, public_longitude, location_precision')
    .eq('organization_id', orgId)
    .in('id', valid)
    .in('status', ['published', 'sold', 'rented'])
    .is('deleted_at', null)
    .not('public_latitude', 'is', null)
    .not('public_longitude', 'is', null);
  if (error) return [];
  return (data ?? []).flatMap((r) => {
    const lat = toNumber(r.public_latitude);
    const lng = toNumber(r.public_longitude);
    return lat === null || lng === null ? [] : [{ id: r.id, lat, lng, precision: r.location_precision }];
  });
}

/** Deterministik benzerlik puanına göre benzer ilanlar (similar_properties RPC) */
export async function getSimilarProperties(orgId: string, propertyId: string, limit = 4): Promise<PropertyCard[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await client(orgId).rpc(
    'similar_properties',
    { p_property_id: propertyId, p_limit: limit },
    { get: true },
  );
  if (error || !data?.length) return [];
  return getPropertiesByIds(
    orgId,
    data.map((r) => r.id),
  );
}

export interface RegionCount {
  citySlug: string;
  cityName: string;
  districtSlug: string;
  districtName: string;
  neighborhoodSlug: string | null;
  neighborhoodName: string | null;
  count: number;
}

export async function getRegionCounts(orgId: string): Promise<RegionCount[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await client(orgId).rpc('region_listing_counts', { p_org: orgId }, { get: true });
  if (error) return [];
  return (data ?? []).map((r) => ({
    citySlug: r.city_slug,
    cityName: r.city_name,
    districtSlug: r.district_slug,
    districtName: r.district_name,
    neighborhoodSlug: r.neighborhood_slug,
    neighborhoodName: r.neighborhood_name,
    count: Number(r.listing_count),
  }));
}

/** Yayındaki ilan sayıları: kategori ve emlak tipine göre (ana sayfa kutucukları) */
export async function getInventoryCounts(orgId: string): Promise<{
  total: number;
  byListingType: Record<ListingType, number>;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  /** "sale:konut", "rent:daire" gibi ilan türü × kategori/tip sayıları (sitemap, menüler) */
  combos: Record<string, number>;
}> {
  const empty = { total: 0, byListingType: { sale: 0, rent: 0 }, byCategory: {}, byType: {}, combos: {} };
  if (!isSupabaseConfigured()) return empty;
  const { data, error } = await client(orgId)
    .from('properties')
    .select('listing_type, category, type:property_types(slug)')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .limit(5000);
  if (error || !data) return empty;
  const result = {
    total: data.length,
    byListingType: { sale: 0, rent: 0 },
    byCategory: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    combos: {} as Record<string, number>,
  };
  const bump = (map: Record<string, number>, key: string) => {
    map[key] = (map[key] ?? 0) + 1;
  };
  for (const row of data) {
    result.byListingType[row.listing_type] += 1;
    bump(result.byCategory, row.category);
    bump(result.combos, `${row.listing_type}:${row.category}`);
    const slug = one(row.type as { slug: string } | { slug: string }[] | null)?.slug;
    if (slug) {
      bump(result.byType, slug);
      bump(result.combos, `${row.listing_type}:${slug}`);
    }
  }
  return result;
}

export interface RegionPriceStat {
  listingType: ListingType;
  currency: CurrencyCode;
  count: number;
  min: number;
  median: number;
  max: number;
  medianPerM2: number | null;
}

/** Bölge fiyat aralıkları — en az 3 yayındaki ilan varsa (veritabanında hesaplanır) */
export async function getRegionPriceStats(
  orgId: string,
  cityId: number,
  districtId?: number | null,
  neighborhoodId?: number | null,
): Promise<RegionPriceStat[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await client(orgId).rpc(
    'region_price_stats',
    { p_org: orgId, p_city: cityId, p_district: districtId ?? undefined, p_neighborhood: neighborhoodId ?? undefined },
    { get: true },
  );
  if (error || !data) return [];
  return data.map((r) => ({
    listingType: r.listing_type,
    currency: r.currency,
    count: Number(r.listing_count),
    min: Number(r.min_price),
    median: Number(r.median_price),
    max: Number(r.max_price),
    medianPerM2: r.median_price_per_m2 === null ? null : Number(r.median_price_per_m2),
  }));
}

/** Site haritası: yayındaki gerçek (demo olmayan) ilanlar */
export async function getSitemapProperties(orgId: string): Promise<{ slug: string; updated_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await client(orgId, 3600)
    .from('properties')
    .select('slug, updated_at')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('is_demo', false)
    .order('updated_at', { ascending: false })
    .limit(10000);
  if (error) return [];
  return data ?? [];
}

/** Eski/değişmiş adresler için yönlendirme (slug değişimi, silinen ilan) */
export async function findRedirect(orgId: string, path: string): Promise<{ to_path: string; status_code: number } | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createPublicClient([cacheTags.redirects(orgId), cacheTags.properties(orgId)], 3600)
    .from('redirects')
    .select('to_path, status_code')
    .eq('organization_id', orgId)
    .eq('from_path', path)
    .maybeSingle();
  return data ?? null;
}
