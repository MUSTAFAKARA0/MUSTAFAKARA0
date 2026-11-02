import { z } from 'zod';
import { BIDI_CONTROL_MESSAGE, hasBidiControl, singleLine } from '@/lib/single-line';
import { openingHoursSchema } from '@/modules/content/hours-schema';
import { emailField, phoneField } from '@/modules/crm/validation';

/**
 * Ofis şirket ve site ayarları doğrulaması (white-label). Sunucu eylemleri
 * (`saveCompanySettings`, `saveSiteSettings`) bu şemaları kullanır; ayrı modülde durmaları
 * davranışın birim testiyle doğrulanmasını sağlar. Organizasyon kimliği şemada yoktur, oturumdan gelir.
 */
const clean = (v: string) => singleLine(v.replace(/[<>]/g, ''));

const text = (max: number, label: string, min = 0) =>
  z
    .string()
    .max(max * 2, { error: `${label} en fazla ${max} karakter olabilir.` })
    .transform(clean)
    .pipe(
      z
        .string()
        .min(min, { error: `${label} en az ${min} karakter olmalıdır.` })
        .max(max, { error: `${label} en fazla ${max} karakter olabilir.` })
        .refine((v) => !hasBidiControl(v), { error: `${label} ${BIDI_CONTROL_MESSAGE}` }),
    );

const optional = (max: number, label: string) =>
  text(max, label)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const hexColor = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, { error: 'Renk #RRGGBB biçiminde olmalıdır.' });

const httpsUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(300, { error: `${label} adresi çok uzun.` })
    .refine((v) => v === '' || /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s<>"']*)?$/i.test(v), { error: `${label} için https:// ile başlayan geçerli bir adres girin.` })
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const coordinate = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), { error: 'Geçersiz koordinat.' })
    .transform((v) => (v === null ? null : Math.round(v * 1e6) / 1e6));

export const companySchema = z
  .object({
    display_name: text(80, 'Şirket adı', 2),
    legal_name: optional(160, 'Ticari unvan'),
    tagline: optional(160, 'Slogan'),
    description: optional(2000, 'Tanıtım metni'),
    service_area: optional(160, 'Hizmet bölgesi'),
    primary_color: hexColor,
    accent_color: hexColor,
    phone: phoneField.nullable(),
    whatsapp: phoneField.nullable(),
    email: emailField.nullable(),
    address_line: optional(240, 'Adres'),
    address_district: optional(80, 'İlçe'),
    address_city: optional(80, 'İl'),
    postal_code: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[0-9]{5}$/.test(v), { error: 'Posta kodu 5 haneli olmalıdır.' })
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    office_latitude: coordinate(-90, 90),
    office_longitude: coordinate(-180, 180),
    opening_hours: openingHoursSchema,
    working_hours_note: optional(300, 'Çalışma saatleri notu'),
    instagram_url: httpsUrl('Instagram'),
    facebook_url: httpsUrl('Facebook'),
    x_url: httpsUrl('X'),
    youtube_url: httpsUrl('YouTube'),
    linkedin_url: httpsUrl('LinkedIn'),
    tiktok_url: httpsUrl('TikTok'),
  })
  .refine((v) => (v.office_latitude === null) === (v.office_longitude === null), {
    error: 'Ofis konumu için enlem ve boylamı birlikte girin.',
    path: ['office_latitude'],
  });

export type CompanySettingsInput = z.input<typeof companySchema>;

export const siteSchema = z.object({
  hero_title: optional(120, 'Ana başlık'),
  hero_subtitle: optional(240, 'Alt başlık'),
  default_location_precision: z.enum(['exact', 'approximate', 'neighborhood'], { error: 'Geçersiz konum gösterimi.' }),
});

export type SiteSettingsInput = z.input<typeof siteSchema>;
