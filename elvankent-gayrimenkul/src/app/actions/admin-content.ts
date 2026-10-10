'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { cacheTags } from '@/lib/cache-tags';
import { slugify } from '@/lib/slug';
import { isUuid } from '@/lib/utils';
import { PAGE_DEFINITIONS, type PageKey } from '@/modules/content/default-pages';
import { ActionError, assertNoDbError, NotFoundError, runAction, type ActionResult } from '@/platform/actions';
import { requirePermission, type OrgContext } from '@/platform/auth/session';
import { saveSeoDraft } from '@/site-editor/service';
import type { SavedDraft } from '@/site-editor/types';

/**
 * İçerik yönetimi: blog yazıları, düzenlenebilir sayfalar, bölge sayfaları,
 * yönlendirmeler ve site geneli SEO ayarları.
 *
 * Yetki iki katmanlıdır: burada `content.manage` / `seo.manage` erken
 * doğrulanır, asıl karar veritabanında RLS ile verilir. Organizasyon kimliği
 * istemciden ALINMAZ; kullanıcının doğrulanmış aktif üyeliğinden gelir.
 */

// -----------------------------------------------------------------------------
// Ortak alanlar
// -----------------------------------------------------------------------------

/** Tek satırlık düz metin: HTML işaretleri ve fazla boşluklar atılır */
const clean = (v: string) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

