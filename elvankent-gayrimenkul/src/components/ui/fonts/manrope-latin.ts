// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Manrope · latin — birincil alt küme: CSS değişkeni, sınıf ve yedek yazı tipi bu modülden */
export const Manrope = localFont({
  src: [
    { path: '../../../../public/fonts/site/manrope/e310b55a7fd9677f.woff2', weight: '200 800', style: 'normal' },
  ],
  display: 'optional',
  preload: true,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
  variable: '--font-manrope',
  fallback: ['Manrope Fallback'],
});
