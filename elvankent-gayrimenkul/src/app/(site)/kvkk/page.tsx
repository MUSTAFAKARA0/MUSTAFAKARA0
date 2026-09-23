import type { Metadata } from 'next';
import { LegalPage } from '@/components/common/legal-page';
import { getSiteSettings } from '@/lib/data/settings';

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni',
  description: '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metni.',
  alternates: { canonical: '/kvkk' },
};

export default async function KvkkPage() {
  const s = await getSiteSettings();
  return (
    <LegalPage title="KVKK Aydınlatma Metni" path="/kvkk" updatedAt="2026-09-22">
      <h2>1. Veri Sorumlusu</h2>
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla{' '}
        <strong>{s.business_name}</strong> ([TİCARİ UNVAN], [MERSİS / VERGİ NO], adres: {s.address ?? '[ADRES]'}) tarafından
        aşağıda açıklanan kapsamda işlenebilecektir.
      </p>

      <h2>2. İşlenen Kişisel Veriler</h2>
      <ul>
        <li>Kimlik bilgisi: ad, soyad</li>
        <li>İletişim bilgisi: telefon numarası, e-posta adresi</li>
        <li>Talep bilgisi: iletişim formu mesajı ve ilgilendiğiniz ilan</li>
        <li>İşlem güvenliği bilgisi: IP adresinin geri döndürülemez özeti (hash), tarayıcı bilgisi</li>
      </ul>

      <h2>3. İşleme Amaçları</h2>
      <ul>
        <li>İletişim ve bilgi taleplerinizin yanıtlanması</li>
        <li>İlgilendiğiniz gayrimenkule ilişkin bilgilendirme ve randevu süreçlerinin yürütülmesi</li>
        <li>Web sitesinin güvenliğinin sağlanması, kötüye kullanım ve spam girişimlerinin önlenmesi</li>
        <li>Hukuki yükümlülüklerin yerine getirilmesi</li>
      </ul>

      <h2>4. Hukuki Sebepler</h2>
      <p>
        Kişisel verileriniz KVKK’nın 5. maddesinin 2. fıkrasında yer alan “bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya
        ilgili olması”, “veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi” ve “ilgili kişinin temel hak ve özgürlüklerine
        zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri” hukuki sebeplerine dayanılarak işlenir. [HUKUK DANIŞMANI
        TARAFINDAN DOĞRULANMALIDIR]
      </p>

      <h2>5. Aktarım</h2>
      <p>
        Kişisel verileriniz, yalnızca yukarıdaki amaçlarla sınırlı olmak üzere barındırma ve veritabanı hizmeti aldığımız iş
        ortaklarımıza (ör. bulut altyapı sağlayıcıları) ve yasal olarak yetkili kamu kurum ve kuruluşlarına aktarılabilir. Bulut
        hizmet sağlayıcılarının sunucularının yurt dışında bulunması hâlinde aktarım, KVKK’nın 9. maddesinde öngörülen şartlara
        uygun olarak gerçekleştirilir. [SAĞLAYICI VE SUNUCU KONUMU BİLGİSİ EKLENMELİDİR]
      </p>

      <h2>6. Toplama Yöntemi</h2>
      <p>Kişisel verileriniz; web sitemizdeki iletişim formları, telefon ve WhatsApp üzerinden elektronik ortamda toplanmaktadır.</p>

      <h2>7. Saklama Süresi</h2>
      <p>
        İletişim talepleri, talebin sonuçlanmasından itibaren [SÜRE] boyunca saklanır ve sürenin sonunda silinir, yok edilir veya
        anonim hâle getirilir.
      </p>

      <h2>8. Haklarınız</h2>
      <p>KVKK’nın 11. maddesi uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmişse düzeltilmesini, silinmesini veya yok edilmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.</p>
      <p>
        Başvurularınızı {s.email ? <strong>{s.email}</strong> : '[E-POSTA]'} adresine veya yazılı olarak {s.address ?? '[ADRES]'}{' '}
        adresine iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.
      </p>
    </LegalPage>
  );
}
