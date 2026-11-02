import { poppins } from '@/platform/branding/fonts/poppins';

/**
 * KARAY kurumsal yazı tipi (logo paketi): başlık 600, alt başlık 500, metin 400. Yalnızca platform alanında yüklenir.
 * Dosyalar depodadır (next/font/local, ./fonts — scripts/fonts/build-local-fonts.mjs üretir): build Google Fonts'a bağlanmaz (K-13).
 */
export const platformFont = poppins;
