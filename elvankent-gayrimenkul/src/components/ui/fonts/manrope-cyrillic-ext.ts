// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Manrope · cyrillic-ext — yalnızca @font-face (aile adı birincil modülle aynı) */
export const Manrope = localFont({
  src: [
    { path: '../../../../public/fonts/site/manrope/e8c0b39992f06b3d.woff2', weight: '200 800', style: 'normal' },
  ],
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F' }],
});
