import 'server-only';
import { isUuid, one } from '@/lib/utils';
import { PAGE_DEFINITIONS, type PageKey } from '@/modules/content/default-pages';
import type { MediaSource } from '@/modules/media/variants';
import type { OrgContext } from '@/platform/auth/session';

/**
 * Yönetim paneli içerik sorguları. Oturum istemcisiyle çalışır (RLS geçerli)
 * ve her sorgu ayrıca aktif organizasyonla sınırlandırılır.
 */

export const CONTENT_PAGE_SIZE = 20;

function searchTerm(q: string | undefined): string | undefined {
  const cleaned = (q ?? '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned.length >= 2 ? cleaned : undefined;
}

// -----------------------------------------------------------------------------
// Blog
// -----------------------------------------------------------------------------
export type PostFilter = 'all' | 'draft' | 'published' | 'scheduled' | 'cop';

export interface AdminPostRow {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
  cover: MediaSource | null;
}

const COVER = 'cover:media_assets!posts_cover_media_id_fkey(id, public_base, legacy_path, variant_widths, width, height, blur_data_url, alt_text)';

export async function listAdminPosts(ctx: OrgContext, filter: PostFilter, q: string | undefined, page: number) {
  const from = (page - 1) * CONTENT_PAGE_SIZE;
  let query = ctx.supabase
    .from('posts')
    .select(`id, slug, title, status, published_at, updated_at, deleted_at, ${COVER}`, { count: 'exact' })
    .eq('organization_id', ctx.org.id);
  const now = new Date().toISOString();
  if (filter === 'cop') query = query.not('deleted_at', 'is', null);
  else {
    query = query.is('deleted_at', null);
    if (filter === 'draft') query = query.eq('status', 'draft');
    if (filter === 'published') query = query.eq('status', 'published').lte('published_at', now);
    if (filter === 'scheduled') query = query.eq('status', 'published').gt('published_at', now);
  }
  const term = searchTerm(q);
  if (term) query = query.ilike('title', `%${term}%`);
  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .order('id')
    .range(from, from + CONTENT_PAGE_SIZE - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`Yazılar yüklenemedi: ${error.message}`);
  const rows: AdminPostRow[] = (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    publishedAt: p.published_at,
    updatedAt: p.updated_at,
    deletedAt: p.deleted_at,
    cover: one(p.cover as MediaSource | MediaSource[] | null),
  }));
  const total = count ?? 0;
  return { rows, total, pageCount: Math.ceil(total / CONTENT_PAGE_SIZE) };
}

export async function postCounts(ctx: OrgContext): Promise<Record<PostFilter, number>> {
  const { data } = await ctx.supabase.from('posts').select('status, published_at, deleted_at').eq('organization_id', ctx.org.id).limit(5000);
  const now = Date.now();
  const counts: Record<PostFilter, number> = { all: 0, draft: 0, published: 0, scheduled: 0, cop: 0 };
  for (const p of data ?? []) {
    if (p.deleted_at) {
      counts.cop++;
      continue;
    }
    counts.all++;
    if (p.status === 'draft') counts.draft++;
    else if (p.published_at && new Date(p.published_at).getTime() > now) counts.scheduled++;
    else counts.published++;
  }
  return counts;
}

export interface AdminPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  cover: (MediaSource & { id: string }) | null;
}

export async function getAdminPost(ctx: OrgContext, id: string): Promise<AdminPost | null> {
  if (!isUuid(id)) return null;
  const { data } = await ctx.supabase
    .from('posts')
    .select(`id, organization_id, slug, title, excerpt, body, status, published_at, updated_at, deleted_at, seo_title, seo_description, ${COVER}`)
    .eq('id', id)
    .maybeSingle();
  if (!data || data.organization_id !== ctx.org.id) return null;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    body: data.body,
    status: data.status,
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
    deletedAt: data.deleted_at,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    cover: one(data.cover as (MediaSource & { id: string }) | (MediaSource & { id: string })[] | null),
  };
}

// -----------------------------------------------------------------------------
// Sabit sayfalar
// -----------------------------------------------------------------------------
export interface AdminPageRow {
  key: PageKey;
  path: string;
  title: string;
  legal: boolean;
  saved: boolean;
  legalReviewed: boolean;
  updatedAt: string | null;
}

export async function listAdminPages(ctx: OrgContext): Promise<AdminPageRow[]> {
  const { data } = await ctx.supabase.from('pages').select('key, title, legal_reviewed, updated_at').eq('organization_id', ctx.org.id);
  const byKey = new Map((data ?? []).map((r) => [r.key, r]));
  return (Object.keys(PAGE_DEFINITIONS) as PageKey[]).map((key) => {
    const def = PAGE_DEFINITIONS[key];
    const row = byKey.get(key);
    return {
      key,
      path: def.path,
      title: row?.title ?? def.title,
      legal: def.legal,
      saved: Boolean(row),
      legalReviewed: row?.legal_reviewed ?? false,
      updatedAt: row?.updated_at ?? null,
    };
  });
}

