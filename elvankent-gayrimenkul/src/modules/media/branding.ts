import 'server-only';
import sharp, { type Metadata, type Sharp } from 'sharp';
import type { Permission } from '@/platform/auth/permissions';

/**
 * Marka görselleri (logo, favicon, ana sayfa görseli, paylaşım görseli).
 * Yüklenen dosyanın GERÇEK türü sunucuda doğrulanır. SVG yalnızca logo, mobil logo
 * ve site simgesi için ve güvenli biçimde kabul edilir: betik, olay niteliği, dış
 * bağlantı, gömülü içerik (foreignObject) veya varlık tanımı (XXE) içeren dosya
 * reddedilir; kabul edilen SVG sunucuda PNG'ye dönüştürülür (siteye SVG gitmez).
 * Çıktı her zaman sunucuda yeniden kodlanır → EXIF/GPS ve gömülü içerik temizlenir. Dosyalar `branding` kovasında
 * organizations/{org}/branding/{tür}-{rastgele}.{png|jpg} yoluna yazılır.
 */
export type BrandingKind = 'logo' | 'logo_mobile' | 'favicon' | 'hero' | 'og';

export const BRANDING_KINDS: readonly BrandingKind[] = ['logo', 'logo_mobile', 'favicon', 'hero', 'og'];

export const BRANDING_COLUMN = {
  logo: 'logo_url',
  logo_mobile: 'logo_mobile_url',
  favicon: 'favicon_url',
  hero: 'hero_image_url',
  og: 'og_image_url',
} as const satisfies Record<BrandingKind, string>;

/** Paylaşım görseli SEO yetkisiyle, diğerleri şirket ayarları yetkisiyle yönetilir */
export const BRANDING_PERMISSION: Record<BrandingKind, Permission> = {
  logo: 'settings.manage',
  logo_mobile: 'settings.manage',
  favicon: 'settings.manage',
  hero: 'settings.manage',
  og: 'seo.manage',
};

export const BRANDING_LABEL: Record<BrandingKind, string> = {
  logo: 'Logo',
  logo_mobile: 'Mobil logo',
  favicon: 'Site simgesi',
  hero: 'Ana sayfa görseli',
  og: 'Paylaşım görseli',
};

/** Yükleme üst sınırı (dönüştürme öncesi). Çıktı kovanın 2 MB sınırının altında tutulur. */
export const BRANDING_MAX_INPUT_BYTES = 15 * 1024 * 1024;
const OUTPUT_LIMIT = 2 * 1024 * 1024;

const MIN_SIZE: Record<BrandingKind, { width: number; height: number }> = {
  logo: { width: 120, height: 40 },
  logo_mobile: { width: 80, height: 30 },
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

const SVG_KINDS: readonly BrandingKind[] = ['logo', 'logo_mobile', 'favicon'];

/** SVG güvenlik kontrolü: yalnızca düz vektör çizimler (betik/dış kaynak/gömülü içerik yok) */
function assertSafeSvg(input: Buffer): void {
  const text = input.toString('utf8');
  const forbidden = [/<script/i, /<foreignObject/i, /<!ENTITY/i, /<!DOCTYPE/i, /\son[a-z]+\s*=/i, /javascript:/i, /(xlink:)?href\s*=\s*["'](?!#)/i, /<image/i, /<use[^>]+href\s*=\s*["'][^#]/i, /@import/i, /url\(\s*["']?(?!#)/i];
  if (forbidden.some((re) => re.test(text))) {
    throw new BrandingError('Bu SVG dosyası güvenlik nedeniyle kabul edilmedi (betik, dış bağlantı veya gömülü içerik var). Düz bir SVG veya PNG yükleyin.');
  }
}

function looksLikeSvg(input: Buffer): boolean {
  const head = input.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
}

export async function processBranding(kind: BrandingKind, input: Buffer): Promise<BrandingOutput> {
  const svg = looksLikeSvg(input);
  if (svg) {
    if (!SVG_KINDS.includes(kind)) throw new BrandingError('SVG yalnızca logo ve site simgesi için kabul edilir. Bu alan için JPG, PNG veya WEBP yükleyin.');
    if (input.length > 1024 * 1024) throw new BrandingError('SVG dosyası çok büyük (en fazla 1 MB).');
    assertSafeSvg(input);
  }
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 60_000_000, failOn: 'error', ...(svg ? { density: 300 } : {}) }).metadata();
  } catch {
    throw new BrandingError('Dosya okunamadı. Geçerli bir JPG, PNG, WEBP, AVIF (logoda SVG) görsel yükleyin.');
  }
  const format = meta.format === 'heif' ? (meta.compression === 'av1' ? 'avif' : 'heif') : meta.format;
  if (!format || !['jpeg', 'png', 'webp', 'avif', ...(svg ? ['svg'] : [])].includes(format)) {
    throw new BrandingError('Bu dosya türü desteklenmiyor. JPG, PNG, WEBP veya AVIF yükleyin (logo ve site simgesinde SVG de olur).');
  }
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;
  const min = MIN_SIZE[kind];
  // Vektör (SVG) her boyuta ölçeklenir; en küçük boyut kontrolü yalnızca piksel görsellerde
  if (!svg && (width < min.width || height < min.height)) {
    throw new BrandingError(`Görsel çok küçük (${width}×${height} px). En az ${min.width}×${min.height} px olmalıdır.`);
  }

  const base = () => sharp(input, { limitInputPixels: 60_000_000, failOn: 'error', ...(svg ? { density: 300 } : {}) }).autoOrient();
  let pipeline: Sharp;
  let contentType: BrandingOutput['contentType'] = 'image/png';
  switch (kind) {
    case 'logo':
      pipeline = base().resize({ width: 1200, height: 480, fit: 'inside', withoutEnlargement: !svg }).png({ compressionLevel: 9, adaptiveFiltering: true });
      break;
    case 'logo_mobile':
      pipeline = base().resize({ width: 600, height: 240, fit: 'inside', withoutEnlargement: !svg }).png({ compressionLevel: 9, adaptiveFiltering: true });
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
        : kind === 'logo' || kind === 'logo_mobile'
          ? base().resize({ width: kind === 'logo' ? 1200 : 600, height: kind === 'logo' ? 480 : 240, fit: 'inside', withoutEnlargement: true }).png({ palette: true, quality: 90 })
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
