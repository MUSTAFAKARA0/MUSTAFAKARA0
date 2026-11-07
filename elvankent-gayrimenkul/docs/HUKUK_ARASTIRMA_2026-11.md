# KARAYS – Türk hukuku uyum araştırması, boşluk listesi ve taslak metinler

> **ÖNEMLİ UYARI:** Bu belge hukuki görüş veya hukuki tavsiye **değildir**. Teknik bir ön araştırma ve **avukat incelemesine sunulacak taslaktır**. Taslak metinler, bir hukuk danışmanı (tercihen KVKK ve bilişim hukuku alanında) tarafından incelenip onaylanmadan yayına alınmamalıdır. [Köşeli parantez] içindeki alanlar şirket sahibinin dolduracağı bilgilerdir.
>
> Araştırma tarihi: 07.11.2026. Bu oturumda mevzuat.gov.tr, resmigazete.gov.tr ve bazı haber/hukuk sitelerine **doğrudan erişim (WebFetch) ağ kısıtı nedeniyle mümkün olmadı**; bulgular web araması sonuçlarından (kvkk.gov.tr, ticaret.gov.tr, resmigazete.gov.tr bağlantıları dahil) derlenmiştir. "Doğrulanmalı" işaretli maddeler resmi metinden teyit edilmelidir. Tam metin doğrulaması için oturum ağ ayarlarında `www.mevzuat.gov.tr`, `www.resmigazete.gov.tr`, `www.kvkk.gov.tr`, `ticaret.gov.tr` alan adlarına izin verilmesi gerekir.
>
> Repo dosyaları **değiştirilmedi** (salt okunur inceleme).

---

## 0. En kritik 12 boşluk (öncelik sırasıyla)

| # | Boşluk | Risk | Kim çözer |
|---|---|---|---|
| 1 | **Yetki belgesi numarası hiçbir yerde yok** (veri modeli, ofis ayarları, ilan sayfası). Taşınmaz Ticareti Yönetmeliği uyarınca ilanlarda yetki belgesi no + yetki belgesindeki işletme adı + iletişim bilgisi zorunlu. Ürünün her müşterisini (ofisi) idari para cezası riskine sokar. | Yüksek | Geliştirme + her ofis |
| 2 | **KARAYS şirket kimliği boş** (`legal.ts:13,20` "[Şirket bilgileri girilecek]"); unvan, MERSİS/VKN, adres, KVKK başvuru adresi yok. | Yüksek | Sahip |
| 3 | **Yurt dışına aktarım (KVKK md.9, 7499 s.K. sonrası)**: Supabase (AB/Frankfurt), Vercel (fra1), Resend, Sentry, Cloudflare R2, **Gmail (destek e-postası)** → hepsi yurt dışı aktarım. Türkiye'nin yeterlilik kararı yok → standart sözleşme imzalanıp **5 iş günü içinde Kurum'a bildirim** gerekir. Şu an hiçbir mekanizma/metin yok. | Yüksek | Avukat + sahip |
| 4 | **KARAYS–Ofis Veri İşleme Sözleşmesi (DPA) yok.** KARAYS ofislerin müşteri/CRM verisinde veri işleyen; KVKK md.12/2 müteselsil sorumluluk. | Yüksek | Avukat + sahip |
| 5 | **KARAYS lead formu onay kutusu aydınlatma ile rızayı karıştırıyor** (`karay-lead-form.tsx:107` "…işlenmesini kabul ediyorum") ve zorunlu tutuluyor (`actions/karay.ts:45`). Aydınlatma Tebliği md.5: aydınlatma ile açık rıza ayrı yapılmalı; talebe yanıt için rıza gereksiz (md.5/2-c). | Orta | Geliştirme |
| 6 | **KARAYS hizmet sözleşmesi / abonelik koşulları yok** (`legal.ts:45` yalnızca "[Şirket bilgileri girilecek]"). TBK md.20-25 genel işlem koşulları denetimi B2B'de de geçerli. | Yüksek | Avukat + sahip |
| 7 | **KARAYS sitesi için Çerez Politikası yok** (`legal.ts` yalnızca kvkk/gizlilik/kullanim-kosullari). Speed Insights her durumda yükleniyor (`root-document.tsx:20`, `vercel-insights.tsx:39`). | Orta | Geliştirme |
| 8 | **Ofis sitesi çerez bandında "Kabul et" ile "Yalnızca zorunlu" eşit değil** (`site-extras.tsx:121-126`: dolu buton vs. outline). Çerez Rehberi'nin (Tem. 2025 güncel sürüm) ilkesi: reddetme kabul kadar kolay olmalı. | Düşük-Orta | Geliştirme |
| 9 | **Saklama süreleri boş** (`default-pages.ts:104` "[SÜRE]", `legal.ts:27`). Silme Yönetmeliği: periyodik imha ≤ 6 ay; politika yoksa 3 ay içinde imha. | Orta | Avukat + geliştirme (otomatik imha işi) |
| 10 | **5651 yer sağlayıcı yükümlülükleri**: KARAYS ofis sitelerini barındırıyor → yer sağlayıcı. İhbar-kaldır prosedürü, BTK yer sağlayıcı bildirimi, trafik bilgisi saklama tanımlı değil. | Orta | Avukat + sahip |
| 11 | **Destek e-postası `karays.support@gmail.com`**: kurumsal olmayan, ABD'ye aktarım, KVKK başvuru kanalı olarak zayıf. Alan adlı e-posta + (isteğe bağlı) KEP adresi önerilir. | Orta | Sahip |
| 12 | **Ofis aydınlatma şablonunda başvuru yolu/30 gün/Kurul'a şikâyet, yurt dışı aktarım alıcıları ve saklama süresi eksik** (`default-pages.ts:94-108`). | Orta | Geliştirme + avukat |

---

## 1. Mevzuat özeti (konu konu)

### 1.1 KVKK (6698 sayılı Kanun)

**Temel metinler ve tarihler**
- 6698 sayılı Kişisel Verilerin Korunması Kanunu – RG 07.04.2016, sayı 29677.
- 7499 sayılı Kanun (KVKK md.6, 9, 18 vb. değişiklikleri) – RG 12.03.2024, sayı 32487; yurt dışı aktarım hükümleri **01.06.2024** yürürlük, eski md.9 ile **01.09.2024**'e kadar birlikte uygulama.
- Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik – RG 10.07.2024, sayı 32598.
- Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ – RG 10.03.2018, sayı 30356 (değişiklik RG 28.04.2019, 30758).
- Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ – RG 10.03.2018, sayı 30356.
- Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik – RG 28.10.2017, sayı 30224.
- Kurul Kararı 2019/10 (24.01.2019) – veri ihlali bildirimi 72 saat. Kurul Kararı 2025/2451 (25.12.2025) – ihlal ilanlarının Kurum sitesinde 60 gün yayımı.
- VERBİS istisnası: Kurul Kararı 2023/1154 (06.07.2023; bilanço eşiği 25 → 100 milyon TL) ve 2025/1572 (04.09.2025; RG 01.10.2025 – ana faaliyeti özel nitelikli veri olanlar için <10 çalışan ve <10 milyon TL).
- Çerez Uygulamaları Hakkında Rehber – ilk sürüm 20.06.2022; **güncel sürüm KVKK Yayınları No:69, Temmuz 2025**.
- 2026 idari para cezası aralıkları (yeniden değerleme oranı %25,49, RG 27.11.2025/33090): aydınlatma 85.437 – 1.709.200 TL; veri güvenliği 256.357 – 17.092.242 TL; VERBİS 341.809 – 17.092.242 TL; standart sözleşme bildirmeme ~90.308 – 1.806.377 TL (son kalem ikincil kaynak; kvkk.gov.tr tablosundan doğrulanmalı).

**(a) Aydınlatma yükümlülüğü (md.10 + Tebliğ)** – Veri elde edilirken: veri sorumlusunun (ve varsa temsilcisinin) kimliği, işleme amacı, aktarılabileceği alıcı grupları ve aktarım amacı, toplama yöntemi ve **hukuki sebebi**, md.11 hakları. Tebliğ md.5: açık rıza alınacaksa aydınlatma **ayrı** yapılmalı; aydınlatma, açık rızaya veya bir hizmetin kabulüne bağlanamaz; amaç ve hukuki sebep belirli/açık olmalı; "ve benzeri" gibi genel ifadeler kullanılmamalı; ispat yükü veri sorumlusunda.

**(b) Açık rıza ve diğer hukuki sebepler (md.5/2)** – (a) kanunda öngörülme, (c) sözleşmenin kurulması/ifası, (ç) hukuki yükümlülük, (e) bir hakkın tesisi/korunması, (f) meşru menfaat. Talebe yanıt verme, demo ayarlama, müşteriye hizmet sunma → (c)/(f). Pazarlama e-postası, analitik çerez → açık rıza (ve ticari ileti için 6563 onay kuralları). Açık rıza hizmet şartı olarak dayatılmamalı.

**(c) Veri sorumlusu / veri işleyen ayrımı**
- **KARAYS = veri sorumlusu**: kendi web sitesindeki lead/demo formu, müşteri ofislerin yetkilileri ve kullanıcı hesapları (ad, e-posta, giriş kayıtları), faturalama, destek yazışmaları.
- **KARAYS = veri işleyen**: ofislerin panelde tuttuğu müşteri/CRM, talepler, randevular, ofis sitesinden gelen ziyaretçi talepleri. **Ofis = veri sorumlusu**.
- KARAYS'ın alt-işleyenleri: Supabase, Vercel, Resend, Sentry, Cloudflare R2, (Gmail – destek).
- md.12/2: veri işleyen adına işlenen verilerde veri güvenliği tedbirlerinde veri sorumlusu ile **müteselsilen** sorumludur → yazılı sözleşme şart.

**(d) Veri işleme sözleşmesi (DPA) içeriği** – KVKK'da GDPR md.28 gibi madde madde liste yok; ancak md.12, Kurum'un Kişisel Veri Güvenliği Rehberi (Teknik ve İdari Tedbirler) ve yerleşik uygulama gereği asgari içerik: konu, süre, veri kategorileri, ilgili kişi grupları, amaç; yalnızca talimatla işleme; gizlilik; teknik/idari tedbirler; alt-işleyen onayı ve listesi; yurt dışı aktarım düzeni (md.9 – Vİ→Vİ standart sözleşme); ihlalin gecikmeksizin bildirimi (sorumlunun 72 saatine yetişecek şekilde); ilgili kişi başvurularında destek; sözleşme sonunda iade/silme; denetim hakkı; sorumluluk ve rücu. (Taslak §4.E'de.)

**(e) VERBİS** – Yıllık çalışan sayısı 50'den az **ve** yıllık mali bilanço toplamı 100 milyon TL'den az **ve** ana faaliyeti özel nitelikli veri işleme olmayan veri sorumluları kayıttan muaf (2023/1154). KARAYS ve tipik emlak ofislerinin büyük çoğunluğu muaf görünür; **muafiyet diğer yükümlülükleri kaldırmaz**. Kontrol: sahip, çalışan sayısı ve bilançoyu teyit etmeli. Veri işleyen sıfatı VERBİS kaydı doğurmaz.

**(f) Yurt dışına aktarım (md.9, 01.06.2024 sonrası)** – Sıra: (1) yeterlilik kararı (henüz hiçbir ülke için ilan edilmedi – doğrulanmalı), (2) uygun güvenceler: Kurul'un ilan ettiği **standart sözleşme** (4 modül: VS-VS, VS-Vİ, Vİ-Vİ, Vİ-VS), bağlayıcı şirket kuralları, Kurul izinli taahhütname; (3) arızi haller (açık rıza vb. – **olağan/düzenli aktarımda kullanılamaz**, Kurum'un Ocak 2025 Yurt Dışı Aktarım Rehberi). Standart sözleşme **değiştirilmeden** (yalnız seçimlik maddeler) kullanılır, taraflarca imzalanır ve **imzadan itibaren 5 iş günü içinde** Kurum'a fiziki, KEP veya "Standart Sözleşme Bildirim Modülü" ile bildirilir; yükümlülük veri işleyen için de geçerlidir. Değişiklik/sona erme de bildirilir.
  - KARAYS için pratik sorun: Supabase/Vercel/Resend/Sentry/Cloudflare kendi DPA + AB SCC'lerini sunar; **Türk standart sözleşmesini imzalamaları gerekir**. Avukatla birlikte her sağlayıcıdan Türk SCC (Vİ-Vİ veya VS-Vİ modülü) imzası talep edilmeli; alınamıyorsa risk kabulü/alternatif (TR barındırma) değerlendirilmeli. **Hukukçu kararı.**
  - Aydınlatma metinlerinde yurt dışı alıcı grupları ve ülkeler (AB – Almanya/İrlanda, ABD) belirtilmeli.