export interface AdminPage {
  key: PageKey;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  legalReviewed: boolean;
  updatedAt: string | null;
  saved: boolean;
}

/** Kayıt yoksa şablon (yer tutucular {{...}} olarak kalır; sitede şirket bilgileriyle doldurulur) */
export async function getAdminPage(ctx: OrgContext, key: PageKey): Promise<AdminPage> {
  const def = PAGE_DEFINITIONS[key];
  const { data } = await ctx.supabase
    .from('pages')
    .select('title, body, seo_title, seo_description, legal_reviewed, updated_at')
    .eq('organization_id', ctx.org.id)
    .eq('key', key)
    .maybeSingle();
  return {
    key,
    title: data?.title ?? def.title,
    body: data?.body ?? def.template,
    seoTitle: data?.seo_title ?? null,
    seoDescription: data?.seo_description ?? null,
    legalReviewed: data?.legal_reviewed ?? false,
    updatedAt: data?.updated_at ?? null,
    saved: Boolean(data),
  };
}

// -----------------------------------------------------------------------------
// Bölge sayfaları
// -----------------------------------------------------------------------------
export interface AdminRegionRow {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'published';
  sortOrder: number;
  location: string;
  faqCount: number;
  bodyLength: number;
  updatedAt: string;
}

type Named = { name: string } | { name: string }[] | null;

export async function listAdminRegions(ctx: OrgContext): Promise<AdminRegionRow[]> {
  const { data, error } = await ctx.supabase
    .from('region_pages')
    .select('id, slug, name, status, sort_order, body, faqs, updated_at, city:cities(name), district:districts(name), neighborhood:neighborhoods(name)')
    .eq('organization_id', ctx.org.id)
    .order('sort_order')
    .order('name')
    .limit(500);
  if (error) throw new Error(`Bölge sayfaları yüklenemedi: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    status: r.status,
    sortOrder: r.sort_order,
    location: [one(r.neighborhood as Named)?.name, one(r.district as Named)?.name, one(r.city as Named)?.name].filter(Boolean).join(', '),
    faqCount: Array.isArray(r.faqs) ? r.faqs.length : 0,
    bodyLength: r.body.length,
    updatedAt: r.updated_at,
  }));
}

export interface AdminRegion {
  id: string;
  slug: string;
  name: string;
  cityId: number;
  districtId: number | null;
  neighborhoodId: number | null;
  intro: string | null;
  body: string;
  faqs: { q: string; a: string }[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: 'draft' | 'published';
  sortOrder: number;
  updatedAt: string;
}

export async function getAdminRegion(ctx: OrgContext, id: string): Promise<AdminRegion | null> {
  if (!isUuid(id)) return null;
  const { data } = await ctx.supabase
    .from('region_pages')
    .select('id, organization_id, slug, name, city_id, district_id, neighborhood_id, intro, body, faqs, seo_title, seo_description, status, sort_order, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (!data || data.organization_id !== ctx.org.id) return null;
  const faqs = Array.isArray(data.faqs)
    ? (data.faqs as unknown[]).filter((f): f is { q: string; a: string } => Boolean(f) && typeof (f as { q?: unknown }).q === 'string' && typeof (f as { a?: unknown }).a === 'string')
    : [];
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    cityId: data.city_id,
    districtId: data.district_id,
    neighborhoodId: data.neighborhood_id,
    intro: data.intro,
    body: data.body,
    faqs,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    status: data.status,
    sortOrder: data.sort_order,
    updatedAt: data.updated_at,
  };
}

// -----------------------------------------------------------------------------
// SEO: yönlendirmeler ve ayarlar
// -----------------------------------------------------------------------------
export interface RedirectRow {
  id: number;
  fromPath: string;
  toPath: string;
  statusCode: number;
  createdAt: string;
}

export const REDIRECTS_PAGE_SIZE = 50;

export async function listRedirects(ctx: OrgContext, q: string | undefined, page: number) {
  const from = (page - 1) * REDIRECTS_PAGE_SIZE;
  let query = ctx.supabase
    .from('redirects')
    .select('id, from_path, to_path, status_code, created_at', { count: 'exact' })
    .eq('organization_id', ctx.org.id);
  const term = (q ?? '').replace(/[^\p{L}\p{N}/._-]/gu, '').slice(0, 80);
  if (term.length >= 2) query = query.or(`from_path.ilike.%${term}%,to_path.ilike.%${term}%`);
  const { data, count, error } = await query.order('created_at', { ascending: false }).order('id').range(from, from + REDIRECTS_PAGE_SIZE - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`Yönlendirmeler yüklenemedi: ${error.message}`);
  const total = count ?? 0;
  return {
    rows: (data ?? []).map<RedirectRow>((r) => ({ id: r.id, fromPath: r.from_path, toPath: r.to_path, statusCode: r.status_code, createdAt: r.created_at })),
    total,
    pageCount: Math.ceil(total / REDIRECTS_PAGE_SIZE),
  };
}

