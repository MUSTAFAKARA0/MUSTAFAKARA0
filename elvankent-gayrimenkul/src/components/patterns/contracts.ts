import type { SectionOverride } from '@/components/home/sections';
import type { HomeData } from '@/components/site/site-home';
import type { PropertyCard, PropertyDetail, PropertyImage } from '@/modules/properties/types';
import type { SearchOptions } from '@/modules/properties/search-types';
import type { ListingPreset, ListingQuery } from '@/modules/properties/filters';
import type { Tenant } from '@/platform/tenant/tenant';
import type { SiteView } from '@/site-config/load';
import type { HomeSectionConfig } from '@/site-config/schema';

/**
 * DESIGN PATTERN LIBRARY — bileşen sözleşmeleri (yalnızca tipler).
 *
 * Bir desen (pattern), bir tasarım kararının (hero, header, ilan kartı, galeri, arama, ilan
 * detayı, footer, bölüm, menü, etkileşim) tek bir uygulamasıdır. Kurallar:
 *
 *  1. VERİ ≠ TASARIM: desenler veriyi yalnızca prop olarak alır (ilan sorgusu, CRM, SEO yok).
 *     Aynı PropertyCard / PropertyDetail verisi her desende aynıdır.
 *  2. KİRACIDAN BAĞIMSIZ: kiracı kimliği, alan adı veya müşteriye özel koşul içermez.
 *  3. Görsel desenler SUNUCU bileşenidir: seçilmeyen desenin kodu tarayıcıya gitmez.
 *  4. Tarayıcı davranışı gerektiren desenler (harita, tam ekran galeri, filtre alt paneli…)
 *     YALNIZCA bir istemci yükleyicisinin içinden tembel yüklenir (interaction/islands.tsx
 *     örneği). Sunucu bileşeninde statik import veya next/dynamic YETMEZ — D7.0 ölçümü:
 *     iki yöntemde de seçilmeyen kod tarayıcıya iniyordu.
 *  5. Deseni yalnızca seçen sitenin CSS'i sayfaya yazılır (patterns/styles.ts).
 *
 * Mevcut bileşenler (components/home, layout, property, gallery, search) "standart" ve eski
 * varyantlardır; DEĞİŞTİRİLMEZ. Yeni varyantlar bu klasörde yeni dosya olarak eklenir.
 */
export const PATTERN_KINDS = ['hero', 'header', 'listing-card', 'gallery', 'search', 'property-detail', 'footer', 'section', 'navigation', 'interaction', 'listing', 'map'] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];

export interface PatternMeta {
  kind: PatternKind;
  /** Manifestteki kimlik (kebab-case; yapıyı anlatır, aile adını değil: ör. 'split-map', 'luxury-frame') */
  id: string;
  label: string;
  /** Tarayıcı kodu taşıyor mu (taşıyorsa yalnızca istemci yükleyicisinden tembel yüklenir) */
  interactive: boolean;
  /** İnteraktif desenin tarayıcı paketindeki benzersiz işareti (bundle regresyon testi) */
  marker?: string;
  /** Uygulamanın yeri (src/'e göre) */
  source: string;
  /** Mevcut (D7 öncesi) bileşen: dosyası kilitli, değiştirilmez */
  legacy?: boolean;
}

/** Kiracıya bağlı desenlerin ortak bağlamı (kiracı yalnızca prop olarak gelir) */
export interface PatternContext {
  tenant: Tenant;
  view: SiteView;
}

export interface HeroPatternProps extends PatternContext {
  spotlight: PropertyCard | null;
  options: SearchOptions;
  publishedCount: number;
  content: SectionOverride;
}
export interface HeaderPatternProps extends PatternContext {
  hasBlog: boolean;
}
export interface FooterPatternProps extends PatternContext {
  hasBlog: boolean;
  regions: { slug: string; name: string }[];
}
export interface NavigationPatternProps {
  items: { href: string; label: string }[];
}
/** İlan kartı kiracıdan bağımsızdır: yalnızca ilan verisi */
export interface ListingCardPatternProps {
  property: PropertyCard;
  priority?: boolean;
  sizes?: string;
}
export interface GalleryPatternProps {
  images: PropertyImage[];
  title: string;
}
/** Ana sayfa (hero) araması */
export interface SearchPatternProps {
  options: SearchOptions;
}
/**
 * İlan listesi/arama sayfasının arama yüzeyi (klasik filtre, premium arama, kenar çubuğu,
 * harita öncelikli, mobil filtre paneli, kompakt). Sorgu ve seçenekler veri katmanından gelir;
 * desen yalnızca URL'yi değiştirir (ilan sorgusu yapmaz).
 */
export interface ListingSearchPatternProps {
  query: ListingQuery;
  preset: ListingPreset;
  options: SearchOptions;
}
/**
 * İlan sonuçları yüzeyi (ızgara, kompakt ızgara, yatay, öne çıkan, harita sonuçları). Sonuçlar
 * ve sayfalama veri katmanından hazır gelir.
 */
export interface ListingResultsPatternProps {
  items: PropertyCard[];
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  priorityCount?: number;
}
/**
 * Harita yüzeyi (Map First altyapısı). Harita sağlayıcısı, karo sunucusu ve koordinatlar mevcut
 * sistemden gelir (modules/maps); desen yalnızca sunumu seçer, harita arka ucunu değiştirmez.
 */
export interface MapPatternProps {
  center: { lat: number; lng: number };
  mode: 'pin' | 'area';
  radiusMeters?: number;
  zoom?: number;
  attribution: string;
  maxZoom?: number;
  ariaLabel: string;
  className?: string;
}
export interface PropertyDetailPatternProps extends PatternContext {
  property: PropertyDetail;
  similar: PropertyCard[];
}
export interface SectionPatternProps extends PatternContext {
  section: HomeSectionConfig;
  data: HomeData;
}
