import { z } from 'zod';
import { slugify } from '@/lib/slug';

/**
 * Organizasyon (kiracı) açma girdileri — saf şemalar (sunucu işlemleri ve sihirbaz formu).
 * Doğrulama sunucuda TEKRAR yapılır; istemci doğrulaması yalnızca kullanıcı içindir.
 */
export const RESERVED_SLUGS = new Set(['admin', 'api', 'platform', 'www', 'app', 'mail', 'static', 'assets', 't', 'onizleme', 'koleksiyon']);

export const orgSchema = z.object({
  name: z
    .string()
    .max(200)
    .transform((v) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, { error: 'Organizasyon adı en az 2 karakter olmalıdır.' }).max(80, { error: 'Organizasyon adı en fazla 80 karakter olabilir.' })),
  slug: z
    .string()
    .max(60)
    .transform((v) => slugify(v, 40))
    .pipe(
      z
        .string()
        .min(3, { error: 'Kısa ad en az 3 karakter olmalıdır (harf, rakam, tire).' })
        .refine((v) => !RESERVED_SLUGS.has(v), { error: 'Bu kısa ad sistem tarafından kullanılıyor.' }),
    ),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, { error: 'İlan no öneki 2–5 büyük harf olmalıdır (ör. ABC).' }),
  plan: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, { error: 'Plan seçin.' }),
  owner_email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .pipe(z.email({ error: 'Sahip için geçerli bir e-posta girin.' })),
  owner_name: z
    .string()
    .max(200)
    .transform((v) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, { error: 'Sahip adı en az 2 karakter olmalıdır.' }).max(100)),
});

export type CreateOrgInput = z.input<typeof orgSchema>;

export const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  .pipe(z.string().regex(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, { error: 'Geçerli bir alan adı girin (ör. www.ornekemlak.com).' }));
