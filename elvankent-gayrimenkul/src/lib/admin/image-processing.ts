import 'server-only';
import sharp, { type Metadata } from 'sharp';
import { IMAGE_LIMITS } from '@/lib/constants';

export class ImageValidationError extends Error {}

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'heif']);

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  blurDataUrl: string;
}

/**
 * Yüklenen görseli doğrular ve optimize eder:
 *  - Gerçek dosya formatını içerikten tespit eder (uzantıya güvenmez)
 *  - EXIF yönünü uygular, tüm meta veriyi (GPS konumu dahil) siler
 *  - En fazla 2000 px'e küçültür ve WebP'ye dönüştürür
 *  - Sayfa yüklenirken gösterilecek küçük bulanık önizleme üretir
 */
export async function processPropertyImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength > IMAGE_LIMITS.maxUploadBytes) {
    throw new ImageValidationError('Fotoğraf en fazla 8 MB olabilir.');
  }
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: 'error' }).metadata();
  } catch {
    throw new ImageValidationError('Dosya geçerli bir fotoğraf değil. JPG, PNG veya WebP yükleyin.');
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new ImageValidationError('Desteklenmeyen dosya biçimi. JPG, PNG veya WebP yükleyin.');
  }
  if (!meta.width || !meta.height || meta.width < 300 || meta.height < 200) {
    throw new ImageValidationError('Fotoğraf çok küçük. En az 300×200 piksel olmalıdır.');
  }
  if (meta.width * meta.height > 60_000_000) {
    throw new ImageValidationError('Fotoğraf çözünürlüğü çok yüksek.');
  }

  const max = IMAGE_LIMITS.serverMaxDimension;
  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const blur = await sharp(data).resize(16, 16, { fit: 'inside' }).webp({ quality: 40 }).toBuffer();

  return {
    data,
    width: info.width,
    height: info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
  };
}

/** Logo: şeffaflığı koruyarak PNG'ye dönüştürür, en fazla 600 px genişlik */
export async function processLogo(input: Buffer): Promise<Buffer> {
  if (input.byteLength > 2 * 1024 * 1024) throw new ImageValidationError('Logo en fazla 2 MB olabilir.');
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new ImageValidationError('Dosya geçerli bir görsel değil.');
  }
  if (!meta.format || !['png', 'webp', 'jpeg'].includes(meta.format)) {
    throw new ImageValidationError('Logo PNG, WebP veya JPG olmalıdır.');
  }
  return sharp(input).resize({ width: 600, height: 240, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
}
