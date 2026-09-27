import 'server-only';
import sharp, { type Metadata, type Sharp } from 'sharp';
import type { Permission } from '@/platform/auth/permissions';

/**
 * Marka görselleri (logo, favicon, ana sayfa görseli, paylaşım görseli).
 * Yüklenen dosyanın GERÇEK türü sunucuda doğrulanır; SVG kabul edilmez (betik
 * içerebilir). Çıktı her zaman sunucuda yeniden kodlanır → EXIF/GPS ve gömülü
 * içerik temizlenir. Dosyalar `branding` kovasında
 * organizations/{org}/branding/{tür}-{rastgele}.{png|jpg} yoluna yazılır.
 */
export type BrandingKind = 'logo' | 'favicon' | 'hero' | 'og';

export const BRANDING_KINDS: readonly BrandingKind[] = ['logo', 'favicon', 'hero', 'og'];

export const BRANDING_COLUMN = {
  logo: 'logo_url',
  favicon: 'favicon_url',
  hero: 'hero_image_url',
  og: 'og_image_url',
} as const satisfies Record<BrandingKind, string>;

/** Paylaşım görseli SEO yetkisiyle, diğerleri şirket ayarları yetkisiyle yönetilir */
export const BRANDING_PERMISSION: Record<BrandingKind, Permission> = {
  logo: 'settings.manage',
  favicon: 'settings.manage',
  hero: 'settings.manage',
  og: 'seo.manage',
};

export const BRANDING_LABEL: Record<BrandingKind, string> = {
  logo: 'Logo',
  favicon: 'Site simgesi',
  hero: 'Ana sayfa görseli',
  og: 'Paylaşım görseli',
};

/** Yükleme üst sınırı (dönüştürme öncesi). Çıktı kovanın 2 MB sınırının altında tutulur. */
export const BRANDING_MAX_INPUT_BYTES = 15 * 1024 * 1024;
const OUTPUT_LIMIT = 2 * 1024 * 1024;

const MIN_SIZE: Record<BrandingKind, { width: number; height: number }> = {
  logo: { width: 120, height: 40 },
  favicon: { width: 64, height: 64 },
  hero: { width: 1280, height: 600 },
  og: { width: 600, height: 315 },
};

export class BrandingError extends Error {}

export interface BrandingOutput {
  buffer: Buffer;
  contentType: 'image/png' | 'image/jpeg';
  ext: 'png' | 'jpg';
  width: number;
  height: number;
}

export async function processBranding(kind: BrandingKind, input: Buffer): Promise<BrandingOutput> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 60_000_000, failOn: 'error' }).metadata();
  } catch {
    throw new BrandingError('Dosya okunamadı. Geçerli bir JPG, PNG, WEBP veya AVIF görsel yükleyin.');
  }
  const format = meta.format === 'heif' ? (meta.compression === 'av1' ? 'avif' : 'heif') : meta.format;
  if (!format || !['jpeg', 'png', 'webp', 'avif'].includes(format)) {
    throw new BrandingError('Bu dosya türü desteklenmiyor. JPG, PNG, WEBP veya AVIF yükleyin (SVG güvenlik nedeniyle kabul edilmez).');
  }
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;
  const min = MIN_SIZE[kind];
  if (width < min.width || height < min.height) {
    throw new BrandingError(`Görsel çok küçük (${width}×${height} px). En az ${min.width}×${min.height} px olmalıdır.`);
  }

  const base = () => sharp(input, { limitInputPixels: 60_000_000, failOn: 'error' }).autoOrient();
  let pipeline: Sharp;
  let contentType: BrandingOutput['contentType'] = 'image/png';
  switch (kind) {
    case 'logo':
      pipeline = base().resize({ width: 1200, height: 480, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, adaptiveFiltering: true });
      break;
    case 'favicon':
      pipeline = base()
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 });
      break;
    case 'hero':
      contentType = 'image/jpeg';
      pipeline = base().resize({ width: 2400, height: 1600, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).toColorspace('srgb').jpeg({ quality: 82, mozjpeg: true });
      break;
    case 'og':
      contentType = 'image/jpeg';
      pipeline = base().resize(1200, 630, { fit: 'cover', position: sharp.strategy.attention }).flatten({ background: '#ffffff' }).toColorspace('srgb').jpeg({ quality: 85, mozjpeg: true });
      break;
  }

  let { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  if (data.length > OUTPUT_LIMIT) {
    // Fotoğraf benzeri logolar için paletli PNG, fotoğraflar için daha düşük JPEG kalitesi
    const retry =
      kind === 'favicon'
        ? base().resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ palette: true })
        : kind === 'logo'
          ? base().resize({ width: 1200, height: 480, fit: 'inside', withoutEnlargement: true }).png({ palette: true, quality: 90 })
          : kind === 'og'
            ? base().resize(1200, 630, { fit: 'cover', position: sharp.strategy.attention }).flatten({ background: '#ffffff' }).jpeg({ quality: 70, mozjpeg: true })
            : base().resize({ width: 2000, height: 1400, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 70, mozjpeg: true });
    ({ data, info } = await retry.toBuffer({ resolveWithObject: true }));
    if (data.length > OUTPUT_LIMIT) throw new BrandingError('Görsel dönüştürüldükten sonra da 2 MB sınırını aşıyor. Daha sade veya küçük bir görsel deneyin.');
  }
  return { buffer: data, contentType, ext: contentType === 'image/png' ? 'png' : 'jpg', width: info.width, height: info.height };
}

/** Yalnızca bu organizasyonun marka klasöründeki yollar silinebilir */
export function isOwnBrandingPath(orgId: string, value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(`organizations/${orgId}/branding/`) && !value.includes('..');
}
