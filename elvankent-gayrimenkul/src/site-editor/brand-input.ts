import { z } from 'zod';

/**
 * Marka ve iletişim formunun doğrulaması (KARAY Site Builder ve ofis /admin/site ortak).
 * Değerler TASLAĞA yazılır (site_configs.draft.brand); yayında ofis ayarlarına uygulanır.
 */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v.replace(/[<>]/g, '')));
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), { message: 'Bağlantı https:// ile başlamalıdır.' })
  .transform((v) => (v === '' ? null : v));

export const brandSchema = z.object({
  display_name: z.string().trim().min(2, { message: 'Firma adı en az 2 karakter olmalıdır.' }).max(80),
  short_name: optional(40),
  legal_name: optional(160),
  tagline: optional(160),
  description: optional(2000),
  phone: optional(30),
  whatsapp: optional(30),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Geçerli bir e-posta adresi girin.' })
    .transform((v) => (v === '' ? null : v.toLowerCase())),
  address_line: optional(240),
  address_district: optional(80),
  address_city: optional(80),
  maps_url: optionalUrl,
  instagram_url: optionalUrl,
  facebook_url: optionalUrl,
  x_url: optionalUrl,
  youtube_url: optionalUrl,
  linkedin_url: optionalUrl,
  tiktok_url: optionalUrl,
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, { message: 'Renk #RRGGBB biçiminde olmalıdır.' }).transform((v) => v.toLowerCase()),
  accent_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, { message: 'Renk #RRGGBB biçiminde olmalıdır.' }).transform((v) => v.toLowerCase()),
});
export type BrandInput = z.input<typeof brandSchema>;

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.filter((p) => typeof p === 'string' || typeof p === 'number').join(' › ');
  return `${issue?.message ?? 'Geçersiz değer.'}${path ? ` (${path})` : ''}`;
}
