import { z } from 'zod';
import { SLUG_PATTERN } from '@/lib/slug';

/**
 * Yönetim paneli ilan doğrulama şemaları. Tarayıcıda (anlık geri bildirim) ve
 * sunucuda (güvenlik) aynı şema kullanılır; veritabanı CHECK kısıtları ayrıca
 * son savunma hattıdır.
 */

const nullableInt = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label} sayı olmalıdır.` })
    .int({ error: `${label} tam sayı olmalıdır.` })
    .min(min, { error: `${label} en az ${min} olabilir.` })
    .max(max, { error: `${label} en fazla ${max} olabilir.` })
    .nullable();

const nullableMoney = (label: string) =>
  z
    .number({ error: `${label} sayı olmalıdır.` })
    .min(0, { error: `${label} negatif olamaz.` })
    .max(999_999_999_999, { error: `${label} çok büyük.` })
    .nullable();

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} en fazla ${max} karakter olabilir.` })
    .transform((v) => (v === '' ? null : v.replace(/[<>]/g, '')))
    .nullable();

const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).nullable();

export const HEATING_CODES = ['kombi-dogalgaz', 'merkezi', 'merkezi-pay-olcer', 'yerden-isitma', 'klima', 'soba', 'isi-pompasi', 'gunes-enerjisi', 'yok', 'diger'] as const;
export const PARKING_CODES = ['yok', 'acik', 'kapali', 'acik-kapali'] as const;
export const DEED_CODES = ['kat-mulkiyeti', 'kat-irtifaki', 'hisseli-tapu', 'mustakil-tapu', 'arsa-tapulu', 'kooperatif', 'tapu-yok', 'diger'] as const;
export const USAGE_CODES = ['bos', 'kiracili', 'mulk-sahibi'] as const;
export const ZONING_CODES = ['konut', 'ticari', 'konut-ticari', 'sanayi', 'tarla', 'bag-bahce', 'turizm', 'diger'] as const;
export const FACADE_CODES = ['kuzey', 'guney', 'dogu', 'bati'] as const;
export const VIEW_CODES = ['sehir', 'doga', 'park', 'gol', 'dag', 'cadde', 'deniz'] as const;
const FLOOR_PATTERN = /^([0-9]{1,3}|bodrum|kot-1|kot-2|kot-3|bahce|zemin|giris|yuksek-giris|villa|cati)$/;

export const propertyPatchSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, { error: 'Başlık en az 3 karakter olmalıdır.' })
      .max(120, { error: 'Başlık en fazla 120 karakter olabilir.' })
      .transform((v) => v.replace(/[<>]/g, '')),
    description: optionalText(10_000, 'Açıklama'),
    listing_type: z.enum(['sale', 'rent'], { error: 'İlan türünü seçin.' }),
    property_type_id: z.number({ error: 'Emlak tipini seçin.' }).int().positive({ error: 'Emlak tipini seçin.' }),
    price: nullableMoney('Fiyat'),
    currency: z.enum(['TRY', 'USD', 'EUR']),
    price_negotiable: z.boolean(),
    dues: nullableMoney('Aidat'),
    deposit: nullableMoney('Depozito'),
    city_id: z.number().int().positive().nullable(),
    district_id: z.number().int().positive().nullable(),
    neighborhood_id: z.number().int().positive().nullable(),
    location_precision: z.enum(['exact', 'approximate', 'neighborhood']),
    gross_m2: nullableInt(1, 9_999_999, 'Brüt m²'),
    net_m2: nullableInt(1, 9_999_999, 'Net m²'),
    room_count: nullableInt(0, 50, 'Oda sayısı'),
    living_room_count: nullableInt(0, 10, 'Salon sayısı'),
    building_age: nullableInt(0, 200, 'Bina yaşı'),
    floor: z.string().regex(FLOOR_PATTERN, { error: 'Geçersiz kat değeri.' }).nullable(),
    total_floors: nullableInt(0, 200, 'Kat sayısı'),
    bathroom_count: nullableInt(0, 20, 'Banyo sayısı'),
    balcony_count: nullableInt(0, 20, 'Balkon sayısı'),
    heating: nullableEnum(HEATING_CODES),
    has_elevator: z.boolean().nullable(),
    parking: nullableEnum(PARKING_CODES),
    is_furnished: z.boolean().nullable(),
    in_complex: z.boolean().nullable(),
    complex_name: optionalText(120, 'Site adı'),
    has_air_conditioning: z.boolean().nullable(),
    credit_eligible: z.boolean().nullable(),
    deed_status: nullableEnum(DEED_CODES),
    usage_status: nullableEnum(USAGE_CODES),
    facades: z.array(z.enum(FACADE_CODES)).max(4),
    views: z.array(z.enum(VIEW_CODES)).max(7),
    swap_available: z.boolean().nullable(),
    zoning_status: nullableEnum(ZONING_CODES),
    block_no: optionalText(20, 'Ada no'),
    parcel_no: optionalText(20, 'Parsel no'),
    floor_area_ratio: z.number().min(0).max(100, { error: 'Emsal değeri çok büyük.' }).nullable(),
    height_limit: optionalText(30, 'Gabari'),
    investment_suitable: z.boolean().nullable(),
    seo_title: optionalText(70, 'SEO başlığı'),
    seo_description: optionalText(200, 'Meta açıklama'),
    slug: z
      .string()
      .trim()
      .max(140, { error: 'Adres en fazla 140 karakter olabilir.' })
      .regex(SLUG_PATTERN, { error: 'Adres yalnızca küçük harf, rakam ve tire içerebilir.' }),
    is_featured: z.boolean(),
    show_on_homepage: z.boolean(),
    og_media_id: z.uuid().nullable(),
  })
  .partial()
  .strict();

