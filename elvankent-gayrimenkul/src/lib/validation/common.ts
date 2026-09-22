import { z } from 'zod';

/** Kontrol karakterlerini temizler, satır sonlarını korur */
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} gereklidir.` })
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, { error: min <= 1 ? `${label} gereklidir.` : `${label} en az ${min} karakter olmalıdır.` })
        .max(max, { error: `${label} en fazla ${max} karakter olabilir.` }),
    );

export const optionalText = (max: number, label: string) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? cleanText(v) : ''))
    .pipe(z.string().max(max, { error: `${label} en fazla ${max} karakter olabilir.` }))
    .transform((v) => v || null);

/** Türk telefon numarası (sabit hat veya GSM); boşluk, parantez ve tire kabul edilir */
export const phoneSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? cleanText(v) : ''))
  .refine((v) => !v || /^\+?[\d\s()-]{10,20}$/.test(v), { error: 'Geçerli bir telefon numarası girin.' })
  .refine((v) => !v || (v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 13), {
    error: 'Telefon numarası 10-13 haneli olmalıdır.',
  })
  .transform((v) => v || null);

export const emailSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? cleanText(v).toLowerCase() : ''))
  .refine((v) => !v || z.email().safeParse(v).success, { error: 'Geçerli bir e-posta adresi girin.' })
  .refine((v) => v.length <= 160, { error: 'E-posta adresi çok uzun.' })
  .transform((v) => v || null);

export const urlSchema = (label: string) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? cleanText(v) : ''))
    .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), { error: `${label} https:// ile başlayan geçerli bir adres olmalıdır.` })
    .refine((v) => v.length <= 300, { error: `${label} çok uzun.` })
    .transform((v) => v || null);

export type FieldErrors = Record<string, string>;

/** Zod hatalarını alan → ilk mesaj sözlüğüne çevirir */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
