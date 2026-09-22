import 'server-only';
import { cache } from 'react';
import { PAGE_SIZE } from '@/lib/constants';
import { isSupabaseConfigured } from '@/lib/env';
import { CACHE_TAGS, createCachedPublicClient } from '@/lib/data/cache';
import { getTaxonomy } from '@/lib/data/taxonomy';
import type { ListingFilters } from '@/lib/listing-filters';
import type { Feature, PropertyCardData, PropertyDetail, PropertyImage, Redirect } from '@/types/database';

/** Kart görünümü için gereken minimum alanlar (kapak görseli ve görsel sayısı dahil) */
const CARD_SELECT = [
  'id, listing_no, slug, title, listing_type, category, status, is_featured, is_demo, price, currency',
  'gross_m2, net_m2, rooms_label, floor, building_age, created_at, published_at',
  'type:property_types(name), city:cities(name), district:districts(name), neighborhood:neighborhoods(name)',
  'cover:property_images(storage_path, width, height, blur_data_url, alt)',
  'images:property_images(count)',
].join(', ');

interface CardRow {
  id: string;
  listing_no: number;
  slug: string;
  title: string;
  listing_type: PropertyCardData['listing_type'];
  category: PropertyCardData['category'];
  status: PropertyCardData['status'];
  is_featured: boolean;
  is_demo: boolean;
  price: number | string;
  currency: PropertyCardData['currency'];
  gross_m2: number | null;
  net_m2: number | null;
  rooms_label: string | null;
  floor: string | null;
  building_age: number | null;
  created_at: string;
  published_at: string | null;
  type: { name: string } | null;
  city: { name: string } | null;
  district: { name: string } | null;
  neighborhood: { name: string } | null;
  cover: PropertyCardData['cover'][] | null;
  images: { count: number }[] | null;
}

function toCard(row: CardRow): PropertyCardData {
  return {
    id: row.id,
    listing_no: row.listing_no,
    slug: row.slug,
    title: row.title,
    listing_type: row.listing_type,
    category: row.category,
    status: row.status,
    is_featured: row.is_featured,
    is_demo: row.is_demo,
    price: Number(row.price),
    currency: row.currency,
    gross_m2: row.gross_m2,
    net_m2: row.net_m2,
    rooms_label: row.rooms_label,
    floor: row.floor,
    building_age: row.building_age,
    created_at: row.created_at,
    published_at: row.published_at,
    type_name: row.type?.name ?? '',
    city_name: row.city?.name ?? '',
    district_name: row.district?.name ?? '',
    neighborhood_name: row.neighborhood?.name ?? null,
    cover: row.cover?.[0] ?? null,
    image_count: row.images?.[0]?.count ?? 0,
  };
}

function publicClient() {
  return createCachedPublicClient([CACHE_TAGS.properties], 300);
}

function baseCardQuery(count = false) {
  return publicClient()
    .from('properties')
    .select(CARD_SELECT, count ? { count: 'exact' } : undefined)
    .eq('status', 'active')
    .eq('cover.is_cover', true);
}

export interface SearchResult {
  items: PropertyCardData[];
  total: number;
  page: number;
  pageCount: number;
}

