import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * globals.css'teki özel tasarım token'ları tailwind-merge'e tanıtılır; aksi halde
 * `text-display-lg` gibi yazı boyutları renk sınıfı sanılır ve `text-foreground`
 * ile birlikte kullanıldığında silinir.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display-2xl', 'display-xl', 'display-lg', 'title', 'price'] }],
      ease: [{ ease: ['premium'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Arama parametresinden tek bir string değer okur. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Pozitif tam sayı ayrıştırır (binlik ayırıcı noktalar kabul edilir); geçersizse undefined. */
export function parsePositiveInt(value: string | undefined | null, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (!value) return undefined;
  const n = Number(value.replace(/[.\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return Math.floor(n);
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Numeric (string) değerleri sayıya çevirir; null korunur. */
export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Tekil/çoğul PostgREST gömülü ilişkisini tek nesneye indirger. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Verilen tarih şu andan sonra mı (zamanlanmış yayın, süresi dolmamış bağlantı vb.) */
export function isFutureDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

/** Kısa, kararlı içerik özeti (önbellek anahtarı için; güvenlik amaçlı değildir) */
export function hashString(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
