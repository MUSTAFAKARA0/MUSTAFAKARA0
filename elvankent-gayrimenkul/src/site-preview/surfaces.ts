/** Önizlenebilen site yüzeyleri (?s=): ana sayfa, arama (ilan listesi), ilan detayı */
export const PREVIEW_SURFACES = [
  { id: 'ana-sayfa', label: 'Ana sayfa' },
  { id: 'ilanlar', label: 'Arama / ilanlar' },
  { id: 'ilan', label: 'İlan detayı' },
] as const;
export type PreviewSurface = (typeof PREVIEW_SURFACES)[number]['id'];

/** Kapalı liste: bilinmeyen değer ana sayfaya düşer */
export function parsePreviewSurface(raw: unknown): PreviewSurface {
  return PREVIEW_SURFACES.find((s) => s.id === raw)?.id ?? 'ana-sayfa';
}
