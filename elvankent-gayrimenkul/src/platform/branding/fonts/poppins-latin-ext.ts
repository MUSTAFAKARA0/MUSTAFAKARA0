// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Poppins · latin-ext — yalnızca @font-face (aile adı birincil modülle aynı) */
export const Poppins = localFont({
  src: [
    { path: './poppins/1fae5e73d2788ee1.woff2', weight: '400', style: 'normal' },
    { path: './poppins/f8f0c28661c88edb.woff2', weight: '500', style: 'normal' },
    { path: './poppins/72efc6a32cfd37c5.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: true,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
});
