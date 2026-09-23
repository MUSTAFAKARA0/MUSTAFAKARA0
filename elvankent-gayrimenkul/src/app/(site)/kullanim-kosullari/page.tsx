import type { Metadata } from 'next';
import { LegalPage } from '@/components/common/legal-page';
import { getSiteSettings } from '@/lib/data/settings';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları',
  description: 'Web sitesinin kullanımına ilişkin koşullar.',
  alternates: { canonical: '/kullanim-kosullari' },
};

export default async function TermsPage() {
  const s = await getSiteSettings();
  return (
    <LegalPage title="Kullanım Koşulları" path="/kullanim-kosullari" updatedAt="2026-09-22">
      <p>
        Bu web sitesini kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız. Site, {s.business_name} ([TİCARİ UNVAN]) tarafından
        işletilmektedir.
      </p>

      <h2>İlan bilgileri</h2>
      <p>
        İlanlardaki bilgiler, mülk sahiplerinden alınan bilgiler ve yerinde yapılan incelemelere dayanarak özenle hazırlanır. Buna
        rağmen fiyat, metrekare, imar durumu ve benzeri bilgiler değişebilir veya hata içerebilir. Kesin bilgi için işlem öncesinde
        tapu kaydı, imar durumu ve ilgili belgeler resmi kurumlardan teyit edilmelidir. Site içeriği hiçbir şekilde yatırım tavsiyesi
        değildir.
      </p>

      <h2>Demo ilanlar</h2>
      <p>“DEMO” olarak işaretlenen ilanlar gerçek mülkleri temsil etmez; sitenin işleyişini göstermek amacıyla yayınlanır.</p>

      <h2>Fikri mülkiyet</h2>
      <p>
        Sitedeki metin, logo, tasarım ve fotoğrafların izinsiz kopyalanması, çoğaltılması veya ticari amaçla kullanılması yasaktır.
      </p>

      <h2>Kullanıcı yükümlülükleri</h2>
      <ul>
        <li>İletişim formlarında doğru bilgi paylaşmak</li>
        <li>Siteyi hukuka aykırı, spam veya otomatik amaçlarla kullanmamak</li>
        <li>Sitenin güvenliğini tehlikeye atacak girişimlerde bulunmamak</li>
      </ul>

      <h2>Sorumluluğun sınırlandırılması</h2>
      <p>
        Site “olduğu gibi” sunulmaktadır. Kesintisiz veya hatasız çalışacağı garanti edilmez. [HUKUK DANIŞMANI TARAFINDAN
        DOĞRULANMALIDIR]
      </p>

      <h2>Uygulanacak hukuk</h2>
      <p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda [İL] mahkemeleri ve icra daireleri yetkilidir.</p>
    </LegalPage>
  );
}
