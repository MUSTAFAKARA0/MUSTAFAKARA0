// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Manrope · vietnamese — yalnızca @font-face (aile adı birincil modülle aynı) */
export const Manrope = localFont({
  src: [
    { path: '../../../../public/fonts/site/manrope/bab757f8a0a1bc04.woff2', weight: '200 800', style: 'normal' },
  ],
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB' }],
});
