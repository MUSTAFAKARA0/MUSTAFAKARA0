import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/common/legal-page';
import { getSiteSettings } from '@/lib/data/settings';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
  description: 'Web sitemizi kullanırken bilgilerinizin nasıl toplandığı, kullanıldığı ve korunduğu hakkında bilgi.',
  alternates: { canonical: '/gizlilik-politikasi' },
};

export default async function PrivacyPage() {
  const s = await getSiteSettings();
  return (
    <LegalPage title="Gizlilik Politikası" path="/gizlilik-politikasi" updatedAt="2026-09-22">
      <p>
        {s.business_name} olarak ziyaretçilerimizin gizliliğine önem veriyoruz. Bu politika, web sitemizi kullanırken hangi bilgilerin
        toplandığını ve nasıl korunduğunu açıklar. Kişisel verilerin işlenmesine ilişkin ayrıntılı bilgi için{' '}
        <Link href="/kvkk">KVKK Aydınlatma Metni</Link>’ni inceleyebilirsiniz.
      </p>

      <h2>Topladığımız bilgiler</h2>
      <ul>
        <li>İletişim formu ile gönüllü olarak paylaştığınız ad, telefon, e-posta ve mesaj bilgileri</li>
        <li>İlan görüntüleme ve iletişim butonu tıklamaları gibi anonim kullanım istatistikleri</li>
        <li>Güvenlik amacıyla IP adresinizin geri döndürülemez özeti (ham IP adresi saklanmaz)</li>
      </ul>

      <h2>Favoriler</h2>
      <p>
        Favorilerinize eklediğiniz ilanlar yalnızca kendi tarayıcınızda (yerel depolama) tutulur; sunucularımıza gönderilmez. Tarayıcı
        verilerinizi temizlediğinizde favorileriniz de silinir.
      </p>

      <h2>Üçüncü taraf hizmetler</h2>
      <ul>
        <li>Veritabanı ve dosya depolama: [SAĞLAYICI ADI, ör. Supabase]</li>
        <li>Barındırma: [SAĞLAYICI ADI, ör. Vercel]</li>
        <li>Harita görüntüleri: OpenStreetMap veya [HARİTA SAĞLAYICISI] (döşemeler sunucumuz üzerinden alınır)</li>
        <li>WhatsApp, Facebook ve X paylaşım bağlantıları yalnızca tıkladığınızda ilgili hizmete yönlendirir.</li>
      </ul>

      <h2>Güvenlik</h2>
      <p>
        Verileriniz şifreli bağlantı (HTTPS) üzerinden iletilir; veritabanı erişimi satır bazlı yetkilendirme ile sınırlandırılır ve
        iletişim taleplerine yalnızca yetkili yöneticiler erişebilir.
      </p>

      <h2>İletişim</h2>
      <p>Gizlilikle ilgili sorularınız için {s.email ?? '[E-POSTA]'} adresinden bize ulaşabilirsiniz.</p>
    </LegalPage>
  );
}
