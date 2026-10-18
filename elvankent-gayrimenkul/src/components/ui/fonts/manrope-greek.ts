// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Manrope · greek — yalnızca @font-face (aile adı birincil modülle aynı) */
export const Manrope = localFont({
  src: [
    { path: '../../../../public/fonts/site/manrope/40af11327fe53081.woff2', weight: '200 800', style: 'normal' },
  ],
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF' }],
});
