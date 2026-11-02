import { fraunces } from '@/components/ui/fonts/fraunces';
import { manrope } from '@/components/ui/fonts/manrope';

/**
 * Tasarım sisteminin temel yazı tipleri: gövde Manrope, başlık Fraunces. Ofis paneli
 * bunları kullanır; kiracı sitelerinde de varsayılan (Klasik) tema yazı tipleridir.
 * Theme Engine'in yazı tipi kataloğu aynı aileleri kendi modülünde ayrıca tanımlar: modül
 * paylaşılsaydı paketleyici iki yüzeyin yazı tipi CSS'ini birleştirir, panel de tüm tema
 * kataloğunu yüklerdi. Bir rota ikisini birlikte yüklemez. KARAY yüzeyleri bu modülü
 * yüklemez (KARAY kendi yazı tipini kullanır).
 *
 * Dosyalar depodadır (next/font/local, ./fonts — scripts/fonts/build-local-fonts.mjs üretir;
 * Klasik tema paketiyle aynı dosyalar): build Google Fonts'a bağlanmaz (K-13).
 *
 * "optional": yazı tipi ilk görüntülemeye yetişmezse o sayfada yedek yazı tipi kalır
 * (düzen kayması/CLS olmaz), sonraki sayfalarda önbellekten kullanılır.
 */
export { fraunces, manrope };

/** <html> sınıfları: temel yazı tipi değişkenleri */
export const baseFontVariables = [manrope, fraunces].map((f) => f.variable).join(' ');
