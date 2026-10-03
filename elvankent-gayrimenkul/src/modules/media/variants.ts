import { publicEnv } from '@/lib/env';

/**
 * Görsel varyant sistemi (sunucuda, yükleme anında üretilir):
 *
 *   thumbnail 320 · small 640 · medium 960 · large 1440 · gallery 2048 · high-res 2880
 *
 * Orijinal dosya (4K ve üzeri) özel kovada saklanır ve ziyaretçiye gönderilmez.
 * Varyantlar WebP'dir, EXIF/GPS içermez ve herkese açık kovadan CDN ile
 * sunulur. Orijinal genişliği aşan varyant üretilmez (büyütme yapılmaz).
 *
 * Neden Supabase görsel dönüşümü değil? Resmi dokümantasyona göre dönüşüm
 * Pro plan gerektirir, en fazla 2500 px genişlik ve 25 MB kaynak ile
 * sınırlıdır ve kaynak görsel başına ücretlendirilir. Önceden üretilmiş
 * varyantlar her planda çalışır ve ek maliyet doğurmaz.
 */
export const VARIANT_WIDTHS = [320, 640, 960, 1440, 2048, 2880] as const;

export const VARIANT_NAMES: Record<number, string> = {
  320: 'thumbnail',
  640: 'small',
  960: 'medium',
  1440: 'large',
  2048: 'gallery',
  2880: 'high-res',
};

export const MEDIA_BUCKETS = {
  originals: 'media-originals',
  public: 'media',
  branding: 'branding',
  legacy: 'property-images',
} as const;

export const MEDIA_LIMITS = {
  /** Orijinal dosya üst sınırı (Supabase Free planının global sınırı 50 MB) */
  maxOriginalBytes: 50 * 1024 * 1024,
  maxImagesPerProperty: 50,
  minWidth: 600,
  minHeight: 400,
  /** Çözünürlük üst sınırı (bellek güvenliği): 100 MP */
  maxPixels: 100_000_000,
  acceptedMime: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as readonly string[],
  /** Tarayıcıda JPEG'e dönüştürülmeye çalışılan formatlar */
  convertibleMime: ['image/heic', 'image/heif'] as readonly string[],
  acceptAttr: 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif',
};

/** Orijinal genişliğe göre üretilecek varyant genişlikleri */
export function planVariantWidths(originalWidth: number): number[] {
  const widths: number[] = VARIANT_WIDTHS.filter((w) => w < originalWidth);
  const top = Math.min(originalWidth, VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]);
  if (!widths.includes(top)) widths.push(top);
  return widths;
}

export interface MediaSource {
  public_base: string | null;
  legacy_path: string | null;
  variant_widths: number[] | null;
  width: number | null;
  height: number | null;
  blur_data_url?: string | null;
  alt_text?: string | null;
}

function storagePublicUrl(bucket: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** İstenen genişliği karşılayan en küçük varyant (yoksa en büyüğü) */
export function pickVariantWidth(widths: number[], requested: number): number {
  const sorted = [...widths].sort((a, b) => a - b);
  return sorted.find((w) => w >= requested) ?? sorted[sorted.length - 1];
}

/** Görselin istenen genişliğe uygun varyant adresi */
export function mediaUrl(media: MediaSource, requestedWidth = 1440): string {
  const widths = media.variant_widths ?? [];
  if (media.public_base && widths.length > 0) {
    const w = pickVariantWidth(widths, requestedWidth);
    const path = `${media.public_base}/w${w}.webp`;
    return path.startsWith('/') ? path : storagePublicUrl(MEDIA_BUCKETS.public, path);
  }
  if (media.legacy_path) {
    return media.legacy_path.startsWith('/') ? media.legacy_path : storagePublicUrl(MEDIA_BUCKETS.legacy, media.legacy_path);
  }
  return '/placeholder-property.svg';
}

/** Düz <img> için srcset (next/image kullanılamayan yerler: OG, e-posta, yazdırma) */
export function mediaSrcSet(media: MediaSource): string | undefined {
  const widths = media.variant_widths ?? [];
  if (!media.public_base || widths.length === 0) return undefined;
  return [...widths].sort((a, b) => a - b).map((w) => `${mediaUrl(media, w)} ${w}w`).join(', ');
}

/** Herkese açık kovadaki bir dosyanın adresi (logo, favicon vb.) */
export function brandingUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl) || pathOrUrl.startsWith('/')) return pathOrUrl;
  return storagePublicUrl(MEDIA_BUCKETS.branding, pathOrUrl);
}
