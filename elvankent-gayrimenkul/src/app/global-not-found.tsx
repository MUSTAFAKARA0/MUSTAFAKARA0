import type { Metadata } from 'next';
import { RootNotFound } from '@/components/common/root-not-found';
import './globals.css';

/**
 * Hiçbir rotayla eşleşmeyen adresler için 404. Uygulamanın birden fazla kök layout'u
 * olduğundan (kiracı sitesi, ofis paneli, KARAY platformu, KARAY sayfası) bu sayfa
 * kendi <html>/<body> iskeletini ve stillerini yükler. Kiracı alan adlarındaki adresler
 * proxy tarafından kiracı sitesine yönlendirildiği için orada kiracının 404'ü görünür;
 * /admin, /platform ve /karay altındaki 404'ler kendi yüzeylerinin kökünde gösterilir.
 * Burada pratikte yalnızca eşleşmeyen /api adresleri kalır.
 *
 * Bilerek next/font kullanılmaz (sistem yazı tipi): paketleyici bu dosyanın yazı
 * tiplerini TÜM rotaların ön yükleme listesine ekliyor, KARAY yüzeyleri de kiracı
 * yazı tiplerini indiriyordu.
 */
export const metadata: Metadata = { title: 'Sayfa bulunamadı', robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="tr">
      <body className="min-h-dvh">
        <RootNotFound />
      </body>
    </html>
  );
}
