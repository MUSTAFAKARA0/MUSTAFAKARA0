import { z } from 'zod';
import { cleanText, optionalText, text } from './common';

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

const optInt = (min: number, max: number, label: string) =>
  z.preprocess(
    emptyToNull,
    z.coerce
      .number({ error: `${label} sayı olmalıdır.` })
      .int({ error: `${label} tam sayı olmalıdır.` })
      .min(min, { error: `${label} en az ${min} olabilir.` })
      .max(max, { error: `${label} en fazla ${max} olabilir.` })
      .nullable(),
  );

const optMoney = (label: string) =>
  z.preprocess(
    emptyToNull,
    z.coerce.number({ error: `${label} sayı olmalıdır.` }).min(0, { error: `${label} negatif olamaz.` }).max(999_999_999_999).nullable(),
  );

const triState = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v === '' ? null : v), z.boolean().nullable());

const optCoord = (min: number, max: number) =>
  z.preprocess(emptyToNull, z.coerce.number().min(min).max(max).nullable());

const stringList = (max: number) =>
  z
    .array(z.string().transform(cleanText).pipe(z.string().min(1).max(30)))
    .max(max)
    .default([]);

export const propertySchema = z
  .object({
    title: text(10, 120, 'İlan başlığı'),
    description: text(30, 10000, 'Açıklama'),
    listing_type: z.enum(['sale', 'rent'], { error: 'İlan tipini seçin.' }),
    property_type_id: z.coerce.number({ error: 'Emlak tipini seçin.' }).int().positive({ error: 'Emlak tipini seçin.' }),
    status: z.enum(['draft', 'active', 'passive', 'sold', 'rented']),
    is_featured: z.boolean().default(false),

    price: z.coerce.number({ error: 'Fiyat girin.' }).positive({ error: 'Fiyat 0’dan büyük olmalıdır.' }).max(999_999_999_999),
    currency: z.enum(['TRY', 'USD', 'EUR']),
    price_negotiable: z.boolean().default(false),
    dues: optMoney('Aidat'),
    deposit: optMoney('Depozito'),

    city_id: z.coerce.number({ error: 'İl seçin.' }).int().positive({ error: 'İl seçin.' }),
    district_id: z.coerce.number({ error: 'İlçe seçin.' }).int().positive({ error: 'İlçe seçin.' }),
    neighborhood_id: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
    address: optionalText(400, 'Açık adres'),
    latitude: optCoord(-90, 90),
    longitude: optCoord(-180, 180),
    location_precision: z.enum(['exact', 'approximate', 'neighborhood']),

    gross_m2: optInt(1, 9_999_999, 'Brüt m²'),
    net_m2: optInt(1, 9_999_999, 'Net m²'),
    room_count: optInt(0, 50, 'Oda sayısı'),
    living_room_count: optInt(0, 10, 'Salon sayısı'),
    building_age: optInt(0, 200, 'Bina yaşı'),
    floor: optionalText(30, 'Kat'),
    total_floors: optInt(0, 200, 'Toplam kat'),
    bathroom_count: optInt(0, 20, 'Banyo sayısı'),
    balcony_count: optInt(0, 20, 'Balkon sayısı'),

    heating: optionalText(40, 'Isıtma'),
    has_elevator: triState,
    parking: optionalText(40, 'Otopark'),
    is_furnished: triState,
    in_complex: triState,
    complex_name: optionalText(120, 'Site adı'),
    has_air_conditioning: triState,
    credit_eligible: triState,
    deed_status: optionalText(40, 'Tapu durumu'),
    usage_status: optionalText(40, 'Kullanım durumu'),
    facades: stringList(4),
    views: stringList(8),
    swap_available: triState,

    zoning_status: optionalText(40, 'İmar durumu'),
    block_no: optionalText(20, 'Ada'),
    parcel_no: optionalText(20, 'Parsel'),
    floor_area_ratio: z.preprocess(emptyToNull, z.coerce.number().min(0).max(99).nullable()),
    height_limit: optionalText(30, 'Gabari'),

    meta_description: optionalText(300, 'SEO açıklaması'),
    feature_ids: z.array(z.coerce.number().int().positive()).max(100).default([]),
  })
  .refine((d) => d.net_m2 === null || d.gross_m2 === null || d.net_m2 <= d.gross_m2, {
    error: 'Net m², brüt m²’den büyük olamaz.',
    path: ['net_m2'],
  })
  .refine((d) => (d.latitude === null) === (d.longitude === null), {
    error: 'Harita konumu eksik. Haritadan bir nokta seçin.',
    path: ['latitude'],
  });

export type PropertyInput = z.input<typeof propertySchema>;
export type PropertyData = z.output<typeof propertySchema>;