**(g) Veri ihlali (md.12/5 + Kurul 2019/10)** – Veri sorumlusu, öğrendiği andan itibaren **en geç 72 saat** içinde Kurul'a "Kişisel Veri İhlal Bildirim Formu" ile bildirir; gecikmede gerekçe ekler; etkilenen kişilere makul en kısa sürede bildirim; ihlal kayıtları tutulur; veri işleyen ihlali **gecikmeksizin** veri sorumlusuna bildirir (DPA'da "24 saat" gibi somut süre önerilir).

**(h) Saklama ve imha** – Silme Yönetmeliği: VERBİS'e kayıtlı veri sorumluları saklama ve imha politikası hazırlamak zorunda; periyodik imha aralığı **en fazla 6 ay**; politika zorunluluğu olmayan veri sorumlusu, silme yükümlülüğü doğduğunda **3 ay** içinde imha eder; ilgili kişi talebinde 30 gün. Muaf olsa da kısa bir politika iyi uygulamadır ve ofislere sunulacak süreler için gereklidir.

### 1.2 Çerezler (KVKK Çerez Uygulamaları Hakkında Rehber, 2022; güncel sürüm Temmuz 2025)
- **Zorunlu çerezler** (kullanıcının talep ettiği bilgi toplumu hizmeti için: oturum açma, form, gizlilik tercihinin hatırlanması, güvenlik, yük dengeleme): açık rıza gerekmez; md.5/2 hukuki sebeplerine dayanır; **aydınlatma yine gerekir** (çerez politikası/aydınlatma bağlantısı).
- **Analitik, kişiselleştirme, reklam/pazarlama, üçüncü taraf takip** → kural olarak **açık rıza** (opt-in), önceden işaretli kutu yok, çerezler rızadan önce yüklenmez.
- Banner: kabul ve **ret seçeneği eşit kolaylık/görünürlükte**; "çerez duvarı" ile rıza dayatılmaz; yanıltıcı arayüz (dark pattern) yok; tercih sonradan değiştirilebilir/geri alınabilir; rıza sürekli tekrar sorulmamalı. (Ret butonu eşitliği Rehber'in genel ilkesi ve Kurul uygulaması olarak aktarılıyor; Temmuz 2025 metninden kelimesi kelimesine **doğrulanmalı**.)
- **Yalnızca zorunlu çerez/oturum kullanan site**: rıza bandına (consent banner) gerek yok; ancak çerez/aydınlatma bilgisinin erişilebilir olması (footer'da "Çerez Politikası") gerekir. localStorage ve "benzeri teknolojiler" de kapsamda değerlendirilir.
- Not: Elektronik Haberleşme Kanunu (5809) md.51 de terminal ekipmanına erişimde ayrıca dikkate alınmalı (hukukçu).

### 1.3 6563 Elektronik Ticaret Kanunu, Ticari İletişim Yönetmeliği, İYS
- 6563 sayılı Kanun – RG 05.11.2014, 29166. Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik – RG 15.07.2015, 29417; İYS değişiklikleri RG 04.01.2020 ve sonrası.
- md.6: ticari elektronik ileti için önceden onay; **esnaf ve tacirlere önceden onay alınmaksızın** gönderilebilir; ancak alıcı ret hakkını kullanırsa gönderim durdurulur. Kaynaklara göre tacir/esnaf alıcıların adresleri gönderimden önce **İYS'ye kaydedilmeli** ve ret durumları kontrol edilmeli. Ticari ileti gönderen hizmet sağlayıcıların **İYS'ye kaydı** zorunlu.
- Her iletide: hizmet sağlayıcının tanıtıcı bilgileri (unvan, MERSİS/vergi no, iletişim) ve **ücretsiz, kolay ret** bağlantısı; ret talebi 3 iş günü içinde uygulanır.
- Bilgilendirme/işlem iletileri (talebinize yanıt, fatura, şifre sıfırlama, demo randevusu) ticari ileti sayılmaz → onay gerekmez, ama içine reklam eklenmemeli.
- KARAYS için: emlak ofisleri genellikle tacir/esnaf → pazarlama e-postası onaysız gönderilebilir, **İYS kaydı + ret bağlantısı + ret takibi** şart. Lead formundaki kişi bireysel danışman/tüketici olabilir → güvenli yol: **isteğe bağlı, işaretsiz** "ürün haberleri" onay kutusu.
- Ofisler için: ziyaretçilere (tüketici) "yeni ilan" SMS/e-postası göndermek **onay + İYS** gerektirir. Ürün şu an toplu pazarlama gönderimi sunmuyor; eklenirse İYS entegrasyonu şart.

### 1.4 Ticari hayatta zorunlu bilgiler
- **TTK (6102) md.39**: Tacir, ticari mektuplarında ve defter kayıtlarına dayanak belgelerde **ticaret unvanı, işletme merkezi, ticaret sicil no / MERSİS no** ve (internet sitesi zorunluluğu varsa) internet sitesi adresini gösterir. (Sizin brifteki "md.39-40" atfının md.39 ile karşılandığı kaynaklarda görüldü; md.40 tacirin işletmesini tescil ettirmesine ilişkindir – doğrulanmalı.)
- **TTK md.1524**: İnternet sitesi açma zorunluluğu yalnızca **bağımsız denetime tabi** sermaye şirketleri için (6335 s.K. değişikliği). KARAYS büyük olasılıkla kapsam dışı; kapsamdaysa sitede "Bilgi Toplumu Hizmetleri" bölümü gerekir.
- **6563 md.3 + Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik** (RG 26.08.2015, 29457) md.5: elektronik ticaret faaliyetinde sitede erişilebilir şekilde: **ad/unvan, MERSİS no (yoksa vergi kimlik no), açık adres, e-posta, telefon, KEP adresi (varsa), meslek odası bilgisi (varsa)**. KARAYS abonelik satışını çevrim içi alıyorsa ETBİS (Elektronik Ticaret Bilgi Sistemi) kaydı da değerlendirilmeli (**hukukçu/mali müşavir**).
- **Şahıs işletmesi (gerçek kişi tacir/esnaf)**: ticaret unvanı = ad soyad (+ ek), vergi dairesi + VKN/TCKN, ticaret sicil/esnaf sicil no, MERSİS (ticaret siciline kayıtlıysa), adres.
- **Ofis siteleri** için de aynısı: ofisin unvanı, adresi, iletişim, MERSİS/VKN, oda sicil no ve **yetki belgesi no** footer'da/İletişim sayfasında olmalı.

### 1.5 Taşınmaz Ticareti Hakkında Yönetmelik ve EİDS
- Taşınmaz Ticareti Hakkında Yönetmelik – RG 05.06.2018, 30442 (dayanak: 6585 s. Perakende Ticaretin Düzenlenmesi Hakkında Kanun md.16/1-b). Önemli değişiklikler: RG 14.10.2020 (yetki belgesi no ilan zorunluluğu, ilan sitelerinin belgesiz işletmeleri kabul etmemesi), 2023 (ilan platformlarında kimlik/yetki doğrulama – EİDS'nin dayanağı; tarih doğrulanmalı), RG 14.05.2024.
- **İlan zorunluluğu**: İşletmeler satış/kiralama ilanlarında **yetki belgesi numarasına ve iletişim bilgilerine** yer verir; yetki belgesindeki işletme adı/unvanı kullanılır. Kaynaklar, işletmenin **kendi internet sitesindeki ilanların da** bu kurala tabi olduğunu belirtiyor (kapsam dışı olduğuna dair kaynak bulunamadı).
- **Yetkilendirme sözleşmesi**: Hizmet, mülk sahibiyle yazılı (en az 2 nüsha) yetkilendirme sözleşmesi kapsamında verilir; EİDS yetkisi bu sözleşmenin yerine geçmez.
- **EİDS** (Ticaret Bakanlığı, 15.09.2024 devreye alındı): İnternet ilan platformlarında ilanın mülk sahibi veya e-Devlet üzerinden yetkilendirilmiş işletme tarafından verildiğini doğrular. Kademeli zorunluluk: kiralık konut ilk, satılık konut 15.02.2025, işyerleri Nisan 2025 vb. (tarihler kaynaklarda farklı; **doğrulanmalı**). Yükümlülük öncelikle **ilan platformları (aracı hizmet sağlayıcılar)** üzerindedir; Bakanlık EİDS API'sine entegre firmaları listeliyor (Eyl. 2026).
- **KARAYS'a etkisi**: KARAYS çok ofisli ortak bir portal/pazar yeri işletmiyor; her ofisin kendi sitesi var → KARAYS'ın EİDS entegrasyonu yükümlülüğü **muhtemelen yok** (ofis kendi ilanının içerik sağlayıcısı). Ancak (i) ofis sitelerinde yetki belgesi no gösterimi **mutlaka** gerekli, (ii) ileride ortak portal/ilan arama sayfası açılırsa KARAYS ilan platformu sayılabilir ve EİDS + belgesiz işletme kabul etmeme yükümlülüğü doğar. **Hukukçu teyidi önerilir.** Ürün özelliği önerisi: ilan editöründe "Mülk sahibi yetkilendirmesi (yazılı sözleşme / EİDS) alındı" onay alanı ve tarih.
- Yetki belgesi sorgulama: https://ttbs.gtb.gov.tr/Home/BelgeSorgula

### 1.6 B2B SaaS sözleşmesi, mesafeli sözleşmeler, e-fatura
- **Mesafeli Sözleşmeler Yönetmeliği** (RG 27.11.2014, 29188) ve 6502 s. TKHK yalnızca **tüketici** işlemlerine uygulanır; emlak ofisleri ticari/mesleki amaçla hareket ettiğinden **uygulanmaz** (cayma hakkı, ön bilgilendirme formu zorunlu değil). Sözleşmede müşterinin tacir/esnaf olarak ticari amaçla hareket ettiği beyanı yer almalı.
- **TBK md.20-25 (genel işlem koşulları)** B2B'de de uygulanır: önceden açıkça bilgi verilmeyen ve okuma imkânı tanınmayan koşullar yazılmamış sayılır (md.21); karşı taraf aleyhine tek taraflı değiştirme yetkisi veren hükümler yazılmamış sayılır (md.24); dürüstlüğe aykırı hükümler (md.25). Sorumluluk sınırlaması: TBK md.115 (ağır kusur/kast için önceden sorumsuzluk kaydı kesin hükümsüz).
- **6563 md.4-5** (sipariş, onay): çevrim içi sözleşme kuruluyorsa sipariş öncesi teknik adımlar, düzeltme imkânı ve sipariş onayı; taraflardan biri tüketici değilse aksi kararlaştırılabilir.
- **e-Fatura/e-Arşiv** (VUK 509 Sıra No.lu Genel Tebliğ): genel eşik kaynaklara göre 2025 brüt satış hasılatı **3 milyon TL** → 01.07.2026'ya kadar e-fatura; internet üzerinden satış/hizmet veren ve bazı sektörler için daha düşük eşikler (500.000 TL) ve e-arşiv düzenleme sınırları (rakamlar ikincil kaynaklarda çelişkili – **mali müşavir/GİB'den doğrulanmalı**). E-fatura kayıtlı kullanıcıya e-fatura, diğerlerine e-arşiv fatura.

### 1.7 5651 sayılı Kanun
- 5651 (RG 23.05.2007) ve İnternet Ortamında Yapılan Yayınların Düzenlenmesine Dair Usul ve Esaslar Hakkında Yönetmelik (RG 24.10.2007).
- **KARAYS = ofis sitelerine göre yer sağlayıcı**, karays.com için **içerik sağlayıcı**; ofisler kendi sitelerinin içerik sağlayıcısı.
- md.3: içerik, yer ve erişim sağlayıcılar **tanıtıcı bilgilerini** (unvan, adres, iletişim) internet sitesinde bulundurur.
- md.5 (yer sağlayıcı): içeriği kontrol/araştırma yükümlülüğü yok; hukuka aykırı içerik usulüne uygun **bildirildiğinde** (md.8, 9, 9/A kararları ve kişilik hakkı başvuruları dahil) yayından kaldırır; **trafik bilgisini 1 yıldan az, 2 yıldan fazla olmamak üzere** saklar, doğruluk/bütünlük/gizlilik sağlar; BTK'nın istediği bilgileri verir; **yer sağlayıcılık bildirimi** yapmayanlara idari para cezası öngörülür (tutarlar güncel metinden doğrulanmalı). Yönetmelikte daha eski 6 aylık süre geçiyor → hangi sürenin uygulanacağı **hukukçu kararı**.
- Pratik: Vercel/Supabase log saklama süreleri kısa; yer sağlayıcı trafik kaydı (IP, zaman, hedef) için ayrı log arşivi (ör. R2'ye günlük dışa aktarım, 1-2 yıl) gerekebilir — bu ayrıca KVKK açısından aydınlatmaya eklenmeli.

### 1.8 Erişilebilirlik
- Brifteki varsayım doğrultusunda değerlendirme dışı (özel sektör B2B SaaS için genel bir web erişilebilirliği zorunluluğu bulunmadığı kabul edildi; hukukçu teyidi isteğe bağlı).

---

## 2. Boşluk listesi (gereklilik → mevcut durum → kesin düzeltme → gerekenler)

Kısaltmalar: **[SAHİP]** = şirket sahibinin vereceği bilgi; **[AVUKAT]** = hukuk incelemesi şart; **[GELİŞTİRME]** = kod değişikliği.

### A. KARAYS'ın kendi sitesi (veri sorumlusu)

| # | Gereklilik | Mevcut durum (dosya:satır) | Düzeltme | Gerekenler |
|---|---|---|---|---|
| A1 | Aydınlatma: veri sorumlusunun kimliği | `src/modules/karay/legal.ts:13,20` "KARAYS Gayrimenkul Teknolojileri — [Şirket bilgileri girilecek]" | §4.A metnini kullan; `pending` sabitini kaldırıp `KARAY_COMPANY` nesnesi (unvan, mersis, vkn, vergiDairesi, adres, eposta, kep, telefon) ekle ve metinlere enjekte et | [SAHİP] unvan, MERSİS/VKN, adres, KVKK e-postası |
| A2 | Aydınlatma: hukuki sebep | `legal.ts:26` "hukuki inceleme sonrası belirlenecektir" | "KVKK md.5/2-(c) sözleşmenin kurulması (demo/teklif talebi), (f) meşru menfaat (spam önleme, kayıt güvenliği), (ç) hukuki yükümlülük; pazarlama iletisi için ayrı onay" (§4.A) | [AVUKAT] |
| A3 | Aydınlatma: saklama süresi | `legal.ts:27` boş | Lead: son temastan itibaren 2 yıl; müşteriye dönüşmezse 2 yıl sonra silme; spam kayıtları 90 gün (§4.F) | [AVUKAT] süre onayı |
| A4 | Aydınlatma: alıcı grupları + yurt dışı aktarım | `legal.ts:37` "Barındırma ve e-posta hizmet sağlayıcıları [Şirket bilgileri girilecek]"; kvkk metninde aktarım bölümü yok (`legal.ts:16-30`) | Alıcılar: Supabase (AB/Almanya), Vercel (AB/Frankfurt; ABD merkezli), Resend (AB), Sentry (AB), Cloudflare R2 (yedek; AB yargı alanı seçilmeli), Google (Gmail – ABD), md.9 uyarınca standart sözleşme (§4.A) | [AVUKAT] + her sağlayıcıyla Türk SCC imzası + 5 iş günü bildirimi |
| A5 | İlgili kişi başvuru yolu (Başvuru Tebliği: yazılı, KEP, güvenli e-imza/mobil imza, sistemde kayıtlı e-posta; 30 gün; Kurul'a şikâyet md.14) | `legal.ts:28` "[Şirket bilgileri girilecek] adresine başvurarak" | §4.G metni + `/karay/yasal/basvuru` sayfası | [SAHİP] adres, e-posta, KEP (isteğe bağlı) |
| A6 | Aydınlatma ile açık rızanın ayrılması (Tebliğ md.5) | `src/components/karay/karay-lead-form.tsx:98-110` "Aydınlatma metnini okudum; talebime yanıt verilmesi için bilgilerimin işlenmesini **kabul ediyorum**"; `src/app/actions/karay.ts:45` zorunlu `z.literal(true)` | Etiketi değiştir: `"Kişisel verilerimin işlenmesine ilişkin <Link>Aydınlatma Metni</Link>'ni okudum."` (onay değil beyan). Daha iyi: kutuyu kaldırıp gönder butonunun üstüne "Formu göndererek talebinizin yanıtlanması için verilerinizin Aydınlatma Metni'nde açıklandığı şekilde işleneceğini bilirsiniz." bilgi notu koy. Ayrıca **isteğe bağlı, işaretsiz** ikinci kutu: `name="marketing"` "KARAYS'ın ürün güncellemeleri ve kampanyaları hakkında e-posta/telefon ile bilgilendirilmek istiyorum. (İsteğe bağlı; dilediğiniz an iptal edebilirsiniz.)" → `karay_leads.marketing_opt_in_at` | [GELİŞTİRME] [AVUKAT] |
| A7 | Alan adlandırma | `actions/karay.ts:88` `p_kvkk_consent: true`; `actions/public.ts:123` aynı; `customers.kvkk_consent_at` | Veri modeli "rıza" değil "aydınlatma beyanı" kaydediyor; `privacy_notice_ack_at` / `privacy_notice_version` olarak yeniden adlandır, metin sürüm numarası sakla (ispat yükü) | [GELİŞTİRME] (düşük öncelik) |
| A8 | Çerez politikası (KARAYS sitesi) | `legal.ts` yalnızca `kvkk`, `gizlilik`, `kullanim-kosullari`; KARAYS sitesinde çerez bandı yok; `src/components/common/root-document.tsx:20` + `vercel-insights.tsx:39` Speed Insights her ziyaretçide yüklenir; Web Analytics rıza yoksa yüklenmez (iyi) | `KARAY_LEGAL`'e `cerez-politikasi` ekle (§4.C). Site yalnızca zorunlu çerez/çerezsiz ölçüm kullandığı sürece **banner gerekmez**; politika footer'da olmalı. Speed Insights'ı politikada açıkla ya da rızaya bağla ([AVUKAT] kararı, `docs/LEGAL_DATA_MAP.md` #6) | [GELİŞTİRME] |
| A9 | Hizmet sağlayıcı tanıtıcı bilgileri (6563 md.3, TTK md.39, 5651 md.3) | `src/components/karay/karay-footer.tsx:56-66` yalnızca Yasal bağlantılar; unvan/MERSİS/adres yok; `src/app/karay/page.tsx:~401` adres alanı profile'dan, boş olabilir | Footer'a sabit satır: `{unvan} · MERSİS: {mersis} · Vergi Dairesi/No: {vd}/{vkn} · {adres} · {eposta} · KEP: {kep}` | [SAHİP] |
| A10 | Kullanım koşulları / hizmet sözleşmesi | `legal.ts:41-47` iki cümle + "[Şirket bilgileri girilecek]" | §4.D özetini yayımla; tam Hizmet Sözleşmesi + DPA'yı müşteriyle imzalanacak/kabul edilecek belge olarak hazırla; panel ilk girişte "Hizmet Sözleşmesi ve Veri İşleme Sözleşmesi'ni okudum, kabul ediyorum" (tacir için açık kabul + sürüm + zaman damgası) | [AVUKAT] [SAHİP] fiyat, süre, iade |
| A11 | Gizlilik politikası | `legal.ts:31-39` kısa; "Bilgileriniz satılmaz" iyi; alt-işleyenler yok | §4.B | [AVUKAT] |
| A12 | Destek kanalı | `karays.support@gmail.com` (brif) | `destek@karays.com` / `kvkk@karays.com` (alan adlı, Google Workspace veya AB'de barındırılan e-posta); Gmail kalacaksa yurt dışı aktarım alıcısı olarak açıkla | [SAHİP] |
| A13 | İYS | Ürün içi pazarlama gönderimi yok; KARAYS'ın ofislere pazarlama e-postası planı bilinmiyor | KARAYS ticari ileti gönderecekse: İYS hizmet sağlayıcı kaydı, tacir alıcıların İYS'ye yüklenmesi + ret kontrolü, her iletide unvan + ret bağlantısı | [SAHİP] [AVUKAT] |
| A14 | VERBİS | Belirsiz | Muafiyet koşullarını (çalışan <50, bilanço <100 milyon TL, ana faaliyet özel nitelikli değil) iç kayda geçir; aşılırsa kayıt | [SAHİP] |
| A15 | Yurt dışı aktarım bildirimi | Yok | Her alt işleyenle Türk standart sözleşmesi (KARAYS veri sorumlusu olarak VS→Vİ; ofis verisi için Vİ→Vİ) imzala, **5 iş günü** içinde Kurum'a bildir; sağlayıcı listesi/ülke kaydı tut | [AVUKAT] [SAHİP] |
| A16 | Veri ihlali prosedürü | `docs/KI41_GUVENLIK_PLANI.md` vb. teknik plan var; KVKK bildirim akışı belgelenmemiş | 72 saat akışı: tespit → ofislere (veri sorumlusu) 24 saat içinde bildirim → KARAYS kendi verisi için Kurul formu → ihlal kaydı | [AVUKAT] |
| A17 | 5651 yer sağlayıcı | Hiçbir metin/süreç yok | Kullanım koşullarına içerik sorumluluğu + ihbar e-postası (`hukuk@karays.com`), kaldırma süreci; BTK yer sağlayıcı bildirimi; trafik log arşivi (1-2 yıl) | [AVUKAT] [SAHİP] [GELİŞTİRME] |
| A18 | e-Fatura | Bilinmiyor (`docs/BILLING_ARCHITECTURE.md` kapsam dışı incelendi) | Mali müşavirle e-fatura/e-arşiv mükellefiyeti; faturada abonelik dönemi ve hizmet tanımı | [SAHİP] mali müşavir |

### B. Ofis (kiracı) siteleri ve panel (ofis = veri sorumlusu, KARAYS = veri işleyen)

| # | Gereklilik | Mevcut durum (dosya:satır) | Düzeltme | Gerekenler |
|---|---|---|---|---|
| B1 | **Yetki belgesi numarası ilanlarda** (Taşınmaz Ticareti Yön.) | `grep -rni "yetki belgesi\|yetki_belgesi\|authorization" src` → **hiç sonuç yok** (yalnızca yazılım yetkileri). `src/components/admin/settings/company-form.tsx:138-194`'te alan yok. `src/components/property/property-detail-view.tsx:111` yalnızca "İlan no", `:240` yalnızca `s.display_name` | (1) Migration: `alter table tenant_settings add column real_estate_license_no text check (char_length(real_estate_license_no) <= 40), add column license_business_name text check (char_length(license_business_name) <= 160);` (ve site_brand_publish / brand_content_draft RPC alan listelerine ekle: `20261001000001`, `20261006000001`, `20261007000001` migration'larındaki `'legal_name'` listesi). (2) `company-form.tsx`'e: `<TextField label="Taşınmaz ticareti yetki belgesi no" name="real_estate_license_no" required hint="Ticaret Bakanlığı TTBS'den alınan belge numarası. İlanlarda ve site altbilgisinde gösterilir (Taşınmaz Ticareti Hakkında Yönetmelik)." />` ve "Yetki belgesindeki işletme adı". (3) İlan yayınlama: belge no yoksa yayın engeli (steps-publish.tsx) veya kalıcı uyarı. (4) `property-detail-view.tsx:240` → `{s.license_business_name ?? s.legal_name ?? s.display_name} · Yetki Belgesi No: {s.real_estate_license_no} · {telefon}`; ayrıca 111. satır yanına "Yetki belgesi no". (5) İlan kartı/listeleme sayfası ve footer'da (`site-footer.tsx:186` civarı) "Yetki Belgesi No: …". (6) JSON-LD RealEstateAgent'a `identifier`. | [GELİŞTİRME] + her ofis [yetki belgesi no] |
| B2 | Mülk sahibi yetkilendirmesi (yazılı sözleşme; ilan platformlarında EİDS) | Yok | İlan editörüne: "Mülk sahibiyle yazılı yetkilendirme sözleşmesi imzalandı" onay kutusu + tarih + (isteğe bağlı) sözleşme dosyası; "EİDS yetkisi alındı (ilan portallarına aktarım için)" bilgisi. Yayın öncesi uyarı. | [GELİŞTİRME] [AVUKAT] KARAYS'ın ilan platformu sayılmadığı teyidi |
| B3 | Ofis kimlik bilgileri (TTK md.39, 6563 md.3, 5651 md.3) | `company-form.tsx:140` yalnızca "Ticari unvan" (`legal_name`); MERSİS, VKN/vergi dairesi, oda sicil no, KEP yok | Alanlar ekle: `mersis_no`, `tax_office`, `tax_no`, `chamber_registry` (ör. "İstanbul Emlak Komisyoncuları Odası sicil no"), `kep_address`; footer ve /kvkk şablonuna `{{mersis}}`, `{{vkn}}`, `{{kep}}`, `{{yetki_belgesi}}` değişkenleri (`src/modules/content/queries.ts:35` civarındaki değişken eşleme) | [GELİŞTİRME] + her ofis |
| B4 | Ofis KVKK aydınlatma şablonu – hukuki sebep | `src/modules/content/default-pages.ts:92` md.5/2 (c),(ç),(f) – iyi; "[HUKUK DANIŞMANI…]" | "(e) bir hakkın tesisi, kullanılması veya korunması" ekle (uyuşmazlıkta delil); ziyaretçi değerleme talebi için (c) | [AVUKAT] |
| B5 | Ofis şablonu – aktarım/yurt dışı | `default-pages.ts:96` "[SAĞLAYICI VE SUNUCU KONUMU BİLGİSİ EKLENMELİDİR]" | Değiştir: "Kişisel verileriniz, web sitesi ve müşteri yönetim yazılımı hizmetini aldığımız **[KARAYS unvanı]** (veri işleyen) ve onun alt hizmet sağlayıcıları olan barındırma, veritabanı, e-posta iletimi, hata izleme ve yedekleme sağlayıcılarına (Supabase Inc. – AB/Almanya, Vercel Inc. – AB/Almanya, Resend – AB, Functional Software Inc. (Sentry) – AB, Cloudflare Inc. – R2 yedekleme) aktarılmaktadır. Bu sağlayıcıların sunucuları yurt dışında bulunduğundan aktarım, KVKK md.9 uyarınca Kurul'ca ilan edilen standart sözleşmeler imzalanarak ve Kurum'a bildirilerek gerçekleştirilir." | [AVUKAT] + A15 tamamlanmalı |
| B6 | Ofis şablonu – saklama | `default-pages.ts:104` "[SÜRE]" | "Talep ve iletişim kayıtları, talebin sonuçlanmasından itibaren 2 yıl; sözleşmeye dönüşen kayıtlar, TTK md.82 ve VUK md.253 uyarınca 10 yıl (yalnızca ilgili belgeler) saklanır…" ve ürün tarafında otomatik imha işi (6 ayda bir) | [AVUKAT] [GELİŞTİRME] |
| B7 | Ofis şablonu – başvuru yolu | `default-pages.ts:108` e-posta ve adres var; yöntem/süre/Kurul'a şikâyet yok | "Başvurunuzu, kimliğinizi tespit edici bilgilerle birlikte yazılı olarak {{adres}} adresine, {{kep}} KEP adresine, güvenli elektronik/mobil imzalı olarak veya daha önce bize bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden {{eposta}} adresine iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır. Başvurunuz reddedilir, cevap yetersiz bulunur veya süresinde cevap verilmezse KVKK md.14 uyarınca Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz." | — |
| B8 | Ofis talep formu onay kutusu | `src/components/forms/lead-form.tsx:274-288` "…KVKK Aydınlatma Metni'ni okudum." – **doğru ifade** (rıza değil beyan); `src/modules/crm/validation.ts:59` zorunlu, hata mesajı "onaylayın" | Hata mesajını "Devam etmek için Aydınlatma Metni'ni okuduğunuzu işaretleyin." yap. İsteğe bağlı, işaretsiz ticari ileti onayı ofis isterse ayrı kutu ("Benzer ilanlardan SMS/e-posta/arama ile haberdar olmak istiyorum") + İYS'ye aktarım notu | [GELİŞTİRME] |
| B9 | Çerez bandı – ret eşitliği | `src/components/layout/site-extras.tsx:121-129` "Kabul et" (varsayılan dolu) / "Yalnızca zorunlu" (outline) / "Tercihler" (ghost) | İki butonu aynı varyantta ve aynı boyutta göster; "Yalnızca zorunlu" yerine "Reddet": `<Button size="sm" variant="outline" onClick={() => saveConsent(false)}>Reddet</Button>` `<Button size="sm" variant="outline" onClick={() => saveConsent(true)}>Kabul et</Button>` | [GELİŞTİRME] |
| B10 | Çerez bandı gerekliliği | Ofis sitesinde analitik yalnızca Vercel Web Analytics (çerezsiz) ve rızaya bağlı – iyi. | Seçenek: analitik hiç kullanılmayacaksa bandı kaldırıp yalnızca footer'da "Çerez Politikası" bırakmak Rehber'e uygundur. Kullanılacaksa mevcut yapı + B9. | [AVUKAT] |
| B11 | Çerez politikası metni tutarlılığı | `default-pages.ts:153` "Yalnızca yönetim paneline giriş yapan yetkililer için oturum çerezleri"; `:161` eg:consent "12 ay" – `site-extras.tsx:45-47` 12 ay kontrolü var ✓; ancak `src/components/common/vercel-insights.tsx:10-17` süreyi kontrol etmiyor (12 ay sonra da analitik yüklenir) | vercel-insights'ta da `at` + 365 gün kontrolü ekle; politikaya "Vercel Speed Insights (çerezsiz performans ölçümü)" satırı ekle | [GELİŞTİRME] |
| B12 | Ofis gizlilik politikası alt-işleyenler | `default-pages.ts:130-132` "[SAĞLAYICI ADI]", "[HARİTA SAĞLAYICISI]" | Gerçek adlarla doldur (B5 ile aynı liste + harita sağlayıcı adı) | [GELİŞTİRME] |
| B13 | Ofis kullanım koşulları – yetki belgesi | `default-pages.ts:177-203` | "Site, Taşınmaz Ticareti Yetki Belgesi No {{yetki_belgesi}} ile faaliyet gösteren {{unvan}} tarafından işletilmektedir." cümlesi ekle; `[İL]` → `{{il}}` | [GELİŞTİRME] |
| B14 | DPA kabulü | Ofis panelinde DPA kabul akışı yok | İlk girişte/abonelik başlangıcında DPA (§4.E) kabulü, sürüm+zaman damgası+kabul eden kullanıcı `audit_logs`'a | [GELİŞTİRME] [AVUKAT] |
| B15 | Ofisin ilgili kişi taleplerine teknik destek | `docs/LEGAL_DATA_MAP.md`: dışa aktarma ve silme mevcut ✓ | DPA'da taahhüt et; panelde "KVKK başvurusu kaydı" (tarih, 30 gün sayacı) özelliği önerilir | — |

---

## 3. Kod düzeltme örnekleri (özet)

**3.1 `src/components/karay/karay-lead-form.tsx:98-110`** (öneri)
```tsx
<p className="text-[13px] text-[#5b6b85]">
  Formu göndererek talebinizin yanıtlanması amacıyla kişisel verilerinizin{' '}
  <Link href="/karay/yasal/kvkk" target="_blank" className="font-semibold underline underline-offset-2">Aydınlatma Metni</Link>
  'nde açıklandığı şekilde işleneceğini bilirsiniz.
</p>
<Checkbox
  name="marketing"
  label="KARAYS'ın ürün güncellemeleri ve kampanyaları hakkında e-posta ile bilgilendirilmek istiyorum (isteğe bağlı, dilediğiniz an iptal edebilirsiniz)."
/>
```
`src/app/actions/karay.ts:45` → `kvkk` zorunluluğunu kaldır (veya beyan olarak tut: `z.literal(true, { message: 'Aydınlatma Metni\'ni okuduğunuzu işaretleyin.' })`) ve `marketing: z.boolean()` ekle; `karay_leads`'e `marketing_opt_in_at timestamptz`, `privacy_notice_version text`.

**3.2 `src/modules/karay/legal.ts`**
```ts
export const KARAY_COMPANY = {
  unvan: '[KARAYS ticaret unvanı]',
  mersis: '[MERSİS no]',
  vergiDairesi: '[Vergi dairesi]',
  vkn: '[VKN/TCKN]',
  adres: '[Açık adres]',
  eposta: '[kvkk@karays.com]',
  destek: '[destek@karays.com]',
  kep: '[KEP adresi – varsa]',
  telefon: '[Telefon]',
} as const;
```
ve `KARAY_LEGAL`'e `cerez-politikasi`, `veri-isleme-sozlesmesi`, `saklama-imha`, `basvuru` belgelerini ekle (metinler §4).

**3.3 Yetki belgesi (B1) – görüntüleme**
```tsx
{s.real_estate_license_no && (
  <p className="text-[12.5px] text-muted-foreground">
    {s.license_business_name ?? s.legal_name ?? s.display_name} · Taşınmaz Ticareti Yetki Belgesi No:{' '}
    <span className="numeric">{s.real_estate_license_no}</span>
  </p>
)}
```
İlan detayı (`property-detail-view.tsx:111` ve `:240`), ilan kartı (`property-card.tsx`), footer (`site-footer.tsx:186`), paylaşılabilir ilan metni/WhatsApp mesajı ve OG görseli.

---

## 4. TASLAK METİNLER (avukat incelemesi için – hukuki tavsiye değildir)

> Tüm metinlerde: **"Bu metin taslaktır; hukuk danışmanı onayından sonra yayımlanacaktır."** ibaresi yayına kadar korunmalıdır. [Köşeli parantez] = doldurulacak bilgi.

### 4.A KARAYS Aydınlatma Metni (müşteri adayları, müşteriler ve panel kullanıcıları)

**KARAYS KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN AYDINLATMA METNİ**
Son güncelleme: [GG.AA.YYYY] · Sürüm: [1.0]

**1. Veri sorumlusu**
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, kişisel verileriniz veri sorumlusu sıfatıyla **[KARAYS ticaret unvanı]** ("KARAYS") tarafından aşağıda açıklanan kapsamda işlenmektedir.
MERSİS No: [ ] · Vergi Dairesi/No: [ ] · Adres: [ ] · E-posta: [kvkk@karays.com] · KEP: [ ] · Telefon: [ ]

**2. Bu metnin kapsamı**
Bu metin; (i) karays.com sitesindeki "Bilgi al / Demo talep et" formunu dolduran kişileri, (ii) KARAYS'tan hizmet alan emlak ofislerinin yetkilileri ve çalışanları ile panel kullanıcılarını, (iii) KARAYS ile e-posta, telefon veya WhatsApp üzerinden iletişime geçen kişileri kapsar.
Emlak ofislerinin web sitelerini ziyaret eden ve bu sitelerdeki formları dolduran kişilerin verileri bakımından **veri sorumlusu ilgili emlak ofisidir**; KARAYS bu verileri yalnızca ofis adına ve ofisin talimatıyla **veri işleyen** olarak işler. Bu kişiler için ilgili ofisin aydınlatma metni geçerlidir.

**3. İşlenen kişisel veri kategorileri**
- Kimlik: ad, soyad.
- İletişim: e-posta adresi, telefon numarası, şehir.
- Mesleki bilgi: emlak ofisinin adı, unvanı, görev/unvanınız.
- Talep/müşteri işlem: form mesajı, talep türü (bilgi/demo), görüşme notları, teklif ve abonelik bilgileri.
- Finans (yalnızca müşteriler): fatura bilgileri, vergi dairesi/numarası, ödeme kayıtları.
- İşlem güvenliği: IP adresinin geri döndürülemez özeti (hash), tarayıcı bilgisi, panel giriş kayıtları, iki adımlı doğrulama bilgisi, denetim (audit) kayıtları.
- Pazarlama (yalnızca onay vermeniz hâlinde): ürün güncellemesi iletileri tercihiniz.

**4. İşleme amaçları ve hukuki sebepler**
| Amaç | Hukuki sebep (KVKK md.5/2) |
|---|---|
| Bilgi/demo talebinize yanıt vermek, teklif hazırlamak | (c) Bir sözleşmenin kurulmasıyla doğrudan ilgili olması |
| Hizmet sözleşmesinin ifası, hesap açma, destek, faturalama | (c) Sözleşmenin ifası; (ç) Hukuki yükümlülük (VUK, TTK) |
| Panel güvenliği, yetkilendirme, denetim kayıtları, spam/kötüye kullanımın önlenmesi | (f) Meşru menfaat; (ç) Veri güvenliği yükümlülüğü (KVKK md.12) |
| Uyuşmazlıklarda delil olarak kullanma | (e) Bir hakkın tesisi, kullanılması veya korunması |
| Yetkili kurumların taleplerinin karşılanması, 5651 sayılı Kanun kapsamındaki trafik kayıtları | (a) Kanunlarda açıkça öngörülme; (ç) Hukuki yükümlülük |
| Ürün güncellemeleri ve kampanya iletileri | Ticari elektronik ileti mevzuatı (6563) kapsamında onayınız veya tacir/esnaf istisnası ve ret hakkınız; kişisel veriler bakımından [açık rıza / meşru menfaat – AVUKAT KARARI] |

**5. Toplama yöntemi**
Kişisel verileriniz karays.com'daki formlar, KARAYS paneli, e-posta, telefon ve WhatsApp aracılığıyla elektronik ortamda; sözleşme süreçlerinde yazılı olarak toplanır.

**6. Aktarım**
Kişisel verileriniz yukarıdaki amaçlarla sınırlı olarak:
- **Hizmet sağlayıcılarımıza (veri işleyenler):** veritabanı ve dosya depolama – Supabase Inc. (sunucu: AB/Almanya – Frankfurt); barındırma – Vercel Inc. (AB/Almanya – Frankfurt bölgesi); e-posta iletimi – Resend [şirket unvanı] (AB); hata izleme – Functional Software Inc. d/b/a Sentry (AB); yedekleme – Cloudflare Inc. R2 ([AB yargı alanı]); kurumsal e-posta – [Google LLC / alan adlı e-posta sağlayıcı] ([ABD/AB]);
- **Mali müşavir, avukat, bankalar/ödeme kuruluşları** (yalnızca müşteriler için);
- **Yetkili kamu kurum ve kuruluşlarına** (talep hâlinde, mevzuat gereği).

**Yurt dışına aktarım:** Yukarıdaki hizmet sağlayıcıların sunucuları Türkiye dışında bulunduğundan aktarım, KVKK md.9 ve Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik uyarınca **Kurul'ca ilan edilen standart sözleşmeler** imzalanarak ve imzadan itibaren 5 iş günü içinde Kurum'a bildirilerek gerçekleştirilir. [AVUKAT: sağlayıcı bazında imza durumu teyit edilmeden bu cümle yayımlanmamalı.]

**7. Saklama süresi**
- Yanıtlanan ve müşteriye dönüşmeyen talepler: son iletişimden itibaren **[2 yıl]**;
- Müşteri sözleşme ve fatura kayıtları: **10 yıl** (TTK md.82, VUK md.253);
- Panel giriş ve denetim kayıtları: **2 yıl**;
- 5651 kapsamındaki trafik kayıtları: **[1–2 yıl – AVUKAT]**;
- Spam olarak işaretlenen kayıtlar: **[90 gün]**.
Süre sonunda veriler silinir, yok edilir veya anonim hâle getirilir; periyodik imha **6 ayda bir** yapılır.

**8. Haklarınız (KVKK md.11)**
Kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse bilgi talep etme; işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; KVKK md.7 kapsamında silinmesini veya yok edilmesini isteme; bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme; münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme; kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.
Başvuru yolları için bkz. **"İlgili Kişi Başvuru Yolu"** (§4.G). Ticari elektronik iletileri, iletideki ret bağlantısından veya [destek@karays.com] adresinden ücretsiz olarak durdurabilirsiniz.

---

### 4.B KARAYS Gizlilik Politikası

**KARAYS GİZLİLİK POLİTİKASI**
Son güncelleme: [GG.AA.YYYY]

1. **Kapsam.** Bu politika, [KARAYS ticaret unvanı] ("KARAYS") tarafından işletilen karays.com sitesi ve KARAYS yönetim paneli için geçerlidir. KARAYS altyapısıyla yayımlanan emlak ofisi web sitelerinde, ilgili ofisin gizlilik politikası ve aydınlatma metni geçerlidir; bu sitelerde ofis veri sorumlusu, KARAYS veri işleyendir.
2. **Topladığımız bilgiler.** Formlarda kendi isteğinizle verdiğiniz bilgiler (ad soyad, e-posta, telefon, ofis adı, şehir, mesaj); müşterilerimiz için hesap, abonelik ve fatura bilgileri; güvenlik için gerekli teknik kayıtlar (IP adresinin geri döndürülemez özeti, tarayıcı bilgisi, giriş kayıtları). Ham IP adresini form kayıtlarında saklamayız.
3. **Kullanım amaçları.** Talebinize yanıt vermek, hizmeti sunmak ve geliştirmek, güvenliği sağlamak, yasal yükümlülükleri yerine getirmek. Ayrıntılar: [Aydınlatma Metni].
4. **Paylaşım.** Kişisel verilerinizi satmayız veya reklam amacıyla üçüncü kişilerle paylaşmayız. Yalnızca hizmeti sunmak için çalıştığımız alt hizmet sağlayıcılarla (Supabase – AB/Almanya; Vercel – AB/Almanya; Resend – AB; Sentry – AB; Cloudflare R2 – yedekleme; [e-posta sağlayıcı]) ve mevzuat gereği yetkili kurumlarla paylaşırız. Yurt dışı aktarım KVKK md.9'a uygun yapılır.
5. **Müşteri verileri (ofis verileri).** Emlak ofislerinin panelde tuttuğu müşteri, talep, randevu ve ilan verileri ofise aittir. KARAYS bu verileri yalnızca Veri İşleme Sözleşmesi çerçevesinde, ofisin talimatıyla ve hizmetin sunulması için işler; kendi amaçları için kullanmaz, pazarlamada kullanmaz ve satmaz.
6. **Güvenlik.** Şifreli bağlantı (HTTPS/TLS), veritabanında satır bazlı yetkilendirme (RLS), rol bazlı yetki, iki adımlı doğrulama seçeneği, erişim ve işlem denetim kayıtları, şifreli yedekleme, hata kayıtlarında kişisel verinin maskelenmesi.
7. **Çerezler.** Bkz. [Çerez Politikası].
8. **Saklama.** Bkz. [Saklama ve İmha Özeti].
9. **Haklarınız ve iletişim.** KVKK md.11 haklarınız için bkz. [İlgili Kişi Başvuru Yolu]. Sorularınız: [kvkk@karays.com].
10. **Değişiklikler.** Bu politika güncellenebilir; önemli değişiklikler sitede ve müşterilerimize e-posta ile duyurulur.

---

### 4.C KARAYS Çerez Politikası

**KARAYS ÇEREZ POLİTİKASI**
Son güncelleme: [GG.AA.YYYY]

Bu politika, karays.com ve KARAYS panelinde kullanılan çerezler ve benzeri teknolojiler (tarayıcı yerel depolaması) hakkında bilgi verir. KVKK'nın Çerez Uygulamaları Hakkında Rehberi dikkate alınarak hazırlanmıştır.

**1. Kullandığımız çerezler ve benzeri teknolojiler**
| Ad | Tür | Amaç | Süre | Taraf |
|---|---|---|---|---|
| [sb-…-auth-token] | Zorunlu (oturum) | Panel girişinin güvenli sürdürülmesi (yalnızca giriş yapan kullanıcılar) | Oturum / [ ] | Birinci taraf |
| [alan seçimi çerezi – `session.ts`'teki ad] | Zorunlu | Giriş yapılan alanın (KARAYS / ofis paneli) seçilmesi | [ ] | Birinci taraf |
| [CSRF / güvenlik] | Zorunlu | Güvenlik | Oturum | Birinci taraf |
| Vercel Speed Insights | Çerezsiz performans ölçümü | Sayfa hızının (LCP, INP, CLS) ölçülmesi; kimlik veya çerez kullanmaz | — | Vercel Inc. |
[Geliştirici: gerçek çerez adları ve süreleri canlı ortamda tarayıcı geliştirici araçlarıyla listelenip bu tabloya işlenmelidir.]

**2. Rıza**
Yukarıdaki zorunlu çerezler, talep ettiğiniz hizmetin (panel girişi, güvenlik) sunulması için gereklidir ve KVKK md.5/2-(c) ve (f) kapsamında açık rıza alınmadan kullanılır. karays.com'da **analitik, reklam veya pazarlama çerezi kullanılmamaktadır**; bu nedenle çerez onay bandı gösterilmez. Bu tür çerezler ileride kullanılırsa, yalnızca açık rızanız alındıktan sonra etkinleştirilecek; "Kabul et" ve "Reddet" seçenekleri eşit şekilde sunulacak ve tercihinizi her zaman değiştirebileceksiniz.

**3. Çerezleri yönetme**
Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz; zorunlu çerezleri engellerseniz panele giriş yapılamayabilir.

**4. İletişim**
[kvkk@karays.com] · Ayrıntılar için [Aydınlatma Metni].

---

### 4.D Kullanım Koşulları / Hizmet Sözleşmesi Özeti (KARAYS–Emlak Ofisi)

**KARAYS HİZMET SÖZLEŞMESİ – ÖZET VE TEMEL HÜKÜMLER**
> Bu özet, imzalanacak/elektronik ortamda kabul edilecek tam Hizmet Sözleşmesi'nin yerini tutmaz. Tam metin: [bağlantı]. Taslaktır.

1. **Taraflar.** [KARAYS ticaret unvanı], MERSİS [ ], adres [ ] ("KARAYS") ile hizmeti satın alan emlak işletmesi ("Müşteri"). Müşteri, sözleşmeyi **ticari/mesleki faaliyeti kapsamında** kurduğunu, tüketici sıfatı taşımadığını ve geçerli bir **Taşınmaz Ticareti Yetki Belgesi** (No: [ ]) bulunduğunu beyan eder. Bu nedenle 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uygulanmaz.
2. **Hizmet.** Barındırılan web sitesi (Müşterinin alan adında), ilan yönetimi, müşteri/talep (CRM) ve randevu modülleri, site düzenleyici, yedekleme ve teknik destek. Plan kapsamı ve limitler: [Fiyat/Plan sayfası].
3. **Süre ve ücret.** [Aylık/yıllık] abonelik; ücretler [KDV hariç/dahil] [ ] TL; faturalar [e-fatura/e-arşiv] olarak düzenlenir. Ödeme [ ] gün içinde. Gecikmede [ ] gün ihbar sonrası hizmet askıya alınabilir. Fiyat değişiklikleri en az [30] gün önceden bildirilir; Müşteri yeni dönem başlamadan fesih hakkına sahiptir.
4. **Müşterinin yükümlülükleri ve içerik sorumluluğu.** İlan ve site içeriğinin (fiyat, metrekare, imar, fotoğraf, telif) doğruluğu ve hukuka uygunluğu Müşteriye aittir. Müşteri; Taşınmaz Ticareti Hakkında Yönetmelik'e uygun olarak ilanlarında **yetki belgesi numarasını** ve iletişim bilgilerini göstermeyi, mülk sahibiyle **yazılı yetkilendirme sözleşmesi** yapmadan ilan yayımlamamayı, 6563 sayılı Kanun ve İYS kurallarına uymadan ticari ileti göndermemeyi, kendi sitesinin veri sorumlusu olarak KVKK yükümlülüklerini (aydınlatma metni, başvuruların yanıtlanması, VERBİS kaydı gerekiyorsa) yerine getirmeyi kabul eder.
5. **KARAYS'ın yer sağlayıcılığı (5651).** KARAYS, Müşteri içeriğini kontrol etmekle yükümlü değildir; hukuka aykırı içeriğin usulüne uygun bildirimi veya yetkili merci kararı hâlinde içeriği yayından kaldırabilir ve Müşteriyi bilgilendirir. Bildirimler: [hukuk@karays.com].
6. **Kişisel veriler.** Müşterinin site ve panel verileri bakımından Müşteri veri sorumlusu, KARAYS veri işleyendir; taraflar ilişkisi ekteki **Veri İşleme Sözleşmesi**'ne tabidir (§4.E).
7. **Hizmet seviyesi.** Hedef erişilebilirlik [%99,5/ay]; planlı bakım önceden duyurulur; günlük yedekleme, [ ] gün saklama.
8. **Fikri mülkiyet.** Yazılım, tema ve şablonlar KARAYS'a aittir; Müşteriye sözleşme süresince devredilemez, münhasır olmayan kullanım lisansı verilir. Müşteri içeriği Müşteriye aittir.
9. **Sorumluluğun sınırı.** KARAYS'ın sorumluluğu, kast ve ağır ihmal hâlleri hariç (TBK md.115), zarar tarihinden önceki [12] ayda ödenen ücret toplamı ile sınırlıdır; dolaylı zararlar (kâr kaybı vb.) kapsam dışıdır. [AVUKAT]
10. **Fesih ve veri iadesi.** Taraflar [30] gün önceden yazılı bildirimle feshedebilir. Fesih sonrası Müşteri **[30] gün** boyunca verilerini dışa aktarabilir (Ayarlar › Veri dışa aktarma); bu süre sonunda veriler ve yedekler en geç **[90] gün** içinde silinir (yasal saklama zorunluluğu olanlar hariç). Alan adı Müşteriye aittir ve devrine yardımcı olunur.
11. **Değişiklikler.** Sözleşmede Müşteri aleyhine değişiklikler, en az [30] gün önceden bildirilir ve Müşterinin açık kabulüne veya fesih hakkına bağlıdır (TBK md.24).
12. **Uygulanacak hukuk ve yetki.** Türk hukuku; [İL] mahkemeleri ve icra daireleri yetkilidir. Ticari uyuşmazlıklarda 6325 s. Kanun uyarınca dava şartı arabuluculuk uygulanır.
13. **Tebligat ve iletişim.** Taraflar sözleşmedeki e-posta/KEP adreslerine yapılan bildirimlerin geçerli olduğunu kabul eder.

---

### 4.E Veri İşleme Sözleşmesi (KARAYS–Ofis) Şablonu

**KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN VERİ İŞLEME SÖZLEŞMESİ**
(Hizmet Sözleşmesi'nin eki ve ayrılmaz parçasıdır – TASLAK)

**Madde 1 – Taraflar**
1.1 **Veri Sorumlusu:** [Ofis ticaret unvanı], MERSİS/VKN [ ], Yetki Belgesi No [ ], adres [ ], e-posta/KEP [ ] ("Ofis").
1.2 **Veri İşleyen:** [KARAYS ticaret unvanı], MERSİS [ ], adres [ ], e-posta/KEP [ ] ("KARAYS").

**Madde 2 – Konu ve süre**
KARAYS, Hizmet Sözleşmesi kapsamında Ofis adına ve Ofis'in talimatları doğrultusunda kişisel verileri işler. Bu sözleşme Hizmet Sözleşmesi süresince ve 10. maddedeki iade/silme yükümlülükleri tamamlanana kadar yürürlükte kalır.

**Madde 3 – İşlemenin niteliği**
| Unsur | Kapsam |
|---|---|
| İlgili kişi grupları | Ofis web sitesi ziyaretçileri ve form dolduranlar; Ofis'in müşterileri, alıcı/kiracı/mülk sahibi adayları; Ofis çalışanları ve panel kullanıcıları |
| Veri kategorileri | Kimlik (ad, soyad); iletişim (telefon, e-posta); talep/müşteri işlem (mesaj, ilgilenilen ilan, randevu, değerleme bilgileri, görüşme notları); işlem güvenliği (IP özeti, tarayıcı bilgisi, giriş/denetim kayıtları); gayrimenkul bilgileri (adres/konum, mülk özellikleri – mülk sahibine ilişkin olduğu ölçüde). **Özel nitelikli kişisel veri işlenmesi amaçlanmamaktadır;** Ofis, serbest metin alanlarına özel nitelikli veri girmemeyi taahhüt eder. |
| İşleme faaliyetleri | Kaydetme, depolama, barındırma, yedekleme, görüntüleme, e-posta bildirimi, dışa aktarma, silme |
| Amaç | Ofis'in web sitesinin ve panelinin (ilan, CRM, randevu) çalıştırılması; teknik destek; güvenlik |

**Madde 4 – KARAYS'ın yükümlülükleri**
4.1 Kişisel verileri yalnızca Ofis'in belgelenmiş talimatlarıyla (Hizmet Sözleşmesi, panel ayarları ve yazılı talimatlar) ve bu sözleşmedeki amaçlarla işler; kendi amaçları için kullanmaz, satmaz, pazarlamada kullanmaz. Talimatın mevzuata aykırı olduğunu düşünürse Ofis'i derhâl bilgilendirir.
4.2 Verilere erişen personelinin gizlilik yükümlülüğü altında olmasını sağlar; erişimi görev gereğiyle sınırlar ve kayıt altına alır.
4.3 KVKK md.12 ve Kurul'un Kişisel Veri Güvenliği Rehberi doğrultusunda **Ek-1**'deki teknik ve idari tedbirleri alır.
4.4 İlgili kişilerin KVKK md.11 başvurularının Ofis tarafından yanıtlanabilmesi için verilerin dışa aktarılması, düzeltilmesi ve silinmesi işlevlerini sağlar; KARAYS'a doğrudan gelen başvuruları **[3] iş günü** içinde Ofis'e iletir ve kendisi yanıtlamaz.
4.5 Kurul, yargı veya diğer yetkili mercilerden gelen talepleri, hukuken yasak olmadıkça, gecikmeksizin Ofis'e bildirir.

**Madde 5 – Alt veri işleyenler**
5.1 Ofis, **Ek-2**'deki alt veri işleyenlerin kullanılmasına onay verir.
5.2 KARAYS, yeni bir alt veri işleyen eklemeden veya değiştirmeden en az **[30] gün** önce Ofis'e e-posta/panel bildirimi yapar; Ofis bu süre içinde haklı gerekçeyle itiraz edebilir; uzlaşılamazsa Ofis sözleşmeyi cezasız feshedebilir.
5.3 KARAYS, alt veri işleyenlere bu sözleşmedekinden az koruyucu olmayan yükümlülükler yükler ve onların eylemlerinden Ofis'e karşı sorumludur.

**Madde 6 – Yurt dışına aktarım**
6.1 Ek-2'deki alt veri işleyenlerin sunucuları Türkiye dışında bulunduğundan, KARAYS bu aktarımları KVKK md.9 ve Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik uyarınca, Kurul'ca ilan edilen **standart sözleşmeyi (veri işleyenden veri işleyene modülü)** alt veri işleyenle imzalayarak ve imzadan itibaren **5 iş günü** içinde Kurum'a bildirerek gerçekleştirir. [AVUKAT: Ofis'in de VS→Vİ modülü kapsamında taraf/bildirim yükümlüsü olup olmadığı değerlendirilmelidir.]
6.2 KARAYS, Ofis'in talebi üzerine imzalı standart sözleşmelerin ve bildirimlerin kanıtını sunar.

**Madde 7 – Kişisel veri ihlali**
7.1 KARAYS, kendisinin veya alt veri işleyenlerinin sistemlerinde Ofis verilerini etkileyen bir ihlali öğrendiği andan itibaren **gecikmeksizin ve en geç 24 saat** içinde Ofis'e bildirir.
7.2 Bildirim, bilinen ölçüde: ihlalin niteliği ve zamanı, etkilenen veri kategorileri ve yaklaşık kişi sayısı, olası sonuçlar, alınan/önerilen tedbirler ve irtibat kişisini içerir; bilgiler kademeli olarak tamamlanabilir.
7.3 KARAYS, Ofis'in Kurul'a 72 saat içinde bildirim yapabilmesi ve ilgili kişileri bilgilendirebilmesi için gerekli desteği sağlar. Ofis adına Kurul'a bildirim yapmaz (Ofis yazılı olarak yetkilendirmedikçe).

**Madde 8 – Denetim**
Ofis, yılda en fazla bir kez, **[30]** gün önceden yazılı bildirimle, KARAYS'ın bu sözleşmeye uyumunu belge talebi veya makul kapsamlı denetimle kontrol edebilir. KARAYS öncelikle güncel güvenlik belgelerini ve alt işleyenlerin bağımsız denetim raporlarını (ör. SOC 2/ISO 27001) sunar.

**Madde 9 – Ofis'in yükümlülükleri**
Ofis; veri sorumlusu olarak aydınlatma yükümlülüğünü (site aydınlatma metni), gerekli hâllerde açık rızayı, VERBİS kaydını (muaf değilse), ilgili kişi başvurularının yanıtlanmasını ve ticari elektronik ileti mevzuatına uyumu sağlar; KARAYS'a hukuka aykırı talimat vermez.

**Madde 10 – Sözleşme sonu: iade ve silme**
Hizmet Sözleşmesi sona erdiğinde Ofis **[30]** gün boyunca verilerini dışa aktarabilir; ardından KARAYS canlı sistemdeki verileri **[30]** gün içinde, yedeklerdeki kopyaları yedek döngüsü sonunda ve en geç **[90]** gün içinde siler ve talep hâlinde silme beyanı verir. Mevzuattan doğan saklama yükümlülükleri saklıdır.

**Madde 11 – Sorumluluk**
Taraflar, KVKK md.12/2 uyarınca veri güvenliği tedbirlerinin alınmasında müteselsilen sorumlu olduklarını bilir. İç ilişkide, ihlale kendi kusuruyla sebep olan taraf diğer tarafın ödediği tazminat ve idari para cezası için rücu edilebilir. [AVUKAT: Hizmet Sözleşmesi'ndeki sorumluluk sınırı ile ilişkisi]

**Madde 12 – Öncelik**
Kişisel verilere ilişkin konularda bu sözleşme Hizmet Sözleşmesi'ne göre önceliklidir.

**Ek-1 – Teknik ve idari tedbirler (özet)**
- Aktarımda TLS şifreleme; depolamada sağlayıcı düzeyinde şifreleme; şifreli yedekler.
- Veritabanında satır bazlı yetkilendirme (RLS) ile ofisler arası mantıksal ayrım; rol ve yetki bazlı erişim; iki adımlı doğrulama seçeneği.
- Denetim kayıtları (2 yıl), kayıtlarda e-posta maskelenmesi; hata izleme kayıtlarında e-posta/telefon maskelenmesi.
- Form kayıtlarında ham IP yerine geri döndürülemez özet; hız sınırlama ve spam önleme.
- Günlük yedekleme, geri yükleme testleri ([docs/BACKUP_RESTORE.md]); en az ayrıcalık ilkesi; erişim yetkilerinin periyodik gözden geçirilmesi.
- Personel gizlilik taahhütnamesi ve KVKK farkındalık eğitimi; ihlal müdahale planı.

**Ek-2 – Alt veri işleyenler**
| Sağlayıcı | Hizmet | Konum | Aktarım dayanağı |
|---|---|---|---|
| Supabase Inc. | Veritabanı, kimlik doğrulama, dosya depolama | AB – Almanya (Frankfurt) | Standart sözleşme (Vİ-Vİ) + bildirim [durum] |
| Vercel Inc. | Barındırma, CDN, sunucu fonksiyonları | AB – Almanya (fra1); şirket ABD | Standart sözleşme [durum] |
| Resend [unvan] | Bildirim e-postası iletimi | AB | Standart sözleşme [durum] |
| Functional Software Inc. (Sentry) | Hata izleme (kişisel veri maskelenir) | AB | Standart sözleşme [durum] |
| Cloudflare Inc. | R2 yedek depolama | [AB yargı alanı] | Standart sözleşme [durum] |

---

### 4.F Kişisel Veri Saklama ve İmha Özeti (KARAYS)

**KARAYS KİŞİSEL VERİ SAKLAMA VE İMHA POLİTİKASI – ÖZET**
Dayanak: KVKK md.7; Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik (RG 28.10.2017/30224). KARAYS, VERBİS kayıt yükümlülüğünden [muaf / kayıtlı] olup bu politikayı iyi uygulama olarak benimser.

| Veri / Süreç | Saklama süresi | Başlangıç | İmha yöntemi |
|---|---|---|---|
| KARAYS demo/bilgi talepleri (müşteriye dönüşmeyen) | [2 yıl] | Son iletişim | Veritabanından silme |
| Spam/bot olarak işaretlenen talepler | [90 gün] | Kayıt | Silme |
| Müşteri (ofis) sözleşme, fatura, ödeme kayıtları | 10 yıl | Hesap döneminin sonu | Silme/anonimleştirme |
| Panel kullanıcı hesapları | Sözleşme süresi + [30 gün] | Fesih | Silme |
| Denetim (audit) kayıtları | 2 yıl | Kayıt | Silme |
| 5651 trafik kayıtları (yer sağlayıcı) | [1–2 yıl – AVUKAT] | Kayıt | Silme |
| Hata izleme (Sentry) kayıtları | [90 gün] (sağlayıcı ayarı) | Kayıt | Sağlayıcıda otomatik silme |
| Bildirim e-postası günlükleri (Resend) | [30 gün] (sağlayıcı ayarı) | Gönderim | Otomatik silme |
| Yedekler (Supabase + R2) | [30] gün döngü | Yedek tarihi | Döngüsel üzerine yazma/silme |
| **Ofis verileri (veri işleyen sıfatıyla)** | Ofis'in talimatı; sözleşme bitiminde 30 gün dışa aktarma + en geç 90 gün içinde silme | Fesih | Silme (yedekler dahil) |
| Destek e-postaları | [2 yıl] | Son yazışma | Silme |

- **Periyodik imha:** 6 ayda bir ([Ocak] ve [Temmuz]) otomatik iş ile; imha işlemleri kayıt altına alınır ve kayıtlar 3 yıl saklanır.
- **Talep üzerine silme:** İlgili kişi talebi en geç 30 gün içinde sonuçlandırılır.
- **Sorumlular:** [Görev/Unvan] – politika sahibi; [Görev] – teknik uygulama.
- **Ofisler için öneri (panelde varsayılan):** müşteriye dönüşmeyen talepler 2 yıl; sözleşmeye dönüşen işlemler ilgili belgeler için 10 yıl; ofis bu süreleri kendi politikasına göre ayarlayabilir.

---

### 4.G İlgili Kişi Başvuru Yolu

**KVKK KAPSAMINDA BAŞVURU**
Dayanak: KVKK md.11 ve 13; Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ (RG 10.03.2018/30356).

**Kime başvurmalısınız?**
- KARAYS sitesi, KARAYS'a ilettiğiniz talepler veya KARAYS müşterisi/kullanıcısı olmanızla ilgili verileriniz için → **KARAYS**.
- Bir emlak ofisinin web sitesinde doldurduğunuz form veya o ofisle ilişkiniz için → **ilgili emlak ofisi** (ofisin sitesindeki KVKK sayfasında iletişim bilgisi yer alır). KARAYS'a gönderilen bu tür başvurular 3 iş günü içinde ilgili ofise iletilir ve size bilgi verilir.

**Başvuru yöntemleri (KARAYS için)**
1. Islak imzalı dilekçe ile şahsen veya noter aracılığıyla: **[KARAYS açık adresi]**
2. Kayıtlı elektronik posta (KEP) ile: **[KEP adresi]**
3. Güvenli elektronik imza veya mobil imza ile imzalanmış e-posta ile: **[kvkk@karays.com]**
4. Daha önce KARAYS'a bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden: **[kvkk@karays.com]**

**Başvuruda bulunması gerekenler:** ad, soyad ve imza (yazılı başvuruda); T.C. kimlik numarası (yabancılar için uyruk ve pasaport/kimlik numarası); tebligata esas yerleşim yeri veya iş yeri adresi; varsa bildirime esas e-posta, telefon veya faks numarası; talep konusu. Konuya ilişkin belgeler eklenebilir.

**Yanıt süresi ve ücret:** Başvurunuz, niteliğine göre en kısa sürede ve **en geç 30 gün** içinde ücretsiz sonuçlandırılır. İşlemin ayrıca bir maliyet gerektirmesi hâlinde Kurul'ca belirlenen tarifedeki ücret alınabilir. Kimlik doğrulaması için ek bilgi isteyebiliriz.

**Kurul'a şikâyet:** Başvurunuzun reddedilmesi, verilen cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâllerinde, cevabı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz (KVKK md.14).

---

## 5. Sahipten istenecek bilgiler (kontrol listesi)

- [ ] KARAYS işletme türü: şahıs / Ltd. / A.Ş.
- [ ] Ticaret unvanı (sicildeki gibi), MERSİS no, ticaret sicil müdürlüğü ve no
- [ ] Vergi dairesi ve VKN (şahıs ise TCKN'ye bağlı VKN)
- [ ] Açık işletme adresi (merkez), telefon
- [ ] Alan adlı e-postalar: destek@, kvkk@, hukuk@ (Gmail yerine) ve varsa KEP adresi
- [ ] Çalışan sayısı ve son yıl mali bilanço toplamı (VERBİS muafiyeti teyidi)
- [ ] e-Fatura/e-Arşiv mükellefiyet durumu (mali müşavir)
- [ ] Abonelik satışı çevrim içi mi (kart ile), sözleşme imza ile mi? (6563 md.4-5 / ETBİS değerlendirmesi)
- [ ] KARAYS'ın ofislere pazarlama e-postası/SMS gönderip göndermeyeceği (İYS kaydı)
- [ ] Cloudflare R2 bucket'ının yargı alanı (EU jurisdiction) ve Resend bölgesi teyidi
- [ ] Her ofis için: yetki belgesi no, yetki belgesindeki işletme adı, MERSİS/VKN, oda sicil no

## 6. Avukata sorulacaklar

1. Yurt dışı alt işleyenler (Supabase, Vercel, Resend, Sentry, Cloudflare, Google) ile Türk standart sözleşmeleri: hangi modül, kim imzalar, sağlayıcı imzalamazsa seçenekler; ofis tarafında ayrıca bildirim gerekir mi?
2. KARAYS'ın 5651 kapsamında yer sağlayıcı bildirimi yükümlülüğü ve trafik bilgisi saklama süresi (Kanun 1–2 yıl / Yönetmelik 6 ay çelişkisi).
3. KARAYS'ın ofis siteleri için Taşınmaz Ticareti Yönetmeliği anlamında "ilan platformu/aracı hizmet sağlayıcı" sayılmadığının teyidi; EİDS yükümlülüğü.
4. Lead formunda ticari ileti için ayrı onay kutusu – tacir istisnası ile KVKK hukuki sebebinin (açık rıza mı meşru menfaat mi) birlikte değerlendirilmesi.
5. Vercel Speed Insights'ın rızasız yüklenmesi (çerezsiz, kişisel veri iddia edilmiyor) – Çerez Rehberi (Tem. 2025) ve 5809 md.51 açısından uygunluk.
6. Hizmet sözleşmesinde sorumluluk sınırı, fiyat değişikliği ve tek taraflı değişiklik hükümlerinin TBK md.20-25 açısından geçerliliği.
7. Saklama sürelerinin (2 yıl talep, 10 yıl ticari kayıt, 2 yıl denetim) onayı.

---

## 7. Kaynaklar

**Resmi kaynaklar (kvkk.gov.tr, ticaret.gov.tr, resmigazete.gov.tr)**
- KVKK – 6698 sayılı Kanun kapsamında idari para cezası tutarları (2017–2026 tablosu): https://www.kvkk.gov.tr/Icerik/8145/6698-sayili-kisisel-verilerin-korunmasi-kanunu-kapsaminda-idari-para-cezasi-tutarlari
- KVKK – Çerez Uygulamaları Hakkında Rehber (2022; güncel sürüm KVKK Yayınları No:69, Temmuz 2025): https://kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber
- KVKK – Standart Sözleşme Bildirim Modülü Hakkında Kamuoyu Duyurusu: https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu
- KVKK – Yurt Dışına Kişisel Veri Aktarımında Kullanılacak Standart Sözleşmelerde Dikkat Edilmesi Gereken Hususlar: https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu
- KVKK – Yurt Dışına Aktarım Yönetmelik Taslağı duyurusu: https://www.kvkk.gov.tr/Icerik/7906/Kisisel-Verilerin-Yurt-Disina-Aktarilmasina-Iliskin-Usul-ve-Esaslar-Hakkinda-Yonetmelik-Taslagi-Hakkinda-Kamuoyu-Duyurusu
- KVKK – Veri İhlali Bildirimi: https://www.kvkk.gov.tr/Icerik/5362/Veri-Ihlali-Bildirimi
- KVKK – Aydınlatma Yükümlülüğünün Yerine Getirilmesi Rehberi: https://www.kvkk.gov.tr/Icerik/5395/Aydinlatma-Yukumlulugunun-Yerine-Getirilmesi-Rehberi-Kurum-Internet-Sayfasinda-Yayinlanmistir-
- KVKK – Aydınlatma Yükümlülüğünün Yerine Getirilmesi Hakkında Kamuoyu Duyurusu: https://kvkk.gov.tr/Icerik/6765/AYDINLATMA-YUKUMLULUGUNUN-YERINE-GETIRILMESI-HAKKINDA-KAMUOYU-DUYURUSU
- KVKK – Silme, Yok Etme veya Anonim Hale Getirme Yönetmeliği: https://www.kvkk.gov.tr/Icerik/5441/KISISEL-VERILERIN-SILINMESI-YOK-EDILMESI-VEYA-ANONIM-HALE-GETIRILMESI-HAKKINDA-YONETMELIK
- KVKK – Kamuoyu Duyurusu (VERBİS 2025/1572): https://kvkk.gov.tr/Icerik/8388/KAMUOYU-DUYURUSU
- KVKK – Kurul Kararı 2022/1358: https://www.kvkk.gov.tr/Icerik/7595/2022-1358
- Resmî Gazete 10.03.2018 (Aydınlatma Tebliği ve Başvuru Tebliği, sayı 30356): https://resmigazete.gov.tr/eskiler/2018/03/20180310-5.htm
- Resmî Gazete 14.05.2024 (Taşınmaz Ticareti Hakkında Yönetmelikte Değişiklik): https://www.resmigazete.gov.tr/eskiler/2024/05/20240514-3.htm
- Ticaret Bakanlığı – EİDS Yetki Doğrulama Uygulaması hayata geçirildi: https://ticaret.gov.tr/kurumsal-haberler/elektronik-ilan-dogrulama-sistemi-eids-yetki-dogrulama-uygulamasi-hayata-gecirildi
- Ticaret Bakanlığı (Afyon İl Md.) – EİDS Nedir, Nasıl Kullanılır: https://afyon.ticaret.gov.tr/haberler/elektronik-ilan-dogrulama-sistemi-eids-nedir-nasil-kullanilir
- Ticaret Bakanlığı (Ordu İl Md.) – EİDS bilgilendirme PDF: https://ordu.ticaret.gov.tr/data/670e107b13b876dc68d93225/ELEKTRON%C4%B0K%20%C4%B0LAN%20DO%C4%9ERULAMA%20S%C4%B0STEM%C4%B0%20(E%C4%B0DS).pdf
- Ticaret Bakanlığı – Sektörel ticaret SSS (taşınmaz ticareti): https://ticaret.gov.tr/ic-ticaret/sikca-sorulan-sorular/sektorel-ticaret
- Ticaret Bakanlığı – MERSİS: https://ticaret.gov.tr/ic-ticaret/ticaret-sicili/merkezi-sicil-kayit-sistemi-mersis
- TTBS yetki belgesi sorgulama: https://ttbs.gtb.gov.tr/Home/BelgeSorgula
- Adalet Bakanlığı – 6563 sayılı Kanun PDF: https://mgm.adalet.gov.tr/Resimler/SayfaDokuman/251020191620586563%20Say%C4%B1l%C4%B1%20Elektr.%20Tic.%20Kanun.pdf

**İkincil kaynaklar (hukuk büroları, mevzuat siteleri – resmi metinle doğrulanmalı)**
- 2026 KVKK cezaları: https://cottgroup.com/tr/mevzuat/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari · https://www.kazimceylan.av.tr/kvkk-idari-para-cezasi-hesaplama · https://www.mondaq.com/turkey/data-protection/1729106/
- VERBİS istisnaları: https://www.erdem-erdem.av.tr/bilgi-bankasi/verbis-kayit-yukumlulugune-iliskin-yeni-istisnalarin-uygulama-esaslari-aciklandi · https://www.erdem-erdem.av.tr/bilgi-bankasi/verbis-kayit-yukumlulugune-iliskin-istisna-kriteri-degistirildi · https://www.mondaq.com/turkey/data-protection/1349972/
- Yurt dışı aktarım / 7499: https://www.erdem-erdem.av.tr/bilgi-bankasi/kisisel-verilerin-korunmasi-kanununda-neler-degisti · https://www.erdem-erdem.av.tr/bilgi-bankasi/kisisel-verilerin-yurt-disina-aktarilmasinda-yasanan-son-gelismeler · https://www.erdem-erdem.av.tr/bilgi-bankasi/yurt-disina-kisisel-veri-aktarimi-rehberi-neleri-duzenliyor · https://cottgroup.com/tr/blog/kvkk-gdpr/item/standart-sozlesme-bildirim-yukumlulugu-ve-yaptirimlari · https://cottgroup.com/tr/mevzuat/item/kisisel-verilerin-yurt-disina-aktarilmasina-iliskin-usul-ve-esaslar-hakkinda-yonetmelik
- Veri ihlali: https://cottgroup.com/tr/mevzuat/item/veri-sorumlulari-icin-kisisel-veri-ihlali-bildirim-proseduru · https://www.erdem-erdem.av.tr/bilgi-bankasi/kisisel-veri-ihlali-bildirimlerinin-ilan-suresine-iliskin-kamuoyu-duyurusu-yayimlandi
- Çerez Rehberi güncellemesi: https://www.erdem-erdem.av.tr/bilgi-bankasi/kisisel-verileri-koruma-kurumu-cerez-uygulamalari-hakkinda-rehberi-guncelledi · https://www.erdem-erdem.av.tr/bilgi-bankasi/kisisel-verilerin-korunmasi-bulteni-2025-3-ceyrek
- İYS / 6563: https://cottgroup.com/tr/mevzuat/item/ileti-yonetim-sistemi-ve-yeni-uygulamalar · https://hukukcularevi.com/ticari-elektronik-ileti-iys-izin-6563-reklam/ · https://www.lexpera.com.tr/mevzuat/yonetmelikler/elektronik-ticarette-hizmet-saglayici-ve-araci-hizmet-saglayicilar-hakkinda-yonetmelik
- 5651: https://www.erdem-erdem.av.tr/bilgi-bankasi/5651-sayili-kanun-kapsaminda-internet-aktorleri
- TTK 1524 / 39: https://www.erdem-erdem.av.tr/bilgi-bankasi/halka-acik-anonim-ortakliklarda-internet-sitesi · https://www.alomaliye.com/2014/01/09/yeni-ttk-belge-duzenini-nasil-degistiriyor/
- Taşınmaz ticareti / EİDS (haber): https://www.ntv.com.tr/ntvpara/galeri-emlakta-eids-donemi-basladi-10-soruda-dogrulanmis-ilan-uygulamasi,Y4faL59djUq_O7tFIFrhyA · https://www.dunya.com/ekonomi/tasinmaz-ticareti-yapanlar-icin-yetki-belgesi-zorunlu-olacak-haberi-424116 · https://www.paradergi.com.tr/sektorler/2025/04/03/satilik-isyerleri-icin-eids-zorunlulugu-basliyor · https://www.dukonim.com/bloglar/emlakcilar-kendi-internet-sitelerinde-ilan-yayinlayabilir-mi-2026
- e-Fatura eşikleri (ticari bloglar, GİB'den doğrulanmalı): https://www.parasut.com/blog/e-fatura-gecis-zorunlulugu-sartlari · https://faturaport.com/blog/e-fatura/1-temmuz-2026-e-fatura-zorunlulugu-gecis-limitleri

**Doğrulanamayan / çelişkili noktalar**
- EİDS kademeli zorunluluk tarihleri (kaynaklar arasında farklı); EİDS'nin yönetmelikteki dayanak değişikliğinin RG tarihi.
- Taşınmaz Ticareti Yönetmeliği'nin güncel konsolide metni ve ilan hükmünün madde numarası (mevzuat.gov.tr erişilemedi).
- Çerez Rehberi Temmuz 2025 sürümündeki "reddet butonu" ifadesinin birebir metni.
- 5651 yer sağlayıcı trafik kaydı süresi (Kanun: 1–2 yıl; 2007 Yönetmeliği: 6 ay) ve güncel ceza tutarları.
- e-Fatura/e-Arşiv 2026 eşikleri.
- Standart sözleşme bildirmeme cezası 2026 tutarı (yalnızca ikincil kaynak).
