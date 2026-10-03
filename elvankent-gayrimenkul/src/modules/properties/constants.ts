import type { Enums } from '@/types/supabase';

export type ListingType = Enums<'listing_type'>;
export type PropertyCategory = Enums<'property_category'>;
export type ListingStatus = Enums<'listing_status'>;
export type CurrencyCode = Enums<'currency_code'>;
export type LocationPrecision = Enums<'location_precision'>;

export const LISTING_TYPE_LABELS: Record<ListingType, string> = { sale: 'Satılık', rent: 'Kiralık' };
export const LISTING_TYPE_TO_SLUG: Record<ListingType, string> = { sale: 'satilik', rent: 'kiralik' };
export const LISTING_TYPE_SLUGS: Record<string, ListingType> = { satilik: 'sale', kiralik: 'rent' };

export const CATEGORY_LABELS: Record<PropertyCategory, string> = {
  konut: 'Konut',
  ticari: 'Ticari',
  arsa: 'Arsa',
  diger: 'Diğer',
};
export const CATEGORY_SLUGS: Record<string, PropertyCategory> = { konut: 'konut', ticari: 'ticari', arsa: 'arsa', diger: 'diger' };

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Taslak',
  pending: 'Onay bekliyor',
  published: 'Yayında',
  sold: 'Satıldı',
  rented: 'Kiralandı',
  archived: 'Arşivde',
};

/** Veritabanı tetikleyicisindeki (properties_before_write) geçiş kurallarının aynısı */
export const STATUS_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ['pending', 'published', 'archived'],
  pending: ['draft', 'published', 'archived'],
  published: ['draft', 'pending', 'sold', 'rented', 'archived'],
  sold: ['published', 'archived'],
  rented: ['published', 'archived'],
  archived: ['draft', 'published'],
};

export function allowedTransitions(status: ListingStatus, listingType: ListingType): ListingStatus[] {
  return STATUS_TRANSITIONS[status].filter(
    (s) => !(s === 'sold' && listingType !== 'sale') && !(s === 'rented' && listingType !== 'rent'),
  );
}

/** Herkese açık sitede görünen durumlar */
export const PUBLIC_STATUSES: readonly ListingStatus[] = ['published', 'sold', 'rented'];

export const CURRENCY_LABELS: Record<CurrencyCode, string> = { TRY: '₺ TL', USD: '$ USD', EUR: '€ EUR' };

export const PRECISION_LABELS: Record<LocationPrecision, string> = {
  exact: 'Tam konum',
  approximate: 'Yaklaşık konum (~200 m)',
  neighborhood: 'Sadece mahalle',
};

export const FEATURE_GROUP_LABELS: Record<string, string> = {
  ic: 'İç özellikler',
  dis: 'Dış özellikler',
  muhit: 'Muhit',
  ulasim: 'Ulaşım',
};

type Option = { value: string; label: string };

export const HEATING_OPTIONS: Option[] = [
  { value: 'kombi-dogalgaz', label: 'Kombi (doğalgaz)' },
  { value: 'merkezi', label: 'Merkezi' },
  { value: 'merkezi-pay-olcer', label: 'Merkezi (pay ölçer)' },
  { value: 'yerden-isitma', label: 'Yerden ısıtma' },
  { value: 'klima', label: 'Klima' },
  { value: 'soba', label: 'Soba' },
  { value: 'isi-pompasi', label: 'Isı pompası' },
  { value: 'gunes-enerjisi', label: 'Güneş enerjisi' },
  { value: 'yok', label: 'Yok' },
  { value: 'diger', label: 'Diğer' },
];

export const PARKING_OPTIONS: Option[] = [
  { value: 'yok', label: 'Yok' },
  { value: 'acik', label: 'Açık otopark' },
  { value: 'kapali', label: 'Kapalı otopark' },
  { value: 'acik-kapali', label: 'Açık ve kapalı otopark' },
];

export const DEED_STATUS_OPTIONS: Option[] = [
  { value: 'kat-mulkiyeti', label: 'Kat mülkiyeti' },
  { value: 'kat-irtifaki', label: 'Kat irtifakı' },
  { value: 'hisseli-tapu', label: 'Hisseli tapu' },
  { value: 'mustakil-tapu', label: 'Müstakil tapu' },
  { value: 'arsa-tapulu', label: 'Arsa tapulu' },
  { value: 'kooperatif', label: 'Kooperatif hisseli' },
  { value: 'tapu-yok', label: 'Tapu kaydı yok' },
  { value: 'diger', label: 'Diğer' },
];

