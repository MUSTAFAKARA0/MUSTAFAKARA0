/**
 * Theme Engine kimlikleri (bağımlılıksız). Tema ve yazı tipi listesi YALNIZCA burada
 * tanımlıdır; kiracılar bu kimliklerden birini veri olarak taşır (site_configs.theme).
 * Yeni tema: buraya kimlik + themes.ts'e tanım (+ gerekirse design-css.ts'te sunum parçası). Müşteri başına
 * tema dosyası/kodu oluşturulmaz.
 */
export const THEME_IDS = ['klasik', 'marble', 'atlas', 'prestij', 'kent', 'yalin', 'rezidans', 'doga', 'dergi', 'grafit'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const FONT_IDS = ['manrope', 'fraunces', 'inter', 'playfair', 'dm-sans', 'lora', 'cormorant', 'space-grotesk', 'outfit', 'newsreader'] as const;
export type FontId = (typeof FONT_IDS)[number];

/** Yapısal tasarım seçenekleri (kapalı listeler; bkz. settings.ts › styleSchema) */
export const HERO_LAYOUTS = ['overlay', 'centered', 'split', 'cinematic', 'editorial', 'showcase', 'immersive', 'blueprint', 'map-search'] as const;
export const CARD_SURFACES = ['elevated', 'outline', 'flat', 'bezel'] as const;
export const CARD_LAYOUTS = ['standard', 'overlay', 'editorial', 'horizontal'] as const;
export const HEADER_LAYOUTS = ['classic', 'centered', 'floating', 'transparent', 'structured', 'search-bar'] as const;
export const FOOTER_LAYOUTS = ['classic', 'contact', 'minimal', 'editorial', 'structured', 'discovery'] as const;
export const MOTION_LEVELS = ['none', 'subtle', 'expressive'] as const;
export type HeroLayout = (typeof HERO_LAYOUTS)[number];
export type CardSurface = (typeof CARD_SURFACES)[number];
export type CardLayout = (typeof CARD_LAYOUTS)[number];
export type HeaderLayout = (typeof HEADER_LAYOUTS)[number];
export type FooterLayout = (typeof FOOTER_LAYOUTS)[number];
export type MotionLevel = (typeof MOTION_LEVELS)[number];

/**
 * Tasarım paketi slotları (design package). D7.3: yüzey desenleri yalnızca EKLEME ile genişler
 * (mevcut değerler silinmez/yeniden adlandırılmaz). Her slot sitenin manifestinde kapalı bir listeden
 * seçilir. Bugün tek uygulaması olan slotlar 'standard' ile başlar; yeni bir varyant = buraya
 * kimlik + Site Engine'de bileşen/CSS parçası (yalnızca seçen siteye gider). 'none' = bu sürümde
 * bileşen yok (ör. müşteri yorumları gerçek veri gerektirir; uydurma içerik gösterilmez).
 */
export const NAVIGATION_STYLES = ['standard'] as const;
export const GRID_LAYOUTS = ['standard', 'gallery-wide', 'ruled-index', 'map-results'] as const;
export const SEARCH_STYLES = ['standard', 'map-first'] as const;
export const LISTING_DETAIL_LAYOUTS = ['standard', 'immersive', 'information-first', 'map-first'] as const;
export const GALLERY_LAYOUTS = ['standard', 'grid', 'carousel', 'fullscreen'] as const;
export const MAP_LIST_LAYOUTS = ['standard', 'map-first'] as const;
export type SearchStyle = (typeof SEARCH_STYLES)[number];
export type GridLayout = (typeof GRID_LAYOUTS)[number];
export type ListingDetailLayout = (typeof LISTING_DETAIL_LAYOUTS)[number];
export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number];
export type MapListLayout = (typeof MAP_LIST_LAYOUTS)[number];
export const AGENT_SECTIONS = ['none'] as const;
export const TESTIMONIAL_SECTIONS = ['none'] as const;

/**
 * Etkileşim desenleri (D7 Pattern Library › interaction). Tarayıcıda çalışan küçük adalar; her
 * biri YALNIZCA onu seçen sitenin tarayıcısına iner (istemci tarafı tembel yükleme — D7.0 ölçümü).
 * Seçilmezse sayfaya ne kod ne CSS yazılır. Kimlikler kapalı listedir (manifest: slots.interactions).
 */
export const INTERACTION_PATTERNS = ['scroll-header', 'image-reveal'] as const;
export type InteractionPattern = (typeof INTERACTION_PATTERNS)[number];
