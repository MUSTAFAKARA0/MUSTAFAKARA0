# KARAY — Faz 2: Karar kaydı (Decision Register)

> **Tarih:** 11.10.2026 · **Denetlenen commit:** `6055693` · **Tür:** denetim ve plan; kod değişikliği yok.
> **Eş belge:** [PHASE2_PRODUCTION_PREFLIGHT.md](PHASE2_PRODUCTION_PREFLIGHT.md) — teknik bulgular (`PF`, `SEC`, `OPS`), preflight akışı ve hazırlık sonucu.
>
> **Bu belge karar vermez; seçenekleri ve önerileri sunar.** "Önerilen seçenek" bir öneridir, kesinleşmiş değildir.
>
> **Fiyat, komisyon veya ücret yazılmadı.**
>
> **Dış kaynaklar:** Sağlayıcı ve mevzuat bilgileri 11.10.2026'da resmi kaynaklardan okundu ve her maddede bağlantısı var. Bunlar değişebilir. Sağlayıcıdan **yazılı teyit** alınmadan sözleşmeye dayanak yapılmamalı. Hukuki ve vergisel konularda belge yalnızca soruları ve çerçeveyi verir; son söz hukukçu ve mali müşavirindir.

## 0. Senden beklenen kararlar (önem sırasıyla, en fazla 8)

1. **D-16 — Güvenlik güncellemesine onay.**
   - Durum: `sharp` ve `next` açıkları KARAY'ın yükleme yolunda erişilebilir; CI bu yüzden kırmızı.
   - Gereken: sonraki fazın ilk işi olarak yalnız bağımlılık güncellemesi.
2. **D-11 — Altyapı planları ve bütçe.**
   - Vercel Pro; Supabase ücretli plan (yedekler).
   - Yedek kovası; yedeğin açılması.
3. **D-13 + D-14 — Alan adı ve dal/yayın stratejisi.**
   - Alan adları: `KARAY_HOSTS`, `PLATFORM_ROOT_DOMAIN`, DNS'in yeri.
   - Dal/yayın: korumalı `main`; Vercel production dalı.
4. **D-01 + D-02 + D-03 — Plan kapsamı, fiyat modeli, deneme süresi.**
   - Rakamlar senin.
5. **D-07 + D-08 — Faturalama ve ilk müşterilerde tahsilat.**
   - Tüzel kişilik ve e-Arşiv/e-Fatura yolu.
   - Havale/EFT mi, sağlayıcı mı?
6. **D-10 — KVKK rolleri, sözleşmeler, yurt dışı aktarım.**
   - Hukukçu; hizmet sözleşmesi ve veri işleme sözleşmesi.
   - Standart sözleşme bildirimi.
7. **D-12 — Depo görünürlüğü.**
   - Profil deposu public; KARAY'ı ayrı private depoya taşımak önerilir.
8. **D-05 + D-04 — İptal / süre bitimi ve ödeme gecikmesi.**
   - Kod boşluğu var; geçici işletim kuralı hemen geçerli.

## 1. Özet tablo

| ID | Karar | Öncelik | Ne zaman gerekli | Bağlı bulgular | Durum |
| --- | --- | --- | --- | --- | --- |
| D-01 | Plan yapısı ve kapsamı | P0 | İlk teklif | — | Bekliyor |
| D-02 | Fiyatlandırma modeli | P0 | İlk teklif | D-01 | Bekliyor |
| D-03 | Deneme süresi | P0 | İlk müşteri kaydı | D-01 | Bekliyor |
| D-04 | Başarısız ödeme, ek süre, askı | P1 | İlk geciken ödeme | D-08 | Bekliyor |
| D-05 | İptal ve süre bitimi (veri saklama dahil) | P1 | İlk iptal (geçici kural hemen) | OPS-02 | Bekliyor |
| D-06 | Yükseltme / düşürme | P1 | İlk plan değişikliği | D-01 | Bekliyor |
| D-07 | Faturalama ve e-belge | P0 | İlk fatura | OPS-03 | Bekliyor |
| D-08 | Tahsilat yöntemi ve ödeme sağlayıcısı | P0 (ilk müşterilerde yöntem) / P2 (sağlayıcı) | İlk tahsilat | D-07 | Bekliyor |
| D-09 | Webhook güvenliği ilkeleri | P2 | Ödeme entegrasyonundan önce | D-08 | Bekliyor |
| D-10 | KVKK rolleri, sözleşmeler, yurt dışı aktarım | P0 | İlk müşteri sözleşmesi | PF-09 | Bekliyor |
| D-11 | Altyapı planları ve bütçe | P0 | Production açılışı | PF-02, PF-03, PF-06 | Bekliyor |
| D-12 | Depo görünürlüğü | P1 | İlk ücretli müşteri | SEC-01, SEC-03 | Bekliyor |
| D-13 | Alan adı stratejisi | P0 | Production açılışı | PF-05, PF-06 | Bekliyor |
| D-14 | Dal ve yayın stratejisi | P0 | Production açılışı | PF-04, PF-11 | Bekliyor |
| D-15 | Güvenlik başlıkları ve görüntü yüzeyi (CSP, HSTS, SVG) | P1 | Sonraki faz | SEC-02, PF-10, SEC-06 | Bekliyor |
| D-16 | Güvenlik güncellemesine onay | P0 | Hemen | PF-01 | Bekliyor |
| D-17 | İlk müşterilerde elle işletim ve otomasyon eşiği | P1 | İlk müşteri | OPS-03 | Bekliyor |
| D-18 | Olay/destek sorumlusu ve hizmet taahhüdü | P1 | İlk müşteri | PF-07, PF-12, OPS-04, SEC-04 | Bekliyor |

Öncelik ölçeği eş belgedekiyle aynı:

| Öncelik | Ne zaman |
| --- | --- |
| **P0** | İlk ücretli müşteri veya production açılışından önce. |
| **P1** | İlk müşteriyle birlikte veya ilk 30 gün içinde. |
| **P2** | Müşteri sayısı artmadan veya otomatik tahsilattan önce. |
| **P3** | İyileştirme. |

