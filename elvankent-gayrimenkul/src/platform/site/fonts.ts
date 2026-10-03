import { Cormorant_Garamond, DM_Sans, Fraunces, Inter, Lora, Manrope, Newsreader, Outfit, Playfair_Display, Space_Grotesk } from 'next/font/google';

/**
 * Site yazı tipi kataloğu (kiracılar bu listeden seçer; serbest harici font yüklenmez).
 *
 * Performans: her yazı tipi için yalnızca gereken ağırlıklar tanımlıdır. @font-face
 * tanımları küçüktür; yazı tipi DOSYASI yalnızca sayfada o yazı tipi kullanılıyorsa
 * indirilir. Varsayılan tema yazı tipleri (Manrope, Fraunces) önceden yüklenir; diğerleri
 * seçildiğinde yüklenir. "optional": yazı tipi ilk görüntülemeye yetişmezse o sayfada yedek
 * yazı tipi kalır (düzen kayması/CLS olmaz), sonraki sayfalarda önbellekten kullanılır.
 */
const manrope = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--font-manrope', display: 'optional' });
const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', display: 'optional', weight: ['400', '500', '600'] });
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'optional', preload: false, weight: ['400', '500', '600', '700'] });
const playfair = Playfair_Display({ subsets: ['latin', 'latin-ext'], variable: '--font-playfair', display: 'optional', preload: false, weight: ['400', '500', '600', '700'] });
const dmSans = DM_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-dm-sans', display: 'optional', preload: false, weight: ['400', '500', '600', '700'] });
const lora = Lora({ subsets: ['latin', 'latin-ext'], variable: '--font-lora', display: 'optional', preload: false, weight: ['400', '500', '600', '700'] });
const cormorant = Cormorant_Garamond({ subsets: ['latin', 'latin-ext'], variable: '--font-cormorant', display: 'optional', preload: false, weight: ['400', '500', '600', '700'] });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-space-grotesk', display: 'optional', preload: false, weight: ['400', '500', '600', '700'] });
const outfit = Outfit({ subsets: ['latin', 'latin-ext'], variable: '--font-outfit', display: 'optional', preload: false, weight: ['400', '500', '600', '700'] });
const newsreader = Newsreader({ subsets: ['latin', 'latin-ext'], variable: '--font-newsreader', display: 'optional', preload: false, weight: ['400', '500', '600', '700'] });

export { FONT_CATALOG } from '@/platform/site/font-catalog';

/** <html> sınıfları: yazı tipi değişkenlerini tanımlar (dosya indirmez) */
export const fontVariables = [manrope, fraunces, inter, playfair, dmSans, lora, cormorant, spaceGrotesk, outfit, newsreader].map((f) => f.variable).join(' ');
