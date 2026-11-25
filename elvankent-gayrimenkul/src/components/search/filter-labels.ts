import { formatNumber } from '@/lib/format';

/** Fiyat aralığı etiketi: "En az X ₺", "En çok Y ₺" veya "X – Y ₺" (anlamsız "0 – ∞" yok) */
export function priceRangeLabel(min?: number, max?: number): string | undefined {
  if (min && max) return `${formatNumber(min)} – ${formatNumber(max)} ₺`;
  if (min) return `En az ${formatNumber(min)} ₺`;
  if (max) return `En çok ${formatNumber(max)} ₺`;
  return undefined;
}
