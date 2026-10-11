import 'server-only';
import { isUuid, one, toNumber } from '@/lib/utils';
import type { AdminMedia } from '@/modules/media/server';
import { ADMIN_MEDIA_FIELDS } from '@/modules/media/server';
import type { MediaSource } from '@/modules/media/variants';
import type { CurrencyCode, ListingStatus, ListingType, LocationPrecision, PropertyCategory } from '@/modules/properties/constants';
import type { OrgContext } from '@/platform/auth/session';

export const ADMIN_PAGE_SIZE = 20;

export type AdminStatusFilter = ListingStatus | 'cop' | 'all';

export interface AdminListFilters {
  q?: string;
  status: AdminStatusFilter;
  listingType?: ListingType;
  category?: PropertyCategory;
  sort: 'guncel' | 'yeni' | 'eski' | 'fiyat-artan' | 'fiyat-azalan' | 'baslik';
  days?: number;
  minPrice?: number;
  maxPrice?: number;
  page: number;
}

export interface AdminListRow {
  id: string;
  referenceNo: string;
  title: string;
  slug: string;
  status: ListingStatus;
  listingType: ListingType;
  category: PropertyCategory;
  typeName: string;
  price: number | null;
  currency: CurrencyCode;
  isFeatured: boolean;
  isDemo: boolean;
  showOnHomepage: boolean;
  location: string;
  updatedAt: string;
  createdAt: string;
  deletedAt: string | null;
  cover: MediaSource | null;
  photos: number;
  views: number;
  favorites: number;
}

function sanitizeSearch(q: string | undefined): string | undefined {
  const cleaned = (q ?? '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned.length >= 2 ? cleaned : undefined;
}

export async function listAdminProperties(ctx: OrgContext, f: AdminListFilters) {
  const q = sanitizeSearch(f.q);
  let query = ctx.supabase
    .from('properties')
    .select(
      'id, reference_no, title, slug, status, listing_type, category, price, currency, is_featured, is_demo, show_on_homepage, created_at, updated_at, deleted_at, ' +
        'type:property_types(name), district:districts(name), neighborhood:neighborhoods(name), ' +
        'cover:media_assets!media_assets_property_id_fkey(public_base, legacy_path, variant_widths, width, height, is_cover, status), ' +
        'photos:media_assets!media_assets_property_id_fkey(count), stats:property_stats(view_count, favorite_count)',
      { count: 'exact' },
    )
    .eq('organization_id', ctx.org.id)
    .eq('cover.is_cover', true)
    .eq('photos.status', 'ready');

  query = f.status === 'cop' ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (f.status !== 'cop' && f.status !== 'all') query = query.eq('status', f.status);
  if (f.listingType) query = query.eq('listing_type', f.listingType);
  if (f.category) query = query.eq('category', f.category);
  if (f.days) query = query.gte('created_at', new Date(Date.now() - f.days * 86_400_000).toISOString());
  if (f.minPrice !== undefined) query = query.gte('price', f.minPrice);
  if (f.maxPrice !== undefined) query = query.lte('price', f.maxPrice);
  if (q) {
    const upper = q.toLocaleUpperCase('tr-TR');
    query = /^[A-Z]{2,5}-\d{4}-\d{2,}$/.test(upper) ? query.eq('reference_no', upper) : query.or(`title.ilike.*${q}*,reference_no.ilike.*${upper}*`);
  }

  switch (f.sort) {
    case 'yeni':
      query = query.order('created_at', { ascending: false });
      break;
    case 'eski':
      query = query.order('created_at', { ascending: true });
      break;
    case 'fiyat-artan':
      query = query.order('price', { ascending: true, nullsFirst: false });
      break;
    case 'fiyat-azalan':
      query = query.order('price', { ascending: false, nullsFirst: false });
      break;
    case 'baslik':
      query = query.order('title', { ascending: true });
      break;
    default:
      query = query.order(f.status === 'cop' ? 'deleted_at' : 'updated_at', { ascending: false });
  }
  query = query.order('id');

  const from = (f.page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`İlanlar yüklenemedi: ${error.message}`);

  type Row = {
    id: string;
    reference_no: string;
    title: string;
    slug: string;
    status: ListingStatus;
    listing_type: ListingType;
    category: PropertyCategory;
    price: number | string | null;
    currency: CurrencyCode;
    is_featured: boolean;
    is_demo: boolean;
    show_on_homepage: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    type: { name: string } | { name: string }[] | null;
    district: { name: string } | { name: string }[] | null;
    neighborhood: { name: string } | { name: string }[] | null;
    cover: (MediaSource & { is_cover: boolean })[] | null;
    photos: { count: number }[] | null;
    stats: { view_count: number; favorite_count: number } | { view_count: number; favorite_count: number }[] | null;
  };
  const rows: AdminListRow[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const stats = one(r.stats);
    return {
      id: r.id,
      referenceNo: r.reference_no,
      title: r.title,
      slug: r.slug,
      status: r.status,
      listingType: r.listing_type,
      category: r.category,
      typeName: one(r.type)?.name ?? '',
      price: toNumber(r.price),
      currency: r.currency,
      isFeatured: r.is_featured,
      isDemo: r.is_demo,
      showOnHomepage: r.show_on_homepage,
      location: [one(r.neighborhood)?.name, one(r.district)?.name].filter(Boolean).join(', '),
      updatedAt: r.updated_at,
      createdAt: r.created_at,
      deletedAt: r.deleted_at,
      cover: r.cover?.[0] ?? null,
      photos: r.photos?.[0]?.count ?? 0,
      views: stats?.view_count ?? 0,
      favorites: stats?.favorite_count ?? 0,
    };
  });
  const total = count ?? 0;
  return { rows, total, pageCount: Math.ceil(total / ADMIN_PAGE_SIZE) };
}

