import type { ContactStatus, CurrencyCode, FeatureGroup, ListingType, PropertyCategory, PropertyStatus } from '@/types/database';

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  sale: 'Satılık',
  rent: 'Kiralık',
};

export const CATEGORY_LABELS: Record<PropertyCategory, string> = {
  konut: 'Konut',
  isyeri: 'İş Yeri',
  arsa: 'Arsa',
};

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: 'Taslak',
  active: 'Yayında',
  passive: 'Yayından kaldırıldı',
  sold: 'Satıldı',
  rented: 'Kiralandı',
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'Yeni',
  read: 'Okundu',
  replied: 'Yanıtlandı',
  archived: 'Arşiv',
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  TRY: '₺ TL',
  USD: '$ USD',
  EUR: '€ EUR',
};

export const FEATURE_GROUP_LABELS: Record<FeatureGroup, string> = {
  ic: 'İç Özellikler',
  dis: 'Dış Özellikler',
  muhit: 'Muhit',
  ulasim: 'Ulaşım',
};

/* Seçim listeleri — yönetim formunda ve filtrelerde kullanılır. */
export const HEATING_OPTIONS = [
  'Kombi (Doğalgaz)',
  'Merkezi',
  'Merkezi (Pay ölçer)',
  'Yerden ısıtma',
  'Klima',
  'Soba',
  'Isı pompası',
  'Güneş enerjisi',
  'Yok',
] as const;

export const PARKING_OPTIONS = ['Yok', 'Açık otopark', 'Kapalı otopark', 'Açık & kapalı otopark'] as const;

export const DEED_STATUS_OPTIONS = [
  'Kat mülkiyeti',
  'Kat irtifakı',
  'Hisseli tapu',
  'Müstakil tapulu',
  'Arsa tapulu',
  'Kooperatif hisseli',
  'Tapu kaydı yok',
] as const;

export const USAGE_STATUS_OPTIONS = ['Boş', 'Kiracılı', 'Mülk sahibi'] as const;

export const FACADE_OPTIONS = ['Kuzey', 'Güney', 'Doğu', 'Batı'] as const;

export const VIEW_OPTIONS = ['Şehir', 'Doğa', 'Park', 'Göl', 'Dağ', 'Cadde'] as const;

export const ZONING_OPTIONS = ['Konut', 'Ticari', 'Konut + Ticari', 'Sanayi', 'Tarla', 'Bağ & Bahçe', 'Turizm', 'Diğer'] as const;

export const FLOOR_OPTIONS = [
  'Bodrum kat',
  'Kot 1',
  'Kot 2',
  'Bahçe katı',
  'Zemin',
  'Giriş katı',
  'Yüksek giriş',
  'Villa katı',
  'Çatı katı',
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
] as const;

/** Filtrelerde kullanılan oda seçenekleri; "5+" beş ve üzeri */
export const ROOM_FILTER_OPTIONS = ['1+0', '1+1', '2+1', '3+1', '4+1', '5+'] as const;

export const SORT_OPTIONS = [
  { value: 'yeni', label: 'En yeni' },
  { value: 'fiyat-artan', label: 'Fiyat (düşükten yükseğe)' },
  { value: 'fiyat-azalan', label: 'Fiyat (yüksekten düşüğe)' },
  { value: 'm2-azalan', label: 'm² (büyükten küçüğe)' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const PAGE_SIZE = 12;

export const IMAGE_LIMITS = {
  maxUploadBytes: 8 * 1024 * 1024,
  maxImagesPerProperty: 40,
  acceptedMime: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as string[],
  clientMaxDimension: 2400,
  serverMaxDimension: 2000,
};

export const STORAGE_BUCKETS = {
  propertyImages: 'property-images',
  branding: 'branding',
} as const;
