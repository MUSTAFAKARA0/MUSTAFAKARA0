import 'server-only';
import sharp, { type Metadata } from 'sharp';
import { MEDIA_LIMITS, planVariantWidths } from '@/modules/media/variants';

/**
 * Sunucuda görsel doğrulama ve varyant üretimi (sharp / libvips).
 *
 * - Dosya türü uzantıya veya tarayıcının bildirdiği MIME'a göre DEĞİL, dosyanın
 *   gerçek içeriğine (sihirli baytlar) göre belirlenir.
 * - EXIF yönü uygulanır, ardından tüm meta veriler (EXIF/GPS/kamera bilgisi)
 *   varyantlardan silinir; renkler sRGB'ye dönüştürülür.
 * - Orijinalden büyük varyant üretilmez (büyütme yok). Ana galeri boyutlarında
 *   kalite yüksek tutulur.
 */

export class MediaValidationError extends Error {
  // Alan açıkça tanımlanır (TS parametre özelliği değil): birim testleri modülü tip silme kipinde yükleyebilir
  readonly code: 'unsupported' | 'too_small' | 'too_large' | 'corrupt';
  constructor(message: string, code: MediaValidationError['code']) {
    super(message);
    this.name = 'MediaValidationError';
    this.code = code;
  }
}

export interface InspectedImage {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
  /** EXIF yönü uygulanmış boyutlar */
  width: number;
  height: number;
}

export interface ProcessedImage {
  width: number;
  height: number;
  variants: { width: number; buffer: Buffer }[];
  blurDataUrl: string | null;
  variantsBytes: number;
}

const INPUT_OPTIONS = { limitInputPixels: MEDIA_LIMITS.maxPixels, failOn: 'error' as const };

const UNSUPPORTED_MESSAGE = 'Bu dosya desteklenmeyen bir formatta. JPG, PNG, WEBP veya AVIF yükleyin.';
const CORRUPT_MESSAGE = 'Dosya okunamadı. Bozuk veya desteklenmeyen bir görsel olabilir.';

export type ImageContainer = 'jpeg' | 'png' | 'webp' | 'isobmff' | 'svg' | 'gif' | 'tiff';

/**
 * Dosyanın ilk baytlarından kapsayıcı türünü belirler (çözücü çalıştırmadan).
 * isobmff = HEIF/AVIF ("ftyp" kutusu); hangi kodek olduğuna sonra sharp bakar.
 */
