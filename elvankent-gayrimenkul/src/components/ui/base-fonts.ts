import { Fraunces, Manrope } from 'next/font/google';

/**
 * Tasarım sisteminin temel yazı tipleri: gövde Manrope, başlık Fraunces. Ofis paneli
 * bunları kullanır; kiracı sitelerinde de varsayılan (Klasik) tema yazı tipleridir.
 * Theme Engine'in yazı tipi kataloğu aynı aileleri kendi modülünde ayrıca tanımlar: modül
 * paylaşılsaydı paketleyici iki yüzeyin yazı tipi CSS'ini birleştirir, panel de tüm tema
 * kataloğunu yüklerdi. Bir rota ikisini birlikte yüklemez. KARAY yüzeyleri bu modülü
 * yüklemez (KARAY kendi yazı tipini kullanır).
 *
 * "optional": yazı tipi ilk görüntülemeye yetişmezse o sayfada yedek yazı tipi kalır
 * (düzen kayması/CLS olmaz), sonraki sayfalarda önbellekten kullanılır.
 */
export const manrope = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--font-manrope', display: 'optional' });
export const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', display: 'optional', weight: ['400', '500', '600'] });

/** <html> sınıfları: temel yazı tipi değişkenleri */
export const baseFontVariables = [manrope, fraunces].map((f) => f.variable).join(' ');
