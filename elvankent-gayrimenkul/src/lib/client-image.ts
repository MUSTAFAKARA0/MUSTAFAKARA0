'use client';

import { IMAGE_LIMITS } from '@/lib/constants';
import type { PropertyImage } from '@/types/database';

export const UPLOAD_ERROR = 'Fotoğraf yüklenirken bir hata oluştu. Lütfen tekrar deneyin.';
const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;

/** Dosyanın yüklemeye uygun olup olmadığını hızlıca kontrol eder */
export function validateImageFile(file: File): string | null {
  const okType = IMAGE_LIMITS.acceptedMime.includes(file.type) || /\.(jpe?g|png|webp|avif)$/i.test(file.name);
  if (!okType) return `“${file.name}” desteklenmeyen bir dosya türü. JPG, PNG veya WebP seçin.`;
  if (file.size > MAX_ORIGINAL_BYTES) return `“${file.name}” çok büyük (en fazla 40 MB).`;
  return null;
}

/**
 * Büyük telefon fotoğraflarını yüklemeden önce tarayıcıda küçültür
 * (mobil veri tasarrufu + sunucu gövde sınırı). Küçük dosyalar olduğu gibi gönderilir.
 */
export async function prepareImageForUpload(file: File): Promise<Blob> {
  const max = IMAGE_LIMITS.clientMaxDimension;
  if (file.size <= 1.5 * 1024 * 1024 && file.type !== 'image/png') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) return file;
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** XHR ile yükler (fetch yükleme ilerlemesi raporlamaz) */
export function uploadPropertyImage(
  propertyId: string,
  blob: Blob,
  fileName: string,
  onProgress: (percent: number) => void,
): Promise<PropertyImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/properties/${propertyId}/images`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response as { image?: PropertyImage; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.image) resolve(body.image);
      else reject(new Error(body?.error || UPLOAD_ERROR));
    };
    xhr.onerror = () => reject(new Error('Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.'));
    xhr.ontimeout = () => reject(new Error(UPLOAD_ERROR));
    xhr.timeout = 120_000;
    const form = new FormData();
    form.append('file', blob, fileName.replace(/\.[^.]+$/, '') + (blob.type === 'image/jpeg' ? '.jpg' : ''));
    xhr.send(form);
  });
}