/** Durum sekmelerindeki sayılar */
export async function adminStatusCounts(ctx: OrgContext): Promise<Record<AdminStatusFilter, number>> {
  const statuses: ListingStatus[] = ['draft', 'pending', 'published', 'sold', 'rented', 'archived'];
  const base = () => ctx.supabase.from('properties').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.org.id);
  const results = await Promise.all([
    base().is('deleted_at', null),
    ...statuses.map((s) => base().is('deleted_at', null).eq('status', s)),
    base().not('deleted_at', 'is', null),
  ]);
  const counts = { all: results[0].count ?? 0, cop: results[results.length - 1].count ?? 0 } as Record<AdminStatusFilter, number>;
  statuses.forEach((s, i) => (counts[s] = results[i + 1].count ?? 0));
  return counts;
}

export interface EditorProperty {
  id: string;
  organization_id: string;
  reference_no: string;
  slug: string;
  title: string;
  description: string | null;
  listing_type: ListingType;
  property_type_id: number;
  category: PropertyCategory;
  status: ListingStatus;
  price: number | null;
  currency: CurrencyCode;
  price_negotiable: boolean;
  dues: number | null;
  deposit: number | null;
  city_id: number | null;
  district_id: number | null;
  neighborhood_id: number | null;
  location_precision: LocationPrecision;
  gross_m2: number | null;
  net_m2: number | null;
  room_count: number | null;
  living_room_count: number | null;
  building_age: number | null;
  floor: string | null;
  total_floors: number | null;
  bathroom_count: number | null;
  balcony_count: number | null;
  heating: string | null;
  has_elevator: boolean | null;
  parking: string | null;
  is_furnished: boolean | null;
  in_complex: boolean | null;
  complex_name: string | null;
  has_air_conditioning: boolean | null;
  credit_eligible: boolean | null;
  deed_status: string | null;
  usage_status: string | null;
  facades: string[];
  views: string[];
  swap_available: boolean | null;
  zoning_status: string | null;
  block_no: string | null;
  parcel_no: string | null;
  floor_area_ratio: number | null;
  height_limit: string | null;
  investment_suitable: boolean | null;
  seo_title: string | null;
  seo_description: string | null;
  is_featured: boolean;
  show_on_homepage: boolean;
  is_demo: boolean;
  og_media_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  price_previous: number | null;
  price_dropped_at: string | null;
}

export interface EditorData {
  property: EditorProperty;
  location: { address: string | null; latitude: number | null; longitude: number | null };
  featureIds: number[];
  media: AdminMedia[];
  priceHistory: { old_price: number | null; new_price: number; currency: CurrencyCode; changed_at: string }[];
  history: { id: number; action: string; actor_label: string | null; created_at: string; metadata: Record<string, unknown> }[];
  stats: { views: number; favorites: number; whatsapp: number; phone: number };
}

const NUMERIC_FIELDS = ['price', 'dues', 'deposit', 'floor_area_ratio', 'price_previous'] as const;

export async function getEditorData(ctx: OrgContext, id: string): Promise<EditorData | null> {
  if (!isUuid(id)) return null;
  const { data: property, error } = await ctx.supabase.from('properties').select('*').eq('id', id).eq('organization_id', ctx.org.id).maybeSingle();
  if (error) throw new Error(`İlan yüklenemedi: ${error.message}`);
  if (!property) return null;

  const [location, features, media, prices, history, stats] = await Promise.all([
    ctx.supabase.from('property_locations').select('address, latitude, longitude').eq('property_id', id).maybeSingle(),
    ctx.supabase.from('property_features').select('feature_id').eq('property_id', id),
    ctx.supabase.from('media_assets').select(ADMIN_MEDIA_FIELDS).eq('property_id', id).order('sort_order').order('created_at'),
    ctx.supabase.from('property_price_history').select('old_price, new_price, currency, changed_at').eq('property_id', id).order('changed_at', { ascending: false }).limit(10),
    ctx.can('audit.read')
      ? ctx.supabase
          .from('audit_logs')
          .select('id, action, actor_label, created_at, metadata')
          .eq('organization_id', ctx.org.id)
          .eq('target_type', 'property')
          .eq('target_id', id)
          .order('created_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    ctx.supabase.from('property_stats').select('view_count, favorite_count, whatsapp_click_count, phone_click_count').eq('property_id', id).maybeSingle(),
  ]);

  const p = property as unknown as Record<string, unknown>;
  for (const key of NUMERIC_FIELDS) p[key] = toNumber(p[key] as string | number | null);

  return {
    property: p as unknown as EditorProperty,
    location: {
      address: location.data?.address ?? null,
      latitude: toNumber(location.data?.latitude ?? null),
      longitude: toNumber(location.data?.longitude ?? null),
    },
    featureIds: (features.data ?? []).map((f) => f.feature_id),
    media: (media.data ?? []) as unknown as AdminMedia[],
    priceHistory: (prices.data ?? []).map((r) => ({ ...r, old_price: toNumber(r.old_price), new_price: toNumber(r.new_price) ?? 0 })),
    history: (history.data ?? []) as EditorData['history'],
    stats: {
      views: stats.data?.view_count ?? 0,
      favorites: stats.data?.favorite_count ?? 0,
      whatsapp: stats.data?.whatsapp_click_count ?? 0,
      phone: stats.data?.phone_click_count ?? 0,
    },
  };
}
