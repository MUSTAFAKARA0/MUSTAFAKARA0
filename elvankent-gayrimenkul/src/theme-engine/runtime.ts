import { resolveStyle, THEMES, type ResolvedStyle, type ThemeDefinition } from '@/theme-engine/themes';
import { designCss } from '@/theme-engine/design-css';
import { siteCss } from '@/theme-engine/tokens';
import type { BrandColors, ThemeInput } from '@/theme-engine/types';

/** Temanın DOM'a uygulanan sunum kancaları (bileşenler yalnızca bunları ve tokenları kullanır) */
export interface ThemeAttributes {
  'data-site-theme': string;
  'data-site-card': string;
  'data-site-button': string;
  'data-site-footer': string;
  'data-site-image': string;
  'data-site-card-layout': string;
  'data-site-header-layout': string;
  /** Yalnızca hareket dili seçiliyse */
  'data-site-motion'?: string;
}

export interface AppliedTheme {
  /** Tokenlar → CSS değişkenleri (selector içinde) + seçilmiş tasarım paketinin sunum kuralları */
  css: string;
  /** Kapsayıcıya eklenecek tema öznitelikleri */
  attributes: ThemeAttributes;
  /** Etkin bileşen stilleri (tema varsayılanı + kiracı ayarı) */
  style: ResolvedStyle;
  theme: ThemeDefinition;
}

/**
 * Theme Engine'in tek çalışma zamanı girişi: kiracının tema verisi (theme_id + ayarlar)
 * → CSS değişkenleri + sunum öznitelikleri. Yayındaki kiracı sitesi (Site Engine) ve
 * tema önizlemesi AYNI fonksiyonu kullanır; tema seçimi kod dallanması değil, veridir.
 *
 *   site_config → applyTheme() → { css, attributes } → bileşenler (yalnızca token/öznitelik)
 *
 * Dönen CSS yalnızca bu sitenin seçtiği tema ve varyantları içerir (design-css.ts); tema
 * kataloğunun geri kalanı sayfaya yazılmaz.
 */
export function applyTheme(input: ThemeInput, brand: BrandColors, darkAllowed: boolean, selector = 'html:root'): AppliedTheme {
  const theme = THEMES[input.theme];
  const style = resolveStyle(input);
  return {
    css: siteCss(input, brand, darkAllowed, selector) + designCss(theme.id, style),
    attributes: {
      'data-site-theme': theme.id,
      'data-site-card': style.card,
      'data-site-button': style.button,
      'data-site-footer': style.footer,
      'data-site-image': style.image,
      'data-site-card-layout': style.cardLayout,
      'data-site-header-layout': style.headerLayout,
      ...(style.motion !== 'none' ? { 'data-site-motion': style.motion } : {}),
    },
    style,
    theme,
  };
}