/** Filtrelere göre sayfalı ilan araması */
export async function searchProperties(filters: ListingFilters): Promise<SearchResult> {
  if (!isSupabaseConfigured()) return { items: [], total: 0, page: 1, pageCount: 0 };
  const tax = await getTaxonomy();
  let query = baseCardQuery(true);

  if (filters.listingType) query = query.eq('listing_type', filters.listingType);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.typeSlug) {
    const type = tax.propertyTypes.find((t) => t.slug === filters.typeSlug);
    if (!type) return { items: [], total: 0, page: 1, pageCount: 0 };
    query = query.eq('property_type_id', type.id);
  }

  // Konum filtreleri (slug → id). Bilinmeyen slug sonuçsuz arama demektir.
  if (filters.city) {
    const city = tax.cities.find((c) => c.slug === filters.city);
    if (!city) return { items: [], total: 0, page: 1, pageCount: 0 };
    query = query.eq('city_id', city.id);
    if (filters.district) {
      const district = tax.districts.find((d) => d.city_id === city.id && d.slug === filters.district);
      if (!district) return { items: [], total: 0, page: 1, pageCount: 0 };
      query = query.eq('district_id', district.id);
      if (filters.neighborhood) {
        const n = tax.neighborhoods.find((x) => x.district_id === district.id && x.slug === filters.neighborhood);
        if (!n) return { items: [], total: 0, page: 1, pageCount: 0 };
        query = query.eq('neighborhood_id', n.id);
      }
    }
  } else if (filters.district) {
    const ids = tax.districts.filter((d) => d.slug === filters.district).map((d) => d.id);
    if (!ids.length) return { items: [], total: 0, page: 1, pageCount: 0 };
    query = query.in('district_id', ids);
  }

  if (filters.minPrice !== undefined) query = query.gte('price', filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte('price', filters.maxPrice);
  if (filters.minM2 !== undefined) query = query.gte('gross_m2', filters.minM2);
  if (filters.maxM2 !== undefined) query = query.lte('gross_m2', filters.maxM2);
  if (filters.maxAge !== undefined) query = query.lte('building_age', filters.maxAge);
  if (filters.furnished) query = query.eq('is_furnished', true);
  if (filters.credit) query = query.eq('credit_eligible', true);
  if (filters.complex) query = query.eq('in_complex', true);
  if (filters.elevator) query = query.eq('has_elevator', true);
  if (filters.parking) query = query.not('parking', 'is', null).neq('parking', 'Yok');

  if (filters.rooms?.length) {
    const exact = filters.rooms.filter((r) => r !== '5+');
    const parts: string[] = [];
    if (exact.length) parts.push(`rooms_label.in.(${exact.join(',')})`);
    if (filters.rooms.includes('5+')) parts.push('room_count.gte.5');
    query = query.or(parts.join(','));
  }

  if (filters.q) {
    const onlyDigits = filters.q.replace(/\s/g, '');
    if (/^\d{6,12}$/.test(onlyDigits)) {
      query = query.eq('listing_no', Number(onlyDigits));
    } else {
      // sanitizeQuery sadece harf/rakam/boşluk/tire bırakır → filtre enjeksiyonu yok
      query = query.or(`title.ilike.*${filters.q}*,description.ilike.*${filters.q}*`);
    }
  }

  switch (filters.sort) {
    case 'fiyat-artan':
      query = query.order('price', { ascending: true });
      break;
    case 'fiyat-azalan':
      query = query.order('price', { ascending: false });
      break;
    case 'm2-azalan':
      query = query.order('gross_m2', { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order('is_featured', { ascending: false }).order('published_at', { ascending: false, nullsFirst: false });
  }
  query = query.order('created_at', { ascending: false });

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) {
    // Sayfa aralığı dışı (PGRST103) → boş sonuç
    if (error.code === 'PGRST103') return { items: [], total: count ?? 0, page: filters.page, pageCount: Math.ceil((count ?? 0) / PAGE_SIZE) };
    throw new Error(`İlanlar yüklenemedi: ${error.message}`);
  }
  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as CardRow[]).map(toCard),
    total,
    page: filters.page,
    pageCount: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getFeaturedProperties(limit = 6): Promise<PropertyCardData[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await baseCardQuery()
    .eq('is_featured', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Öne çıkan ilanlar yüklenemedi: ${error.message}`);
  return ((data ?? []) as unknown as CardRow[]).map(toCard);
}

export async function getLatestProperties(limit = 8): Promise<PropertyCardData[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await baseCardQuery()
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Yeni ilanlar yüklenemedi: ${error.message}`);
  return ((data ?? []) as unknown as CardRow[]).map(toCard);
}

/** Favoriler sayfası: tarayıcıda saklanan ID'lere göre yayındaki ilanlar */
export async function getPropertiesByIds(ids: string[]): Promise<PropertyCardData[]> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const valid = ids.filter((id) => uuid.test(id)).slice(0, 100);
  if (!valid.length || !isSupabaseConfigured()) return [];
  const { data, error } = await baseCardQuery().in('id', valid);
  if (error) throw new Error(`Favoriler yüklenemedi: ${error.message}`);
  const cards = ((data ?? []) as unknown as CardRow[]).map(toCard);
  return valid.map((id) => cards.find((c) => c.id === id)).filter((c): c is PropertyCardData => Boolean(c));
}

