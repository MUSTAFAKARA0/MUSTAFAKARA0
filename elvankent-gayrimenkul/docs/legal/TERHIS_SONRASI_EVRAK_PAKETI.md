# KARAYS · Terhis sonrası resmî evrak paketi (hazır dosya)

> 24.11.2026 · Hazırlayan: Claude (geliştirici). **Hukuki görüş değildir.** Kaynaklar ve doğrulama durumu:
> [HUKUK_UYUM_2026-11-22.md](HUKUK_UYUM_2026-11-22.md). Sahip kararı (23.11.2026): şirket, mali müşavir, ücretli plan ve gerçek
> ofisle sözleşme **terhise kadar bekler**. Bu dosya o gün sıfırdan başlanmasın diye hazırlandı; her adımın metni ve sırası burada.
>
> İşaretler: ✅ resmî kaynakla doğrulandı · ⚠️ ikincil kaynak / kısmen doğrulandı · ❓ doğrulanamadı (o gün yeniden bakılır).

## 0. Terhis günü sırası (tek bakışta)

| # | Adım | Kim | Süre | Bağlı olduğu |
|---|---|---|---|---|
| 1 | Mali müşavirle görüşme (§1 soruları) → şahıs işletmesi mi, şirket mi | Sahip | 1 gün | — |
| 2 | Vergi kaydı / şirket kuruluşu | Sahip + müşavir | 1–2 hafta | 1 |
| 3 | KEP adresi ve alan adlı e-posta (ör. `kvkk@karays.com`) | Sahip | 1 gün | 2 |
| 4 | Yasal metinlere şirket bilgileri (§6 tablosu) → yayın | Claude | 1 saat | 2, 3 |
| 5 | Sağlayıcılara KVKK standart sözleşme talebi (§2) | Sahip gönderir, metin hazır | 1 gün + yanıt süresi | 2 |
| 6 | İmzalanan her sözleşme için 5 iş günü içinde Kurul bildirimi (§3) | Sahip | Sözleşme başına 15 dk | 5 |
| 7 | VUK 595 için GİB'den özelge (§4) | Sahip / müşavir | Başvuru 1 saat | 2 |
| 8 | 5651 yer sağlayıcı değerlendirmesi ve gerekiyorsa bildirim (§5) | Sahip | 1 gün | 2 |
| 9 | Vercel Pro (~20 $/ay), harcama sınırı 20 $ | Sahip | 10 dk | 2 |
| 10 | Pilot sözleşmesi imzası → ilk ofis ([PILOT_SOZLESMESI_TASLAK.md](PILOT_SOZLESMESI_TASLAK.md)) | Sahip + ofis | 1 gün | 4, 5 |

**Görev süresince yapılmayanlar (bilinçli):** ücret almak, fatura kesmek, ticari sözleşme imzalamak, gerçek ofise pilot açmak.
Askerî personelin ticaret yasağının kapsamı için birliğin hukuk müşavirliğinden yazılı görüş alınması önerilir (ücretsiz).

## 1. Mali müşavire sorulacak sorular

1. Yazılım hizmeti (SaaS, aylık abonelik) için **şahıs işletmesi** mi, **limited şirket** mi uygun? Gelir beklentisi ilk yıl düşük.
2. **Genç girişimci kazanç istisnası** (GVK m.20) veya benzeri teşviklerden yararlanılabilir mi? Koşulları ve süresi? ❓
3. **Ücretsiz pilot** (bedelsiz hizmet) işe başlama sayılır mı; fatura veya KDV doğurur mu? ❓
4. **VUK Genel Tebliği Sıra No 595** (RG 05.09.2026) ✅: KARAYS'ın ofislerin kendi sitelerinde yayımlanan ilanları barındırması "ilan
   yayımlanmasına aracılık eden yer sağlayıcı" kapsamına girer mi? Girerse aylık bildirim nasıl yapılır? GİB'den özelge isteyelim mi?
5. Yurt dışı sağlayıcı faturaları (Vercel, Supabase) için **KDV sorumlu sıfatıyla beyan** (2 No.lu KDV) gerekir mi; gider yazılabilir mi?
6. Kart ile dolar ödemelerinde belge düzeni nasıl olmalı?

## 2. Sağlayıcılara KVKK standart sözleşme talebi

**Neden:** Verilerin sunucuları ve şirket merkezleri yurt dışında; Türkiye için yeterlilik kararı yok. KVKK m.9'a göre düzenli aktarım için
Kurul'un ilan ettiği **standart sözleşme** imzalanır ve imzadan itibaren **5 iş günü** içinde Kurul'a bildirilir ✅. AB SCC'si (sağlayıcıların
DPA'larındaki) KVKK standart sözleşmesinin yerini tutmaz ⚠️.

**Hangi modül:**
- **Modül 2** (veri sorumlusundan veri işleyene): KARAYS'ın **kendi** verileri (karays.com ziyaretçileri, ofis kullanıcı hesapları).
- **Modül 3** (veri işleyenden veri işleyene): **ofislerin** verileri (ofis sitelerinin ziyaretçi ve müşteri kayıtları); KARAYS veri işleyendir.