const requiredText = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} gerekli.` })
    .max(max * 2, { error: `${label} en fazla ${max} karakter olabilir.` })
    .transform(clean)
    .pipe(
      z
        .string()
        .min(min, { error: `${label} en az ${min} karakter olmalıdır.` })
        .max(max, { error: `${label} en fazla ${max} karakter olabilir.` }),
    );

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2, { error: `En fazla ${max} karakter olabilir.` })
    .transform(clean)
    .pipe(z.string().max(max, { error: `En fazla ${max} karakter olabilir.` }))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/**
 * Markdown gövdesi. HTML'e izin verilmez; metin güvenli işleyiciyle (React
 * kaçışlamalı) gösterildiği için burada yalnızca satır sonları normalleşir.
 */
const markdown = (max: number) =>
  z
    .string()
    .max(max, { error: `İçerik en fazla ${max.toLocaleString('tr-TR')} karakter olabilir.` })
    .transform((v) => v.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim());

const contentStatus = z.enum(['draft', 'published'], { error: 'Geçersiz yayın durumu.' });

function invalidateContent(orgId: string) {
  updateTag(cacheTags.content(orgId));
}

function invalidateRedirects(orgId: string) {
  updateTag(cacheTags.redirects(orgId));
}

/**
 * Adresi değişen (yayında olmuş) içerik için kalıcı yönlendirme. Zincirler
 * düzleştirilir; yeni adrese işaret eden eski bir yönlendirme varsa kaldırılır.
 * Yönlendirme tablosu `seo.manage` yetkisi ister (RLS); yetki yoksa atlanır.
 */
async function moveAddress(ctx: OrgContext, fromPath: string, toPath: string) {
  if (fromPath === toPath || !ctx.can('seo.manage')) return;
  const db = ctx.supabase;
  await db.from('redirects').delete().eq('organization_id', ctx.org.id).eq('from_path', toPath);
  await db.from('redirects').update({ to_path: toPath }).eq('organization_id', ctx.org.id).eq('to_path', fromPath);
  const { error } = await db
    .from('redirects')
    .upsert({ organization_id: ctx.org.id, from_path: fromPath, to_path: toPath, status_code: 308 }, { onConflict: 'organization_id,from_path' });
  if (error) console.warn('[content] redirect upsert failed', error.code);
  invalidateRedirects(ctx.org.id);
}

// -----------------------------------------------------------------------------
// Blog yazıları
// -----------------------------------------------------------------------------
const postSchema = z
  .object({
    title: requiredText(3, 140, 'Başlık'),
    slug: z
      .string()
      .max(160, { error: 'Adres çok uzun.' })
      .optional()
      .transform((v) => (v && v.trim() ? slugify(v, 120) : '')),
    excerpt: optionalText(300),
    body: markdown(50000),
    cover_media_id: z.uuid({ error: 'Geçersiz kapak görseli.' }).nullable().optional(),
    status: contentStatus,
    published_at: z.iso.datetime({ offset: true, error: 'Geçersiz yayın tarihi.' }).nullable().optional(),
    seo_title: optionalText(70),
    seo_description: optionalText(200),
    expected_updated_at: z.string().max(64).nullable().optional(),
  })
  .superRefine((v, issue) => {
    if (v.status === 'published' && v.body.length < 200) {
      issue.addIssue({ code: 'custom', path: ['body'], message: `Yayınlamak için en az 200 karakterlik içerik gerekir (şu an ${v.body.length}).` });
    }
  });

export type PostInput = z.input<typeof postSchema>;

async function loadPost(ctx: OrgContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError('Yazı bulunamadı.');
  const { data, error } = await ctx.supabase
    .from('posts')
    .select('id, organization_id, slug, status, published_at, updated_at, deleted_at')
    .eq('id', id)
    .maybeSingle();
  assertNoDbError(error);
  if (!data || data.organization_id !== ctx.org.id) throw new NotFoundError('Yazı bulunamadı veya erişim yetkiniz yok.');
  return data;
}

async function assertCover(ctx: OrgContext, mediaId: string | null | undefined) {
  if (!mediaId) return;
  const { data } = await ctx.supabase.from('media_assets').select('organization_id, status').eq('id', mediaId).maybeSingle();
  if (!data || data.organization_id !== ctx.org.id) throw new ActionError('Seçilen görsel bu ofise ait değil.');
  if (data.status !== 'ready') throw new ActionError('Kapak görseli henüz hazır değil. İşleme tamamlanınca tekrar kaydedin.');
}

export async function savePost(
  id: string | null,
  raw: PostInput,
): Promise<ActionResult<{ id: string; slug: string; status: 'draft' | 'published'; updatedAt: string; publishedAt: string | null }>> {
  return runAction(async () => {
    const ctx = await requirePermission('content.manage');
    const input = postSchema.parse(raw);
    await assertCover(ctx, input.cover_media_id);

    const fields = {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? null,
      body: input.body,
      cover_media_id: input.cover_media_id ?? null,
      status: input.status,
      seo_title: input.seo_title ?? null,
      seo_description: input.seo_description ?? null,
      ...(input.published_at !== undefined ? { published_at: input.published_at } : {}),
    };
    const returning = 'id, slug, status, updated_at, published_at';

    if (!id) {
      const { data, error } = await ctx.supabase
        .from('posts')
        .insert({ ...fields, organization_id: ctx.org.id, author_id: ctx.user.id })
        .select(returning)
        .single();
      assertNoDbError(error);
      invalidateContent(ctx.org.id);
      return { id: data!.id, slug: data!.slug, status: data!.status, updatedAt: data!.updated_at, publishedAt: data!.published_at };
    }

    const existing = await loadPost(ctx, id);
    if (existing.deleted_at) throw new ActionError('Çöp kutusundaki yazı düzenlenemez. Önce geri yükleyin.');
    if (input.expected_updated_at && input.expected_updated_at !== existing.updated_at) {
      throw new ActionError('Bu yazı siz düzenlerken başka bir oturumda değiştirildi. Sayfayı yenileyip değişikliklerinizi tekrar uygulayın.', 'conflict');
    }
    const { data, error } = await ctx.supabase.from('posts').update(fields).eq('id', id).select(returning).single();
    assertNoDbError(error);
    if (existing.published_at && data!.slug !== existing.slug) {
      await moveAddress(ctx, `/blog/${existing.slug}`, `/blog/${data!.slug}`);
    }
    invalidateContent(ctx.org.id);
    return { id: data!.id, slug: data!.slug, status: data!.status, updatedAt: data!.updated_at, publishedAt: data!.published_at };
  });
}

/** Çöp kutusuna taşır (yayından kalkar) veya geri yükler (taslak olarak) */
export async function setPostDeleted(id: string, deleted: boolean): Promise<ActionResult<null>> {
  return runAction(
    async () => {
      const ctx = await requirePermission('content.manage');
      await loadPost(ctx, id);
      const { error } = await ctx.supabase
        .from('posts')
        .update(deleted ? { deleted_at: new Date().toISOString(), status: 'draft' } : { deleted_at: null })
        .eq('id', id);
      assertNoDbError(error);
      invalidateContent(ctx.org.id);
      return null;
    },
    deleted ? 'Yazı çöp kutusuna taşındı.' : 'Yazı taslak olarak geri yüklendi.',
  );
}

/** Çöp kutusundaki yazıyı kalıcı olarak siler */
export async function purgePost(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('content.manage');
    const post = await loadPost(ctx, id);
    if (!post.deleted_at) throw new ActionError('Yalnızca çöp kutusundaki yazılar kalıcı olarak silinebilir.');
    const { error } = await ctx.supabase.from('posts').delete().eq('id', id);
    assertNoDbError(error);
    if (post.published_at) await moveAddress(ctx, `/blog/${post.slug}`, '/blog');
    invalidateContent(ctx.org.id);
    return null;
  }, 'Yazı kalıcı olarak silindi.');
}

// -----------------------------------------------------------------------------
// Düzenlenebilir sayfalar (Hakkımızda, Hizmetler, KVKK, Gizlilik, Çerez, Koşullar)
// -----------------------------------------------------------------------------
const PAGE_KEYS = Object.keys(PAGE_DEFINITIONS) as PageKey[];

const pageSchema = z.object({
  title: requiredText(2, 120, 'Başlık'),
  body: markdown(60000).pipe(z.string().min(20, { error: 'İçerik en az 20 karakter olmalıdır.' })),
  seo_title: optionalText(70),
  seo_description: optionalText(200),
  legal_reviewed: z.boolean().optional(),
});

export type PageInput = z.input<typeof pageSchema>;

function assertPageKey(key: string): asserts key is PageKey {
  if (!PAGE_KEYS.includes(key as PageKey)) throw new NotFoundError('Sayfa bulunamadı.');
}

export async function savePage(key: string, raw: PageInput): Promise<ActionResult<{ updatedAt: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('content.manage');
    assertPageKey(key);
    const input = pageSchema.parse(raw);
    const legal = PAGE_DEFINITIONS[key].legal;
    const { data, error } = await ctx.supabase
      .from('pages')
      .upsert(
        {
          organization_id: ctx.org.id,
          key,
          title: input.title,
          body: input.body,
          seo_title: input.seo_title ?? null,
          seo_description: input.seo_description ?? null,
          // Hukuki metinlerde "hukuk danışmanı inceledi" onayı her kayıtta açıkça verilir
          legal_reviewed: legal ? input.legal_reviewed === true : false,
          updated_by: ctx.user.id,
        },
        { onConflict: 'organization_id,key' },
      )
      .select('updated_at')
      .single();
    assertNoDbError(error);
    invalidateContent(ctx.org.id);
    return { updatedAt: data!.updated_at };
  }, 'Sayfa kaydedildi.');
}

/** Kaydı siler; sitede yeniden varsayılan şablon gösterilir */
export async function resetPage(key: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('content.manage');
    assertPageKey(key);
    const { error } = await ctx.supabase.from('pages').delete().eq('organization_id', ctx.org.id).eq('key', key);
    assertNoDbError(error);
    invalidateContent(ctx.org.id);
    return null;
  }, 'Sayfa varsayılan şablona döndürüldü.');
}

// -----------------------------------------------------------------------------
// Bölge sayfaları (/bolgeler/{slug})
// -----------------------------------------------------------------------------
const faqSchema = z.object({
  q: requiredText(5, 300, 'Soru'),
  a: requiredText(5, 2000, 'Yanıt'),
});

const optionalId = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .pipe(z.number().int().positive().nullable());

const regionSchema = z
  .object({
    name: requiredText(2, 80, 'Bölge adı'),
    slug: z
      .string()
      .max(120, { error: 'Adres çok uzun.' })
      .optional()
      .transform((v) => (v && v.trim() ? slugify(v, 80) : '')),
    city_id: z.coerce.number({ error: 'İl seçin.' }).int().positive({ error: 'İl seçin.' }),
    district_id: optionalId,
    neighborhood_id: optionalId,
    intro: optionalText(600),
    body: markdown(20000),
    faqs: z.array(faqSchema).max(20, { error: 'En fazla 20 soru eklenebilir.' }).default([]),
    seo_title: optionalText(70),
    seo_description: optionalText(200),
    status: contentStatus,
    sort_order: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .superRefine((v, issue) => {
    if (v.neighborhood_id && !v.district_id) {
      issue.addIssue({ code: 'custom', path: ['neighborhood_id'], message: 'Mahalle seçmek için önce ilçe seçin.' });
    }
  });

export type RegionInput = z.input<typeof regionSchema>;

async function loadRegion(ctx: OrgContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError('Bölge sayfası bulunamadı.');
  const { data, error } = await ctx.supabase
    .from('region_pages')
    .select('id, organization_id, slug, status, name')
    .eq('id', id)
    .maybeSingle();
  assertNoDbError(error);
  if (!data || data.organization_id !== ctx.org.id) throw new NotFoundError('Bölge sayfası bulunamadı veya erişim yetkiniz yok.');
  return data;
}

export async function saveRegionPage(id: string | null, raw: RegionInput): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('content.manage');
    const input = regionSchema.parse(raw);
    const slug = input.slug || slugify(input.name, 80);
    if (!slug) throw new ActionError('Lütfen işaretli alanları kontrol edin.', 'validation', { slug: ['Geçerli bir adres girin (harf ve rakam).'] });

    const fields = {
      name: input.name,
      slug,
      city_id: input.city_id,
      district_id: input.district_id,
      neighborhood_id: input.district_id ? input.neighborhood_id : null,
      intro: input.intro ?? null,
      body: input.body,
      faqs: input.faqs,
      seo_title: input.seo_title ?? null,
      seo_description: input.seo_description ?? null,
      status: input.status,
      sort_order: input.sort_order,
    };

    const existing = id ? await loadRegion(ctx, id) : null;
    const query = existing
      ? ctx.supabase.from('region_pages').update(fields).eq('id', existing.id)
      : ctx.supabase.from('region_pages').insert({ ...fields, organization_id: ctx.org.id });
    const { data, error } = await query.select('id, slug').single();
    if (error?.code === '23505') {
      throw new ActionError('Lütfen işaretli alanları kontrol edin.', 'validation', { slug: ['Bu adres başka bir bölge sayfasında kullanılıyor.'] });
    }
    assertNoDbError(error);
    if (existing && existing.status === 'published' && existing.slug !== data!.slug) {
      await moveAddress(ctx, `/bolgeler/${existing.slug}`, `/bolgeler/${data!.slug}`);
    }
    invalidateContent(ctx.org.id);
    return { id: data!.id, slug: data!.slug };
  }, 'Bölge sayfası kaydedildi.');
}

export async function deleteRegionPage(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('content.manage');
    const region = await loadRegion(ctx, id);
    const { error } = await ctx.supabase.from('region_pages').delete().eq('id', region.id);
    assertNoDbError(error);
    if (region.status === 'published') await moveAddress(ctx, `/bolgeler/${region.slug}`, '/bolgeler');
    invalidateContent(ctx.org.id);
    return null;
  }, 'Bölge sayfası silindi.');
}

// -----------------------------------------------------------------------------
// Yönlendirmeler (seo.manage)
// -----------------------------------------------------------------------------
const RESERVED_PREFIXES = ['/admin', '/api', '/platform', '/_next', '/onizleme', '/koleksiyon'];

function normalizePath(value: string): string {
  let p = value.trim();
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

const fromPathField = z
  .string()
  .max(400, { error: 'Adres en fazla 400 karakter olabilir.' })
  .refine((v) => !/^[a-z][a-z0-9+.-]*:/i.test(v.trim()), { error: 'Tam adres değil, yalnızca yol yazın (ör. /eski-sayfa).' })
  .transform(normalizePath)
  .refine((v) => v !== '/', { error: 'Ana sayfa yönlendirilemez.' })
  .refine((v) => /^\/(?![/\\])[^\s?#<>"'\\]*$/.test(v), { error: 'Adres boşluk, ? veya # içeremez.' })
  .refine((v) => !RESERVED_PREFIXES.some((prefix) => v === prefix || v.startsWith(`${prefix}/`)), {
    error: 'Bu adres sistem tarafından kullanılıyor ve yönlendirilemez.',
  });

const toPathField = z
  .string()
  .max(400, { error: 'Adres en fazla 400 karakter olabilir.' })
  .refine((v) => !/^[a-z][a-z0-9+.-]*:/i.test(v.trim()), { error: 'Yalnızca site içi bir adres girin (ör. /satilik).' })
  .transform(normalizePath)
  // "//alanadi.com" tarayıcıda başka siteye gider (açık yönlendirme) → reddedilir
  .refine((v) => /^\/(?![/\\])[^\s<>"'\\]*$/.test(v), { error: 'Geçerli bir site içi adres girin (ör. /satilik).' });

const redirectSchema = z
  .object({
    from_path: fromPathField,
    to_path: toPathField,
    status_code: z.coerce.number().refine((v) => [301, 302, 307, 308].includes(v), { error: 'Geçersiz yönlendirme türü.' }),
  })
  .refine((v) => v.from_path !== v.to_path, { error: 'Kaynak ve hedef adres aynı olamaz.', path: ['to_path'] });

export type RedirectInput = z.input<typeof redirectSchema>;

export async function saveRedirect(id: number | null, raw: RedirectInput): Promise<ActionResult<{ id: number }>> {
  return runAction(async () => {
    const ctx = await requirePermission('seo.manage');
    const input = redirectSchema.parse(raw);
    const db = ctx.supabase;

    // Döngü: hedef adres, kaynağa geri yönlenen bir kural ise reddedilir
    const { data: loop } = await db
      .from('redirects')
      .select('id')
      .eq('organization_id', ctx.org.id)
      .eq('from_path', input.to_path.split(/[?#]/)[0])
      .eq('to_path', input.from_path)
      .maybeSingle();
    if (loop) throw new ActionError('Bu kural bir yönlendirme döngüsü oluşturur (hedef adres tekrar kaynağa yönleniyor).', 'validation', { to_path: ['Döngü oluşuyor.'] });

    if (id !== null) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new NotFoundError('Yönlendirme bulunamadı.');
      const { data: row } = await db.from('redirects').select('id, organization_id').eq('id', id).maybeSingle();
      if (!row || row.organization_id !== ctx.org.id) throw new NotFoundError('Yönlendirme bulunamadı veya erişim yetkiniz yok.');
    }
    const query = id !== null
      ? db.from('redirects').update(input).eq('id', id)
      : db.from('redirects').insert({ ...input, organization_id: ctx.org.id });
    const { data, error } = await query.select('id').single();
    if (error?.code === '23505') {
      throw new ActionError('Lütfen işaretli alanları kontrol edin.', 'validation', { from_path: ['Bu adres için zaten bir yönlendirme var.'] });
    }
    assertNoDbError(error);
    invalidateRedirects(ctx.org.id);
    return { id: data!.id };
  }, 'Yönlendirme kaydedildi.');
}

export async function deleteRedirect(id: number): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('seo.manage');
    if (!Number.isSafeInteger(id) || id <= 0) throw new NotFoundError('Yönlendirme bulunamadı.');
    const { data, error } = await ctx.supabase.from('redirects').delete().eq('id', id).eq('organization_id', ctx.org.id).select('id');
    assertNoDbError(error);
    if (!data?.length) throw new NotFoundError('Yönlendirme bulunamadı veya erişim yetkiniz yok.');
    invalidateRedirects(ctx.org.id);
    return null;
  }, 'Yönlendirme silindi.');
}

// -----------------------------------------------------------------------------
// Site geneli SEO ayarları (seo.manage)
// -----------------------------------------------------------------------------

/** Google doğrulama: kod veya tam <meta> etiketi yapıştırılabilir */
function extractVerification(value: string): string {
  const v = value.trim();
  const fromMeta = /content\s*=\s*["']([^"']+)["']/i.exec(v);
  return (fromMeta ? fromMeta[1] : v).trim();
}

const seoSchema = z.object({
  seo_title: optionalText(70),
  seo_description: optionalText(200),
  og_image_url: z
    .string()
    .trim()
    .max(500, { error: 'Adres çok uzun.' })
    .refine((v) => v === '' || /^https:\/\/[^\s<>"']+$/i.test(v), { error: 'https:// ile başlayan bir görsel adresi girin veya görsel yükleyin.' })
    .transform((v) => v || null)
    .nullable()
    .optional(),
  google_site_verification: z
    .string()
    .max(500)
    .transform(extractVerification)
    .refine((v) => v === '' || /^[A-Za-z0-9_-]{10,100}$/.test(v), { error: 'Doğrulama kodu 10–100 karakterlik harf, rakam, - veya _ içermelidir.' })
    .transform((v) => v || null)
    .nullable()
    .optional(),
});

export type SeoSettingsInput = z.input<typeof seoSchema>;

/**
 * Site geneli SEO ayarları — P0.3: TASLAĞA yazılır (ortak servis saveSeoDraft; ayrı bir SEO yayın
 * sistemi yok). Canlı site, /admin/site'taki "Yayınla" ile (marka, ana sayfa ve SEO birlikte, tek
 * işlemde) değişir; önizlemede hemen görünür; sürüm geçmişinden geri alınabilir. seo.manage yetkisi
 * yeter (editör taslağı yazar; yayın settings.manage ister). Organizasyon oturumdan gelir.
 */
export async function saveSeoSettings(raw: SeoSettingsInput, expected?: string | null): Promise<ActionResult<SavedDraft>> {
  return runAction(async () => {
    const ctx = await requirePermission('seo.manage');
    const input = seoSchema.parse(raw);
    const draftToken = await saveSeoDraft(
      ctx.supabase,
      ctx.org.id,
      {
        title: input.seo_title ?? null,
        description: input.seo_description ?? null,
        googleSiteVerification: input.google_site_verification ?? null,
        ...(input.og_image_url !== undefined ? { ogImageUrl: input.og_image_url } : {}),
      },
      expected,
    );
    revalidatePath('/admin', 'layout');
    return { draftToken };
  }, 'Kaydedildi — taslak. Sitede görünmesi için Site yönetimi › "Yayınla".');
}
