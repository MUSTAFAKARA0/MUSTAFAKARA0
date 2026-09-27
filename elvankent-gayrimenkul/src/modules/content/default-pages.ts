/**
 * Düzenlenebilir sayfaların varsayılan şablonları. Yönetim panelinde bir
 * sayfa kaydedilene kadar bu şablonlar gösterilir. {{...}} alanları şirket
 * ayarlarından doldurulur; boş alanlar [KÖŞELİ PARANTEZ] ile belirtilir.
 *
 * HUKUKİ METİNLER TASLAKTIR: kesin hukuki tavsiye değildir ve yayından önce
 * bir hukuk danışmanı tarafından doğrulanmalıdır.
 */
export type PageKey = 'about' | 'services' | 'kvkk' | 'privacy' | 'cookies' | 'terms';

export interface PageDefinition {
  key: PageKey;
  path: string;
  title: string;
  description: string;
  legal: boolean;
  template: string;
}

export const PAGE_DEFINITIONS: Record<PageKey, PageDefinition> = {
  about: {
    key: 'about',
    path: '/hakkimizda',
    title: 'Hakkımızda',
    description: 'Ofisimiz, çalışma şeklimiz ve iletişim bilgilerimiz.',
    legal: false,
    template: `{{sirket}}, {{hizmet_bolgesi}} gayrimenkul alım, satım ve kiralama süreçlerinde danışmanlık hizmeti sunar.

## Nasıl çalışırız?

- Her gayrimenkulü yerinde inceler, bilgileri eksiksiz ve doğru şekilde paylaşırız.
- Fiyatlandırmayı bölgedeki güncel ilanlar ve piyasa koşullarıyla birlikte değerlendiririz.
- Süreç boyunca alıcı, satıcı, kiracı ve mülk sahibini düzenli olarak bilgilendiririz.`,
  },
  services: {
    key: 'services',
    path: '/hizmetlerimiz',
    title: 'Hizmetlerimiz',
    description: 'Satış, kiralama, fiyat analizi ve tapu süreçlerinde danışmanlık.',
    legal: false,
    template: `## Satış danışmanlığı

Gayrimenkulünüzü doğru alıcıyla buluşturmak için ilandan tapuya kadar süreci birlikte yönetiriz.

- Mülkün yerinde incelenmesi ve bilgilerin eksiksiz derlenmesi
- İlan metni ve fotoğraf hazırlığı
- Alıcı adaylarıyla görüşme ve randevu organizasyonu
- Tapu devrine kadar evrak ve adım takibi

## Kiralama

Mülk sahibi ve kiracı için anlaşılır ve güvenli bir kiralama süreci sunarız.

- Kiracı adaylarıyla ön görüşme
- Kira sözleşmesi hazırlığında destek
- Teslim ve demirbaş tutanağı

## Piyasa ve fiyat analizi

Bölgedeki benzer ilanlara ve güncel piyasa koşullarına göre gerçekçi bir fiyat aralığı belirlemenize yardımcı oluruz. Resmi değerleme raporu için SPK lisanslı değerleme uzmanlarına yönlendiririz.

## Tapu ve evrak süreçleri

Alım-satım ve kiralama işlemlerinde gerekli belgeler ve resmi adımlar konusunda yol gösteririz.`,
  },
  kvkk: {
    key: 'kvkk',
    path: '/kvkk',
    title: 'KVKK Aydınlatma Metni',
    description: '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metni.',
    legal: true,
    template: `## 1. Veri sorumlusu

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla **{{unvan}}** ({{sirket}}, adres: {{adres}}) tarafından aşağıda açıklanan kapsamda işlenebilecektir.

## 2. İşlenen kişisel veriler

- Kimlik bilgisi: ad, soyad
- İletişim bilgisi: telefon numarası, e-posta adresi
- Talep bilgisi: form mesajı, ilgilendiğiniz ilan, randevu tercihi, değerleme talebinde paylaştığınız mülk bilgileri
- İşlem güvenliği bilgisi: IP adresinin geri döndürülemez özeti (hash), tarayıcı bilgisi

## 3. İşleme amaçları

- Bilgi, randevu ve değerleme taleplerinizin yanıtlanması
- İlgilendiğiniz gayrimenkule ilişkin bilgilendirme ve gösterim süreçlerinin yürütülmesi
- Web sitesinin güvenliğinin sağlanması, kötüye kullanım ve spam girişimlerinin önlenmesi
- Hukuki yükümlülüklerin yerine getirilmesi

## 4. Hukuki sebepler

Kişisel verileriniz KVKK'nın 5. maddesinin 2. fıkrasında yer alan "bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması", "veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi" ve "ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri" hukuki sebeplerine dayanılarak işlenir. [HUKUK DANIŞMANI TARAFINDAN DOĞRULANMALIDIR]

## 5. Aktarım

Kişisel verileriniz, yalnızca yukarıdaki amaçlarla sınırlı olmak üzere barındırma ve veritabanı hizmeti alınan iş ortaklarına (bulut altyapı sağlayıcıları) ve yasal olarak yetkili kamu kurum ve kuruluşlarına aktarılabilir. Sunucuların yurt dışında bulunması hâlinde aktarım, KVKK'nın 9. maddesine uygun olarak gerçekleştirilir. [SAĞLAYICI VE SUNUCU KONUMU BİLGİSİ EKLENMELİDİR]

## 6. Toplama yöntemi

Kişisel verileriniz web sitesindeki formlar, telefon ve WhatsApp üzerinden elektronik ortamda toplanır.

## 7. Saklama süresi

Talepler, sonuçlanmasından itibaren [SÜRE] boyunca saklanır; sürenin sonunda silinir, yok edilir veya anonim hâle getirilir.

## 8. Haklarınız

KVKK'nın 11. maddesi uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı **{{eposta}}** adresine veya yazılı olarak {{adres}} adresine iletebilirsiniz.`,
  },
  privacy: {
    key: 'privacy',
    path: '/gizlilik-politikasi',
    title: 'Gizlilik Politikası',
    description: 'Web sitemizde hangi bilgilerin toplandığı ve nasıl korunduğu.',
    legal: true,
    template: `{{sirket}} olarak ziyaretçilerimizin gizliliğine önem veriyoruz. Bu politika, web sitemizi kullanırken hangi bilgilerin toplandığını ve nasıl korunduğunu açıklar. Ayrıntılı bilgi için [KVKK Aydınlatma Metni](/kvkk)'ni inceleyebilirsiniz.

## Topladığımız bilgiler

- Formlarla gönüllü olarak paylaştığınız ad, telefon, e-posta ve mesaj bilgileri
- İlan görüntüleme ve iletişim tıklamaları gibi anonim kullanım istatistikleri (çerez kullanılmadan)
- Güvenlik amacıyla IP adresinizin geri döndürülemez özeti (ham IP adresi saklanmaz)

## Favoriler ve karşılaştırma listesi

Favorilerinize ve karşılaştırma listenize eklediğiniz ilanlar yalnızca kendi tarayıcınızda tutulur. Tarayıcı verilerinizi temizlediğinizde bu listeler de silinir.

## Üçüncü taraf hizmetler

- Veritabanı ve dosya depolama: [SAĞLAYICI ADI]
- Barındırma: [SAĞLAYICI ADI]
- Harita görüntüleri: [HARİTA SAĞLAYICISI] (görüntüler sunucumuz üzerinden alınır, tarayıcınız sağlayıcıya doğrudan bağlanmaz)
- WhatsApp ve sosyal medya paylaşım bağlantıları yalnızca tıkladığınızda ilgili hizmete yönlendirir.

## Güvenlik

Verileriniz şifreli bağlantı (HTTPS) üzerinden iletilir; veritabanı erişimi satır bazlı yetkilendirme ile sınırlandırılır ve taleplere yalnızca yetkili ofis çalışanları erişebilir.

## İletişim

Gizlilikle ilgili sorularınız için **{{eposta}}** adresinden bize ulaşabilirsiniz.`,
  },
  cookies: {
    key: 'cookies',
    path: '/cerez-politikasi',
    title: 'Çerez Politikası',
    description: 'Web sitemizde kullanılan çerezler ve tarayıcı depolaması hakkında bilgilendirme.',
    legal: true,
    template: `Bu sayfa, web sitemizde kullanılan çerezler ve benzeri teknolojiler hakkında sizi bilgilendirmek amacıyla hazırlanmıştır. Web sitemiz reklam veya pazarlama amaçlı üçüncü taraf çerez **kullanmamaktadır**.

## Zorunlu çerezler

Yalnızca yönetim paneline giriş yapan yetkililer için oturum çerezleri kullanılır. Bu çerezler oturumun güvenli şekilde sürdürülmesi için gereklidir ve ziyaretçiler için oluşturulmaz.

## Tarayıcı depolaması

| Anahtar | Amaç | Süre |
| --- | --- | --- |
| eg:favorites | Favori ilanlarınızı hatırlamak | Siz silene kadar |
| eg:compare | Karşılaştırma listeniz | Siz silene kadar |
| eg:consent | Çerez tercihiniz | 12 ay |

## İstatistik

İlan görüntülenme ve iletişim tıklamaları çerez kullanılmadan, IP adresi ve tarayıcı bilgisinin günlük değişen, geri döndürülemez özeti ile sayılır. Bu özet kimliğinizi belirlemek için kullanılmaz.

## Analitik çerezler

Analitik veya pazarlama amaçlı bir hizmet eklenirse yalnızca "Çerez tercihleri" penceresinden onay vermeniz hâlinde çalıştırılır. Onayınızı dilediğiniz zaman geri alabilirsiniz. [HUKUK DANIŞMANI TARAFINDAN DOĞRULANMALIDIR]`,
  },
  terms: {
    key: 'terms',
    path: '/kullanim-kosullari',
    title: 'Kullanım Koşulları',
    description: 'Web sitesinin kullanımına ilişkin koşullar.',
    legal: true,
    template: `Bu web sitesini kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız. Site, {{unvan}} ({{sirket}}) tarafından işletilmektedir.

## İlan bilgileri

İlanlardaki bilgiler mülk sahiplerinden alınan bilgiler ve yerinde yapılan incelemelere dayanarak hazırlanır. Buna rağmen fiyat, metrekare, imar durumu ve benzeri bilgiler değişebilir veya hata içerebilir. İşlem öncesinde tapu kaydı, imar durumu ve ilgili belgeler resmi kurumlardan teyit edilmelidir. Site içeriği yatırım tavsiyesi değildir.

## Demo ilanlar

"DEMO" olarak işaretlenen ilanlar gerçek mülkleri temsil etmez; sitenin işleyişini göstermek amacıyla yayınlanır.

## Fikri mülkiyet

Sitedeki metin, logo, tasarım ve fotoğrafların izinsiz kopyalanması, çoğaltılması veya ticari amaçla kullanılması yasaktır.

## Kullanıcı yükümlülükleri

- Formlarda doğru bilgi paylaşmak
- Siteyi hukuka aykırı, spam veya otomatik amaçlarla kullanmamak
- Sitenin güvenliğini tehlikeye atacak girişimlerde bulunmamak

## Sorumluluğun sınırlandırılması

Site "olduğu gibi" sunulmaktadır; kesintisiz veya hatasız çalışacağı garanti edilmez. [HUKUK DANIŞMANI TARAFINDAN DOĞRULANMALIDIR]

## Uygulanacak hukuk

Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda [İL] mahkemeleri ve icra daireleri yetkilidir.`,
  },
};

export const PAGE_KEYS = Object.keys(PAGE_DEFINITIONS) as PageKey[];
