// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Manrope · cyrillic — yalnızca @font-face (aile adı birincil modülle aynı) */
export const Manrope = localFont({
  src: [
    { path: '../../../../public/fonts/site/manrope/95a493061fe0a8d0.woff2', weight: '200 800', style: 'normal' },
  ],
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});
