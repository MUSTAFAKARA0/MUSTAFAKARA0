import type { Metadata } from 'next';
import { LegalPage } from '@/components/common/legal-page';

export const metadata: Metadata = {
  title: 'Çerez Politikası',
  description: 'Web sitemizde kullanılan çerezler ve tarayıcı depolaması hakkında bilgilendirme.',
  alternates: { canonical: '/cerez-politikasi' },
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Çerez Politikası" path="/cerez-politikasi" updatedAt="2026-09-22">
      <p>
        Bu sayfa, web sitemizde kullanılan çerezler ve benzeri teknolojiler hakkında sizi bilgilendirmek amacıyla hazırlanmıştır. Web
        sitemiz reklam veya pazarlama amaçlı üçüncü taraf çerez <strong>kullanmamaktadır</strong>.
      </p>

      <h2>Zorunlu çerezler</h2>
      <p>
        Yalnızca yönetim paneline giriş yapan yetkililer için oturum çerezleri (sb-*) kullanılır. Bu çerezler, oturumun güvenli şekilde
        sürdürülmesi için gereklidir ve ziyaretçiler için oluşturulmaz.
      </p>

      <h2>Tarayıcı depolaması (localStorage)</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2 pr-4">Anahtar</th>
            <th className="py-2 pr-4">Amaç</th>
            <th className="py-2">Süre</th>
          </tr>
        </thead>
        <tbody className="text-sand-700">
          <tr className="border-b border-line/70">
            <td className="py-2 pr-4 font-mono text-xs">eg:favorites</td>
            <td className="py-2 pr-4">Favori ilanlarınızı hatırlamak</td>
            <td className="py-2">Siz silene kadar</td>
          </tr>
          <tr>
            <td className="py-2 pr-4 font-mono text-xs">eg:cookie-notice</td>
            <td className="py-2 pr-4">Bu bildirimin tekrar gösterilmemesi</td>
            <td className="py-2">Siz silene kadar</td>
          </tr>
        </tbody>
      </table>

      <h2>İstatistik</h2>
      <p>
        İlan görüntülenme ve iletişim tıklamaları, çerez kullanılmadan; IP adresi ve tarayıcı bilgisinin günlük değişen, geri
        döndürülemez özeti ile sayılır. Bu özet kimliğinizi belirlemek için kullanılmaz.
      </p>

      <h2>Çerezleri yönetme</h2>
      <p>
        Tarayıcınızın ayarlarından çerezleri ve site verilerini dilediğiniz zaman silebilir veya engelleyebilirsiniz. Bu durumda
        favorileriniz silinebilir. İleride analiz veya pazarlama amaçlı çerez kullanılması hâlinde, bu politika güncellenecek ve açık
        rızanız alınacaktır. [HUKUK DANIŞMANI TARAFINDAN DOĞRULANMALIDIR]
      </p>
    </LegalPage>
  );
}