Metinler: https://www.kvkk.gov.tr/Icerik/7929/Standart-Sozlesmeler ✅ · İngilizce çeviri:
https://kvkk.gov.tr/Icerik/7998/Standart-Sozlesme-Metinlerinin-Ingilizce-Cevirisine-Iliskin-Duyuru ✅
Her iki tarafın **imza tarihi** sözleşmenin üzerinde yazılı olmalı (5 iş günü buna göre hesaplanır) ✅.

| Sağlayıcı | Ne için | Veri yeri | Modül | Talep tarihi | Yanıt | İmza | Bildirim |
|---|---|---|---|---|---|---|---|
| Supabase Inc. (ABD) | Veritabanı, giriş, dosyalar | AB-Almanya | 2 + 3 | | | | |
| Vercel Inc. (ABD) | Barındırma | AB + küresel CDN | 2 + 3 | | | | |
| Resend, Inc. (ABD) | Bildirim e-postası | Gönderim AB, kayıtlar ABD ✅ | 2 + 3 | | | | |
| Functional Software Inc. / Sentry (ABD) | Hata kaydı (kişisel veri maskeli) | [bölge seçimi kontrol edilecek] | 2 + 3 | | | | |
| Cloudflare Inc. (ABD) | Şifreli yedek (R2) | [AB] | 2 + 3 | | | | |

Gönderim yolu: her sağlayıcının **destek / gizlilik (privacy, DPA) talep formu** ya da hesap panelindeki destek kanalı. Adresler o gün
sağlayıcının kendi DPA sayfasından alınır (burada uydurma adres yazılmadı).

### E-posta şablonu (İngilizce)

> **Subject:** Request to execute the Turkish Standard Contractual Clauses (KVKK Art. 9) — [Account / Team ID]
>
> Hello,
>
> We are [KARAYS legal name], a company established in Türkiye, and we use [Provider] under account [ID] to host a SaaS product for
> real-estate offices. Under Article 9 of the Turkish Personal Data Protection Law No. 6698 (KVKK), transfers of personal data abroad
> without an adequacy decision require the **Standard Contractual Clauses published by the Turkish Personal Data Protection Board**
> to be signed by both parties and notified to the Authority within five business days of signature. EU SCCs do not substitute them.
>
> We kindly ask you to sign:
> - **Module 2** (controller to processor) for our own account and website data, and
> - **Module 3** (processor to processor) for data we process on behalf of our customers.
>
> The official English translation is available at https://kvkk.gov.tr/Icerik/7998/. We have pre-filled our details and Annex I
> (categories of data, purposes, retention, technical measures) and attach the documents. An electronic signature is acceptable;
> please make sure the **signature date** is written on the document.
>
> If you cannot sign, please let us know in writing, and whether you plan to offer the Turkish clauses in the future.
>
> Thank you,
> [Name, title] · [Company] · [KEP / e-mail]

**Ek I (her iki modül için ortak içerik):** veri kategorileri (kimlik, iletişim, talep/müşteri işlem, gayrimenkul, işlem güvenliği),
ilgili kişiler (site ziyaretçileri, form dolduranlar, ofis müşterileri ve çalışanları), amaç (hizmetin barındırılması, yedekleme,
e-posta bildirimi, hata takibi), saklama (sözleşme süresince; silme talebinde 30 gün), teknik tedbirler (TLS, şifreli depolama,
satır düzeyi erişim kuralları, iki adımlı giriş, şifreli yedek). Pilot sözleşmesi taslağının m.7 tablosuyla aynıdır.

**Sağlayıcı imzalamazsa:** yazışma saklanır. Seçenekler (sahip kararı): (a) o sağlayıcının yerine Türkiye'de barındırma (ücretli);
(b) aktarımın en aza indirilmesi (ör. Resend'e talep ayrıntısı gitmemesi: `NOTIFY_EMAIL_DETAILS=minimal`, varsayılan; Sentry'ye giden
hata raporlarında e-posta, telefon ve anahtar benzeri değerler maskelenir, `src/modules/monitoring/report.ts`);
(c) hukuki risk kabulünün pilot sözleşmesinde açıkça yazılması. Hangisinin yeterli olduğunu bu dosya söyleyemez.

## 3. Kurul'a bildirim (imzadan sonra 5 iş günü)

✅ Yollar: fiziki olarak, KEP ile veya KVKK **Standart Sözleşme Bildirim Modülü** üzerinden
(https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu).

Kontrol listesi (her sözleşme için):
- [ ] İki tarafın imza tarihi sözleşmede yazılı
- [ ] İmza tarihinden itibaren 5 iş günü hesaplandı (resmî tatiller hariç)
- [ ] Bildirim yapıldı; alındı/numara kaydedildi
- [ ] §2 tablosunda "İmza" ve "Bildirim" sütunları dolduruldu
- [ ] Claude'a tarih bildirildi → `legal.ts` aktarım cümlesine "[imza/bildirim tarihi]" işlenir

## 4. VUK 595 · GİB'den özelge

