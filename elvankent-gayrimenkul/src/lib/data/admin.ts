import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ContactRequest,
  ContactStatus,
  DashboardStats,
  PropertyImage,
  PropertyLocation,
  PropertyRow,
  PropertyStats,
  PropertyStatus,
} from '@/types/database';

/**
 * Yönetim paneli sorguları. Her zaman oturumlu admin istemcisiyle çağrılır;
 * RLS, admin olmayan kullanıcıların bu verilere erişimini veritabanında engeller.
 */

const ADMIN_PAGE_SIZE = 20;

export interface AdminPropertyRow {
  id: string;
  listing_no: number;
  slug: string;
  title: string;
  price: number;
  currency: PropertyRow['currency'];
  listing_type: PropertyRow['listing_type'];
  category: PropertyRow['category'];
  status: PropertyStatus;
  is_featured: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  type_name: string;
  location: string;
  cover_path: string | null;
  image_count: number;
  stats: Pick<PropertyStats, 'view_count' | 'phone_click_count' | 'whatsapp_click_count' | 'contact_form_count' | 'favorite_count'>;
}

const EMPTY_STATS = { view_count: 0, phone_click_count: 0, whatsapp_click_count: 0, contact_form_count: 0, favorite_count: 0 };

interface RawAdminRow {
  id: string;
  listing_no: number;
  slug: string;
  title: string;
  price: number | string;
  currency: PropertyRow['currency'];
  listing_type: PropertyRow['listing_type'];
  category: PropertyRow['category'];
  status: PropertyStatus;
  is_featured: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  type: { name: string } | null;
  district: { name: string } | null;
  neighborhood: { name: string } | null;
  cover: { storage_path: string }[] | null;
  images: { count: number }[] | null;
  stats: AdminPropertyRow['stats'] | AdminPropertyRow['stats'][] | null;
}

const ADMIN_SELECT = [
  'id, listing_no, slug, title, price, currency, listing_type, category, status, is_featured, is_demo, created_at, updated_at',
  'type:property_types(name), district:districts(name), neighborhood:neighborhoods(name)',
  'cover:property_images(storage_path)',
  'images:property_images(count)',
  'stats:property_stats(view_count, phone_click_count, whatsapp_click_count, contact_form_count, favorite_count)',
].join(', ');

function mapRow(r: RawAdminRow): AdminPropertyRow {
  const stats = Array.isArray(r.stats) ? r.stats[0] : r.stats;
  return {
    id: r.id,
    listing_no: r.listing_no,
    slug: r.slug,
    title: r.title,
    price: Number(r.price),
    currency: r.currency,
    listing_type: r.listing_type,
    category: r.category,
    status: r.status,
    is_featured: r.is_featured,
    is_demo: r.is_demo,
    created_at: r.created_at,
    updated_at: r.updated_at,
    type_name: r.type?.name ?? '',
    location: [r.neighborhood?.name, r.district?.name].filter(Boolean).join(', '),
    cover_path: r.cover?.[0]?.storage_path ?? null,
    image_count: r.images?.[0]?.count ?? 0,
    stats: stats ?? EMPTY_STATS,
  };
}

export interface AdminPropertyFilters {
  status?: PropertyStatus | 'all';
  q?: string;
  page: number;
  sort?: 'yeni' | 'eski' | 'fiyat' | 'goruntulenme';
}

export async function listAdminProperties(supabase: SupabaseClient, f: AdminPropertyFilters) {
  let query = supabase.from('properties').select(ADMIN_SELECT, { count: 'exact' }).eq('cover.is_cover', true);
  if (f.status && f.status !== 'all') query = query.eq('status', f.status);
  if (f.q) {
    const q = f.q.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim().slice(0, 60);
    if (/^\d{6,12}$/.test(q)) query = query.eq('listing_no', Number(q));
    else if (q) query = query.ilike('title', `%${q}%`);
  }
  if (f.sort === 'eski') query = query.order('created_at', { ascending: true });
  else if (f.sort === 'fiyat') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });
  const from = (f.page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`İlanlar yüklenemedi: ${error.message}`);
  let rows = ((data ?? []) as unknown as RawAdminRow[]).map(mapRow);
  if (f.sort === 'goruntulenme') rows = rows.sort((a, b) => b.stats.view_count - a.stats.view_count);
  return { rows, total: count ?? 0, pageCount: Math.ceil((count ?? 0) / ADMIN_PAGE_SIZE) };
}

export async function getStatusCounts(supabase: SupabaseClient): Promise<Record<PropertyStatus | 'all', number>> {
  const { data } = await supabase.from('properties').select('status');
  const counts: Record<PropertyStatus | 'all', number> = { all: 0, draft: 0, active: 0, passive: 0, sold: 0, rented: 0 };
  for (const r of (data ?? []) as { status: PropertyStatus }[]) {
    counts[r.status] += 1;
    counts.all += 1;
  }
  return counts;
}

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats | null> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats', { p_days: 30 });
  if (error) return null;
  return data as DashboardStats;
}

export async function getRecentProperties(supabase: SupabaseClient, limit = 5) {
  const { data } = await supabase
    .from('properties')
    .select(ADMIN_SELECT)
    .eq('cover.is_cover', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as RawAdminRow[]).map(mapRow);
}

export type ContactWithProperty = ContactRequest & {
  property: { id: string; title: string; slug: string; listing_no: number } | null;
};

export async function listContacts(supabase: SupabaseClient, opts: { status?: ContactStatus | 'all'; page: number; limit?: number }) {
  const limit = opts.limit ?? ADMIN_PAGE_SIZE;
  let query = supabase
    .from('contact_requests')
    .select(
      'id, property_id, full_name, phone, email, message, source, status, admin_note, kvkk_consent, created_at, updated_at, property:properties(id, title, slug, listing_no)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  else query = query.neq('status', 'archived');
  const from = (opts.page - 1) * limit;
  const { data, error, count } = await query.range(from, from + limit - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`Mesajlar yüklenemedi: ${error.message}`);
  return { rows: (data ?? []) as unknown as ContactWithProperty[], total: count ?? 0, pageCount: Math.ceil((count ?? 0) / limit) };
}

export async function getNewContactCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from('contact_requests').select('id', { count: 'exact', head: true }).eq('status', 'new');
  return count ?? 0;
}

export interface AdminPropertyDetail {
  property: PropertyRow;
  location: PropertyLocation | null;
  featureIds: number[];
  images: PropertyImage[];
  stats: PropertyStats | null;
}

export async function getAdminProperty(supabase: SupabaseClient, id: string): Promise<AdminPropertyDetail | null> {
  const { data, error } = await supabase
    .from('properties')
    .select(
      '*, location:property_locations(*), features:property_features(feature_id), images:property_images(*), stats:property_stats(*)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const { location, features, images, stats, ...property } = data as PropertyRow & {
    location: PropertyLocation | PropertyLocation[] | null;
    features: { feature_id: number }[];
    images: PropertyImage[];
    stats: PropertyStats | PropertyStats[] | null;
  };
  return {
    property: { ...property, price: Number(property.price) },
    location: (Array.isArray(location) ? location[0] : location) ?? null,
    featureIds: features.map((f) => f.feature_id),
    images: [...images].sort((a, b) => a.sort_order - b.sort_order),
    stats: (Array.isArray(stats) ? stats[0] : stats) ?? null,
  };
}
