import type { Metadata } from 'next';
import { NotFoundView } from '@/components/common/error-view';

export const metadata: Metadata = { title: 'Sayfa bulunamadı', robots: { index: false } };

/**
 * Kök 404: kiracı sitesinin dışında kalan adresler (panel, platform) ve
 * kayıtlı olmayan / askıdaki alan adları. Kiracı sitelerindeki 404'ler
 * markalı olarak app/t/[tenant]/not-found.tsx ile gösterilir.
 *
 * Statik kalmalıdır: Next.js not-found bileşenlerini her sayfanın ağacında
 * önceden render eder. Burada headers()/cookies() okumak ISR sayfalarını
 * (ilan, bölge ve blog detayı) çalışma anında dinamiğe çevirir ve 500
 * hatasına yol açar.
 */
export default function RootNotFound() {
  return (
    <main className="flex min-h-dvh items-center">
      <NotFoundView
        title="Sayfa bulunamadı."
        description="Adres hatalı yazılmış, sayfa taşınmış veya bu adreste yayında bir site bulunmuyor olabilir."
      />
    </main>
  );
}
