import { CARD_LAYOUTS, FOOTER_LAYOUTS, GALLERY_LAYOUTS, HEADER_LAYOUTS, HERO_LAYOUTS, INTERACTION_PATTERNS, LISTING_DETAIL_LAYOUTS, NAVIGATION_STYLES, SEARCH_STYLES } from '@/theme-engine/ids';
import type { PatternKind, PatternMeta } from '@/components/patterns/contracts';

/**
 * Desen kaydı — YALNIZCA VERİ (bileşen içe aktarmaz; içe aktarsaydı kayıt tarayıcı paketine
 * bütün desenleri taşırdı). Manifestin kapalı listeleri (theme-engine/ids.ts) ile bu kayıt
 * birebir eşleşir: her manifest değerinin bir uygulaması, her uygulamanın bir manifest değeri
 * vardır (tests/unit/patterns.test.mjs).
 */
const legacy = (kind: PatternKind, ids: readonly string[], source: string): PatternMeta[] =>
  ids.map((id) => ({ kind, id, label: id, interactive: false, source, legacy: true }));

export const PATTERN_REGISTRY: readonly PatternMeta[] = [
  // Mevcut (kilitli) uygulamalar
  ...legacy('hero', HERO_LAYOUTS, 'components/home/hero.tsx'),
  ...legacy('header', HEADER_LAYOUTS, 'components/layout/site-header.tsx'),
  ...legacy('listing-card', CARD_LAYOUTS, 'components/property/property-card.tsx'),
  ...legacy('footer', FOOTER_LAYOUTS, 'components/layout/site-footer.tsx'),
  ...legacy('gallery', GALLERY_LAYOUTS, 'components/gallery/property-gallery.tsx'),
  ...legacy('search', SEARCH_STYLES, 'components/search/hero-search.tsx'),
  ...legacy('property-detail', LISTING_DETAIL_LAYOUTS, 'components/property/property-detail-view.tsx'),
  ...legacy('navigation', NAVIGATION_STYLES, 'components/layout/site-header.tsx'),
  // D7: etkileşim adaları (istemci tarafı tembel yükleme)
  { kind: 'interaction', id: 'scroll-header', label: 'Kaydırınca belirginleşen header', interactive: true, marker: 'karay-pattern:interaction/scroll-header', source: 'components/patterns/interaction/scroll-header.tsx' },
  { kind: 'interaction', id: 'image-reveal', label: 'Görsel yüklenince yumuşak beliriş', interactive: true, marker: 'karay-pattern:interaction/image-reveal', source: 'components/patterns/interaction/image-reveal.tsx' },
];

/** Manifest kapalı listeleri (desen türü → izin verilen kimlikler) */
export const PATTERN_ENUMS: Partial<Record<PatternKind, readonly string[]>> = {
  hero: HERO_LAYOUTS,
  header: HEADER_LAYOUTS,
  'listing-card': CARD_LAYOUTS,
  footer: FOOTER_LAYOUTS,
  gallery: GALLERY_LAYOUTS,
  search: SEARCH_STYLES,
  'property-detail': LISTING_DETAIL_LAYOUTS,
  navigation: NAVIGATION_STYLES,
  interaction: INTERACTION_PATTERNS,
};

export function findPattern(kind: PatternKind, id: string): PatternMeta | null {
  return PATTERN_REGISTRY.find((p) => p.kind === kind && p.id === id) ?? null;
}