export function sniffImageContainer(input: Buffer): ImageContainer | null {
  const ascii = (start: number, end: number) => input.subarray(start, end).toString('latin1');
  if (input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return 'jpeg';
  if (input.length >= 8 && input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (input.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (input.length >= 12 && ascii(4, 8) === 'ftyp') return 'isobmff';
  if (input.length >= 6 && /^GIF8[79]a$/.test(ascii(0, 6))) return 'gif';
  if (input.length >= 4 && (ascii(0, 4) === 'II*\0' || ascii(0, 4) === 'MM\0*')) return 'tiff';
  // SVG / XML: isteğe bağlı UTF-8 BOM ve boşluktan sonra "<"
  let i = input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf ? 3 : 0;
  while (i < input.length && i < 1024 && (input[i] === 0x20 || input[i] === 0x09 || input[i] === 0x0a || input[i] === 0x0d)) i++;
  if (input[i] === 0x3c) return 'svg';
  return null;
}

/** Çözücüye (libvips) ulaşmasına izin verilen kapsayıcılar: JPEG, PNG, WebP, HEIF/AVIF */
const DECODABLE: ReadonlySet<ImageContainer> = new Set(['jpeg', 'png', 'webp', 'isobmff']);

function qualityFor(width: number): number {
  if (width <= 640) return 76;
  if (width <= 1440) return 80;
  return 84;
}

/**
 * Dosyanın gerçek biçimini ve boyutlarını doğrular.
 *
 * Önce dosya imzası denetlenir: yalnızca JPEG, PNG, WebP ve HEIF/AVIF kapsayıcıları sharp'a
 * (libvips) verilir. SVG/XML, GIF, TIFF ve diğer biçimler hiç ayrıştırılmadan reddedilir; çözücü
 * yüzeyi daralır (ör. librsvg açığı GHSA-wq5f-xc86-pv6w bu yoldan erişilebiliyordu). Kabul edilen
 * biçimler değişmedi; önceden reddedilen her dosya yine reddedilir. Tek fark mesajdadır: "<" ile
 * başlayıp geçerli SVG olmayan içerik (HTML, bozuk SVG) "Dosya okunamadı" yerine "desteklenmeyen
 * format" mesajı alır (önceden librsvg ayrıştırmayı deneyip hata veriyordu).
 */
export async function inspectImage(input: Buffer): Promise<InspectedImage> {
  const container = sniffImageContainer(input);
  if (!container) throw new MediaValidationError(CORRUPT_MESSAGE, 'corrupt');
  if (!DECODABLE.has(container)) throw new MediaValidationError(UNSUPPORTED_MESSAGE, 'unsupported');

  let meta: Metadata;
  try {
    meta = await sharp(input, INPUT_OPTIONS).metadata();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/pixel limit/i.test(message)) {
      throw new MediaValidationError('Bu görselin çözünürlüğü çok yüksek (en fazla 100 megapiksel).', 'too_large');
    }
    throw new MediaValidationError(CORRUPT_MESSAGE, 'corrupt');
  }

  let mime: InspectedImage['mime'];
  switch (meta.format) {
    case 'jpeg':
      mime = 'image/jpeg';
      break;
    case 'png':
      mime = 'image/png';
      break;
    case 'webp':
      mime = 'image/webp';
      break;
    case 'heif':
      // AVIF = AV1 sıkıştırmalı HEIF. HEIC (HEVC) sunucuda çözülemez; tarayıcıda JPEG'e çevrilmelidir.
      if (meta.compression !== 'av1') {
        throw new MediaValidationError('HEIC dosyası sunucuda işlenemiyor. Lütfen fotoğrafı JPEG olarak kaydedip tekrar yükleyin.', 'unsupported');
      }
      mime = 'image/avif';
      break;
    default:
      throw new MediaValidationError(UNSUPPORTED_MESSAGE, 'unsupported');
  }

  const rawWidth = meta.width ?? 0;
  const rawHeight = meta.height ?? 0;
  if (!rawWidth || !rawHeight) throw new MediaValidationError('Görsel boyutları okunamadı.', 'corrupt');
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = swapped ? rawHeight : rawWidth;
  const height = swapped ? rawWidth : rawHeight;

  if (width * height > MEDIA_LIMITS.maxPixels) {
    throw new MediaValidationError('Bu görselin çözünürlüğü çok yüksek (en fazla 100 megapiksel).', 'too_large');
  }
  if (Math.max(width, height) < MEDIA_LIMITS.minWidth || Math.min(width, height) < MEDIA_LIMITS.minHeight) {
    throw new MediaValidationError(
      `Görsel çok küçük (${width}×${height}). En az ${MEDIA_LIMITS.minWidth}×${MEDIA_LIMITS.minHeight} piksel olmalı.`,
      'too_small',
    );
  }
  return { mime, width, height };
}

/**
 * WebP varyantlarını ve bulanık önizlemeyi üretir.
 * `rotate`: kullanıcının istediği ek döndürme (EXIF yönünden sonra uygulanır).
 */
export async function processImage(input: Buffer, rotate: 0 | 90 | 180 | 270 = 0): Promise<ProcessedImage> {
  const inspected = await inspectImage(input);
  const quarterTurn = rotate === 90 || rotate === 270;
  const width = quarterTurn ? inspected.height : inspected.width;
  const height = quarterTurn ? inspected.width : inspected.height;

  const base = sharp(input, INPUT_OPTIONS).autoOrient();
  if (rotate) base.rotate(rotate);
  base.toColorspace('srgb');

  const variants: ProcessedImage['variants'] = [];
  let variantsBytes = 0;
  for (const target of planVariantWidths(width)) {
    const buffer = await base
      .clone()
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: qualityFor(target), effort: 4, smartSubsample: true })
      .toBuffer();
    variants.push({ width: target, buffer });
    variantsBytes += buffer.length;
  }

  let blurDataUrl: string | null = null;
  try {
    const tiny = await base.clone().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
    const url = `data:image/webp;base64,${tiny.toString('base64')}`;
    blurDataUrl = url.length <= 2000 ? url : null;
  } catch {
    blurDataUrl = null;
  }

  return { width, height, variants, blurDataUrl, variantsBytes };
}
