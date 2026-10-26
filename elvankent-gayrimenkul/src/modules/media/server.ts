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
  const failed = results.filter((r) => r.error);
  if (failed.length) console.error('[media] file removal failed', { count: failed.length });
  return { ok: failed.length === 0 };
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CANONICAL_ORIGINAL = new RegExp(`^organizations/(${UUID})/(?:properties/${UUID}/images|content)/${UUID}/original$`);

/**
 * Satırın depolama klasörü (`organizations/{org}/.../{id}`). Yalnız kanonik orijinal yolundan türetilir ve
 * organizasyon bölümü satırın organization_id'sine eşit olmalıdır; aksi halde null (klasör silinmez).
 */
export function mediaFolderOf(media: { original_path: string | null }, organizationId: string): string | null {
  const match = media.original_path ? CANONICAL_ORIGINAL.exec(media.original_path) : null;
  if (!match || match[1] !== organizationId.toLowerCase()) return null;
  return (media.original_path as string).replace(/\/original$/, '');
}

/** Eski tek-yol silme için: satırın tüm yolları kendi organizasyonunun ön ekiyle başlıyor mu (demo '/' tabanı hariç) */
export function pathsOwnedByOrg(media: { original_path: string | null; public_base: string | null }, organizationId: string): boolean {
  const prefix = `organizations/${organizationId}/`;
  const ok = (p: string | null) => !p || p.startsWith('/') || (p.startsWith(prefix) && !p.split('/').includes('..'));
  return ok(media.original_path) && ok(media.public_base);
}

/** Silme kuyruğu öğesi güvenli mi: org_id var, yol o kurumun ön ekiyle başlıyor ve `..` yok */
export function queueItemIsSafe(item: { org_id?: string | null; path?: string | null }): boolean {
  if (!item.org_id || typeof item.path !== 'string') return false;
  return item.path.startsWith(`organizations/${item.org_id}/`) && !item.path.split('/').includes('..') && !item.path.includes('//');
}

const LIST_PAGE = 100;
const MAX_DEPTH = 3;

async function listFilesRecursive(db: DB, bucket: string, prefix: string, depth: number, out: string[]): Promise<boolean> {
  let ok = true;
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: LIST_PAGE, offset });
    if (error) {
      console.error('[media] list failed', { bucket, prefix, message: error.message });
      return false;
    }
    for (const entry of data ?? []) {
      // Klasör girdilerinin id'si null'dır
      if (entry.id === null || entry.id === undefined) {
        if (depth < MAX_DEPTH) ok = (await listFilesRecursive(db, bucket, `${prefix}/${entry.name}`, depth + 1, out)) && ok;
        else ok = false; // derinlik sınırı: dosyalar kalmış olabilir, satır silinmemeli
      } else out.push(`${prefix}/${entry.name}`);
    }
    if (!data || data.length < LIST_PAGE) return ok;
  }
}

/**
 * Bir medyanın klasörünü (`organizations/.../{id}/`) iki kovadan da tamamen siler:
 * revizyon klasörleri listelenir (yalnız kayıtlı public_base değil, yetim sürümler de gider).
 * Dönüş değerleri denetlenir; başarısızlık günlüğe yazılır.
 */
export async function removeMediaFolder(db: DB, folder: string): Promise<{ ok: boolean; removed: number }> {
  let ok = true;
  let removed = 0;
  for (const bucket of [MEDIA_BUCKETS.public, MEDIA_BUCKETS.originals]) {
    const files: string[] = [];
    if (!(await listFilesRecursive(db, bucket, folder, 0, files))) ok = false;
    for (let i = 0; i < files.length; i += LIST_PAGE) {
      const chunk = files.slice(i, i + LIST_PAGE);
      const { error } = await db.storage.from(bucket).remove(chunk);
      if (error) {
        ok = false;
        console.error('[media] folder remove failed', { bucket, folder, message: error.message });
      } else removed += chunk.length;
    }
  }
  return { ok, removed };
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
