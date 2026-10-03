import { Poppins } from 'next/font/google';

/** KARAY kurumsal yazı tipi (logo paketi): başlık 600, alt başlık 500, metin 400. Yalnızca platform alanında yüklenir. */
export const platformFont = Poppins({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], display: 'swap' });
