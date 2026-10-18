// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
import localFont from 'next/font/local';

/** Poppins · devanagari — yalnızca @font-face (aile adı birincil modülle aynı) */
export const Poppins = localFont({
  src: [
    { path: './poppins/23617a1bf667dd6a.woff2', weight: '400', style: 'normal' },
    { path: './poppins/9c8c47ee0aeaa2d3.woff2', weight: '500', style: 'normal' },
    { path: './poppins/6d8ef422be4d8270.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A' }],
});