export type PropertyPatch = z.infer<typeof propertyPatchSchema>;

/** Gizli konum (yalnızca ofis üyeleri görür): açık adres ve kesin koordinat */
export const locationSchema = z
  .object({
    address: optionalText(300, 'Adres'),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), { error: 'Harita konumu eksik.' });

export type PrivateLocation = z.infer<typeof locationSchema>;

export const featureIdsSchema = z.array(z.number().int().positive()).max(80);

export const PUBLISH_CHECKS = [
  { key: 'title', label: 'Başlık en az 10 karakter' },
  { key: 'description', label: 'Açıklama en az 50 karakter' },
  { key: 'price', label: 'Fiyat girildi' },
  { key: 'location', label: 'İl ve ilçe seçildi' },
  { key: 'photo', label: 'En az bir fotoğraf' },
] as const;

export type PublishCheckKey = (typeof PUBLISH_CHECKS)[number]['key'];

/** Veritabanındaki yayın kontrol listesinin istemci tarafı karşılığı (aynı kurallar) */
export function publishChecklist(p: {
  title: string;
  description: string | null;
  price: number | null;
  city_id: number | null;
  district_id: number | null;
  readyPhotos: number;
}): Record<PublishCheckKey, boolean> {
  return {
    title: p.title.trim().length >= 10,
    description: (p.description ?? '').trim().length >= 50,
    price: (p.price ?? 0) > 0,
    location: p.city_id !== null && p.district_id !== null,
    photo: p.readyPhotos > 0,
  };
}

export interface SeoCheck {
  label: string;
  ok: boolean;
  hint?: string;
}

/** SEO kontrol listesi (öneri niteliğinde; yayını engellemez) */
export function seoChecklist(p: {
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  description: string | null;
  slug: string;
  readyPhotos: number;
  missingAlt: number;
  hasLocation: boolean;
}): SeoCheck[] {
  const title = p.seo_title ?? p.title;
  const metaLength = (p.seo_description ?? '').length;
  return [
    { label: 'Sayfa başlığı 30–65 karakter', ok: title.length >= 30 && title.length <= 65, hint: `${title.length} karakter` },
    {
      label: 'Meta açıklama 110–160 karakter',
      ok: metaLength >= 110 && metaLength <= 160,
      hint: p.seo_description ? `${metaLength} karakter` : 'Boşsa açıklamadan otomatik üretilir',
    },
    { label: 'Açıklama en az 300 karakter', ok: (p.description ?? '').length >= 300, hint: `${(p.description ?? '').length} karakter` },
    { label: 'Okunabilir, kısa adres (URL)', ok: p.slug.length > 0 && p.slug.length <= 80 },
    { label: 'En az 5 fotoğraf', ok: p.readyPhotos >= 5, hint: `${p.readyPhotos} fotoğraf` },
    {
      label: 'Fotoğraf açıklamaları (alt metin)',
      ok: p.missingAlt === 0 && p.readyPhotos > 0,
      hint: p.missingAlt ? `${p.missingAlt} fotoğrafın açıklaması otomatik` : undefined,
    },
    { label: 'Konum (il/ilçe/mahalle)', ok: p.hasLocation },
  ];
}
