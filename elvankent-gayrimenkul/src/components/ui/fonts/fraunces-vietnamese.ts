// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Fraunces · vietnamese — yalnızca @font-face (aile adı birincil modülle aynı) */
export const Fraunces = localFont({
  src: [
    { path: '../../../../public/fonts/site/fraunces/250cc2966c658fb6.woff2', weight: '400', style: 'normal' },
    { path: '../../../../public/fonts/site/fraunces/250cc2966c658fb6.woff2', weight: '500', style: 'normal' },
    { path: '../../../../public/fonts/site/fraunces/250cc2966c658fb6.woff2', weight: '600', style: 'normal' },
  ],
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB' }],
});