Karar verildikçe ilgili maddeye **"Karar: … (tarih)"** satırı eklenir ve tablodaki durum güncellenir.

---

## 2. Ticari kararlar

### D-01 · Plan yapısı ve kapsamı

- **ID:** D-01
- **Mevcut durum:** Üç plan var.

  | Plan | Kullanıcı | İlan | Depolama | Analitik | CRM | PDF | Özel alan adı |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | `baslangic` | 3 | 50 | 2 GB | var | yok | yok | yok |
  | `profesyonel` | 10 | 300 | 10 GB | var | var | var | yok |
  | `kurumsal` | sınırsız | sınırsız | 50 GB | var | var | var | var |

  KARAY, ofis bazında bayrağı plandan bağımsız olarak açıp kapatabilir (`feature_overrides`).
- **Kanıt:** `plans` tablosu; [BILLING_ARCHITECTURE.md](BILLING_ARCHITECTURE.md) satır 11; `org_plan()` içindeki override (`20260930000002_site_builder.sql:158-161`).
- **Risk:**
  - Kapsam pazarla uyuşmazsa satış zorlaşır. Örneğin özel alan adı yalnız Kurumsal'da; oysa emlak ofislerinin çoğu kendi alan adını ister.
  - Limitler maliyetle uyumsuzsa (özellikle depolama) zarar oluşur.
- **Öncelik:** P0
- **Benim vermem gereken karar:**
  - Plan sayısı ve adları.
  - Her planın limitleri.
  - Özel alan adının ve CRM'in hangi planlarda olacağı.
- **Seçenekler:**
  - **A. Mevcut 3 plan.**
    - Artı: kod/migration gerekmez.
    - Eksi: özel alan adı yalnız en üst planda.
  - **B. İki plan (Standart + Kurumsal).**
    - Artı: satış ve elle faturalama basit.
    - Eksi: küçük ofis için giriş fiyatı yükselebilir.
  - **C. Tek plan + eklentiler** (alan adı, ek kullanıcı).
    - Artı: esnek.
    - Eksi: elle faturalamada karmaşık; kodda eklenti kavramı yok.
