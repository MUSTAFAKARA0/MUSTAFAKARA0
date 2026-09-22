import type { CurrencyCode, ListingType } from '@/types/database';

const priceFormatters = new Map<CurrencyCode, Intl.NumberFormat>();

export function formatPrice(price: number, currency: CurrencyCode = 'TRY'): string {
  let f = priceFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 });
    priceFormatters.set(currency, f);
  }
  return f.format(price);
}

export function formatListingPrice(price: number, currency: CurrencyCode, listingType: ListingType): string {
  const base = formatPrice(price, currency);
  return listingType === 'rent' ? `${base} / ay` : base;
}

const numberFormatter = new Intl.NumberFormat('tr-TR');
export function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

export function formatArea(m2: number | null | undefined): string | null {
  if (!m2) return null;
  return `${numberFormatter.format(m2)} m²`;
}

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

/** "Bugün", "Dün", "3 gün önce", "2 hafta önce" … */
export function formatRelativeDate(value: string | Date, now: Date = new Date()): string {
  const date = new Date(value);
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return formatDate(date);
}

export function formatFloor(floor: string | null, totalFloors?: number | null): string | null {
  if (!floor) return null;
  const label = /^\d+$/.test(floor) ? `${floor}. kat` : floor;
  return totalFloors ? `${label} / ${totalFloors}` : label;
}

export function yesNo(value: boolean | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value ? 'Evet' : 'Hayır';
}

/** Türk telefon numarasını görüntüleme formatına çevirir: 0 (532) 123 45 67 */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('90') && digits.length === 12 ? digits.slice(2) : digits.replace(/^0/, '');
  if (local.length !== 10) return raw;
  return `0 (${local.slice(0, 3)}) ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
}
