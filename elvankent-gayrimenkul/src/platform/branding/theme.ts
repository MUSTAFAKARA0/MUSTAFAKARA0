/**
 * White-label tema: kiracının marka renklerinden (şirket ayarları) tasarım
 * token'ları üretir. Erişilebilirlik korunur: buton yazı rengi ve metin olarak
 * kullanılan marka tonu WCAG AA (4.5:1) kontrastı sağlayacak şekilde seçilir.
 */
const HEX = /^#[0-9a-f]{6}$/i;

type RGB = [number, number, number];

export function parse(hex: string): RGB {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(parse(a));
  const lb = luminance(parse(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a: RGB, b: RGB, weightA: number): RGB {
  return [0, 1, 2].map((i) => a[i] * weightA + b[i] * (1 - weightA)) as RGB;
}

/** Beyaz zemin üzerinde metin olarak okunabilir (≥4.5:1) en yakın ton */
function readableOnWhite(hex: string): string {
  let rgb = parse(hex);
  for (let i = 0; i < 20 && contrastRatio(toHex(rgb), '#ffffff') < 4.5; i++) {
    rgb = mix(rgb, [0, 0, 0], 0.88);
  }
  return toHex(rgb);
}

export function foregroundFor(hex: string): string {
  return contrastRatio(hex, '#ffffff') >= 4.5 ? '#ffffff' : '#141a18';
}

export function safeColor(value: string | null | undefined, fallback: string): string {
  return value && HEX.test(value) ? value.toLowerCase() : fallback;
}

export interface ThemeTokens {
  primary: string;
  primaryFg: string;
  primaryHover: string;
  primaryInk: string;
  primarySoft: string;
  accent: string;
  accentFg: string;
  accentInk: string;
  accentSoft: string;
}

export function buildTheme(primaryColor: string | null | undefined, accentColor: string | null | undefined): ThemeTokens {
  const primary = safeColor(primaryColor, '#0e4d45');
  const accent = safeColor(accentColor, '#b5813a');
  const p = parse(primary);
  const a = parse(accent);
  return {
    primary,
    primaryFg: foregroundFor(primary),
    primaryHover: toHex(mix(p, [0, 0, 0], 0.86)),
    primaryInk: readableOnWhite(primary),
    primarySoft: toHex(mix(p, [255, 255, 255], 0.09)),
    accent,
    accentFg: foregroundFor(accent),
    accentInk: readableOnWhite(accent),
    accentSoft: toHex(mix(a, [255, 255, 255], 0.14)),
  };
}

/** <style> içine yazılacak CSS (yalnızca doğrulanmış hex değerleri → enjeksiyon yok) */
export function themeCss(tokens: ThemeTokens, selector = ':root'): string {
  return `${selector}{--primary:${tokens.primary};--primary-fg:${tokens.primaryFg};--primary-hover:${tokens.primaryHover};--primary-ink:${tokens.primaryInk};--primary-soft:${tokens.primarySoft};--accent:${tokens.accent};--accent-fg:${tokens.accentFg};--accent-ink:${tokens.accentInk};--accent-soft:${tokens.accentSoft};--ring:${tokens.primary};}`;
}

/** a ve b renklerini karıştırır (weightA: a'nın payı) — hex giriş/çıkış */
export function mixHex(a: string, b: string, weightA: number): string {
  return toHex(mix(parse(a), parse(b), weightA));
}

/**
 * Ön plan rengini zemine göre en az `ratio` kontrasta ulaşana kadar koyulaştırır
 * (açık zemin) veya açar (koyu zemin). Tasarım tokenlarında okunabilirliği korur.
 */
export function ensureContrast(fg: string, bg: string, ratio = 4.5): string {
  let rgb = parse(fg);
  const target: RGB = luminance(parse(bg)) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  for (let i = 0; i < 24 && contrastRatio(toHex(rgb), bg) < ratio; i++) rgb = mix(rgb, target, 0.88);
  return toHex(rgb);
}

export function isDark(hex: string): boolean {
  return luminance(parse(hex)) < 0.2;
}
