import 'server-only';
import { cache } from 'react';
import { cacheTags } from '@/lib/cache-tags';
import { isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/server';
import { one } from '@/lib/utils';
import { fillPlaceholders } from '@/modules/content/markdown';
import { PAGE_DEFINITIONS, type PageKey } from '@/modules/content/default-pages';
import type { MediaSource } from '@/modules/media/variants';
import type { Tenant } from '@/platform/tenant/tenant';

function client(orgId: string, revalidate = 300) {
  return createPublicClient([cacheTags.content(orgId)], revalidate);
}

export interface ContentPage {
  key: PageKey;
  path: string;
  title: string;
  body: string;
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string | null;
  /** Hukuki metin ve henüz "hukuk danışmanı inceledi" işaretlenmemiş */
  needsLegalReview: boolean;
  isTemplate: boolean;
}

export function placeholderValues(tenant: Tenant): Record<string, string | null> {
  const s = tenant.settings;
  const address = [s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ');
  return {
    sirket: s.display_name,
    unvan: s.legal_name,
    adres: address || null,
    eposta: s.email,
    telefon: s.phone,
    hizmet_bolgesi: s.service_area ? `${s.service_area}` : null,
  };
}

/** Düzenlenebilir sayfa (kayıt yoksa şablon) */
export const getContentPage = cache(async (tenant: Tenant, key: PageKey): Promise<ContentPage> => {
  const def = PAGE_DEFINITIONS[key];
  let row: {
    title: string;
    body: string;
    seo_title: string | null;
    seo_description: string | null;
    updated_at: string;
    legal_reviewed: boolean;
  } | null = null;
  if (isSupabaseConfigured()) {
    const { data } = await client(tenant.id)
      .from('pages')
      .select('title, body, seo_title, seo_description, updated_at, legal_reviewed')
      .eq('organization_id', tenant.id)
      .eq('key', key)
      .maybeSingle();
    row = data;
  }
  const values = placeholderValues(tenant);
  const template = key === 'about' && !values.hizmet_bolgesi
    ? def.template.replace(', {{hizmet_bolgesi}}', '').replace(' {{hizmet_bolgesi}}', '')
    : def.template;
  return {
    key,
    path: def.path,
    title: row?.title ?? def.title,
    body: fillPlaceholders(row?.body ?? template, values),
    description: def.description,
    seoTitle: row?.seo_title ?? null,
    seoDescription: row?.seo_description ?? null,
    updatedAt: row?.updated_at ?? null,
    needsLegalReview: def.legal && !(row?.legal_reviewed ?? false),
    isTemplate: !row,
  };
});

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string;
  cover: MediaSource | null;
}

export interface Post extends PostSummary {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

const POST_COVER = 'cover:media_assets!posts_cover_media_id_fkey(public_base, legacy_path, variant_widths, width, height, blur_data_url, alt_text)';

export async function getPublishedPosts(orgId: string, limit = 24): Promise<PostSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await client(orgId)
    .from('posts')
    .select(`id, slug, title, excerpt, published_at, ${POST_COVER}`)
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    publishedAt: p.published_at ?? '',
    cover: one(p.cover as MediaSource | MediaSource[] | null),
  }));
}

export const POSTS_PAGE_SIZE = 12;

/** Blog listesi (sayfalı): yayındaki yazılar, en yeni önce */
export async function getPostsPage(orgId: string, page: number): Promise<{ items: PostSummary[]; total: number; pageCount: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0, pageCount: 0 };
  const from = (Math.max(1, page) - 1) * POSTS_PAGE_SIZE;
  const { data, error, count } = await client(orgId)
    .from('posts')
    .select(`id, slug, title, excerpt, published_at, ${POST_COVER}`, { count: 'exact' })
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .order('id')
    .range(from, from + POSTS_PAGE_SIZE - 1);
  const total = count ?? 0;
  if (error) {
    if (error.code === 'PGRST103') return { items: [], total, pageCount: Math.ceil(total / POSTS_PAGE_SIZE) };
    throw new Error(`Yazılar yüklenemedi: ${error.message}`);
  }
  return {
    items: (data ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      publishedAt: p.published_at ?? '',
      cover: one(p.cover as MediaSource | MediaSource[] | null),
    })),
    total,
    pageCount: Math.ceil(total / POSTS_PAGE_SIZE),
  };
}

