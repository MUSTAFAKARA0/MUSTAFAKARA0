/**
 * Theme Engine kimlikleri (bağımlılıksız). Tema ve yazı tipi listesi YALNIZCA burada
 * tanımlıdır; kiracılar bu kimliklerden birini veri olarak taşır (site_configs.theme).
 * Yeni tema: buraya kimlik + themes.ts'e tanım (+ gerekirse css/themes.css). Müşteri başına
 * tema dosyası/kodu oluşturulmaz.
 */
export const THEME_IDS = ['klasik', 'marble', 'atlas', 'prestij', 'kent', 'yalin', 'rezidans', 'doga', 'dergi', 'grafit'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const FONT_IDS = ['manrope', 'fraunces', 'inter', 'playfair', 'dm-sans', 'lora', 'cormorant', 'space-grotesk', 'outfit', 'newsreader'] as const;
export type FontId = (typeof FONT_IDS)[number];
