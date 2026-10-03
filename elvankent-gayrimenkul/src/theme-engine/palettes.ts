import type { ColorTokens } from '@/theme-engine/settings';

/**
 * Hazır renk paletleri. Bir palet seçildiğinde TÜM tokenlar birbiriyle uyumlu olarak
 * değişir (yalnızca ana renk değil). Metin/zemin çiftleri WCAG AA kontrastına göre
 * seçilmiştir; tokenlar üretilirken kontrast ayrıca doğrulanır (tokens.ts).
 */
export interface PalettePreset {
  id: string;
  name: string;
  scheme: 'light' | 'dark';
  tokens: ColorTokens;
}

const status = { success: '#1b7549', warning: '#945f06', error: '#b42318' };

export const PALETTES: PalettePreset[] = [
  {
    id: 'modern-green',
    name: 'Modern Yeşil',
    scheme: 'light',
    tokens: { primary: '#0e4d45', secondary: '#141a18', accent: '#b5813a', background: '#fbfaf8', surface: '#ffffff', text: '#141a18', muted: '#5a605d', border: '#e6e2da', ...status },
  },
  {
    id: 'corporate-navy',
    name: 'Kurumsal Lacivert',
    scheme: 'light',
    tokens: { primary: '#1d3a6b', secondary: '#0e1a2f', accent: '#c9a227', background: '#f6f8fb', surface: '#ffffff', text: '#101828', muted: '#556173', border: '#e1e6ee', ...status },
  },
  {
    id: 'premium-gold',
    name: 'Premium Altın',
    scheme: 'light',
    tokens: { primary: '#8a6a2b', secondary: '#1b1814', accent: '#c9a45c', background: '#faf8f4', surface: '#ffffff', text: '#1b1814', muted: '#625b50', border: '#e9e2d6', ...status },
  },
  {
    id: 'minimal-black',
    name: 'Minimal Siyah',
    scheme: 'light',
    tokens: { primary: '#111111', secondary: '#0a0a0a', accent: '#6b7280', background: '#ffffff', surface: '#ffffff', text: '#111111', muted: '#595959', border: '#e5e5e5', ...status },
  },
  {
    id: 'warm-beige',
    name: 'Sıcak Bej',
    scheme: 'light',
    tokens: { primary: '#7a5634', secondary: '#2b2118', accent: '#c08a52', background: '#f8f3ec', surface: '#fffdf9', text: '#2b2118', muted: '#6b5d50', border: '#e8dccb', ...status },
  },
  {
    id: 'luxury-estate',
    name: 'Lüks Konut (bordo · pirinç)',
    scheme: 'light',
    tokens: { primary: '#5b1f2e', secondary: '#1a1416', accent: '#b8975a', background: '#faf7f2', surface: '#ffffff', text: '#1d1718', muted: '#6b5f5f', border: '#eadfd6', ...status },
  },
  {
    id: 'modern-urban',
    name: 'Modern Şehir (grafit · kiremit)',
    scheme: 'light',
    tokens: { primary: '#2d3a4a', secondary: '#11161d', accent: '#d9553b', background: '#f5f6f7', surface: '#ffffff', text: '#11161d', muted: '#5b6573', border: '#dfe3e8', ...status },
  },
  {
    id: 'natural-estate',
    name: 'Doğal Yaşam (zeytin · kum)',
    scheme: 'light',
    tokens: { primary: '#4f6b3a', secondary: '#1e2419', accent: '#b89a64', background: '#f7f6f0', surface: '#fffefa', text: '#1e2419', muted: '#5f6655', border: '#e3e1d3', ...status },
  },
  {
    id: 'graphite-teal',
    name: 'Grafit (antrasit · camgöbeği)',
    scheme: 'light',
    tokens: { primary: '#0f766e', secondary: '#161a1f', accent: '#0ea5b7', background: '#f4f5f6', surface: '#ffffff', text: '#15191e', muted: '#545c66', border: '#dde1e5', ...status },
  },
  {
    id: 'night',
    name: 'Gece (koyu)',
    scheme: 'dark',
    tokens: {
      primary: '#3fb5a3',
      secondary: '#060908',
      accent: '#d4a45a',
      background: '#0e1312',
      surface: '#161d1b',
      text: '#eef2f0',
      muted: '#a6b1ac',
      border: '#2a3431',
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#f87171',
    },
  },
];

export function findPalette(id: string | null | undefined): PalettePreset | null {
  return PALETTES.find((p) => p.id === id) ?? null;
}