- **Önerilen seçenek:** İlk müşterilerde **A**. İstisna gerekirse (ör. Profesyonel'de özel alan adı) ofis bazında bayrak kullanılır; kod değişmez. Kalıcı değişiklik ilk 3–5 müşteriden sonra veriye göre yapılır.
- **Bağımlılıklar:** D-02, D-06.
- **Tamamlanma ölçütü:**
  - Plan tablosu (ad, limit, özellik) onaylandı.
  - Değişiklik varsa `plans` satırları migration ile güncellendi.
  - Teklif metni ve KARAY sayfası aynı tabloyu kullanıyor.

### D-02 · Fiyatlandırma modeli (rakam yok)

- **ID:** D-02
- **Mevcut durum:**
  - `plans.price_monthly` üç planda da boş; para birimi alanı TRY.
  - Yıllık fiyat, KDV durumu ve kurulum ücreti için alan yok.
  - KARAY sayfası fiyat göstermiyor. SSS'deki "Fiyatlandırma nasıl?" sorusunun cevabı: "Ofisinizin ihtiyaçlarına göre bilgi veriyoruz. "Bilgi al" formunu doldurmanız yeterli."
- **Kanıt:** `plans` sütunları (`price_monthly numeric`, `currency`); `src/app/karay/page.tsx:80`.
- **Risk:**
  - Teklifler arasında tutarsızlık.
  - TL fiyatlarda güncelleme kuralı yoksa uzun süreli sözleşmede değer kaybı.
- **Öncelik:** P0
- **Benim vermem gereken karar:**
  - Aylık mı, yıllık mı, ikisi birden mi (yıllıkta indirim var mı)?
  - KDV dahil mi, hariç mi gösterilecek?
  - Kurulum ücreti olacak mı?
  - Fiyatlar sitede açık mı olacak, teklif usulü mü?
  - Fiyat güncelleme dönemi ve mevcut müşterilere yansıtma kuralı.
  - Erken müşteri koşulu olacak mı?
  - **Rakamlar.**
- **Seçenekler:**
  - **A. Sitede açık liste fiyatı.**
    - Artı: güven, hızlı satış.
    - Eksi: pazarlık esnekliği azalır; TL güncellemesi herkese görünür.
  - **B. Teklif usulü.**
    - Artı: esneklik; ilk müşterilerden öğrenme.
    - Eksi: satış döngüsü uzar; tutarlılık riski.
  - **C. Kurulum ücreti + aylık ücret.**
    - Artı: kurulum emeği karşılanır.
    - Eksi: giriş bariyeri.
- **Önerilen seçenek (yapı, rakam değil):**
  - İlk müşterilerde **B**: sitede "Bilgi al" kalır.
  - Sözleşmede KDV hariç tutar ve yılda bir güncelleme maddesi.
  - Aylık ve yıllık ödeme seçeneği.
  - `price_monthly` ancak liste fiyatı kesinleşince doldurulur.
- **Bağımlılıklar:** D-01, D-07 (KDV/fatura), D-08.
- **Tamamlanma ölçütü:**
  - Fiyat tablosu (plan × dönem, KDV durumu, güncelleme kuralı) yazılı ve onaylı.
  - Teklif şablonu hazır.
  - A seçilirse `price_monthly` dolduruldu ve KARAY sayfası güncellendi.

### D-03 · Deneme süresi

- **ID:** D-03
- **Mevcut durum:**
  - Yeni organizasyonun aboneliği `trialing` başlar; bitiş 14 gün sonra.
  - Bu süre **üç veritabanı fonksiyonunda sabit** yazılı.
  - Deneme bitince otomatik işlem yok. Müşteri listesinde yalnızca "Deneme süresi bitti" uyarısı (Dikkat) çıkar.
  - Site taslak başlar ve yayına almayı KARAY yapar.
  - Plan yeniden `trialing` olarak atanırsa 14 gün baştan başlar; bu, elle uzatma demektir.
- **Kanıt:** `20260926000007_v2_security.sql:1161,1186`; `20261008000001_owner_invitations.sql:149`; FAZ 1 müşteri durumu.
- **Risk:**
  - 14 gün, bir ofisin kurulumu ve ilan girişi için kısa kalabilir.
  - Deneme sonunda ne olacağı belirsiz.
- **Öncelik:** P0
- **Benim vermem gereken karar:**
  - Deneme olacak mı; süresi ne?
  - Deneme sırasında site yayına alınabilir mi?
  - Bitince ne olacak: KARAY'ın araması → aktif mi, askı mı?
- **Seçenekler:**
  - **A. 14 gün** (mevcut; kod değişmez).
  - **B. 30 gün** (üç fonksiyonda küçük migration ya da elle uzatma).
  - **C. Deneme yok;** ücretli kurulum + belirli süre iade güvencesi.
  - **D. Deneme yok;** ilk ay indirimli.
- **Önerilen seçenek:**
  - Kodda **A** kalsın.
  - Gerekirse KARAY elle uzatsın.
  - Deneme bitiminde telefonla karar verilsin; otomatik askı olmasın.
  - Deneme sırasında site yayına alınmasın (taslak + önizleme).
- **Bağımlılıklar:** D-01, D-04.
- **Tamamlanma ölçütü:**
  - Deneme politikası yazılı ve teklif/sözleşmede yer alıyor.
  - Süre değişecekse migration yapıldı.
  - Bitişte yapılacaklar operasyon belgesinde.

### D-04 · Başarısız ödeme, ek süre ve askı

- **ID:** D-04
- **Mevcut durum:**
  - `past_due` durumu var, ama otomatik geçiş yok.
  - Askı (`suspended`) elle yapılır ve **serttir**: site **404**, panel kapalı, veri korunur.
  - Ayrıca site durumu olarak **Bakım modu** var: ziyaretçiye kısa bilgi sayfası gösterilir, panel çalışır.
- **Kanıt:** [BILLING_ARCHITECTURE.md](BILLING_ARCHITECTURE.md) satır 15-16 ve 43-45; [operations/customer-handoff.md](operations/customer-handoff.md) "Geri alma".
- **Risk:**
  - Erken askı: müşteri kaybı ve arama motoru kaybı (404).
  - Geç askı: tahsilatsız hizmet.
- **Öncelik:** P1
- **Benim vermem gereken karar:**
  - Ek süre kaç gün?
  - Hatırlatma takvimi nasıl?
  - Ek süre sonunda önce bakım modu mu, doğrudan askı mı?
  - Askıdan dönüşte ek ücret olacak mı?
- **Seçenekler:**
  - **A. Vade + N gün → bakım modu → M gün → askı.** Kademeli; kod gerekmez.
  - **B. Vade + N gün → askı.** Basit ama sert.
  - **C. Askı yok, yalnızca panel kısıtlaması.** Kod gerektirir; ilk aşamada önerilmez.
- **Önerilen seçenek:** **A**, elle uygulanır.
  1. Hatırlatma.
  2. Durum `past_due` yapılır ve KARAY notuna yazılır.
  3. Ek süre sonunda site bakım moduna alınır.
  4. İkinci ek süre sonunda askı.

  N ve M senin kararın.
- **Bağımlılıklar:**
  - D-08: otomatik tahsilatta sağlayıcının yeniden deneme takvimi bu politikayla uyumlu olmalı.
  - D-05.
- **Tamamlanma ölçütü:**
  - Politika yazılı ve müşteri sözleşmesinde yer alıyor.
  - Adımlar operasyon belgesinde.

### D-05 · İptal ve süre bitimi (veri saklama ve dışa aktarma dahil)

- **ID:** D-05
- **Mevcut durum:**
  - **Kod boşluğu:** Abonelik `cancelled` veya `expired` olunca:
    - kullanıcı, ilan ve depolama limitleri **kalkar** (sınırsız);
    - CRM, analitik, PDF ve özel alan adı yönetimi kapanır;
    - site açık kalır.
  - Yerelde doğrulandı: PF belgesi OPS-02.
  - Ofis panelinden ilan, müşteri ve talep dışa aktarımı var (`/api/admin/export/[entity]`). Görseller bu dışa aktarıma dahil değil.
  - Organizasyon silinebilir; KVKK silme talebi için tasarlandı.
- **Kanıt:**
  - `20260930000002_site_builder.sql:166`; `20260926000007_v2_security.sql:1011`.
  - `src/app/api/admin/export/[entity]/route.ts:16,175`.
  - `20260927000001_v2_platform_fixes.sql:95`.
- **Risk:**
  - İptal eden müşteri sınırsız kaynak kullanabilir.
  - Veri saklama süresi belirsiz kalırsa KVKK ve sözleşme riski.
- **Öncelik:** P1. Geçici kural hemen geçerli.
- **Benim vermem gereken karar:**
  - İptal hemen mi, dönem sonunda mı geçerli?
  - İptal sonrası veri kaç gün saklanır?
  - Dışa aktarma nasıl teslim edilir (görseller dahil mi)?
  - Saklama süresi sonunda veri silinir mi?
  - Müşterinin alan adı yönlendirmesi ne olur?
- **Seçenekler:**
  - **A. Dönem sonunda iptal → X gün askı (salt koruma) → silme.**
  - **B. Hemen askı → X gün → silme.**
  - **C. Süresiz saklama.** KVKK açısından önerilmez.
- **Önerilen seçenek:**
  - **A**, ve iptal öncesinde dışa aktarma teslimi.
  - **Geçici kural (kod düzeltilene kadar):** Konsolda abonelik "iptal/sona erdi" **yapılmaz**. Ayrılan müşterinin organizasyonu **askıya alınır** ve planı aktif bırakılır.
  - Kalıcı düzeltme sonraki fazda: aboneliği olmayan ofiste yeni kayıt ve yükleme reddedilir.
- **Bağımlılıklar:** D-10 (saklama süresi), D-04, OPS-02.
- **Tamamlanma ölçütü:**
  - Politika sözleşmede ve operasyon belgesinde.
  - Kalıcı düzeltme yapıldı ve RLS testi geçiyor: iptal edilen ofiste yeni ilan, üye ve yükleme reddediliyor.

### D-06 · Yükseltme / düşürme

- **ID:** D-06
- **Mevcut durum:**
  - Konsolda plan değiştirmek, mevcut aboneliği kapatıp yenisini açmak demek; geçmiş korunur.
  - Kıst (proration) yok.
  - Düşürmede limit üstü veri korunur, yeni ekleme reddedilir.
  - Özel alan adı bayrağı kalkarsa aktif alan adı çalışmaya devam eder; otomatik kaldırma yok.
- **Kanıt:** [BILLING_ARCHITECTURE.md](BILLING_ARCHITECTURE.md) satır 13 ve 19-21.
- **Risk:**
  - Düşüren müşteri üst planın özel alan adını fiilen kullanmaya devam eder.
  - Fark ücreti belirsiz kalır.
- **Öncelik:** P1
- **Benim vermem gereken karar:**
  - Değişiklik hemen mi, dönem sonunda mı geçerli?
  - Fark ücreti nasıl hesaplanır?
  - Düşürmede özel alan adı ve limit üstü veri ne olur?
- **Önerilen seçenek:**
  - Yükseltme hemen geçerli; fark bir sonraki faturada.
  - Düşürme dönem sonunda geçerli.
  - Düşürmede özel alan adı için uyarı + KARAY onayı (BILLING_ARCHITECTURE önerisi).
  - Limit üstü veri silinmez.
  - Kod gerekmez; elle yapılır.
- **Bağımlılıklar:** D-01, D-02, D-07.
- **Tamamlanma ölçütü:** Kurallar sözleşmede ve operasyon belgesinde.

### D-07 · Faturalama ve e-belge

- **ID:** D-07
- **Mevcut durum:**
  - Sistemde fatura yok; yalnızca tasarım belgesi var.
  - İlk müşteriler elle faturalanacak.
- **Kanıt:**
  - [BILLING_ARCHITECTURE.md](BILLING_ARCHITECTURE.md) §1 ve §3 ("Fatura" satırı).
  - GİB e-Arşiv: 509 Sıra No.lu VUK Genel Tebliği kapsamında e-Arşiv uygulamasına dahil olanlar ve internetten satış yapanlar için düzenleme ve zorunlu içerik kuralları var. Düzenleme GİB portalından veya özel entegratör üzerinden yapılır. Eşikler değişebildiği için mali müşavirle teyit edilmeli ([GİB e-Arşiv](https://ebelge.gib.gov.tr/earsivhakkinda.html)).
  - Alıcı e-Fatura kayıtlı kullanıcısıysa e-Arşiv yerine e-Fatura düzenlenir. KARAY'ın müşterileri şirket olduğundan bu sık görülebilir; mali müşavirle teyit edilmeli.
- **Risk:** Yanlış belge türü veya eksik içerik: vergi cezası, müşteri tarafında gider kaydı sorunu.
- **Öncelik:** P0
- **Benim vermem gereken karar:**
  - Faturayı kesecek tüzel kişilik (şahıs şirketi / ltd. / a.ş.).
  - Mali müşavir.
  - e-Fatura/e-Arşiv yolu: GİB portalı mı, özel entegratör mü?
  - Fatura dönemi ve vadesi.
  - KDV oranı ve gösterimi (mali müşavirle).
- **Önerilen seçenek:**
  - İlk müşterilerde faturayı mali müşavirin veya entegratörün portalından **elle** kes.
  - Fatura no, tarih ve tutarı KARAY notlarına yaz.
  - Entegratör API'si billing fazında değerlendirilir.
  - Kod yok.
- **Bağımlılıklar:** Şirket kuruluşu ve vergi kaydı; D-02; D-08.
- **Tamamlanma ölçütü:**
  - Tüzel kişilik ve vergi bilgileri net.
  - Süreç mali müşavirle onaylandı.
  - İlk fatura kesildi ve notta kayıtlı.
  - Fatura bilgileri sözleşmede.

### D-08 · Tahsilat yöntemi ve ödeme sağlayıcısı

- **ID:** D-08
- **Mevcut durum:**
  - Ödeme entegrasyonu yok; bu fazda da yazılmadı.
  - Seçim kriterleri [BILLING_ARCHITECTURE.md](BILLING_ARCHITECTURE.md) §3'te.
- **Kanıt:** Aşağıdaki tablo resmi belgelerden derlendi. Ücret ve oran **yazılmadı**; her sağlayıcıdan teklif alınmalı.

  | Seçenek | Belgede görülen | Dikkat | Kaynak |
  | --- | --- | --- | --- |
  | Havale/EFT + elle fatura | Entegrasyon yok | Takip elle yapılır; ölçeklenmez | — |
  | iyzico Abonelik | Ödeme planlarında günlük, haftalık, aylık ve yıllık aralık; `trialPeriodDays` (deneme); plan yükseltme; her yinelenen ödemede webhook | Belgedeki ücret bilgisi güncel olmayabilir. Webhook imzası (V3) iyzico'ya talep iletilerek açılır | [Abonelik](https://docs.iyzico.com/en/products/subscription), [Webhook](https://docs.iyzico.com/ek-servisler/webhook) |
  | PayTR Kart Saklama + tekrarlayan ödeme | Saklı kartla tekrarlı tahsilat; bildirimler; iade API'si | Tekrarlayan ödeme için mağazada **Non-3D** yetkisi gerekir. Tahsilat zamanlamasını KARAY'ın sunucusu yapar. Aynı bildirim birden fazla gelebilir | [Tekrarlayan ödeme](https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-kart-tekrarlayan-odeme) |
  | Craftgate | Ödeme orkestrasyonu; müşteri onayıyla saklı kartla tekrarlayan ödeme; PCI DSS Level 1 | Kendisi ödeme kuruluşu değil; banka/POS anlaşmaları ayrıca yapılır | [Tokenization](https://craftgate.io/en/products/tokenization) |
  | Paddle (merchant of record) | Satışı ve faturayı Paddle yapar | Türkiye, belgede desteklenmeyen satıcı ülkeler arasında görünmüyor; teyit gerekir. Türk müşteriye yabancı fatura gider; KARAY'ın vergi durumu mali müşavirle netleşmeli | [Desteklenen ülkeler](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle) |
  | Stripe | — | Türkiye'de kurulu bir şirketin doğrudan hesap açabildiği **teyit edilmedi** | [Global](https://stripe.com/global) |
  | Banka sanal POS | — | Bankayla görüşme gerekir; hazır abonelik altyapısı belgelenmedi; entegrasyon yükü yüksek | — |

- **Risk:**
  - Erken entegrasyon: kullanılmayan kod ve PCI/KVKK yükü.
  - Geç entegrasyon: elle tahsilat yükü.
- **Öncelik:** P0 (ilk müşterilerde yöntem) / P2 (sağlayıcı entegrasyonu).
- **Benim vermem gereken karar:**
  - İlk müşterilerde tahsilat yöntemi.
  - Billing fazında hangi sağlayıcılardan teklif istenecek.
- **Önerilen seçenek:**
  - İlk müşterilerde **havale/EFT + elle fatura**, D-17 eşiğine kadar.
  - Billing fazı için kısa liste: **iyzico** (hazır abonelik ürünü) ve **PayTR** (kart saklama).
  - İkisinden BILLING_ARCHITECTURE §3 sorularına yazılı yanıt ve teklif alınır. Paddle, ancak mali müşavir yabancı merchant-of-record modelini uygun bulursa değerlendirilir.
- **Bağımlılıklar:**
  - D-07.
  - D-09.
  - D-10: sağlayıcıya veri aktarımı.
  - Üye işyeri başvurusu için vergi ve şirket bilgileri.
- **Tamamlanma ölçütü:**
  - İlk müşteriler için ödeme talimatı hazır: hesap bilgisi, açıklama biçimi.
  - Billing fazından önce en az iki sağlayıcıdan yazılı yanıt alındı ve seçim yapıldı.

### D-09 · Webhook güvenliği ilkeleri (billing fazının kabul ölçütü)

- **ID:** D-09
- **Mevcut durum:** Kod yok. [BILLING_ARCHITECTURE.md](BILLING_ARCHITECTURE.md) §2'deki ilkeler:
  - imzası doğrulanmış olay;
  - `provider_event_id` tekil;
  - sağlayıcı tek gerçek kaynak;
  - kart verisi KARAY'da saklanmaz.
- **Kanıt:**
  - **iyzico** ([Webhook](https://docs.iyzico.com/ek-servisler/webhook)):
    - imza başlığı `X-IYZ-SIGNATURE-V3`, HMAC-SHA256 (hex);
    - imza talep üzerine etkinleşir;
    - abonelik olaylarında imzaya giren alanlar belgede tanımlı bir sırayla birleştirilir;
    - teslim başarısız olursa 15 dakikada bir, en fazla 3 kez yeniden gönderilir.
  - **PayTR:** bildirimler HMAC ile doğrulanır ve aynı bildirim birden fazla gelebilir ([Tekrarlayan ödeme](https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-kart-tekrarlayan-odeme)).
- **Risk:** Sahte veya tekrarlanan olay, ödenmemiş aboneliği aktif yapabilir ya da çift kayıt üretebilir.
- **Öncelik:** P2
- **Benim vermem gereken karar:** Aşağıdaki ilkeleri billing fazının kabul ölçütü olarak onaylamak.
- **Önerilen seçenek:**
  1. İmza doğrulanmadan hiçbir durum değişmez; imza karşılaştırması sabit zamanlı yapılır.
  2. Olay kimliği tekil kaydedilir. Aynı olay ikinci kez gelirse 200 döner, işlem yapılmaz.
  3. Kritik geçişlerde (aktif etme, askı) sağlayıcı API'sinden durum yeniden sorgulanır.
  4. Olaylar sırasız gelebilir; sonuç sıraya bağlı olmamalı.
  5. Ham gövde yerine özet saklanır; kişisel veri en aza indirilir.
  6. Gizli anahtar yalnız sunucuda tutulur.
  7. Günlük mutabakat yapılır; fark çıkarsa alarm.
  8. Sağlayıcı destekliyorsa zaman damgası penceresiyle tekrar oynatma koruması.
- **Bağımlılıklar:** D-08.
- **Tamamlanma ölçütü:** Billing fazı testleri şunları kapsıyor:
  - geçersiz imza reddediliyor;
  - çift teslimde tek işlem;
  - sırasız olay;
  - mutabakat farkında alarm.

### D-10 · KVKK rolleri, sözleşmeler ve yurt dışı aktarım

- **ID:** D-10
- **Mevcut durum:**
  - KARAY'ın kendi metinleri TASLAK (PF-09).
  - [LEGAL_DATA_MAP.md](LEGAL_DATA_MAP.md) veri haritası mevcut ve açık "Hukukçu kararı" maddeleri var.
  - Altyapının tamamı yurt dışı hizmet sağlayıcılarında:
    - Vercel (bölge `fra1`);
    - Supabase (bölge doğrulanamadı; belgede Frankfurt önerisi var);
    - Resend;
    - isteğe bağlı Sentry;
    - yedek kovası.
- **Kanıt:**
  - **Yurt dışı aktarım:** 6698 sayılı Kanun'un 9. maddesi 7499 sayılı Kanun'la değişti. Standart sözleşmeyle yapılan aktarımda sözleşme, imzadan itibaren **5 iş günü** içinde Kurum'a bildirilir; bunun için Kurum'un bildirim modülü var ([duyuru](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu), [rehber](https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi)).
  - **VERBİS:** Kurul'un 2023/1154 sayılı kararıyla şu veri sorumluları kayıt yükümlülüğünden istisna:
    - yıllık çalışan sayısı 50'den az;
    - yıllık mali bilanço toplamı 100 milyon TL'den az;
    - ana faaliyeti özel nitelikli veri işlemek olmayan.

    Kaynak: [karar](https://www.kvkk.gov.tr/Icerik/7647/2023-1154). Güncel durum hukukçuyla teyit edilmeli.
- **Risk:**
  - Aydınlatma ve aktarım yükümlülüklerine aykırılık.
  - Ofislerle rol ayrımı yazılı değilse, bir veri ihlalinde sorumluluk belirsiz kalır.
- **Öncelik:** P0
- **Benim vermem gereken karar:**
  - Hukukçu seçimi.
  - Rollerin onayı.
  - Müşteri hizmet sözleşmesi ve **veri işleme sözleşmesi** şablonları.
  - Yurt dışı aktarımın dayanağı ve hangi sağlayıcılar için.
  - Veri saklama süreleri.
  - Ofislere hazır metin şablonu verilecek mi? (Metni ofis onaylar.)
  - Müşteriler ticari amaçla satın aldığı için tüketici mevzuatının (cayma hakkı, ön bilgilendirme) uygulanıp uygulanmadığı hukukçuya sorulmalı.
- **Önerilen seçenek:**
  - **Roller** (hukukçu teyidine kadar öneri):
    - Ofislerin ziyaretçi talepleri ve CRM kayıtlarında **veri sorumlusu ofis**, **veri işleyen KARAY**.
    - KARAY'ın kendi müşterilerinin hesap ve fatura bilgileri ile KARAY sayfasındaki talepler (`platform_leads`) için **veri sorumlusu KARAY**.
  - **Hukukçudan tek seferlik paket:**
    - KARAY aydınlatma, gizlilik, çerez metinleri ve kullanım koşulları;
    - hizmet sözleşmesi;
    - veri işleme sözleşmesi;
    - alt işleyen listesi (Vercel, Supabase, Resend, yedek kovası, seçilecek ödeme sağlayıcısı);
    - aktarım mekanizması ve gerekiyorsa bildirimler;
    - ofisler için şablon metinler.
- **Bağımlılıklar:** D-11 (sağlayıcı ve bölge), D-08 (ödeme sağlayıcısı), D-05 (saklama), PF-09.
- **Tamamlanma ölçütü:**
  - Şablonlar imzaya hazır.
  - Gerekiyorsa aktarım bildirimi yapıldı.
  - KARAY metinleri yayında ve TASLAK değil.
  - LEGAL_DATA_MAP.md'deki "Hukukçu kararı" maddeleri kapandı.

---

## 3. Altyapı ve yönetim kararları

### D-11 · Altyapı planları ve bütçe

- **ID:** D-11
- **Mevcut durum:**
  - Planlar bu ortamdan doğrulanamadı.
  - KARAY yedeği hiç çalışmadı (14/14 `skipped`).
- **Kanıt:** PF-02, PF-03 ve PF-06 kaynakları:
  - **Vercel:** Hobby ticari olmayan kullanım için.
  - **Supabase Free:** otomatik yedek yok; düşük etkinlikte proje duraklatılır. Storage veritabanı yedeğine dahil değil.
  - **Resend ücretsiz plan:** günde 100, ayda 3.000 e-posta.
  - **GitHub private depo:** Free'de dal koruması yok.
- **Risk:**
  - Vercel koşullarının ihlali.
  - Yedeksiz çalışma.
  - Projenin duraklaması.
- **Öncelik:** P0
- **Benim vermem gereken karar:**
  - Hangi planlar alınacak?
  - Hesaplar kimin adına (şirket hesabı önerilir)?
  - Aylık bütçe tavanı.
  - Supabase PITR şimdi mi, sonra mı?
  - Supabase bölgesi.
  - Yedek kovası sağlayıcısı.
- **Önerilen seçenek:**
  - **Zorunlu en az:** Vercel Pro, Supabase ücretli plan (günlük yedek), ayrı hesapta yedek kovası, alan adları.
  - **İhtiyaca göre:**
    - Resend ücretli plan (hacim artınca);
    - GitHub Pro/Team (depo private olursa, dal koruması için);
    - PITR (müşteri sayısı artınca);
    - uptime servisi (ücretsiz katman yetebilir).
  - Fiyatlar sağlayıcı sayfalarından güncel alınır; bu belge rakam içermez.
- **Bağımlılıklar:** D-12, D-13, D-10.
- **Tamamlanma ölçütü:**
  - Hesaplar şirket adına ve 2FA açık.
  - Plan ve bölge bilgisi DEPLOYMENT_RUNBOOK'a yazıldı.
  - BACKUP_RESTORE.md "Açılış kapısı" tamamlandı (PF-02).
  - Aylık maliyet, güncel sağlayıcı fiyatlarıyla hesaplanıp onaylandı.

### D-12 · Depo görünürlüğü

- **ID:** D-12
- **Mevcut durum:**
  - Depo public.
  - Adı kullanıcı adıyla aynı olduğu için **GitHub profil deposu**; kök README profil sayfasında görünür.
  - Aynı depoda başka iki projenin dalları ve ortak geçmişi var.
  - Kendiliğinden private **yapılmadı**.
- **Kanıt:**
  - GitHub API.
  - [Görünürlük değişikliğinin etkileri](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility):
    - yıldız ve izleyiciler silinir;
    - public fork'lar public kalır ve ayrılır.
  - [Profil README](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme): depo private olursa profil README'si kaldırılır.
  - [Dal koruması](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches): private depoda Pro veya Team gerekir.
- **Risk:**
  - Kod ve güvenlik modeli herkese açık.
  - Yedek açılınca Actions loglarında işletme sayıları görünür (SEC-03).
- **Öncelik:** P1
- **Benim vermem gereken karar:** A, B veya C. C seçilirse geçmiş nasıl taşınacak (yalnız uygulama klasörünün geçmişi mi, temiz başlangıç mı)?
- **Seçenekler:**
  - **A. Public kalsın.**
    - Artı: Actions ve dal koruması ücretsiz.
    - Eksi: kod ve loglar açık; SEC-03 düzeltmesi zorunlu.
  - **B. Bu depo private olsun.**
    - Artı: tek adım.
    - Eksi: profil README'si kalkar; diğer projeler de gizlenir; Free'de dal koruması yok; Actions kotası.
  - **C. KARAY ayrı bir private depoya taşınsın.**
    - Artı: profil ve diğer projeler etkilenmez; temiz yetkilendirme.
    - Eksi: taşıma işi (Vercel bağlantısı, sırlar, iş akışı yolları, AI oturum dalı); dal koruması için GitHub Pro/Team.
- **Önerilen seçenek:** **C.** Adımlar PF belgesi SEC-01'de. Hangi seçenek olursa olsun, daha önce public olan geçmiş geri alınamaz; tüm geçmiş ve tüm yollar için gizli anahtar taraması yapılmalı.
- **Bağımlılıklar:** D-11, D-14, SEC-01, SEC-03.
- **Tamamlanma ölçütü:** PF belgesi SEC-01'deki ölçütler (C için) ya da SEC-03 düzeltmesi (A için).

### D-13 · Alan adı stratejisi

- **ID:** D-13
- **Mevcut durum:**
  - Kod iki değer bekler:
    - `KARAY_HOSTS`: KARAY sitesi ve platform paneli;
    - `PLATFORM_ROOT_DOMAIN`: müşteri siteleri için `{slug}.{kök}`.
  - Production'da bu değerler yoksa prelaunch hata verir.
  - Özel alan adı akışı hazır.
  - DNS sağlayıcısı belli değil.
- **Kanıt:**
  - `scripts/prelaunch-check.mjs:63-74`.
  - Vercel'de joker alan adı için alan adının Vercel nameserver'larını kullanması gerekir. Belge `_acme-challenge` yetkilendirmesini alternatif olarak anlatır ([kaynak](https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains#using-wildcard-domains)).
- **Risk:**
  - Değerler yoksa alt alan adlı müşteri siteleri açılmaz.
  - Ortak alan adında bir müşteri sitesinin kara listeye alınması (ör. kimlik avı şikâyeti) KARAY'ın ana alan adını da etkileyebilir.
- **Öncelik:** P0
- **Benim vermem gereken karar:**
  - KARAY'ın alan adı hangisi; kayıtlı mı, kimin adına?
  - Müşteri kökü aynı alan adı mı, ayrı alan adı mı?
  - DNS Vercel'e taşınacak mı?
  - E-posta hangi alt alan adından gönderilecek?
- **Seçenekler:**
  - **A. Müşteri siteleri KARAY alan adının alt alanında.**
    - Artı: tek alan adı.
    - Eksi: itibar riski paylaşılır; ana alan adının DNS'i joker için Vercel'e taşınmalı.
  - **B. Müşteri siteleri ayrı bir alan adında.**
    - Artı: itibar ve çerez yalıtımı; KARAY alan adının DNS'i (e-posta kayıtlarıyla) yerinde kalabilir.
    - Eksi: ek alan adı.
- **Önerilen seçenek:** **B.** Müşteri kökünün DNS'i Vercel'de olur; `*.kök` projeye bağlanır.
- **Bağımlılıklar:** D-11; PF-05, PF-06, PF-08.
- **Tamamlanma ölçütü:**
  - Alan adları şirket adına kayıtlı.
  - Vercel'de tanımlı: `KARAY_HOSTS`, `PLATFORM_ROOT_DOMAIN`, `DOMAIN_TARGET_CNAME` / `DOMAIN_TARGET_A`.
  - Prelaunch'ta alan adı satırları hatasız.

### D-14 · Dal ve yayın stratejisi

- **ID:** D-14
- **Mevcut durum:**
  - Varsayılan dal AI çalışma dalı (`claude/…-vxq9dj`).
  - `main` yok; hiçbir dal korumalı değil.
  - Açık tek PR ([#2](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/pull/2)) başka bir projenin dalına açılmış.
  - CI veritabanı testleri kapalı.
- **Kanıt:** GitHub API; PF-04, PF-11.
- **Risk:**
  - Vercel production dalı bu dala bağlıysa her push canlıya gider.
  - Birleştirmeden önce inceleme kapısı yok.
- **Öncelik:** P0
- **Benim vermem gereken karar:**
  - Production dalı.
  - Birleştirmeyi kim onaylayacak?
  - CI veritabanı testleri açılsın mı?
  - Otomatik deploy mu, elle Promote mu?
- **Seçenekler:**
  - **A. Korumalı `main` + PR** (zorunlu kontroller).
  - **B. Mevcut düzen.** Önerilmez.
  - **C. `main` + ayrı `production` dalı.** Bu ölçekte fazla süreç.
- **Önerilen seçenek:**
  - **A.**
  - İlk aylarda Vercel'de production'a **elle Promote** (DEPLOYMENT_RUNBOOK:8-9).
  - `ELVANKENT_CI_DB_TESTS=true`.
  - PR #2 birleştirilmez.
- **Bağımlılıklar:** D-12 (private + Free'de koruma yok), PF-01 (CI yeşil olmalı).
- **Tamamlanma ölçütü:** PF-04 ve PF-11 ölçütleri.

### D-15 · Güvenlik başlıkları ve görüntü yüzeyi (CSP, HSTS, SVG)

- **ID:** D-15
- **Mevcut durum:**
  - CSP `script-src` ve `style-src` içinde `'unsafe-inline'` var; oturum çerezleri `httpOnly: false` (SEC-02).
  - HSTS'nin `includeSubDomains; preload` hali müşteri alan adlarında da gönderiliyor (PF-10).
  - SVG çözümleme yüzeyi geniş (SEC-06).
- **Kanıt:** `next.config.ts:82-83,98`; Next.js CSP belgesi (nonce dinamik render ister, ISR kapanır, PPR uyumsuz; SRI deneysel).
- **Risk:**
  - XSS olursa hesap ele geçirilebilir.
  - Müşterinin başka alt alan adları HTTPS'e zorlanır.
- **Öncelik:** P1
- **Benim vermem gereken karar:**
  - Aşamalı CSP planının hangi aşamaları sonraki faza alınsın?
  - Müşteri alan adlarında HSTS politikası.
  - SVG logo desteği kalsın mı?
- **Önerilen seçenek:**
  - Sonraki fazda, küçük ve düşük riskli işler:
    - **Aşama 0:** Report-Only;
    - **Aşama 1:** `HttpOnly` çerez;
    - müşteri alan adlarında `includeSubDomains`/`preload` olmadan HSTS;
    - medya yolunda dosya imzası kontrolü (SVG yalnız logo yolunda).
  - **Aşama 2** (panel nonce'u) ayrı bir adımda.
  - **Aşama 3** (SRI) yalnızca önizlemede deneme.
  - CSP'yi kırabilecek değişiklik otomatik uygulanmaz.
- **Bağımlılıklar:** D-16.
- **Tamamlanma ölçütü:** SEC-02, PF-10 ve SEC-06 ölçütleri.

### D-16 · Güvenlik güncellemesine onay (sonraki fazın ilk işi)

- **ID:** D-16
- **Mevcut durum:**
  - `next` 16.3.6, `sharp` 0.35.4 ve `source-map-js` 1.2.1 için yüksek önemli bildirimler var.
  - sharp/librsvg açığına ilan fotoğrafı ve logo yüklemesinden ulaşılabiliyor.
  - CI kırmızı ve gitleaks çalışmıyor (PF-01).
- **Kanıt:** PF-01 tablosu; yerel `metadata()` doğrulaması.
- **Risk:** Sunucuda kod çalıştırma → service-role anahtarı → tüm kiracıların verisi.
- **Öncelik:** P0
- **Benim vermem gereken karar:** Bu fazdan sonra **yalnızca** güvenlik güncellemesi içeren küçük bir değişikliğe onay. Talimat gereği onayın olmadan sonraki faza geçilmedi.
- **Önerilen seçenek:**
  - Kapsam: `next` → 16.3.8, `sharp` → 0.35.5, kilit dosyası güncellemesi.
  - İsteğe bağlı olarak aynı değişiklikte medya dosya imzası kontrolü (SEC-06).
  - Tam regresyon.
  - Bu yapılmadan `6055693` production'a alınmaz.
- **Bağımlılıklar:** Yok.
- **Tamamlanma ölçütü:** PF-01 ölçütü.

### D-17 · İlk müşterilerde elle işletim ve otomasyon eşiği

- **ID:** D-17
- **Mevcut durum:** Elle yönetim araçları hazır:
  - plan ve abonelik atama;
  - müşteri durumu ve "Dikkat" uyarıları;
  - yalnızca eklenebilen KARAY notları;
  - teslim kontrol listesi;
  - özel alan adı bağlantısını elle onaylama.
- **Kanıt:** FAZ 1 raporu ve kodu; [operations/README.md](operations/README.md).
- **Risk:**
  - Erken otomasyon: gereksiz kod ve bakım yükü.
  - Geç otomasyon: tahsilat ve takip kişiye bağlı kalır.
- **Öncelik:** P1
- **Benim vermem gereken karar:** Kaç müşteriye kadar elle işletilecek, ya da hangi sinyalde otomasyona geçilecek? Örnek sinyaller: aylık elle iş saati, geciken tahsilat sayısı.
- **Önerilen seçenek:**
  - Ödeme otomasyonu ancak müşteri sayısı senin belirleyeceğin eşiği geçince ya da elle tahsilat takibi aksarsa başlar.
  - O zamana kadar billing kodu, otomatik deneme bitişi ve otomatik askı **yok**.
  - Manuel yürüyen işler sırf otomasyon için geliştirilmez.
- **Bağımlılıklar:** D-07, D-08, OPS-03.
- **Tamamlanma ölçütü:**
  - Eşik yazılı.
  - Aylık mutabakat rutini (OPS-03) en az bir kez işletildi.

### D-18 · Olay ve destek sorumlusu, hizmet taahhüdü

- **ID:** D-18
- **Mevcut durum:**
  - [operations/incident-response.md](operations/incident-response.md) önem derecelerini ve eşikleri tanımlıyor.
  - Yazılı olmayanlar:
    - sorumlu kişi;
    - uyarı kanalı;
    - destek kanalı ve saatleri.
  - RPO ≤ 24 saat / RTO ≤ 4 saat iç hedef olarak duruyor ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)).
  - Hesaplarda 2FA ve sır sahipliği belgelenmemiş (SEC-04).
- **Kanıt:** PF-07, PF-12, OPS-04, SEC-04.
- **Risk:**
  - Kesintide gecikme.
  - Müşteriye verilen sözle gerçek kapasite arasında fark.
- **Öncelik:** P1
- **Benim vermem gereken karar:**
  - S1–S3 olayları için sorumlu kişi ve yedeği.
  - Uyarıların gideceği kanal.
  - Müşteriye açılacak destek kanalı ve saatleri.
  - Sözleşmede SLA olacak mı?
  - Bakım penceresi.
  - Kabul edilebilir veri kaybı.
  - Hesaplara kimlerin erişeceği.
- **Önerilen seçenek:**
  - İlk müşterilerde tek sorumlu ve "en iyi çaba"; sayısal SLA yok.
  - RPO ve RTO iç hedef olarak kalır.
  - Bakım penceresi düşük trafik saatinde ve önceden duyurulur.
  - Tüm hesaplarda 2FA.
- **Bağımlılıklar:** PF-07, SEC-04.
- **Tamamlanma ölçütü:**
  - incident-response.md'de ad, kanal ve saatler yazılı.
  - Sözleşmede destek maddesi var.
  - Test uyarısı sorumluya ulaştı.
