import { buildTheme, ensureContrast, foregroundFor, isDark, mixHex, safeColor } from '@/platform/branding/theme';
import { FONT_CATALOG } from '@/platform/site/font-catalog';
import { findPalette } from '@/platform/site/palettes';
import type { ColorTokens, SiteConfig } from '@/platform/site/schema';
import { THEMES } from '@/platform/site/themes';

/**
 * Site tasarım tokenları → CSS değişkenleri. Bileşenler renk/yazı tipi/köşe değerlerini
 * koda gömmez; yalnızca bu değişkenleri kullanır (globals.css @theme). Böylece tema,
 * palet ve tipografi değişikliği yalnızca bu CSS'i değiştirir.
 *
 * Renk modu:
 *   brand  → ofisin kendi ana/vurgu renkleri (Şirket Ayarları) + temanın nötr zeminleri
 *            (bugünkü davranış; ayar yoksa site görünümü değişmez)
 *   preset → hazır palet (tüm tokenlar uyumlu)
 *   custom → palet + tek tek değiştirilen tokenlar
 * Metin/zemin ve buton yazısı kontrastı her durumda WCAG AA'ya göre düzeltilir.
 */

const DEFAULT_NEUTRALS: Omit<ColorTokens, 'primary' | 'accent'> = {
  secondary: '#141a18',
  background: '#fbfaf8',
  surface: '#ffffff',
  text: '#141a18',
  muted: '#5a605d',
  border: '#e6e2da',
  success: '#1b7549',
  warning: '#945f06',
  error: '#b42318',
};

export interface ResolvedColors {
  tokens: ColorTokens;
  scheme: 'light' | 'dark';
}

export function resolveColors(config: SiteConfig, brand: { primary_color: string | null; accent_color: string | null }, darkAllowed: boolean): ResolvedColors {
  const c = config.colors;
  const preset = findPalette(c.preset);
  if (c.mode === 'brand' || !preset) {
    return {
      scheme: 'light',
      tokens: { ...DEFAULT_NEUTRALS, primary: safeColor(brand.primary_color, '#0e4d45'), accent: safeColor(brand.accent_color, '#b5813a') },
    };
  }
  const tokens: ColorTokens = c.mode === 'custom' ? { ...preset.tokens, ...stripUndefined(c.tokens ?? {}) } : preset.tokens;
  const scheme = preset.scheme === 'dark' && darkAllowed ? 'dark' : 'light';
  // Koyu palet seçili ama koyu görünüm kapalıysa: modern yeşil paletine dön
  if (preset.scheme === 'dark' && !darkAllowed) return { scheme: 'light', tokens: findPalette('modern-green')!.tokens };
  return { scheme, tokens };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const RADII: Record<'soft' | 'sharp' | 'medium' | 'round', Record<string, string>> = {
  soft: {},
  round: { lg: '0.85rem', xl: '1.1rem', '2xl': '1.45rem', '3xl': '2rem' },
  medium: { lg: '0.4rem', xl: '0.55rem', '2xl': '0.75rem', '3xl': '1rem' },
  sharp: { lg: '0.2rem', xl: '0.25rem', '2xl': '0.3rem', '3xl': '0.4rem' },
};

/** Tokenlardan tam CSS (seçici: kiracı sitesi kökü veya önizleme alanı) */
export function siteCss(config: SiteConfig, brand: { primary_color: string | null; accent_color: string | null }, darkAllowed: boolean, selector = 'html:root'): string {
  const { tokens: raw, scheme } = resolveColors(config, brand, darkAllowed);
  // İkincil renk (footer ve koyu bloklar) beyaz metinle okunabilir koyulukta tutulur
  const t = { ...raw, secondary: ensureContrast(raw.secondary, '#ffffff', 7) };
  const theme = THEMES[config.theme];
  const base = buildTheme(t.primary, t.accent);
  const bg = t.background;
  const text = ensureContrast(t.text, bg, 7);
  const muted = ensureContrast(t.muted, bg, 4.5);
  const dark = scheme === 'dark' || isDark(bg);
  const surfaceMuted = mixHex(t.surface, text, dark ? 0.92 : 0.955);
  const surfaceSunken = mixHex(t.surface, text, dark ? 0.86 : 0.92);
  const primaryInk = ensureContrast(t.primary, bg, 4.5);
  const accentInk = ensureContrast(t.accent, bg, 4.5);
  const vars: Record<string, string> = {
    '--primary': t.primary,
    '--primary-fg': base.primaryFg,
    '--primary-hover': base.primaryHover,
    '--primary-ink': primaryInk,
    '--primary-soft': mixHex(t.primary, t.surface, dark ? 0.22 : 0.09),
    '--accent': t.accent,
    '--accent-fg': base.accentFg,
    '--accent-ink': accentInk,
    '--accent-soft': mixHex(t.accent, t.surface, dark ? 0.24 : 0.14),
    '--ring': t.primary,
    '--background': bg,
    '--surface': t.surface,
    '--surface-muted': surfaceMuted,
    '--surface-sunken': surfaceSunken,
    '--surface-inverse': t.secondary,
    '--inverse-foreground': foregroundFor(t.secondary) === '#ffffff' ? '#f4f2ee' : '#141a18',
    '--foreground': text,
    '--muted-foreground': muted,
    '--border': t.border,
    '--border-strong': mixHex(t.border, text, 0.82),
    '--success': ensureContrast(t.success, t.surface),
    '--success-soft': mixHex(t.success, t.surface, 0.1),
    '--warning': ensureContrast(t.warning, t.surface),
    '--warning-soft': mixHex(t.warning, t.surface, 0.12),
    '--danger': ensureContrast(t.error, t.surface),
    '--danger-soft': mixHex(t.error, t.surface, 0.1),
  };

  // Tipografi (tema varsayılanı + kiracı seçimi)
  const heading = FONT_CATALOG[config.typography.heading ?? theme.fonts.heading];
  const body = FONT_CATALOG[config.typography.body ?? theme.fonts.body];
  vars['--font-display-face'] = `var(${heading.cssVar})`;
  vars['--font-sans-face'] = `var(${body.cssVar})`;
  vars['--site-heading-weight'] = String(config.typography.headingWeight ?? theme.headingWeight);
  const scale = config.typography.scale ?? 1;

  // Köşe yuvarlaklığı (Tailwind --radius-* değişkenleri)
  for (const [k, v] of Object.entries(RADII[theme.radius])) vars[`--radius-${k}`] = v;

  const body_ = Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  const fontSize = scale !== 1 ? `${selector}{font-size:${(scale * 100).toFixed(1)}%}` : '';
  return `${selector}{${body_};color-scheme:${dark ? 'dark' : 'light'}}${fontSize}`;
}
