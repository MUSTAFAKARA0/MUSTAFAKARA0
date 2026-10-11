import 'server-only';
import { isUuid, one } from '@/lib/utils';
import type { MediaSource } from '@/modules/media/variants';
import type { OrgContext } from '@/platform/auth/session';

/**
 * Medya kütüphanesi: organizasyonun tüm görselleri (ilan fotoğrafları ve
 * içerik görselleri). Oturum istemcisiyle çalışır (RLS: yalnızca kendi
 * organizasyonunun medyası) ve her sorgu aktif organizasyonla sınırlanır.
 */

export const LIBRARY_PAGE_SIZE = 40;

export const LIBRARY_TYPES = {
  jpeg: { mime: 'image/jpeg', label: 'JPEG' },
  png: { mime: 'image/png', label: 'PNG' },
  webp: { mime: 'image/webp', label: 'WebP' },
  avif: { mime: 'image/avif', label: 'AVIF' },
} as const;
export type LibraryType = keyof typeof LIBRARY_TYPES;

/** Orijinal dosya boyutuna göre gruplar */
export const LIBRARY_SIZES = {
  kucuk: { label: '1 MB altı', min: 0, max: 1024 * 1024 },
  orta: { label: '1–10 MB', min: 1024 * 1024, max: 10 * 1024 * 1024 },
  buyuk: { label: '10 MB üzeri', min: 10 * 1024 * 1024, max: null },
} as const;
export type LibrarySize = keyof typeof LIBRARY_SIZES;

export interface LibraryFilters {
  kind?: 'ilan' | 'icerik';
  propertyId?: string;
  type?: LibraryType;
  size?: LibrarySize;
  days?: number;
  status?: 'ready' | 'failed' | 'pending';
  q?: string;
  sort: 'yeni' | 'eski' | 'buyuk';
  page: number;
}

export interface LibraryItem {
  id: string;
  kind: 'property_photo' | 'post_cover' | 'general';
  status: 'pending' | 'ready' | 'failed';
  media: MediaSource;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  variantsByteSize: number;
  isCover: boolean;
  error: string | null;
  createdAt: string;
  property: { id: string; title: string; referenceNo: string; deleted: boolean } | null;
  usedBy: { id: string; title: string }[];
}

type PropertyRel = { id: string; title: string; reference_no: string; deleted_at: string | null };

export async function listLibrary(ctx: OrgContext, f: LibraryFilters) {
  const from = (f.page - 1) * LIBRARY_PAGE_SIZE;
  let query = ctx.supabase
    .from('media_assets')
    .select(
      'id, kind, status, public_base, legacy_path, variant_widths, width, height, blur_data_url, alt_text, byte_size, variants_byte_size, mime_type, original_filename, is_cover, error, created_at, property:properties!media_assets_property_id_fkey(id, title, reference_no, deleted_at)',
      { count: 'exact' },
    )
    .eq('organization_id', ctx.org.id);

  if (f.kind === 'ilan') query = query.eq('kind', 'property_photo');
  if (f.kind === 'icerik') query = query.neq('kind', 'property_photo');
  if (f.propertyId && isUuid(f.propertyId)) query = query.eq('property_id', f.propertyId);
  if (f.type) query = query.eq('mime_type', LIBRARY_TYPES[f.type].mime);
  if (f.size) {
    const range = LIBRARY_SIZES[f.size];
    query = query.gte('byte_size', range.min);
    if (range.max !== null) query = query.lt('byte_size', range.max);
  }
  if (f.days) query = query.gte('created_at', new Date(Date.now() - f.days * 86_400_000).toISOString());
  if (f.status) query = query.eq('status', f.status);
  const term = (f.q ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60);
  if (term.length >= 2) query = query.ilike('original_filename', `%${term}%`);

  query =
    f.sort === 'eski'
      ? query.order('created_at', { ascending: true })
      : f.sort === 'buyuk'
        ? query.order('byte_size', { ascending: false, nullsFirst: false })
        : query.order('created_at', { ascending: false });
  const { data, count, error } = await query.order('id').range(from, from + LIBRARY_PAGE_SIZE - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`Medya yüklenemedi: ${error.message}`);

  const rows = data ?? [];
  // İçerik görsellerinin hangi yazıda kullanıldığı
  const contentIds = rows.filter((r) => r.kind !== 'property_photo').map((r) => r.id);
  const usage = new Map<string, { id: string; title: string }[]>();
  if (contentIds.length) {
    const { data: posts } = await ctx.supabase
      .from('posts')
      .select('id, title, cover_media_id')
      .eq('organization_id', ctx.org.id)
      .in('cover_media_id', contentIds);
    for (const p of posts ?? []) {
      if (!p.cover_media_id) continue;
      usage.set(p.cover_media_id, [...(usage.get(p.cover_media_id) ?? []), { id: p.id, title: p.title }]);
    }
  }

  const items: LibraryItem[] = rows.map((r) => {
    const property = one(r.property as PropertyRel | PropertyRel[] | null);
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      media: {
        public_base: r.public_base,
        legacy_path: r.legacy_path,
        variant_widths: r.variant_widths,
        width: r.width,
        height: r.height,
        blur_data_url: r.blur_data_url,
        alt_text: r.alt_text,
      },
      fileName: r.original_filename,
      mimeType: r.mime_type,
      width: r.width,
      height: r.height,
      byteSize: r.byte_size,
      variantsByteSize: r.variants_byte_size,
      isCover: r.is_cover,
      error: r.error,
      createdAt: r.created_at,
      property: property ? { id: property.id, title: property.title, referenceNo: property.reference_no, deleted: Boolean(property.deleted_at) } : null,
      usedBy: usage.get(r.id) ?? [],
    };
  });
  const total = count ?? 0;
  return { items, total, pageCount: Math.ceil(total / LIBRARY_PAGE_SIZE) };
}

/** "İlan" filtresi için seçenekler (son güncellenen önce) */
export async function libraryPropertyOptions(ctx: OrgContext): Promise<{ id: string; label: string }[]> {
  const { data } = await ctx.supabase
    .from('properties')
    .select('id, title, reference_no')
    .eq('organization_id', ctx.org.id)
    .order('updated_at', { ascending: false })
    .limit(500);
  return (data ?? []).map((p) => ({ id: p.id, label: `${p.reference_no} · ${p.title}` }));
}

export interface StorageUsage {
  usedBytes: number;
  limitMb: number | null;
  failed: number;
  pending: number;
}

export async function libraryUsage(ctx: OrgContext): Promise<StorageUsage> {
  const [{ data: usage }, failed, pending] = await Promise.all([
    ctx.supabase.rpc('org_usage', { p_org: ctx.org.id }),
    ctx.supabase.from('media_assets').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.org.id).eq('status', 'failed'),
    ctx.supabase.from('media_assets').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.org.id).eq('status', 'pending'),
  ]);
  const u = (usage ?? {}) as { usage?: { storage_bytes?: number }; limits?: { storage_mb?: number | null } };
  return {
    usedBytes: Number(u.usage?.storage_bytes ?? 0),
    limitMb: u.limits?.storage_mb ?? null,
    failed: failed.count ?? 0,
    pending: pending.count ?? 0,
  };
}
