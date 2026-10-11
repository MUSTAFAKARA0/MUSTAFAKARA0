import type { FooterLayout, HeaderLayout, HeroLayout } from '@/theme-engine/ids';
import type { HomepageComposition } from '@/site-factory/types';

/**
 * Manifest değerlerinin Türkçe adları (sihirbaz ve Site Builder). Yalnızca KARAY yüzeyleri
 * kullanır; kiracı sitesine girmez. Değer listeleri Theme Engine kimlikleridir (ids.ts).
 */
export const VARIANT_LABELS = {
  hero: { overlay: 'Fotoğraf üstü', centered: 'Ortalı', split: 'Bölünmüş', cinematic: 'Sinematik', editorial: 'Editoryal (çerçeveli)', showcase: 'İlan vitrini', immersive: 'Kenardan kenara (az metin)', blueprint: 'Izgaralı dizin', 'map-search': 'Arama + bölge dizini' } satisfies Record<HeroLayout, string>,
  header: { classic: 'Klasik', centered: 'Ortalı logo, ayrı menü', floating: 'Yüzen (ayrık)', transparent: 'Saydam (hero üzerinde)', structured: 'Izgaralı, iletişim şeritli', 'search-bar': 'Arama çubuklu' } satisfies Record<HeaderLayout, string>,
  card: { elevated: 'Gölgeli', outline: 'Çizgili', flat: 'Düz zemin', bezel: 'Çift çerçeve' },
  cardLayout: { standard: 'Standart', overlay: 'Görsel üstü', editorial: 'Editoryal (kutusuz)', horizontal: 'Yatay' },
  footer: { classic: 'Sütunlu', contact: 'İletişim öncelikli', minimal: 'Minimal', editorial: 'Editoryal', structured: 'Izgaralı künye', discovery: 'Keşif (bölge kısayollu)' } satisfies Record<FooterLayout, string>,
  motion: { none: 'Hareketsiz', subtle: 'Ölçülü', expressive: 'Belirgin' },
  homepage: { family: 'Ailenin düzeni', 'featured-first': 'Öne çıkan ilan önce', 'listings-first': 'İlanlar önce' } satisfies Record<HomepageComposition, string>,
} as const;

/** Bu sürümde tek uygulaması olan paket slotları (manifestte yer alır; seçenek eklendikçe açılır) */
export const FIXED_SLOT_LABELS: [key: string, label: string, value: string][] = [
  ['navigation', 'Menü', 'Standart'],
  ['grid', 'İlan ızgarası', 'Kart düzenine göre'],
  ['search', 'Arama', 'Hero ile uyumlu'],
  ['listingDetail', 'İlan detayı', 'Standart'],
  ['gallery', 'Galeri', 'Standart'],
  ['mapList', 'Harita / liste', 'Standart'],
  ['agents', 'Danışmanlar', 'Bu sürümde yok'],
  ['testimonials', 'Müşteri yorumları', 'Bu sürümde yok (gerçek veri gerekir)'],
];