const DETAIL_SELECT = [
  '*',
  'type:property_types(id, name, slug, category)',
  'city:cities(id, name, slug)',
  'district:districts(id, name, slug)',
  'neighborhood:neighborhoods(id, name, slug)',
  'images:property_images(id, property_id, storage_path, width, height, blur_data_url, alt, sort_order, is_cover)',
  'features:property_features(feature:features(id, key, label, feature_group, sort_order))',
].join(', ');

/** Yayındaki ilanı ilan numarasına göre getirir (istek başına tekilleştirilmiş). */
export const getPropertyByListingNo = cache(async (listingNo: number): Promise<PropertyDetail | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await publicClient()
    .from('properties')
    .select(DETAIL_SELECT)
    .eq('listing_no', listingNo)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`İlan yüklenemedi: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Omit<PropertyDetail, 'features'> & { features: { feature: Feature | null }[] };
  const images = [...(row.images ?? [])].sort(
    (a: PropertyImage, b: PropertyImage) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
  return {
    ...row,
    price: Number(row.price),
    dues: row.dues === null ? null : Number(row.dues),
    deposit: row.deposit === null ? null : Number(row.deposit),
    floor_area_ratio: row.floor_area_ratio === null ? null : Number(row.floor_area_ratio),
    public_latitude: row.public_latitude === null ? null : Number(row.public_latitude),
    public_longitude: row.public_longitude === null ? null : Number(row.public_longitude),
    images,
    features: row.features
      .map((f) => f.feature)
      .filter((f): f is Feature => Boolean(f))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
});

/** Benzer ilanlar: aynı ilan tipi ve kategori; önce aynı ilçe */
export async function getSimilarProperties(p: PropertyDetail, limit = 4): Promise<PropertyCardData[]> {
  const base = () =>
    baseCardQuery()
      .eq('listing_type', p.listing_type)
      .eq('category', p.category)
      .neq('id', p.id)
      .order('published_at', { ascending: false, nullsFirst: false });
  const { data: near, error } = await base().eq('district_id', p.district_id).limit(limit);
  if (error) return [];
  const result = ((near ?? []) as unknown as CardRow[]).map(toCard);
  if (result.length < limit) {
    const { data: more } = await base().neq('district_id', p.district_id).limit(limit - result.length);
    result.push(...((more ?? []) as unknown as CardRow[]).map(toCard));
  }
  return result;
}

export interface RegionCount {
  city_slug: string;
  city_name: string;
  district_slug: string;
  district_name: string;
  neighborhood_slug: string | null;
  neighborhood_name: string | null;
  listing_count: number;
}

export async function getRegionCounts(): Promise<RegionCount[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await publicClient().rpc('region_listing_counts', {}, { get: true });
  if (error) return [];
  return ((data ?? []) as RegionCount[]).map((r) => ({ ...r, listing_count: Number(r.listing_count) }));
}

/** Sitemap için tüm yayındaki ilanlar (hafif) */
export async function getSitemapProperties(): Promise<{ slug: string; updated_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await publicClient()
    .from('properties')
    .select('slug, updated_at')
    .eq('status', 'active')
    .eq('is_demo', false) // demo ilanlar noindex; site haritasına girmez
    .order('updated_at', { ascending: false })
    .limit(5000);
  if (error) return [];
  return data ?? [];
}

/** Eski/silinmiş URL için tanımlı yönlendirme */
export async function findRedirect(path: string): Promise<Redirect | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createCachedPublicClient([CACHE_TAGS.redirects], 3600);
  const { data } = await supabase
    .from('redirects')
    .select('id, from_path, to_path, status_code')
    .eq('from_path', path)
    .maybeSingle();
  return (data as Redirect | null) ?? null;
}
