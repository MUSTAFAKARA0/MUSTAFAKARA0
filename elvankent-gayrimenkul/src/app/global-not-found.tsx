import { RootNotFound, rootNotFoundMetadata } from '@/components/common/root-not-found';
import './globals.css';

/**
 * Hiçbir rotayla eşleşmeyen adresler için 404. Uygulamanın birden fazla kök layout'u
 * olduğundan (kiracı sitesi, ofis paneli, KARAY platformu, KARAY sayfası) bu sayfa
 * kendi <html>/<body> iskeletini ve stillerini yükler. Kiracı alan adlarındaki adresler
 * proxy tarafından kiracı sitesine yönlendirildiği için orada kiracının 404'ü görünür.
 * /admin, /platform ve /karay altında hiçbir rotayla eşleşmeyen adresler (ör. /platform/yok)
 * ve /api adresleri bu sayfayı gösterir; yüzey köklerindeki not-found.tsx dosyaları
 * yalnızca eşleşen bir rotanın notFound() çağrısında kullanılır.
 *
 * Bilerek next/font kullanılmaz (sistem yazı tipi): paketleyici bu dosyanın yazı
 * tiplerini TÜM rotaların ön yükleme listesine ekliyor, KARAY yüzeyleri de kiracı
 * yazı tiplerini indiriyordu.
 */
export const metadata = rootNotFoundMetadata;

export default function GlobalNotFound() {
  return (
    <html lang="tr">
      <body className="min-h-dvh">
        <RootNotFound />
      </body>
    </html>
  );
}
