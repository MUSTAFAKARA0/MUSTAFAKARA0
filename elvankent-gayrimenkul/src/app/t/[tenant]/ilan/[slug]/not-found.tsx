import { NotFoundView } from '@/components/common/error-view';

/**
 * Silinmiş / yayından kalkmış ilan. Statik kalmalıdır: not-found bileşenleri
 * her ilan sayfasının ağacında önceden render edilir; burada istek başlığı
 * okumak ISR ilan sayfalarını 500 hatasına düşürür (bkz. app/not-found.tsx).
 */
export default function PropertyNotFound() {
  return (
    <NotFoundView
      title="Aradığınız gayrimenkul bulunamadı."
      description="Bu ilan yayından kaldırılmış veya satılmış olabilir. Güncel ilanlarımıza göz atabilirsiniz."
    />
  );
}
