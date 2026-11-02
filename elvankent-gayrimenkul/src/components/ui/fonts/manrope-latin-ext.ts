// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Manrope · latin-ext — yalnızca @font-face (aile adı birincil modülle aynı) */
export const Manrope = localFont({
  src: [
    { path: '../../../../public/fonts/site/manrope/ce093b341d9c1065.woff2', weight: '200 800', style: 'normal' },
  ],
  display: 'optional',
  preload: true,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
});
