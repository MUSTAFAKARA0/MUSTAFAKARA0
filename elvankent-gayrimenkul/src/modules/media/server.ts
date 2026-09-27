import 'server-only';
import { randomBytes } from 'node:crypto';
import type { DB } from '@/lib/supabase/server';
import { MEDIA_BUCKETS } from '@/modules/media/variants';

/**
 * Depolama yolları. Yol, KULLANICI GİRDİSİ (dosya adı) İÇERMEZ; yalnızca
 * veritabanından doğrulanmış kimliklerden üretilir. İlk iki klasör
 * (organizations/{org}) Storage RLS politikalarıyla doğrulanır.
 *
 *   media-originals: organizations/{org}/properties/{ilan}/images/{medya}/original
 *   media:           organizations/{org}/properties/{ilan}/images/{medya}/{rev}/w{genişlik}.webp
 *   içerik görseli:  organizations/{org}/content/{medya}/original (+ /{rev}/w{genişlik}.webp)
 *
 * {rev}: her işlemede (ör. döndürme) değişen kısa rastgele sürüm → CDN'de
 * eski görsel kalmaz, dosyalar "immutable" önbelleğe alınabilir.
 */
export function mediaFolder(orgId: string, propertyId: string, mediaId: string): string {
  return `organizations/${orgId}/properties/${propertyId}/images/${mediaId}`;
}

export function originalPath(orgId: string, propertyId: string, mediaId: string): string {
  return `${mediaFolder(orgId, propertyId, mediaId)}/original`;
}

export type Rotation = 0 | 90 | 180 | 270;

/** İlana bağlı olmayan içerik görselleri (blog kapağı vb.) */
export function contentOriginalPath(orgId: string, mediaId: string): string {
  return `organizations/${orgId}/content/${mediaId}/original`;
}

/**
 * Yeni varyant klasörü: orijinalin bulunduğu klasörün altında rastgele sürüm.
 * Kullanıcı döndürmesi sürüm etiketinde saklanır (…/{rev}-r90).
 */
export function newPublicBase(originalPath: string, rotation: Rotation = 0): string {
  const folder = originalPath.replace(/\/original$/, '');
  const rev = randomBytes(6).toString('base64url').replace(/-/g, 'x');
  return `${folder}/${rev}${rotation ? `-r${rotation}` : ''}`;
}

/** Mevcut varyantların uygulanmış döndürme açısı */
export function rotationOf(publicBase: string | null): Rotation {
  const match = /-r(90|180|270)$/.exec(publicBase ?? '');
  return match ? (Number(match[1]) as Rotation) : 0;
}

export function variantPaths(publicBase: string, widths: number[]): string[] {
  return widths.map((w) => `${publicBase}/w${w}.webp`);
}

/** Dosya adını yalnızca GÖRÜNTÜLEME için normalleştirir (depolama yolunda kullanılmaz). */
export function normalizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  const cleaned = base
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return (cleaned || 'fotograf').slice(0, 120);
}

/**
 * Bir medyanın tüm dosyalarını siler (varyantlar + orijinal). Hata olursa
 * yolları döndürür; çağıran taraf kaydı "failed" olarak bırakıp zamanlanmış
 * temizliğe devredebilir (yetim dosya kalmaz).
 */
export async function removeMediaFiles(
  db: DB,
  media: { original_path: string | null; public_base: string | null; variant_widths: number[] | null },
): Promise<{ ok: boolean }> {
  const tasks: Promise<{ error: unknown }>[] = [];
  const publicBase = media.public_base;
  if (publicBase && !publicBase.startsWith('/')) {
    const paths = variantPaths(publicBase, media.variant_widths ?? []);
    if (paths.length) tasks.push(db.storage.from(MEDIA_BUCKETS.public).remove(paths));
  }
  if (media.original_path) tasks.push(db.storage.from(MEDIA_BUCKETS.originals).remove([media.original_path]));
  const results = await Promise.all(tasks);
  return { ok: results.every((r) => !r.error) };
}

/** Yönetim panelinde kullanılan medya satırı */
export const ADMIN_MEDIA_FIELDS =
  'id, property_id, status, public_base, legacy_path, variant_widths, width, height, blur_data_url, alt_text, sort_order, is_cover, byte_size, variants_byte_size, mime_type, original_filename, error, created_at, processed_at';

export interface AdminMedia {
  id: string;
  property_id: string | null;
  status: 'pending' | 'ready' | 'failed';
  public_base: string | null;
  legacy_path: string | null;
  variant_widths: number[];
  width: number | null;
  height: number | null;
  blur_data_url: string | null;
  alt_text: string | null;
  sort_order: number;
  is_cover: boolean;
  byte_size: number | null;
  variants_byte_size: number;
  mime_type: string | null;
  original_filename: string | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
}
