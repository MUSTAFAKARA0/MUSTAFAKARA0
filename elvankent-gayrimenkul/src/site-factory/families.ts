import { CATALOG } from '@/site-factory/catalog';
import type { DesignFamily } from '@/site-factory/types';

export type { DesignFamily } from '@/site-factory/types';

/**
 * SITE FACTORY — KARAY'ın iç tasarım üretim kataloğu.
 *
 * Bir "tasarım ailesi", parçaların (tema karakteri, renk sistemi, hero, header, ilan kartı,
 * footer, hareket dili ve ana sayfa kompozisyonu) önceden düşünülmüş bir birleşimidir. Aile
 * müşteriye gösterilen bir ayar değildir: KARAY süper admini yeni bir site kurarken seçer,
 * derleyici (compile.ts) seçimi sitenin yapılandırmasına (manifest) yazar.
 *
 * Bu katalog MÜŞTERİ SİTESİNİN ÇALIŞMA ZAMANINA GİRMEZ: Site Engine bu modülü içe aktaramaz
 * (ESLint kuralı + tests/unit/boundaries.test.mjs). Yayındaki site yalnızca kendi manifestini
 * okur ("ben hangi aileden geldim" diye karar vermez); yeni bir aile eklemek mevcut hiçbir
 * kiracının sayfasını değiştirmez.
 *
 * Aileler src/site-factory/catalog/<kimlik>/ klasörlerindedir (sözleşme: catalog/index.ts).
 * Yeni aile = yeni klasör (veri). Yeni bir PARÇA (ör. yeni hero düzeni) = Theme Engine'de kimlik +
 * Site Engine'de bileşen/CSS parçası; seçilmeyen sitelere yine hiçbir şey gitmez.
 */
export const DESIGN_FAMILIES: readonly DesignFamily[] = CATALOG;

export function findDesignFamily(id: string): DesignFamily | null {
  return DESIGN_FAMILIES.find((f) => f.id === id) ?? null;
}

const PART_LABELS: Record<string, Record<string, string>> = {
  hero: { overlay: 'Fotoğraf üstü hero', centered: 'Ortalı hero', split: 'Bölünmüş hero', cinematic: 'Sinematik hero', editorial: 'Editoryal hero', showcase: 'Vitrin hero', immersive: 'Kenardan kenara hero', blueprint: 'Izgaralı dizin hero', 'map-search': 'Arama + bölge hero' },
  headerLayout: { classic: 'Klasik header', centered: 'Ortalı logo', floating: 'Yüzen header', transparent: 'Saydam header', structured: 'Izgaralı header', 'search-bar': 'Arama çubuklu header' },
  cardLayout: { standard: 'Standart kart', overlay: 'Görsel üstü kart', editorial: 'Editoryal kart', horizontal: 'Yatay kart' },
  footerLayout: { classic: 'Sütunlu footer', contact: 'İletişim öncelikli footer', minimal: 'Minimal footer', editorial: 'Editoryal footer', structured: 'Izgaralı footer', discovery: 'Keşif footer' },
  motion: { none: 'Hareketsiz', subtle: 'Ölçülü hareket', expressive: 'Belirgin hareket' },
};

/** D7.3 yüzey desenlerinin kısa adları (style.slots; standart → listelenmez) */
export const SURFACE_PART_LABELS: Record<string, Record<string, string>> = {
  search: { 'map-first': 'Bölge kısayollu arama' },
  grid: { 'gallery-wide': 'Geniş görselli seçki', 'ruled-index': 'Numaralı ilan dizini', 'map-results': 'Liste ↔ harita' },
  listingDetail: { immersive: 'Editoryal ilan detayı', 'information-first': 'Künye öncelikli detay', 'map-first': 'Konum öncelikli detay' },
  gallery: { grid: 'Numaralı galeri', carousel: 'Kaydırmalı galeri', fullscreen: 'Tam genişlik galeri' },
  mapList: { 'map-first': 'Bölge bağlamlı harita' },
};

/** Ailenin parçalarının kısa adları (Site Builder kartlarında) */
export function familyParts(f: DesignFamily, resolved: Record<'hero' | 'headerLayout' | 'cardLayout' | 'footerLayout' | 'motion', string>): string[] {
  const surfaces = Object.entries(f.style.slots ?? {}).flatMap(([k, v]) => (typeof v === 'string' && SURFACE_PART_LABELS[k]?.[v] ? [SURFACE_PART_LABELS[k][v]] : []));
  return (['hero', 'headerLayout', 'cardLayout', 'footerLayout', 'motion'] as const).map((k) => PART_LABELS[k][resolved[k]] ?? resolved[k]).concat(surfaces, `${f.home.length} bölüm`);
}
