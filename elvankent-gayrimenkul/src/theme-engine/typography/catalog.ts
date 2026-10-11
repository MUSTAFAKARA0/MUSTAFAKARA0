import type { FontId } from '@/theme-engine/ids';

/** Yazı tipi kataloğu (yalnızca veri; yükleyiciler fonts.ts'te). CSS değişkenleri <html> üzerinde tanımlıdır. */
export const FONT_CATALOG: Record<FontId, { name: string; cssVar: string; kind: 'serif' | 'sans' }> = {
  manrope: { name: 'Manrope', cssVar: '--font-manrope', kind: 'sans' },
  fraunces: { name: 'Fraunces', cssVar: '--font-fraunces', kind: 'serif' },
  inter: { name: 'Inter', cssVar: '--font-inter', kind: 'sans' },
  playfair: { name: 'Playfair Display', cssVar: '--font-playfair', kind: 'serif' },
  'dm-sans': { name: 'DM Sans', cssVar: '--font-dm-sans', kind: 'sans' },
  lora: { name: 'Lora', cssVar: '--font-lora', kind: 'serif' },
  cormorant: { name: 'Cormorant Garamond', cssVar: '--font-cormorant', kind: 'serif' },
  'space-grotesk': { name: 'Space Grotesk', cssVar: '--font-space-grotesk', kind: 'sans' },
  outfit: { name: 'Outfit', cssVar: '--font-outfit', kind: 'sans' },
  newsreader: { name: 'Newsreader', cssVar: '--font-newsreader', kind: 'serif' },
};