export const USAGE_STATUS_OPTIONS: Option[] = [
  { value: 'bos', label: 'Boş' },
  { value: 'kiracili', label: 'Kiracılı' },
  { value: 'mulk-sahibi', label: 'Mülk sahibi oturuyor' },
];

export const ZONING_OPTIONS: Option[] = [
  { value: 'konut', label: 'Konut' },
  { value: 'ticari', label: 'Ticari' },
  { value: 'konut-ticari', label: 'Konut + ticari' },
  { value: 'sanayi', label: 'Sanayi' },
  { value: 'tarla', label: 'Tarla' },
  { value: 'bag-bahce', label: 'Bağ & bahçe' },
  { value: 'turizm', label: 'Turizm' },
  { value: 'diger', label: 'Diğer' },
];

export const FACADE_OPTIONS: Option[] = [
  { value: 'kuzey', label: 'Kuzey' },
  { value: 'guney', label: 'Güney' },
  { value: 'dogu', label: 'Doğu' },
  { value: 'bati', label: 'Batı' },
];

export const VIEW_OPTIONS: Option[] = [
  { value: 'sehir', label: 'Şehir' },
  { value: 'doga', label: 'Doğa' },
  { value: 'park', label: 'Park' },
  { value: 'gol', label: 'Göl' },
  { value: 'dag', label: 'Dağ' },
  { value: 'deniz', label: 'Deniz' },
  { value: 'cadde', label: 'Cadde' },
];

const SPECIAL_FLOORS: Option[] = [
  { value: 'kot-3', label: 'Kot 3' },
  { value: 'kot-2', label: 'Kot 2' },
  { value: 'kot-1', label: 'Kot 1' },
  { value: 'bodrum', label: 'Bodrum kat' },
  { value: 'zemin', label: 'Zemin kat' },
  { value: 'bahce', label: 'Bahçe katı' },
  { value: 'giris', label: 'Giriş katı' },
  { value: 'yuksek-giris', label: 'Yüksek giriş' },
  { value: 'villa', label: 'Villa katı' },
  { value: 'cati', label: 'Çatı katı' },
];

export const FLOOR_OPTIONS: Option[] = [
  ...SPECIAL_FLOORS,
  ...Array.from({ length: 40 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}. kat` })),
];

/** Kat filtresi (floor_index üzerinden) */
export const FLOOR_FILTER_OPTIONS: Option[] = [
  { value: 'giris', label: 'Giriş / bahçe katı' },
  { value: 'ara', label: 'Ara kat' },
  { value: 'ust', label: 'En üst kat' },
];

export const ROOM_FILTER_OPTIONS = ['1+0', '1+1', '2+1', '3+1', '4+1', '5+'] as const;
export type RoomFilter = (typeof ROOM_FILTER_OPTIONS)[number];

export const SORT_OPTIONS = [
  { value: 'yeni', label: 'En yeni' },
  { value: 'fiyat-artan', label: 'Fiyat (artan)' },
  { value: 'fiyat-azalan', label: 'Fiyat (azalan)' },
  { value: 'm2-azalan', label: 'm² (büyükten küçüğe)' },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const PAGE_SIZE = 12;
/** "Yeni" rozeti ve filtresi (gün) */
export const NEW_LISTING_DAYS = 14;
/** "Fiyat düştü" rozeti ve filtresi (gün) */
export const PRICE_DROP_DAYS = 30;

function labelMap(options: Option[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]));
}

export const HEATING_LABELS = labelMap(HEATING_OPTIONS);
export const PARKING_LABELS = labelMap(PARKING_OPTIONS);
export const DEED_STATUS_LABELS = labelMap(DEED_STATUS_OPTIONS);
export const USAGE_STATUS_LABELS = labelMap(USAGE_STATUS_OPTIONS);
export const ZONING_LABELS = labelMap(ZONING_OPTIONS);
export const FACADE_LABELS = labelMap(FACADE_OPTIONS);
export const VIEW_LABELS = labelMap(VIEW_OPTIONS);
export const FLOOR_LABELS = labelMap(FLOOR_OPTIONS);

export function floorLabel(floor: string | null | undefined, totalFloors?: number | null): string | null {
  if (!floor) return null;
  const label = FLOOR_LABELS[floor] ?? floor;
  return totalFloors ? `${label} / ${totalFloors}` : label;
}

export function roomsLabel(rooms: number | null | undefined, living: number | null | undefined): string | null {
  if (rooms === null || rooms === undefined) return null;
  return `${rooms}+${living ?? 0}`;
}
