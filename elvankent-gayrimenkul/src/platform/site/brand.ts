import type { BrandDraft } from '@/platform/site/schema';
import type { OrgSettings } from '@/platform/tenant/tenant';

/**
 * Taslak marka değişikliklerini ofis ayarlarının üzerine bindirir (saf fonksiyon).
 * Önizlemede ve KARAY › Marka ekranında "taslaktaki etkin değer" için kullanılır.
 * Firma adı ve renkler boşaltılamaz (veritabanındaki kuralla aynı).
 */
export function applyBrandDraft(settings: OrgSettings, brand: BrandDraft | null | undefined): OrgSettings {
  if (!brand) return settings;
  const next: Record<string, unknown> = { ...settings };
  for (const [k, v] of Object.entries(brand)) {
    if (!(k in settings)) continue;
    if ((k === 'display_name' || k === 'primary_color' || k === 'accent_color') && !v) continue;
    next[k] = v === '' ? null : v;
  }
  return next as OrgSettings;
}

export function hasBrandDraft(brand: BrandDraft | null | undefined): boolean {
  return Boolean(brand && Object.keys(brand).length > 0);
}
