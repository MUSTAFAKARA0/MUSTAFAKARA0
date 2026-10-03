import type { Metadata } from 'next';
import { NotFoundView } from '@/components/common/error-view';

export const rootNotFoundMetadata: Metadata = { title: 'Sayfa bulunamadı', robots: { index: false } };

/**
 * Yüzey kökü 404'ü (ofis paneli, KARAY platformu, KARAY sayfası, kayıtlı olmayan /
 * askıdaki alan adı). Kiracı sitelerindeki 404'ler markalı olarak
 * app/t/[tenant]/not-found.tsx ile gösterilir.
 *
 * Statik kalmalıdır: Next.js not-found bileşenlerini her sayfanın ağacında önceden
 * render eder; burada headers()/cookies() okumak ISR sayfalarını (ilan, bölge ve blog
 * detayı) çalışma anında dinamiğe çevirir ve 500 hatasına yol açar.
 */
export function RootNotFound() {
  return (
    <main className="flex min-h-dvh items-center">
      <NotFoundView
        title="Sayfa bulunamadı."
        description="Adres hatalı yazılmış, sayfa taşınmış veya bu adreste yayında bir site bulunmuyor olabilir."
      />
    </main>
  );
}
