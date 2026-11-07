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

Kişisel verileriniz yalnızca yukarıdaki amaçlarla sınırlı olmak üzere aşağıdaki alıcılara aktarılabilir:

- Talebinizle ilgilenen ofis çalışanlarımız ve danışmanlarımız
- Web sitesi ve yönetim yazılımı hizmet sağlayıcımız **KARAYS** ([KARAYS İŞLETME UNVANI]). KARAYS, verilerinizi yalnızca {{sirket}} adına ve talimatlarımız doğrultusunda **veri işleyen** sıfatıyla işler; veri sorumlusu {{unvan}}'dır.
- KARAYS'ın hizmeti sunarken kullandığı alt veri işleyenler: Supabase (veritabanı ve dosya depolama; sunucu konumu AB, Frankfurt / eu-central-1), Vercel (web sitesinin barındırılması; uygulama sunucusu AB, Frankfurt / fra1, içerik dağıtım ağı AB ve ABD dahil küresel), Resend (yeni talep bildirim e-postalarının iletilmesi), Sentry (hata kayıtlarının tutulması; e-posta ve telefon bilgileri maskelenir), Cloudflare R2 (şifreli yedeklerin saklanması) ve GitHub Actions (yedekleme işleminin çalıştırılması)
- Talep edilmesi hâlinde, yasal olarak yetkili kamu kurum ve kuruluşları

Veritabanı ve uygulama sunucuları Türkiye dışında, Avrupa Birliği'nde (Almanya, Frankfurt) bulunur; bazı alt veri işleyenler ABD'de hizmet verir. Bu nedenle kişisel verileriniz yurt dışına aktarılmaktadır. Yurt dışına aktarım, KVKK'nın 9. maddesinde öngörülen uygun güvencelerden biri olan, Kişisel Verileri Koruma Kurulu tarafından ilan edilen standart sözleşmenin imzalanması ve sözleşmenin Kurum'a bildirilmesi yoluyla gerçekleştirilir. [HUKUK DANIŞMANI TARAFINDAN DOĞRULANMALIDIR: güvence türü, sözleşme ve bildirim tarihleri]

## 6. Toplama yöntemi

Kişisel verileriniz web sitesindeki formlar, telefon ve WhatsApp üzerinden elektronik ortamda toplanır.

## 7. Saklama süresi

Talepler, sonuçlanmasından itibaren [SÜRE] boyunca saklanır; sürenin sonunda silinir, yok edilir veya anonim hâle getirilir.

## 8. Haklarınız

KVKK'nın 11. maddesi uyarınca veri sorumlusuna başvurarak:

- a) Kişisel verilerinizin işlenip işlenmediğini öğrenme,
- b) Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,
- c) Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,
- ç) Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,
- d) Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,
- e) KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme,
- f) (d) ve (e) bentleri uyarınca yapılan işlemlerin, kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme,
- g) İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,
- ğ) Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme

haklarına sahipsiniz.

