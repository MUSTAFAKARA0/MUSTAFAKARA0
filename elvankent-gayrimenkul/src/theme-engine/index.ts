/**
 * Theme Engine — herkese açık API (çalışma zamanı, bağımlılığı hafif).
 *
 *   ids        tema ve yazı tipi kimlikleri
 *   themes     tema kayıt defteri (THEMES) ve bileşen stili çözümleyici
 *   palettes   hazır renk paletleri
 *   tokens     renk/tipografi/köşe tokenları → CSS değişkenleri
 *   runtime    applyTheme(): site ve önizleme için tek giriş
 *
 * Bilerek dışa AKTARILMAYANLAR (paket boyutu / çalışma ortamı):
 *   settings            zod şemaları → '@/theme-engine/settings'
 *   typography/font-css seçili tipografi paketi (sunucu) → '@/theme-engine/typography/font-css'
 *   preview             istemci önizleme bileşeni → '@/theme-engine/preview/live-preview'
 *   design-css.ts       seçilmiş tema/varyant sunum kuralları (applyTheme satır içi yazar)
 */
export { THEME_IDS, FONT_IDS, type ThemeId, type FontId } from '@/theme-engine/ids';
export { THEMES, THEME_LIST, resolveStyle, type ThemeDefinition, type ResolvedStyle } from '@/theme-engine/themes';
export { PALETTES, findPalette } from '@/theme-engine/palettes';
export { resolveColors, siteCss } from '@/theme-engine/tokens';
export { FONT_CATALOG } from '@/theme-engine/typography/catalog';
export { applyTheme, type AppliedTheme, type ThemeAttributes } from '@/theme-engine/runtime';
export type { ThemeInput, BrandColors } from '@/theme-engine/types';