/** Yazı okuma süresi (dakika, ~200 kelime/dk) */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export const getPostBySlug = cache(async (orgId: string, slug: string): Promise<Post | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data } = await client(orgId)
    .from('posts')
    .select(`id, slug, title, excerpt, body, published_at, updated_at, seo_title, seo_description, ${POST_COVER}`)
    .eq('organization_id', orgId)
    .eq('slug', slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    body: data.body,
    publishedAt: data.published_at ?? data.updated_at,
    updatedAt: data.updated_at,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    cover: one(data.cover as MediaSource | MediaSource[] | null),
  };
});

export interface RegionFaq {
  q: string;
  a: string;
}

export interface RegionPage {
  id: string;
  slug: string;
  name: string;
  intro: string | null;
  body: string;
  faqs: RegionFaq[];
  seoTitle: string | null;
  seoDescription: string | null;
  cityId: number;
  districtId: number | null;
  neighborhoodId: number | null;
  citySlug: string;
  districtSlug: string | null;
  neighborhoodSlug: string | null;
  cityName: string;
  districtName: string | null;
  latitude: number | null;
  longitude: number | null;
}

type Loc = { slug: string; name: string; latitude: number | null; longitude: number | null };

const REGION_SELECT =
  'id, slug, name, intro, body, faqs, seo_title, seo_description, city_id, district_id, neighborhood_id, ' +
  'city:cities(slug, name, latitude, longitude), district:districts(slug, name, latitude, longitude), ' +
  'neighborhood:neighborhoods(slug, name, latitude, longitude)';

function parseFaqs(value: unknown): RegionFaq[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is RegionFaq => Boolean(f) && typeof f === 'object' && typeof (f as RegionFaq).q === 'string' && typeof (f as RegionFaq).a === 'string')
    .slice(0, 20);
}

type RegionRow = {
  id: string;
  slug: string;
  name: string;
  intro: string | null;
  body: string;
  faqs: unknown;
  seo_title: string | null;
  seo_description: string | null;
  city_id: number;
  district_id: number | null;
  neighborhood_id: number | null;
  city: Loc | Loc[] | null;
  district: Loc | Loc[] | null;
  neighborhood: Loc | Loc[] | null;
};

function toRegion(r: RegionRow): RegionPage {
  const city = one(r.city);
  const district = one(r.district);
  const neighborhood = one(r.neighborhood);
  const point = neighborhood ?? district ?? city;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    intro: r.intro,
    body: r.body,
    faqs: parseFaqs(r.faqs),
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
    cityId: r.city_id,
    districtId: r.district_id,
    neighborhoodId: r.neighborhood_id,
    citySlug: city?.slug ?? '',
    districtSlug: district?.slug ?? null,
    neighborhoodSlug: neighborhood?.slug ?? null,
    cityName: city?.name ?? '',
    districtName: district?.name ?? null,
    latitude: point?.latitude === null || point?.latitude === undefined ? null : Number(point.latitude),
    longitude: point?.longitude === null || point?.longitude === undefined ? null : Number(point.longitude),
  };
}

export async function getRegionPages(orgId: string): Promise<RegionPage[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await client(orgId)
    .from('region_pages')
    .select(REGION_SELECT)
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .order('sort_order')
    .order('name');
  if (error) return [];
  return ((data ?? []) as unknown as RegionRow[]).map(toRegion);
}

export const getRegionPageBySlug = cache(async (orgId: string, slug: string): Promise<RegionPage | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data } = await client(orgId)
    .from('region_pages')
    .select(REGION_SELECT)
    .eq('organization_id', orgId)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return data ? toRegion(data as unknown as RegionRow) : null;
});
