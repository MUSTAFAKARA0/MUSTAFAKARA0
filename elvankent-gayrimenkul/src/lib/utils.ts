import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Arama parametresinden tek bir string değer okur. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Pozitif tam sayı ayrıştırır; geçersizse undefined döner. */
export function parsePositiveInt(value: string | undefined | null, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (!value) return undefined;
  const n = Number(value.replace(/[.\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return Math.floor(n);
}
