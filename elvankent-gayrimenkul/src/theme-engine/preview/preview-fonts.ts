import { Cormorant_Garamond, DM_Sans, Fraunces, Inter, Lora, Manrope, Newsreader, Outfit, Playfair_Display, Space_Grotesk } from 'next/font/google';

/**
 * Tema önizlemesinin (LivePreview) yazı tipleri: katalogla aynı aileler, hiçbiri önceden
 * yüklenmez ve "swap" kullanır (ön yükleme olmadan "optional" ilk çizimde yedek yazı tipinde
 * kalırdı; önizlemenin amacı yazı tipini göstermektir). Önizleme KARAY yüzeylerinde (site oluşturucu, KARAY sayfası vitrini) çizilir;
 * kiracı sitesinin kataloğu (typography/fonts.ts) Manrope/Fraunces'ı önceden yüklediği için
 * önizleme o modülü kullansaydı KARAY sayfaları kiracı yazı tiplerini ön yüklerdi.
 * next/font çağrıları modül düzeyinde sabit olmak zorunda olduğundan tanımlar burada
 * tekrarlanır; aile/ağırlık değişikliği iki dosyada birlikte yapılmalıdır (FONT_CATALOG
 * ile eşleşmesi tests/unit testinde denetlenir).
 */
const manrope = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--font-manrope', display: 'swap', preload: false });
const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', display: 'swap', preload: false, weight: ['400', '500', '600'] });
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap', preload: false, weight: ['400', '500', '600', '700'] });
const playfair = Playfair_Display({ subsets: ['latin', 'latin-ext'], variable: '--font-playfair', display: 'swap', preload: false, weight: ['400', '500', '600', '700'] });
const dmSans = DM_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-dm-sans', display: 'swap', preload: false, weight: ['400', '500', '600', '700'] });
const lora = Lora({ subsets: ['latin', 'latin-ext'], variable: '--font-lora', display: 'swap', preload: false, weight: ['400', '500', '600', '700'] });
const cormorant = Cormorant_Garamond({ subsets: ['latin', 'latin-ext'], variable: '--font-cormorant', display: 'swap', preload: false, weight: ['400', '500', '600', '700'] });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-space-grotesk', display: 'swap', preload: false, weight: ['400', '500', '600', '700'] });
const outfit = Outfit({ subsets: ['latin', 'latin-ext'], variable: '--font-outfit', display: 'swap', preload: false, weight: ['400', '500', '600', '700'] });
const newsreader = Newsreader({ subsets: ['latin', 'latin-ext'], variable: '--font-newsreader', display: 'swap', preload: false, weight: ['400', '500', '600', '700'] });

/** Önizleme kapsayıcısının yazı tipi değişken sınıfları */
export const previewFontVariables = [manrope, fraunces, inter, playfair, dmSans, lora, cormorant, spaceGrotesk, outfit, newsreader].map((f) => f.variable).join(' ');