✅ Tebliğ: RG 05.09.2026, taşınmaz satış/kiralama ilanlarının yayımlanmasına aracılık eden yer sağlayıcılara aylık bildirim.
❓ KARAYS'ın kapsamı: ilanlar ofisin **kendi** sitesinde, ofisin **kendi** ilanı olarak yayımlanır; "aracılık" sayılıp sayılmadığı belirsiz.

**Özelge talebi için olay özeti (müşavir dilekçeye uyarlar):**
> KARAYS, emlak ofislerine kendi alan adlarında çalışan web sitesi ve müşteri yönetim yazılımı sunar (abonelik). İlanları ofis kendi
> panelinden girer; ilanlar yalnız ofisin kendi sitesinde yayımlanır. KARAYS'ın ortak bir ilan portalı, ilanları bir araya getiren
> arama sayfası veya ilan başına ücreti yoktur. Ofisler arasında ilan paylaşımı yoktur.
> **Soru:** KARAYS, 595 Sıra No.lu VUK Genel Tebliği kapsamında "ilanların yayımlanmasına aracılık eden yer sağlayıcı" sayılır mı?
> Sayılırsa bildirim hangi ofisler/ilanlar için, hangi dönemden itibaren yapılır?

Özelge yolu: GİB internet vergi dairesi ya da vergi dairesine dilekçe ⚠️ (o gün müşavirle teyit).

Kod tarafı: GİB bildirimi gerekirse ilan verisinden aylık dışa aktarım (CSV) hazırlanabilir (ücretsiz; o gün tebliğin istediği alanlara göre).

## 5. 5651 · Yer sağlayıcı

✅ Kanun m.5/3: yer sağlayıcı trafik bilgisini **1–2 yıl** (yönetmelikte belirlenen süre) saklar. ⚠️ Kanun metninde yer sağlayıcılık
bildirimi yapmayana idari para cezası var; tutarın güncelliği ❓. ❓ Bildirimin yeri/şekli (BTK, e-Devlet) yalnız forum kaynağıyla biliniyor.

O gün yapılacaklar:
1. BTK'nın resmî sayfasından bildirim usulü okunur (Claude araştırır, kaynak verir).
2. Gerekiyorsa bildirim yapılır (ücret ❓).
3. **Trafik kaydı:** Vercel ve Supabase günlükleri kısa süreli. Gerekiyorsa en az **1 yıl** saklanacak ayrı arşiv (IP, zaman, istenen
   adres, alan adı) kurulur (Cloudflare R2 ücretsiz katmanı; kotası o gün doğrulanır). Kurulursa KVKK aydınlatmasına
   "5651 trafik kaydı – hukuki yükümlülük – 1 yıl" eklenir.
4. Künye sayfasına 5651 m.3 tanıtıcı bilgileri (şirket bilgileriyle birlikte, §6).

**BTK'ya yazılı soru (gerekirse):**
> Emlak ofislerine kendi alan adlarında çalışan web sitesi yazılımı sunan ve ofislerin içeriğini barındıran KARAYS, 5651 sayılı Kanun
> kapsamında yer sağlayıcı bildirimi yapmakla yükümlü müdür? Yükümlüyse bildirim hangi kanaldan yapılır ve trafik bilgisinin saklama
> süresi ve kapsamı nedir?

## 6. Yasal metinlere girilecek bilgiler (tek yerden: `KARAYS_COMPANY`, `src/modules/karay/legal.ts`)

| Alan | Bugünkü yer tutucu | Doldurulacak değer | Not |
|---|---|---|---|
| unvan | `[KARAYS ticaret unvanı]` | | Şahıs işletmesinde ad soyad + işletme adı |
| mersis | `[MERSİS no – …]` | | Ticaret siciline kayıtlı değilse alan kaldırılır |
| vergi | `[vergi dairesi ve vergi kimlik no]` | | |
| adres | `[açık adres]`, `[il]` | | Tebligat adresi |
| kep | `[KEP adresi]` | | KVKK başvuru kanalı |
| telefon | `[telefon]` | | |
| aktarım durumu | `[imza/bildirim tarihi veya "süreç devam ediyor"]` | | §2 tablosundan |
| süreler | `[30 gün]`, `[90 gün]`, `[2 yıl]`, `[12]` | | Mevcut değerler öneri; değiştirilmezse kalır |
| ücret | `[● TL]` | | Fiyat kararı (D kararları) |

Doldurulunca: sayfadaki "taslak" işareti kalkar, arama motorlarına açılır (Claude yapar; ayrı onayla yayına alınır).

## 7. Şimdiden (görev süresince) yapılabilecek ücretsiz ve ticari olmayan işler

- KVKK standart sözleşme metinlerini **doldurulmuş taslak** olarak hazır tutmak (Claude; şirket bilgisi gelince tamamlanır).
- Sağlayıcıların bölge ayarlarının kontrolü (Sentry veri bölgesi, Cloudflare R2 konumu) — yalnız okuma.
- Kişisel veri azaltma: `NOTIFY_EMAIL_DETAILS` tanımlı değilse `minimal` (kodda varsayılan); hata raporları maskelenir (kodda mevcut).
