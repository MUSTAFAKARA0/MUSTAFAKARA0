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
    id: 'aegean-sand',
    name: 'Ege (turkuaz · kum)',
    scheme: 'light',
    tokens: { primary: '#0a5f78', secondary: '#0b2530', accent: '#c9843c', background: '#f6fafb', surface: '#ffffff', text: '#0b2530', muted: '#4d6068', border: '#d9e6ea', ...status },
  },
  {
    id: 'launch-indigo',
    name: 'Lansman (çivit · mercan)',
    scheme: 'light',
    tokens: { primary: '#2f3d8f', secondary: '#121633', accent: '#e0603a', background: '#f7f7fb', surface: '#ffffff', text: '#121633', muted: '#555a75', border: '#e1e2ee', ...status },
  },
  {
    id: 'steel-glass',
    name: 'Çelik ve Cam (lacivert · camgöbeği)',
    scheme: 'light',
    tokens: { primary: '#26455f', secondary: '#0f1b26', accent: '#1d8fa8', background: '#f3f6f8', surface: '#ffffff', text: '#0f1b26', muted: '#526372', border: '#d8e0e6', ...status },
  },
  {
    id: 'field-earth',
    name: 'Tarla (toprak · zeytin)',
    scheme: 'light',
    tokens: { primary: '#5b4a2a', secondary: '#231c10', accent: '#8a9a3a', background: '#f7f4ec', surface: '#fffdf8', text: '#231c10', muted: '#62573f', border: '#e4dcc8', ...status },
  },
  {
    id: 'franchise-crimson',
    name: 'Kurumsal (kırmızı · lacivert)',
    scheme: 'light',
    tokens: { primary: '#a3202e', secondary: '#1c1214', accent: '#1f4e79', background: '#faf7f7', surface: '#ffffff', text: '#1c1214', muted: '#62575a', border: '#ecdfe0', ...status },
  },
  {
    id: 'iznik-ink',
    name: 'İznik (mürekkep · bakır)',
    scheme: 'light',
    tokens: { primary: '#1c4e80', secondary: '#14202e', accent: '#a56628', background: '#f8f5ef', surface: '#fffdf9', text: '#14202e', muted: '#5a6270', border: '#e6dccb', ...status },
  },
  {
    id: 'rental-coral',
    name: 'Kiralık (mercan · yeşil)',
    scheme: 'light',
    tokens: { primary: '#b8402c', secondary: '#1d1412', accent: '#1f7a6d', background: '#fbf8f6', surface: '#ffffff', text: '#1d1412', muted: '#6a5a55', border: '#ecdfd9', ...status },
  },
  {
    id: 'midnight-brass',
    name: 'Gece Yarısı (koyu · pirinç)',
    scheme: 'dark',
    tokens: { primary: '#c9a45c', secondary: '#05070a', accent: '#5fb3a6', background: '#0b0f14', surface: '#131a22', text: '#eef1f4', muted: '#a2adb8', border: '#263340', success: '#4ade80', warning: '#fbbf24', error: '#f87171' },
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
