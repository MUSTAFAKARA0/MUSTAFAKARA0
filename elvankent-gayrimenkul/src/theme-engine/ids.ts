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
export const HERO_LAYOUTS = ['overlay', 'centered', 'split', 'cinematic', 'editorial', 'showcase'] as const;
export const CARD_SURFACES = ['elevated', 'outline', 'flat', 'bezel'] as const;
export const CARD_LAYOUTS = ['standard', 'overlay', 'editorial', 'horizontal'] as const;
export const HEADER_LAYOUTS = ['classic', 'centered', 'floating'] as const;
export const FOOTER_LAYOUTS = ['classic', 'contact', 'minimal'] as const;
export const MOTION_LEVELS = ['none', 'subtle', 'expressive'] as const;
export type HeroLayout = (typeof HERO_LAYOUTS)[number];
export type CardSurface = (typeof CARD_SURFACES)[number];
export type CardLayout = (typeof CARD_LAYOUTS)[number];
export type HeaderLayout = (typeof HEADER_LAYOUTS)[number];
export type FooterLayout = (typeof FOOTER_LAYOUTS)[number];
export type MotionLevel = (typeof MOTION_LEVELS)[number];