Başvurularınızı Türkçe ve yazılı olarak {{adres}} adresine elden veya posta yoluyla, kayıtlı elektronik posta (KEP) ile **{{kep_adresi}}** adresine ya da daha önce bize bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden **{{eposta}}** adresine iletebilirsiniz. Başvurunuz, talebin niteliğine göre en geç **30 gün** içinde ücretsiz olarak sonuçlandırılır (KVKK m.13); işlemin ayrıca bir maliyet gerektirmesi hâlinde Kurul'ca belirlenen tarifedeki ücret alınabilir. Web sitesi hizmet sağlayıcımız KARAYS'a ulaşan başvurular gecikmeksizin tarafımıza iletilir.`,
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
- İlan görüntüleme ve iletişim tıklamaları gibi kullanım istatistikleri (çerez kullanılmadan). Sayım, IP adresi ve tarayıcı bilgisinin günlük değişen, geri döndürülemez özetiyle yapılır; bu özet kimliğinizi doğrudan belirlemez, ancak anonim değil **takma adlı** (pseudonymous) veridir ve kişisel veri olarak korunur.
- Güvenlik amacıyla IP adresinizin geri döndürülemez özeti (ham IP adresi saklanmaz)

## Favoriler ve karşılaştırma listesi

Favorilerinize ve karşılaştırma listenize eklediğiniz ilanlar yalnızca kendi tarayıcınızda tutulur. Tarayıcı verilerinizi temizlediğinizde bu listeler de silinir.

## Üçüncü taraf hizmetler

Web sitemiz ve yönetim yazılımımız, KARAYS tarafından veri işleyen sıfatıyla sağlanır. Kullanılan hizmetler:

- Veritabanı ve dosya depolama: Supabase (AB, Frankfurt)
- Barındırma: Vercel (uygulama sunucusu AB, Frankfurt; içerik dağıtım ağı AB/ABD)
- Talep bildirim e-postası: Resend
- Hata kaydı: Sentry (e-posta ve telefon bilgileri maskelenir)
- Yedek saklama: Cloudflare R2; yedekleme işlemi: GitHub Actions
- Harita görüntüleri: [HARİTA SAĞLAYICISI] (görüntüler sunucumuz üzerinden alınır, tarayıcınız sağlayıcıya doğrudan bağlanmaz)
- WhatsApp ve sosyal medya paylaşım bağlantıları yalnızca tıkladığınızda ilgili hizmete yönlendirir.

## Güvenlik

Verileriniz şifreli bağlantı (HTTPS) üzerinden iletilir; veritabanı erişimi satır bazlı yetkilendirme ile sınırlandırılır ve taleplere yalnızca yetkili ofis çalışanları erişebilir.

## İletişim

Yurt dışına aktarım ve KVKK kapsamındaki haklarınızla ilgili ayrıntılar [KVKK Aydınlatma Metni](/kvkk)'nde yer alır. Gizlilikle ilgili sorularınız için **{{eposta}}** adresinden bize ulaşabilirsiniz.`,
  },
  cookies: {
    key: 'cookies',
    path: '/cerez-politikasi',
    title: 'Çerez Politikası',
    description: 'Web sitemizde kullanılan çerezler ve tarayıcı depolaması hakkında bilgilendirme.',
    legal: true,
    template: `Bu sayfa, web sitemizde kullanılan çerezler ve benzeri teknolojiler (tarayıcı depolaması, ölçüm betikleri) hakkında sizi bilgilendirmek amacıyla hazırlanmıştır. Web sitemiz reklam veya pazarlama amaçlı çerez **kullanmamaktadır**.

## Zorunlu çerezler

Aşağıdaki çerezler yalnızca yönetim paneline giriş yapan yetkililer için oluşturulur; oturumun güvenli şekilde sürdürülmesi için gereklidir ve izne tabi değildir. Siteyi ziyaret edenler için oluşturulmaz.

| Çerez | Amaç | Süre |
| --- | --- | --- |
| sb-…-auth-token | Yönetici oturumu (Supabase kimlik doğrulama; büyük oturumlarda .0, .1 gibi parçalara bölünebilir) | Oturum kapatılana veya süresi dolana kadar |
| eg_scope | Oturumun hangi panel için açıldığını işaretler (güvenlik) | Tarayıcı oturumu |
| eg_active_org | Yöneticinin seçtiği ofis | 180 gün |
| eg_site_preview | Yöneticinin kaydedilmemiş site değişikliklerini önizlemesi | 1 saat |

## Tarayıcı depolaması

| Anahtar | Amaç | Süre |
| --- | --- | --- |
| eg:favorites | Favori ilanlarınızı hatırlamak | Siz silene kadar |
| eg:compare | Karşılaştırma listeniz | Siz silene kadar |
| eg:consent | Çerez tercihiniz | 12 ay |
| eg:qr-source (oturum depolaması) | Talebin QR kod ile açılan sayfadan geldiğini belirtmek | Sekme kapanana kadar |

Bu kayıtlar yalnızca tarayıcınızda tutulur ve sitenin istediğiniz işlevleri yerine getirmesi için gereklidir.

## İstatistik

İlan görüntülenme ve iletişim tıklamaları çerez kullanılmadan, IP adresi ve tarayıcı bilgisinin günlük değişen, geri döndürülemez özeti ile sayılır. Bu özet kimliğinizi belirlemek için kullanılmaz.

## Analitik (yalnızca onayınızla)

| Hizmet | Amaç | Sağlayıcı |
| --- | --- | --- |
| Vercel Web Analytics | Anonim sayfa ziyareti istatistikleri (hangi sayfaların görüntülendiği) | Vercel Inc. (ABD) |
| Vercel Speed Insights | Sayfa hızı ve performans ölçümü (Core Web Vitals) | Vercel Inc. (ABD) |

Bu hizmetler çerez kullanmaz; ziyaretler kimliğinizle eşleştirilmeden toplu olarak sayılır. Yalnızca çerez bildiriminde "Kabul et" demeniz veya "Çerez tercihleri" penceresinde "Analitik" seçeneğini açmanız hâlinde yüklenir; onay vermezseniz hiç çalıştırılmaz. Onayınızı sayfanın alt kısmındaki "Çerez tercihleri" bağlantısından dilediğiniz zaman geri alabilirsiniz. [HUKUK DANIŞMANI TARAFINDAN DOĞRULANMALIDIR]`,
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
