'use client';

import * as tus from 'tus-js-client';
import { publicEnv } from '@/lib/env';
import { MEDIA_LIMITS } from '@/modules/media/variants';
import type { UploadTicket } from '@/app/actions/media';

/** Supabase'in devam ettirilebilir yüklemede zorunlu tuttuğu parça boyutu */
const TUS_CHUNK = 6 * 1024 * 1024;

export interface RunningUpload {
  promise: Promise<void>;
  abort: () => void;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message);
  }
}

function describeStatus(status: number): string {
  if (status === 413) return 'Bu görselin boyutu çok yüksek (en fazla 50 MB).';
  if (status === 415) return 'Bu dosya desteklenmeyen bir formatta.';
  if (status === 400 || status === 403) return 'Yükleme izni doğrulanamadı; tekrar deneyin.';
  if (status === 0) return 'Bağlantı kesildi. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  return 'Yükleme tamamlanamadı; tekrar deneyin.';
}

function standardUpload(file: Blob, ticket: UploadTicket, onProgress: (ratio: number) => void): RunningUpload {
  const xhr = new XMLHttpRequest();
  const path = ticket.path.split('/').map(encodeURIComponent).join('/');
  const url = `${publicEnv.storageUrl}/storage/v1/object/upload/sign/${ticket.bucket}/${path}?token=${encodeURIComponent(ticket.token)}`;
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open('PUT', url);
    xhr.setRequestHeader('apikey', publicEnv.supabaseAnonKey);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError(describeStatus(xhr.status), xhr.status !== 413 && xhr.status !== 415)));
    xhr.onerror = () => reject(new UploadError(describeStatus(0)));
    xhr.onabort = () => reject(new UploadError('İptal edildi', false));
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);
    xhr.send(body);
  });
  return { promise, abort: () => xhr.abort() };
}

function resumableUpload(file: Blob, ticket: UploadTicket, onProgress: (ratio: number) => void): RunningUpload {
  let upload: tus.Upload | null = null;
  let aborted = false;
  const promise = new Promise<void>((resolve, reject) => {
    upload = new tus.Upload(file, {
      endpoint: `${publicEnv.storageUrl}/storage/v1/upload/resumable/sign`,
      headers: { 'x-signature': ticket.token, apikey: publicEnv.supabaseAnonKey, 'x-upsert': 'true' },
      chunkSize: TUS_CHUNK,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // Aynı dosya/yol için yarım kalan yükleme kaldığı yerden devam eder
      fingerprint: async () => `eg-media-${ticket.path}-${file.size}`,
      retryDelays: [0, 2000, 5000, 10000, 20000],
      metadata: {
        bucketName: ticket.bucket,
        objectName: ticket.path,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onProgress: (sent, total) => onProgress(total ? sent / total : 0),
      onError: (error) => {
        if (aborted) return reject(new UploadError('İptal edildi', false));
        const status = (error as tus.DetailedError).originalResponse?.getStatus?.() ?? 0;
        reject(new UploadError(describeStatus(status), status !== 413 && status !== 415));
      },
      onSuccess: () => resolve(),
    });
    const current = upload;
    current
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) current.resumeFromPreviousUpload(previous[0]);
        current.start();
      })
      .catch(() => current.start());
  });
  return {
    promise,
    abort: () => {
      aborted = true;
      void (upload as tus.Upload | null)?.abort(true);
    },
  };
}

export function startUpload(file: Blob, ticket: UploadTicket, onProgress: (ratio: number) => void): RunningUpload {
  return ticket.resumable ? resumableUpload(file, ticket, onProgress) : standardUpload(file, ticket, onProgress);
}

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function detectMime(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? '';
}

export async function readDimensions(file: Blob): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * HEIC/HEIF → JPEG (tarayıcıda). Safari HEIC'i yerleşik olarak çözebilir;
 * diğer tarayıcılarda başarısız olursa kullanıcıya anlaşılır bir yol gösterilir.
 * Bellek güvenliği için en fazla ~16 MP'ye küçültülür.
 */
export async function convertHeic(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UploadError(
      'Bu HEIC fotoğraf tarayıcınızda dönüştürülemedi. Fotoğrafı JPEG olarak kaydedip yükleyin (iPhone: Ayarlar › Kamera › Biçimler › "En Uyumlu").',
      false,
    );
  }
  const maxPixels = 16_000_000;
  const scale = Math.min(1, Math.sqrt(maxPixels / (bitmap.width * bitmap.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UploadError('Fotoğraf dönüştürülemedi.', false);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new UploadError('Fotoğraf dönüştürülemedi.', false);
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' });
}

/** Seçilen dosyayı yüklemeye hazırlar: tür, boyut, çözünürlük kontrolleri */
export async function prepareFile(file: File): Promise<{ file: File; width: number | null; height: number | null }> {
  let mime = detectMime(file);
  let prepared = file;
  if (MEDIA_LIMITS.convertibleMime.includes(mime)) {
    prepared = await convertHeic(file);
    mime = 'image/jpeg';
  }
  if (!MEDIA_LIMITS.acceptedMime.includes(mime)) throw new UploadError('Bu dosya desteklenmeyen bir formatta. JPG, PNG, WEBP, AVIF veya HEIC yükleyin.', false);
  if (prepared.size > MEDIA_LIMITS.maxOriginalBytes) throw new UploadError('Bu görselin boyutu çok yüksek (en fazla 50 MB).', false);
  if (prepared.size === 0) throw new UploadError('Dosya boş görünüyor.', false);
  if (prepared.type !== mime) prepared = new File([prepared], prepared.name, { type: mime });
  const dims = await readDimensions(prepared);
  if (dims) {
    if (dims.width * dims.height > MEDIA_LIMITS.maxPixels) throw new UploadError('Bu görselin çözünürlüğü çok yüksek (en fazla 100 megapiksel).', false);
    if (Math.max(dims.width, dims.height) < MEDIA_LIMITS.minWidth || Math.min(dims.width, dims.height) < MEDIA_LIMITS.minHeight) {
      throw new UploadError(`Görsel çok küçük (${dims.width}×${dims.height}). En az ${MEDIA_LIMITS.minWidth}×${MEDIA_LIMITS.minHeight} piksel olmalı.`, false);
    }
  }
  return { file: prepared, width: dims?.width ?? null, height: dims?.height ?? null };
}
