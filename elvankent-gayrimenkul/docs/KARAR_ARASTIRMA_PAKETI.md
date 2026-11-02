# KARAYS — Karar araştırma paketi (D-01…D-18)

> **Tarih:** 02.11.2026 · **Tür:** araştırma ve öneri; **karar değildir**, hiçbir karar durumu değiştirilmedi.
> **Eş belgeler:** [PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md) (karar kaydı) ·
> [OPS02_ABONELIK_DURUMLARI.md](OPS02_ABONELIK_DURUMLARI.md) (abonelik durumları) · [LEGAL_DATA_MAP.md](LEGAL_DATA_MAP.md) (veri haritası) ·
> [K19_YAYIN_HAZIRLIK.md](K19_YAYIN_HAZIRLIK.md) · [KALAN_ISLER.md](KALAN_ISLER.md) (KI-29, KI-30, KI-34).
>
> **Bu belge hukuki, vergisel veya mali danışmanlık değildir.** "**[HUKUKÇU]**" ve "**[MALİ MÜŞAVİR]**" işaretli maddeler bir
> avukat / mali müşavir tarafından teyit edilmeden sözleşmeye, faturaya veya sitedeki metne dayanak yapılmamalıdır.
>
> **Kaynak yöntemi (önemli):** Kaynaklara 02.11.2026'da web araması ile bakıldı. Bu oturumun ağ ayarı sayfaların doğrudan açılmasına
> izin vermedi (iyzico, PayTR, Stripe, Supabase, Vercel, Cloudflare alan adları çözülmedi); bu yüzden bilgiler, arama motorunun bu
> sayfalardan verdiği **özetlere** dayanır. Her rakamın yanında kaynağı ve "(arama özeti)" notu var. **Rakamlar canlı sayfadan tekrar
> okunmadan bütçeye veya sözleşmeye yazılmamalı.** Doğrulanamayan rakam "doğrulanamadı" diye işaretlendi. Madde numarası yalnız kaynakta
> görüldüyse yazıldı.
>
> **Depo herkese açıktır:** bu belgede proje kimliği, ortam değişkeni değeri, kayıt sayısı veya sır yoktur.

---

## 0. Tek sayfa özet

Aciliyet: **Hemen** = bu hafta, canlı riski var · **P0** = ikinci ücretli müşteriden / ilk faturadan önce · **P1** = ilk 30 gün ·
**P2** = otomatik tahsilattan önce.

| Karar | Öneri (tek satır) | Aciliyet | Uzman teyidi |
| --- | --- | --- | --- |
| **D-11** Altyapı planları | Supabase **Pro** (bugün Free: otomatik yedek yok) + Vercel **Pro** (Hobby ticari kullanıma kapalı); R2 yedeği sürsün; aylık tavan ≈ 50–60 USD | **Hemen** | Hayır (mali müşavir: yurt dışı hizmet alımında KDV/sorumlu sıfatıyla beyan) |
| **D-16** Güvenlik güncellemesi | Fiilen uygulandı (O-4, `650fd4e`; şimdi `next` 16.4.3, `sharp` 0.35.5). Kaydı "uygulandı" diye kapat + kalıcı kural: yalnız güvenlik yaması, CI yeşil, sahip onayı | Hemen (yalnız kayıt) | Hayır |
| **D-10** KVKK rolleri / yurt dışı aktarım | Ofis = veri sorumlusu, KARAYS = veri işleyen; hizmet sözleşmesi + veri işleme sözleşmesi + alt işleyen listesi; yurt dışı aktarım dayanağını **hukukçu seçsin** (sağlayıcıların AB SCC'si KVKK standart sözleşmesi değildir) | **P0** | **[HUKUKÇU]** zorunlu |
| **D-05** saklama/silme | İptal → dönem sonu → 14 gün salt okunur → askı → **askıdan 90 gün sonra elle, yazılı bildirimle silme**; yedeklerde 30/90 günlük dönüşle düşer; KARAYS'ın kendi fatura/sözleşme kayıtları ayrı tutulur (TTK 10 yıl / VUK 5 yıl) | **P0** (sözleşmeye girmeli) | **[HUKUKÇU]** + **[MALİ MÜŞAVİR]** |
| **D-07** Fatura / e-belge | Önce tüzel kişilik ve mali müşavir; ilk faturalar GİB portalı ya da entegratörden elle; alıcı e-Fatura mükellefiyse e-Fatura | **P0** | **[MALİ MÜŞAVİR]** zorunlu |
| **D-08** Tahsilat | Şimdilik **havale/EFT + elle fatura**; otomasyonda kısa liste **iyzico Abonelik** ve **PayTR** (Stripe Türkiye'de doğrudan hesap için doğrulanamadı) | P0 (yöntem) / P2 (sağlayıcı) | **[MALİ MÜŞAVİR]** (POS başvurusu, komisyon faturası) |
| **D-01** Plan yapısı | Mevcut 3 plan; özel alan adı ihtiyacı ofis bazlı bayrakla; 3–5 müşteriden sonra gözden geçir | P0 | Hayır |
| **D-02** Fiyat modeli | Teklif usulü + iç fiyat listesi; **KDV hariç** yazılır; yıllık peşin seçeneği; yılda 1 güncelleme maddesi | P0 | **[MALİ MÜŞAVİR]** (KDV gösterimi) · **[HUKUKÇU]** (güncelleme maddesi) |
| **D-03** Deneme | Kodda 14 gün kalsın; gerekirse elle 30 güne uzat; kart istenmez; bitişte telefon, otomatik askı yok | P0 | Hayır |
| **D-04** alt kararlar | Hatırlatma: vade −3, 0, +3, +6. gün (e-posta; +3 ve +6'da telefon). 8. gün **bakım modu** (elle), 30. gün askı (yazılı ön bildirimle). Askıdan dönüş ücretsiz | P1 | **[HUKUKÇU]** (sözleşme maddesi; SMS kullanılacaksa ticari ileti istisnası) |
| **D-05** salt okunur / askı görünümü | 14 günde: panel + dışa aktarma açık, yeni ilan/üye/yükleme kapalı (bayrak), mevcut kayıt düzenlemesine izin (bugünkü bayrak davranışı); site açık. Askıda sade "yayında değil" sayfası (sonra) | P1 | **[HUKUKÇU]** (14 gün boyunca işleme dayanağı veri işleme sözleşmesinde) |
| **D-06** Yükseltme/düşürme | Yükseltme hemen, fark sonraki faturada; düşürme dönem sonunda; veri silinmez | P1 | Hayır |
| **D-09** Webhook ilkeleri | 8 ilkeyi billing fazının kabul ölçütü olarak onayla | P2 | Hayır |
| **D-12** Depo görünürlüğü | KARAYS'ı ayrı **private** depoya taşı (seçenek C) | P1 | Hayır |
| **D-13** Alan adı | Müşteri siteleri **ayrı bir kök alan adında** (seçenek B) | P0 (özel alan adından önce) | Hayır |
| **D-14** Dal/yayın | Korumalı `main` + PR + elle Promote (seçenek A; fiilen PR ile yayın yapılıyor) | P0 (kayıt) | Hayır |
| **D-15** kalan | Önizlemede doğrulayıp CSP jokerini kaldır; müşteri alan adlarında HSTS'yi `includeSubDomains; preload` olmadan gönder; önce Report-Only | P1 | Hayır |
| **D-17** Otomasyon eşiği | Elle işletim; **5 ücretli müşteri** ya da ayda **2+ geciken ödeme** ya da ayda **4+ saat** elle tahsilat işi → otomasyon fazı | P1 | Hayır |
| **D-18** Destek / SLA | "En iyi çaba", sayısal SLA ve kredi yok; hafta içi 09–18 destek; S1'de 4 iş saati içinde ilk yanıt hedefi; ihlalde ofise gecikmeksizin bildirim (ofisin Kurul'a 72 saat süresi var) | P1 | **[HUKUKÇU]** (sorumluluk sınırı, ihlal bildirimi maddesi) |

### Hukukçuya / mali müşavire tek seferde götürülecek soru listesi

Ayrıntı her kararda; burada toplu liste (görüşmeye bu bölümü götürmeniz yeterli).

**[HUKUKÇU]**
1. Roller: ziyaretçi talepleri ve CRM'de ofis veri sorumlusu, KARAYS veri işleyen; KARAYS'ın kendi müşteri/fatura verisinde KARAYS veri sorumlusu — doğru mu? (D-10)
2. Yurt dışı aktarım dayanağı: Supabase (AB bölgesi, sözleşme tarafı Singapur), Vercel (ABD), Resend (ABD), Cloudflare R2. Sağlayıcıların DPA'ları **AB 2021 SCC** içeriyor; KVKK standart sözleşmesi Kurul metninin **değiştirilmeden** kullanılmasını ve imzadan sonra **5 iş günü** içinde bildirimini istiyor. Bu sağlayıcılarla KVKK standart sözleşmesi nasıl imzalanır, kim bildirir (ofis mi, KARAYS mı), hangi modül? Sağlayıcı imzalamazsa yol ne? (D-10)
3. Hizmet sözleşmesi + veri işleme sözleşmesi + alt işleyen listesi şablonları; ofislere verilecek aydınlatma metni şablonu. (D-10)
4. Müşteriler ticari amaçla satın aldığı için Mesafeli Sözleşmeler Yönetmeliği'nin (cayma hakkı, ön bilgilendirme) uygulanmadığı görüşü doğru mu? Şahıs olarak çalışan emlakçı da "tacir/esnaf" sayılır mı? (D-02, D-03)
5. 6563 sayılı Kanun ve Elektronik Ticarette Hizmet Sağlayıcı Yönetmeliği'ne göre KARAYS sitesinde bulunması gereken tanıtıcı bilgiler. (D-07, D-10)
6. Saklama/silme: askıdan 90 gün sonra silme makul mü; yedeklerdeki kopyaların 30/90 günde düşmesi sözleşmeye nasıl yazılır; KARAYS'ın kendi sözleşme/fatura kayıtları için 10 yıl. (D-05)
7. Ödeme gecikmesinde bakım modu ve askı hakkının sözleşme maddesi; askıda veri erişiminin sınırları. (D-04)
8. Hatırlatmalar SMS/WhatsApp ile gönderilirse ticari elektronik ileti onayı/İYS gerekir mi (mevcut müşteriye hizmetle ilgili ileti istisnası)? (D-04)
9. Fiyat güncelleme maddesi (yılda bir, TÜFE'ye bağlı veya yazılı bildirimle) geçerli mi? (D-02)
10. Sorumluluk sınırı, "en iyi çaba" destek maddesi, veri ihlali bildirim süresi (veri işleyenin ofise bildirimi). (D-18)
11. VERBİS: KARAYS kayıt istisnasında mı (50 çalışan / 100 milyon TL bilanço ölçütleri; 2025/1572 sonrası uygulama)? (D-10)

**[MALİ MÜŞAVİR]**
1. Faturayı kesecek yapı (şahıs / limited / anonim) ve vergi kaydı. (D-07)
2. e-Fatura / e-Arşiv: KARAYS hangi takvime tabi; ilk faturadan itibaren e-Arşiv mi; alıcı e-Fatura mükellefiyse e-Fatura. 509 Sıra No.lu VUK Genel Tebliği'nin 2026 güncel metni üzerinden. (D-07)
3. Hizmetin KDV oranı (genel oran %20 beklenir) ve teklif/faturada gösterimi. (D-02, D-07)
4. Yurt dışından alınan hizmetler (Vercel, Supabase, Resend, Cloudflare): sorumlu sıfatıyla KDV beyanı ve gider kaydı. (D-11)
5. Saklama: TTK 10 yıl, VUK 5 yıl — KARAYS'ın hangi kayıtları (fatura, sözleşme, ödeme dekontu, sağlayıcı faturaları) hangi süreyle, hangi biçimde (elektronik) saklanmalı. (D-05)
6. Ödeme kuruluşu (iyzico/PayTR) başvurusu, komisyon faturaları, mutabakat. (D-08)

---

## 1. Ticari kararlar

### D-01 · Plan yapısı ve kapsamı

**Soru:** Kaç plan olacak, her planda ne var? Özel alan adı ve CRM hangi planda?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Mevcut 3 plan** (Başlangıç / Profesyonel / Kurumsal) | Kod ve migration yok; konsol hazır | Özel alan adı yalnız Kurumsal'da; emlak ofisleri çoğunlukla kendi alan adını ister |
| B. İki plan (Standart + Kurumsal) | Satış ve elle faturalama kolay | Küçük ofiste giriş fiyatı yükselir; `plans` migration'ı |
| C. Tek plan + eklenti (alan adı, ek kullanıcı) | Esnek | Kodda eklenti kavramı yok; elle faturalamada karmaşık |

**Öneri:** **A.** Özel alan adını Profesyonel müşteriye vermek gerekirse ofis bazlı `feature_overrides` bayrağıyla verin (kod değişmez).
Plan tablosunu 3–5 müşteriden sonra gerçek kullanımla (ilan sayısı, depolama) yeniden değerlendirin. Depolama limitleri, D-11'deki
Supabase depolama maliyetiyle kıyaslanmalı (Pro planda dahil kota için canlı fiyat sayfasına bakın).

**Uzman teyidi:** Gerekmez.

**Kaynak:** Karar kaydı D-01 (iç belge). Dış kaynak gerekmedi.

### D-02 · Fiyatlandırma modeli

**Soru:** Fiyat sitede açık mı, teklif usulü mü? Aylık/yıllık? KDV dahil mi hariç mi? Kurulum ücreti? Fiyat ne zaman güncellenir?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Sitede açık liste fiyatı | Güven, hızlı satış | TL güncellemesi herkese görünür; pazarlık esnekliği azalır |
| **B. Teklif usulü + iç fiyat listesi** | İlk müşterilerden öğrenme; esneklik | Tutarlılık riski (iç liste bunu azaltır) |
| C. Kurulum ücreti + aylık | Kurulum emeği karşılanır | Giriş bariyeri |

**Öneri:**
- **B**, ama tutarlılık için yazılı bir **iç fiyat listesi** (plan × aylık/yıllık) tutun; teklifler bu listeden çıksın.
- Müşteriler ticari amaçla aldığı için fiyatı **KDV hariç** yazın ve "KDV ayrıca eklenir" deyin. Genel KDV oranı 10.07.2023'ten beri
  %20 (7346 sayılı Cumhurbaşkanı Kararı) [K20]; yazılım/SaaS hizmetinin bu orana tabi olduğu **beklenir ama bu araştırmada doğrulanmadı** → mali müşavir.
- Aylık ve **yıllık peşin** seçeneği; yıllıkta indirim SaaS'ta yaygın bir uygulamadır (oran sizin kararınız; bu belge rakam önermez).
- Sözleşmede: "Fiyatlar yılda bir kez, en az 30 gün önceden yazılı bildirimle güncellenebilir." TL'de uzun vadeli değer kaybına karşı.
- Kurulum ücreti: ilk müşterilerde yok ya da "kurulum + içerik girişi" ayrı kalem olarak teklifte.
- `price_monthly` ancak A'ya geçince doldurulur.

**Uzman teyidi:**
- **[MALİ MÜŞAVİR]** KDV oranı ve teklif/faturada gösterim.
- **[HUKUKÇU]** Fiyat güncelleme maddesi; müşterinin "tüketici" sayılmadığı varsayımı (Mesafeli Sözleşmeler Yönetmeliği'nde tüketici
  "ticari veya mesleki olmayan amaçlarla hareket eden" kişi olarak tanımlanır [K14]; ofisler ticari amaçla aldığından yönetmeliğin
  dışında kalması beklenir — bu bir çıkarımdır). Sitede tüketiciye açık fiyat gösterilecekse vergiler dahil gösterim kuralları ayrıca sorulmalı (doğrulanmadı).

**Kaynaklar:** [K14], [K20].

### D-03 · Deneme süresi

**Soru:** Deneme olacak mı, kaç gün, deneme sırasında site yayına çıkar mı, bitince ne olur?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. 14 gün (mevcut kod)** | Kod değişmez; elle uzatılabilir | Kurulum + ilan girişi için kısa kalabilir |
| B. 30 gün | Ofise rahat süre | Üç fonksiyonda migration ya da her seferinde elle uzatma |
| C. Deneme yok; ücretli kurulum + iade güvencesi | Ciddi müşteri | Giriş bariyeri |
| D. Deneme yok; ilk ay indirimli | Basit | Fatura ve iade karmaşası yok ama gelir düşer |

**Öneri:** **A + elle uzatma.** Deneme için kart istemeyin (havale/EFT dönemindesiniz). Deneme sırasında site taslak/önizlemede kalsın;
bitişte telefonla karar; **otomatik askı yok** (D-17 eşiğine kadar). Sağlayıcıya geçildiğinde iyzico Abonelik ödeme planına deneme süresi
eklenebiliyor ve denemede kart yalnızca **1 TL çekim + iade** ile doğrulanıyor [K8] — ileride kartla deneme isterseniz bu davranış sözleşmeye ve
deneme metnine yazılmalı.

**Uzman teyidi:** Gerekmez (deneme koşulları sözleşmeye yazılırken hukukçunun genel incelemesi yeterli).

**Kaynaklar:** [K8].

---

## 2. Ödeme gecikmesi ve iptal (D-04 / D-05 alt kararları)

Ana kararlar **verildi (01.11.2026)** ve burada değiştirilmez. Aşağıda yalnız açık alt kararlar var
([OPS02 §5.3](OPS02_ABONELIK_DURUMLARI.md)).

### D-04a · Hatırlatma takvimi, saati ve kanalı

**Soru:** Ödeme gecikince kaç kez, hangi gün/saatte, hangi kanaldan hatırlatılacak?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Yalnız e-posta, 3 adet (0, +3, +6) | Elle bile 5 dakikalık iş | E-posta gözden kaçabilir |
| **B. E-posta + telefon, 4 temas (−3, 0, +3, +6)** | Küçük müşteri tabanında en etkilisi telefon; vade öncesi uyarı gecikmeyi azaltır | Biraz daha emek |
| C. Otomatik e-posta dizisi (Resend) | Emek yok | Kod gerekir; D-17 eşiğinden önce önerilmez |

**Öneri: B**, hafta içi 10:00–17:00 arası:

| Gün | Kanal | İçerik |
| --- | --- | --- |
| Vade −3 | E-posta | Fatura + ödeme bilgisi (bilgilendirme) |
| Vade (0) | E-posta | "Bugün son gün" |
| +3 | E-posta + telefon | "Ödeme görünmüyor; 7. günden sonra site bakım moduna alınabilir" |
| +6 | E-posta + telefon | "Yarın bakım modu" — son uyarı, tarih ve saat yazılı |

Her temas KARAY notuna yazılır. Gerekçe: otomatik tahsilatlı SaaS'larda da yeniden deneme penceresi e-posta dizisinden uzun tutulur
(ör. Stripe'ta yeniden deneme penceresi 1–4 hafta arası ayarlanabilir; 7 günlük e-posta dizisine 2 haftalık pencere önerilir — üçüncü
taraf özet) [K12]. Elle tahsilatta "yeniden deneme" yerine telefon geçer.

**Uzman teyidi:** **[HUKUKÇU]** E-posta ve telefon mevcut müşteriye hizmetle ilgili bildirimdir; ancak **SMS/WhatsApp** kullanılacaksa
Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik'te mevcut müşteriye "edinilen mal/hizmetin değişikliği, kullanımı, bakımı"
ile ilgili iletilerde onay istisnası (m.6/1) ve esnaf/tacirlere gönderilen iletilerde istisna (m.6/3) var gibi görünüyor [K15]; ödeme
hatırlatmasının bu istisnaya girdiği **doğrulanmadı**. İçerikte tanıtım/kampanya olmamalı.

**Kaynaklar:** [K12], [K15].

### D-04b · 7 gün sonrası kısıtlamanın türü ve zamanı

**Soru:** 7 günlük ek süre bitince ne yapılacak, ne zaman, kim yapacak?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. 8. gün site bakım modu (panel çalışır) → 30. gün askı** | Kod yok, anında geri alınır; ofis verisine dokunmaz; ödeme için güçlü ama yıkıcı olmayan sinyal | Ziyaretçi bilgi sayfası görür; uzun sürerse arama motoru etkisi |
| B. 8. gün yeni kayıt engeli (`expired` + OPS-02 bayrağı) | Site açık kalır | Bayrak **genel**; açılması ayrı karar (KI-31) ve ön kontrol ister; ofise zayıf sinyal |
| C. 8. gün doğrudan askı | Basit | Site 404, panel kapalı; müşteri ve arama motoru kaybı; kararın "kademeli" ruhuna aykırı |

**Öneri: A, elle.** 8. gün KARAYS bakım modunu açar ve nota yazar; ödeme gelince aynı gün kapatır. 30. güne kadar ödeme yoksa yazılı
(e-posta) son bildirimle **askı** (veri silinmez). Askıdan dönüşte **ek ücret yok** (ilk müşterilerde ilişkiyi korur; birikmiş borç ödenir).
B, OPS-02 bayrağı canlıda açıldıktan sonra A'nın yerine değil yanına eklenebilir. Otomatik geçiş D-17 eşiğine kadar yok.

**Uzman teyidi:** **[HUKUKÇU]** Bakım modu ve askı hakkı, süreleri ve askıda veri erişimi hizmet sözleşmesine yazılmalı.

**Kaynaklar:** İç belgeler ([OPS02 §5](OPS02_ABONELIK_DURUMLARI.md), [operations/README.md](operations/README.md)).

### D-05a · "Salt okunur" 14 günün kapsamı

**Soru:** Dönem bittikten sonraki 14 günde ofis neyi yapabilir; site yayında kalır mı; site formu talep almaya devam eder mi?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Bayrağın bugünkü davranışı:** panel okuma + dışa aktarma açık, yeni ilan/üye/yükleme kapalı, mevcut kayıt **düzenlenebilir**; site ve form açık | Ek geliştirme yok (SL-02 testli); ofis müşterilerini ve alan adını taşıyabilir | Tam "salt okunur" değil |
| B. Tam salt okunur (düzenleme de kapalı), site açık | Tanıma birebir uyar | Ayrı geliştirme + RLS testleri |
| C. Site bakım modunda, panel salt okunur | Ziyaretçi verisi toplanmaz | Ofisin taşınma süresinde talep kaybı |

**Öneri: A.** "Salt okunur" sözleşmede "yeni içerik eklenemez; mevcut veriler görüntülenebilir, düzeltilebilir ve dışa aktarılabilir"
diye tanımlansın; böylece metin kodla uyuşur. Site ve form 14 gün açık kalsın (ofis yararına). Görseller dışa aktarıma dahil değil:
talep üzerine elle teslim (OPS02 §4 D-05d önerisi). Müşteri alan adı: 14 gün içinde ofis DNS'ini değiştirir; askıdan sonra KARAYS
alan adı bağlantısını kaldırır.

**Uzman teyidi:** **[HUKUKÇU]** 14 günde site formundan gelen kişisel verinin işlenmesi veri işleme sözleşmesinin süresi içinde kalmalı
(sözleşme "hizmet sonu + 14 gün" diye yazılmalı).

### D-05b · Askıdaki sitenin görünümü

**Soru:** Askıdaki site bugün 404; böyle mi kalsın?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. 404 kalsın (şimdilik)** | Kod yok; arama motoru dizinden düşürür | Ziyaretçi "site yok" görür |
| B. Sade "Bu site şu anda yayında değil" sayfası (ofis adı/KARAYS reklamı olmadan) | Daha nazik | Küçük geliştirme + test; durum kodu seçimi |

**Öneri:** Şimdilik **A**; ikinci askı vakasından sonra B (P2).

**Uzman teyidi:** Gerekmez.

### D-05c · Veri saklama süresi ve silme (hukuki görüşe bağlı)

**Soru:** Askıya alınan ofisin verisi ne kadar tutulur, nasıl silinir? KARAYS'ın kendi kayıtları ne kadar tutulur?

İki ayrı veri kümesi var:

1. **Ofisin verisi** (ilanlar, CRM, talepler, görseller): KARAYS veri işleyen. KVKK'da işleme amacı bitince veri silinir/yok edilir/anonim
   hale getirilir; Silme Yönetmeliği'ne göre periyodik imha aralığı **6 ayı geçemez** [K16] ve imha işlemleri kayıt altına alınır (kayıtların
   en az 3 yıl saklanması ikincil özetlerde geçiyor, resmi metinden teyit edilmedi) [K16]. Veri işleyen olarak KARAYS, sözleşme bitince
   veriyi ofisin talimatına göre iade eder ve siler (sözleşmeyle kurulur).
2. **KARAYS'ın kendi ticari kayıtları** (müşteriyle sözleşme, fatura, ödeme dekontları, sağlayıcı faturaları): TTK'ya göre tacir ticari defter ve
   belgeleri **10 yıl**, VUK 253'e göre defter ve belgeler ilgili yılı izleyen yıldan başlayarak **5 yıl** saklanır (ikincil kaynaklar; madde
   metinleri mevzuat.gov.tr'den okunmalı) [K17]. Bu süre ofisin CRM verisine değil, KARAYS'ın kendi belgelerine uygulanır.

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Askıdan 90 gün sonra elle, yazılı bildirimle silme** | Ofise geri dönüş ve itiraz süresi; 6 aylık periyodik imha sınırının içinde kalır | Elle iş; takvim tutulmalı |
| B. Askıdan 30 gün sonra silme | Veri en aza iner | Geri dönmek isteyen müşteri için kısa |
| C. Süresiz saklama | Basit | KVKK'ya aykırı olma riski yüksek; önerilmez |

**Öneri: A** (OPS02 §4'teki 90 gün önerisiyle aynı). Akış: askı → 60. gün "30 gün sonra silinecek, dışa aktarma ister misiniz?" e-postası →
90. gün KARAYS elle siler, silme tarihini ve kapsamını nota yazar. **Yedekler:** R2 gece yedeklerinde veritabanı kopyaları `BACKUP_RETENTION_DAYS`
(varsayılan 30 gün), silinen dosyaların eski kopyaları 90 gün tutulur ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)); sözleşmede "yedeklerdeki kopyalar
en geç 90 gün içinde dönerek silinir" yazılmalı. **Otomatik silme yok** (karar gereği). KARAYS'ın fatura/sözleşme kayıtları ayrı ve 10 yıl.

**Uzman teyidi:** **[HUKUKÇU]** 90 gün, yedeklerin dönüşle silinmesi, imha kaydının saklanma süresi, KARAYS saklama ve imha politikası
gerekip gerekmediği (VERBİS istisnasıyla bağlantılı). **[MALİ MÜŞAVİR]** KARAYS'ın hangi belgelerini 10 yıl / 5 yıl, hangi biçimde saklayacağı.

**Kaynaklar:** [K16], [K17].

---

## 3. D-06 · Yükseltme / düşürme

**Soru:** Plan değişikliği ne zaman geçerli, fark nasıl hesaplanır, düşürmede özel alan adı ve limit üstü veri ne olur?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Yükseltme hemen (fark sonraki faturada, gün oranlı); düşürme dönem sonunda** | SaaS'ta yaygın; elle hesaplanabilir | Gün oranı hesabı elle |
| B. Her değişiklik dönem sonunda | En basit | Yükselten müşteri beklemek zorunda |
| C. Her değişiklik hemen, kıst iade/ek fatura | Adil | Elle faturalamada en zahmetlisi |

**Öneri: A.** Düşürmede limit üstü veri silinmez, yeni ekleme reddedilir (bugünkü davranış). Özel alan adı bayrağı kalkacaksa ofise 14 gün
önceden bildirilir ve KARAYS onayıyla kaldırılır. iyzico Abonelik'te plan yükseltme işlemi belgelenmiş [K8]; otomasyona geçince bu kural
sağlayıcının davranışıyla eşleştirilmeli.

**Uzman teyidi:** Gerekmez (fark faturası biçimi için mali müşavir).

**Kaynaklar:** [K8].

---

## 4. D-07 · Faturalama ve e-belge

**Soru:** Faturayı hangi tüzel kişilik keser? e-Arşiv mi, e-Fatura mı, nereden?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. GİB e-Arşiv portalı / mali müşavirin entegratöründen elle** | Ücretsiz veya düşük maliyet; ilk müşterilere yeter | Elle iş; API yok |
| B. Özel entegratör (API'li) | Otomasyona hazır | Yıllık ücret; erken |
| C. Kâğıt fatura | — | Bu araştırmada güncel durum netleşmedi; internetten satışta e-belge yükümlülüğü var (aşağıda); önerilmez |

**Bulgular:**
- GİB'in 509 Sıra No.lu VUK Genel Tebliği'nin **2026 güncel metni** 573 Sıra No.lu tebliğe kadar değişiklikleri içeriyor [K18].
- İnternet üzerinden satış yapanların e-Fatura veya e-Arşiv Fatura düzenlemesi gerektiği ve e-Arşiv faturada "internet satışı" ibaresi, satışın
  yapıldığı site, ödeme şekli ve tarihi gibi ek içerik zorunluluğu tebliğde yer alıyor (arama özeti) [K18].
- Hasılat eşiği ve tutar sınırları: ikincil kaynaklar **3 milyon TL** hasılat eşiğini ve tutar sınırlarını farklı rakamlarla veriyor; GİB metninde
  bu rakamlar bu araştırmada **doğrulanamadı** [K18], [K19].
- Alıcı e-Fatura kayıtlı kullanıcısıysa e-Arşiv yerine e-Fatura düzenlenir (karar kaydındaki mevcut not).

**Öneri: A.** Sıra: (1) tüzel kişilik ve mali müşavir, (2) mali müşavirin söylediği e-belge yolu, (3) ilk faturayı elle kes ve no/tarih/tutarı
KARAY notuna yaz. Entegratör API'si D-17 eşiğinde.

**Uzman teyidi:** **[MALİ MÜŞAVİR]** zorunlu — tüzel kişilik, e-Fatura/e-Arşiv yükümlülüğü ve başlangıç tarihi, KDV oranı, fatura içeriği.

**Kaynaklar:** [K18], [K19].

---

## 5. D-08 · Tahsilat yöntemi ve ödeme sağlayıcısı

**Soru:** İlk müşterilerden nasıl tahsil edilecek; otomasyona geçerken hangi sağlayıcı?

| Seçenek | Belgede görülen (02.11.2026) | Ücret | Dikkat |
| --- | --- | --- | --- |
| **Havale/EFT + elle fatura** | Entegrasyon yok | Banka masrafı (bankaya göre) | Ölçeklenmez; D-17'ye kadar yeterli |
| **iyzico Abonelik** | Ödeme planına deneme süresi; denemede 1 TL ile kart doğrulama; başarısız tahsilatı yeniden deneme uç noktası (`/v2/subscription/operation/retry`); plan yükseltme [K8]. Abonelik API'si varsayılan açık değil (GitHub issue) [K8] | **Doğrulanamadı.** Üçüncü taraf bloglar %2,49–%3,99 + işlem ücreti arası farklı rakamlar veriyor; resmi sayfa açılamadı [K9] | Teklif yazılı alınmalı; webhook imzası talep üzerine |
| **PayTR** (kart saklama + tekrarlayan ödeme; linkle ödeme) | Kayıtlı kartla tekrarlayan ödeme; tahsilat zamanlamasını KARAYS sunucusu yapar; Non-3D yetkisi gerekir [K10] | **Doğrulanamadı.** Oranlar ciroya göre teklifle veriliyor (üçüncü taraf) [K10] | Linkle ödeme, otomasyondan önce ara adım olabilir |
| Param | Genel ParamPOS API belgesi bulundu; **abonelik/tekrarlayan ödeme metodu bu araştırmada bulunamadı** [K11] | Doğrulanamadı | Kısa listeye alınmadı |
| Stripe | Türkiye'de kurulu şirket için doğrudan hesap **ikincil kaynaklara göre yok**; resmi liste açılamadı [K13] | — | Yurt dışı şirket gerektirir; önerilmez |
| Paddle (merchant of record) | Karar kaydında incelendi | — | Mali müşavir onaylamadan değerlendirilmez |

**Öneri:**
- Şimdi: **havale/EFT + elle fatura.** Ödeme talimatı şablonu: alıcı unvanı, IBAN, açıklama alanına "KARAYS – {ofis kısa adı} – {dönem}".
- D-17 eşiği yaklaşınca **iyzico** ve **PayTR**'den aynı soru listesiyle (BILLING_ARCHITECTURE §3) **yazılı teklif**; ara adım olarak
  "linkle ödeme" (kart saklamadan) değerlendirilebilir.

**Uzman teyidi:** **[MALİ MÜŞAVİR]** POS başvurusu için şirket ve vergi bilgileri, komisyon faturalarının kaydı, tahsilat–fatura mutabakatı.
**[HUKUKÇU]** Sağlayıcı yeni bir alt işleyen olur → D-10 listesine eklenir.

**Kaynaklar:** [K8], [K9], [K10], [K11], [K13].

---

## 6. D-09 · Webhook güvenliği ilkeleri

**Soru:** Karar kaydındaki 8 ilke billing fazının kabul ölçütü olsun mu?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. 8 ilkeyi aynen onayla** | Sahte/çift olaylara karşı standart koruma | — |
| B. Billing fazında yeniden yaz | Sağlayıcıya göre ayar | Ölçüt sonradan gevşeyebilir |

**Öneri: A.** Ek not: iyzico başarısız tahsilatı webhook'taki `orderReferenceCode` ile yeniden denemeye izin veriyor [K8]; yeniden deneme de
idempotent olmalı (ilke 2). Stripe belgesi de yeniden deneme bittikten sonra aboneliğin `past_due` kalabildiğini söylüyor [K12] — sağlayıcı ne
derse desin, kısıtlamayı D-04 takvimimiz belirlemeli (ilke 3: kritik geçişte sağlayıcıdan durum yeniden sorgulanır).

**Uzman teyidi:** Gerekmez.

**Kaynaklar:** [K8], [K12].

---

## 7. D-10 · KVKK rolleri, sözleşmeler ve yurt dışı aktarım

**Soru:** Kim veri sorumlusu, kim veri işleyen? Ofislerle hangi sözleşmeler? Yurt dışındaki sunuculara aktarım hangi dayanakla?

**Bulgular:**
- 6698 sayılı Kanun'un 9. maddesi 7499 sayılı Kanun'la değişti; Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında
  Yönetmelik 10.07.2024'te yayımlandı (RG 32598) [K1]. Sıra: **yeterlilik kararı** → yoksa **uygun güvenceler** (standart sözleşme, bağlayıcı
  şirket kuralları vb.) → yoksa sınırlı **arızi aktarım** halleri [K1], [K2].
- Kurul **dört standart sözleşme** modeli yayımladı; metin **değiştirilmeden** kullanılır (yalnız seçimlik/alternatif maddeler) ve imzadan sonra
  **5 iş günü** içinde Kurum'a bildirilir; taraflar kimin bildireceğini kararlaştırabilir, kararlaştırmazlarsa **veri aktaran** bildirir [K1], [K3], [K4].
  Bildirim modülü: standartsozlesme.kvkk.gov.tr [K4].
- Arızi aktarım, düzensiz, bir veya birkaç kez olan, süreklilik arz etmeyen aktarımlar içindir [K2] → SaaS barındırma gibi **sürekli** aktarıma uymaz.
- Bu araştırmada Türkiye için yayımlanmış bir ülke yeterlilik kararı **bulunamadı** [K1].
- Sağlayıcılar: Supabase DPA'sı AB 2021/914 SCC'lerini içeriyor, sözleşme tarafı Supabase Pte. Ltd (Singapur); veri ABD ve Singapur'a SCC ile
  aktarılıyor; Frankfurt bölgesinde Postgres, Auth ve Storage nesneleri bölgede kalıyor, ancak Storage CDN önbelleği Cloudflare'de küresel [K5], [K22].
  Vercel DPA'sı da 2021 SCC modüllerini içeriyor; alt işleyen değişikliğinde 5 takvim günü itiraz süresi [K6]. **Bunlar AB SCC'sidir, KVKK standart
  sözleşmesi değildir.**
- Veri ihlali: Kurul'un 2019/10 sayılı kararına göre veri sorumlusu ihlali öğrendikten sonra en geç **72 saat** içinde Kurul'a bildirir [K21].
- VERBİS: 50'den az çalışan **ve** yıllık mali bilanço toplamı 100 milyon TL'den az olan (ana faaliyeti özel nitelikli veri işlemek olmayan)
  veri sorumluları kayıttan istisna (2023/1154; 2025/1572 ile uygulama esasları) [K7]. İstisna, Kanun'daki diğer yükümlülükleri kaldırmaz [K7].

| Seçenek (aktarım dayanağı) | Artı | Eksi |
| --- | --- | --- |
| **A. KVKK standart sözleşmesi** (sağlayıcılarla; modül hukukçu seçer) + Kurum'a 5 iş günü içinde bildirim | Kanun'un öngördüğü yol | ABD/Singapur sağlayıcılarının Kurul metnini imzalayıp imzalamayacağı belirsiz; her sağlayıcı için ayrı iş |
| B. Türkiye'de barındırma (yurt içi bulut) | Aktarım sorunu büyük ölçüde kalkar | Mimari değişikliği (Supabase/Vercel yerine), maliyet ve iş yükü; tek kişilik ekip için ağır |
| C. Mevcut durumda kal, yalnız aydınlatma metniyle | Emek yok | Hukuki risk; önerilmez |

**Öneri:**
- **Roller:** ziyaretçi talepleri ve CRM'de **ofis veri sorumlusu, KARAYS veri işleyen**; KARAYS'ın kendi müşteri hesap/fatura verisi ve
  `platform_leads` için **KARAYS veri sorumlusu** (karar kaydındaki öneri).
- **Hukukçudan tek paket:** hizmet sözleşmesi, veri işleme sözleşmesi (iade/silme, alt işleyen izni ve listesi, ihlal bildirimi, denetim), alt işleyen
  listesi (Supabase, Vercel, Resend, Cloudflare R2, ileride ödeme sağlayıcısı), KARAYS aydınlatma/gizlilik/çerez metinleri, ofislere şablon metinler.
- **Aktarım:** **A**'yı hukukçuyla yürütün; sağlayıcılara KVKK standart sözleşmesini imzalayıp imzalamayacaklarını **yazılı** sorun. Olumsuz
  yanıt gelirse B'yi hukukçunun risk değerlendirmesiyle tartın. Bu, Türkiye'deki birçok SaaS'ın ortak sorunudur; tek başına çözülmeye çalışılmamalı.
- Supabase projesinin **AB bölgesinde (eu-central-1)** kalması sürdürülsün ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)'de kayıtlı).

**Uzman teyidi:** **[HUKUKÇU]** zorunlu — rollerin teyidi; standart sözleşme modülü, tarafları, kim bildirecek; sağlayıcı imzalamazsa yol;
VERBİS istisnası; ofis–KARAYS ihlal bildirimi süresi; Supabase Storage CDN önbelleğinin küresel olmasının etkisi.

**Kaynaklar:** [K1]–[K7], [K21], [K22].

---

## 8. Altyapı ve yönetim

### D-11 · Altyapı planları ve bütçe — **en acil**

**Soru:** Hangi ücretli planlar alınacak, aylık tavan ne?

**Neden acil:** [BACKUP_RESTORE.md](BACKUP_RESTORE.md) (31.10.2026, sahip kanıtı) canlı Supabase projesinin **Free planda** olduğunu ve
"Free Plan does not include project backups" yazdığını kaydediyor; tek yedek R2 gece yedeği. Vercel Hobby ise yalnız kişisel, ticari olmayan
kullanım içindir; ticari kullanım hesabın duraklatılma sebepleri arasında [K24].

| Kalem | Plan | Fiyat (arama özeti, 02.11.2026) | Not |
| --- | --- | --- | --- |
| Supabase | **Pro** | **25 USD/ay**, ilk proje dahil; 10 USD işlem kredisi (Micro/Nano bir projeyi karşılar); günlük yedek **7 gün** saklanır; harcama tavanı varsayılan açık [K23] | PITR eklentisi **100 USD/ay** (7 günlük saklama başına) — şimdi değil [K23]. SOC 2 raporu Team planında [K22] |
| Vercel | **Pro** | **20 USD/ay** platform ücreti, 20 USD kullanım kredisi ve 1 dağıtım yapan koltuk; ek koltuk 20 USD/ay; Viewer koltuk ücretsiz [K24] | Kredi biterse kullanım ayrıca faturalanır; bütçe uyarısı açılmalı |
| Cloudflare R2 | Kullandıkça | Standart depolama **0,015 USD/GB-ay**; ayda 10 GB-ay, 1 milyon A sınıfı ve 10 milyon B sınıfı işlem ücretsiz; çıkış (egress) ücretsiz [K25] | Bugünkü yedek hacminde büyük olasılıkla ücretsiz katmanda |
| Resend | Free → Pro | Free: **3.000 e-posta/ay, 100/gün**; Pro **20 USD/ay**, 50.000 e-posta/ay, günlük sınır yok (belgeler arasında çelişki var) [K26] | Talep bildirimi hacmi artınca |
| Alan adları | Yıllık | Bu araştırmada fiyat bakılmadı | D-13 |
| GitHub | Pro/Team | Bakılmadı | Yalnız D-12'de C seçilirse (dal koruması) |

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Supabase Pro + Vercel Pro şimdi** (≈ 45 USD/ay + kullanım) | Yedek, duraklama yok, koşullara uygun | Sabit gider |
| B. Yalnız Supabase Pro | Yedek sorunu kalkar | Vercel koşulları ihlali sürer |
| C. Hiçbiri (R2 yedeğine güven) | Gider yok | Platform yedeği yok, proje duraklayabilir, Vercel hesabı durdurulabilir |

**Öneri: A**, hesaplar şirket adına ve 2FA'lı; Supabase harcama tavanı açık kalsın; Vercel'de bütçe uyarısı. **Aylık tavan önerisi: 60 USD**
(kur ve kullanım için pay). PITR ve Resend Pro müşteri sayısı artınca. Plan değişince BACKUP_RESTORE "Sıklık/saklama" satırı yeniden okunur.

**Uzman teyidi:** **[MALİ MÜŞAVİR]** Yurt dışı hizmet alımında KDV (sorumlu sıfatıyla) ve gider kaydı; şirket kartıyla ödeme.

**Kaynaklar:** [K22]–[K26].

### D-12 · Depo görünürlüğü

**Soru:** Kod herkese açık depoda kalsın mı?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. Public kalsın | Actions ve dal koruması ücretsiz | Kod, güvenlik modeli ve iş akışı logları açık |
| B. Bu depo private | Tek adım | Profil README'si ve diğer projeler gizlenir; Free'de dal koruması yok |
| **C. KARAYS ayrı private depoya** | Temiz yetki; profil etkilenmez | Taşıma işi (Vercel, sırlar, iş akışları); dal koruması için GitHub Pro/Team |

**Öneri: C**, ilk ücretli müşteriden önce değilse bile ilk 30 gün içinde. Geçmiş public olduğundan taşımadan önce tüm geçmişte sır taraması.
Not: herkese açık depoda 60 gün etkinlik olmazsa zamanlanmış iş akışları kapanır ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)); private depoda
Actions dakika kotası ayrıca kontrol edilmeli.

**Uzman teyidi:** Gerekmez. **Kaynaklar:** karar kaydı D-12'deki GitHub belgeleri.

### D-13 · Alan adı stratejisi

**Soru:** Müşteri siteleri KARAYS alan adının alt alanında mı, ayrı bir alan adında mı?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| A. KARAYS alan adının alt alanı | Tek alan adı | İtibar riski ortak; ana alan adının DNS'i joker için Vercel'e taşınmalı |
| **B. Ayrı kök alan adı** | İtibar ve çerez yalıtımı; KARAYS'ın e-posta DNS'i yerinde kalır | Ek alan adı ücreti |

**Öneri: B.** Ayrıca KARAYS e-postası (Resend) ayrı bir alt alan adından gönderilsin. Alan adları şirket adına.

**Uzman teyidi:** Gerekmez. **Kaynaklar:** karar kaydı D-13 (Vercel joker alan adı belgesi).

### D-14 · Dal ve yayın stratejisi

**Soru:** Production dalı, onay ve yayın biçimi?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Korumalı `main` + PR + elle Promote** | İnceleme kapısı; şu anki fiili akışa yakın | Dal koruması private depoda ücretli |
| B. Mevcut düzen | — | Önerilmez |
| C. `main` + ayrı `production` | Daha sıkı | Bu ölçekte fazla |

**Öneri: A.** Geliştirme günlüğüne göre son yayınlar PR birleştirmesiyle yapılıyor (PR #3, PR #4); bu fiili düzeni kayda geçirip dal
korumasını (zorunlu CI) ekleyin. Dal korumasının bugünkü durumu bu araştırmada doğrulanmadı.

**Uzman teyidi:** Gerekmez.

### D-15 · Güvenlik başlıkları (kalan kısım)

**Bugünkü durum (kodla doğrulandı, 02.11.2026):**
- CSP üretimi test edilebilir modülde; kendi Supabase adresleri açıkça listeleniyor; `https://*.supabase.co` jokeri hâlâ açık
  (`next.config.ts` `supabaseWildcard: true`); `script-src`/`style-src` içinde `'unsafe-inline'` sürüyor (`src/lib/csp.ts`).
- Uygulamanın kendi çerezleri `httpOnly: true` (kapsam, davet, oturum, önizleme çerezleri).
- HSTS tüm ana makinelerde `max-age=63072000; includeSubDomains; preload` (`next.config.ts`) → müşteri alan adlarında da gidiyor (PF-10 açık).

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Küçük adımlar:** (1) önizlemede doğrulayıp joker kaldır (KI-32), (2) müşteri alan adlarında HSTS'yi `includeSubDomains; preload` olmadan gönder, (3) CSP Report-Only ile nonce denemesi | Düşük risk, geri alınabilir | Birkaç ayrı yayın |
| B. Tek seferde nonce'lu CSP | Güçlü koruma | Next.js'te nonce dinamik render ister; ISR/önbellek etkisi; kırılma riski |

**Öneri: A**, sırayla; (2) müşterinin kendi alt alan adlarını HTTPS'e zorlamaması için özel alan adı açılmadan önce yapılmalı.

**Uzman teyidi:** Gerekmez.

### D-16 · Güvenlik güncellemesine onay

**Durum:** Karar kaydında "Bekliyor" görünüyor, ama fiilen **uygulandı**: O-4 yalnız güvenlik yaması production'a çıktı (`650fd4e`), sonra tam kod
(`6b698e9`). `package.json` bugün `next` 16.4.3, `sharp` ^0.35.5 (karar kaydının önerdiği 16.3.8 / 0.35.5'ten yeni).

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Kaydı "uygulandı" diye kapat + kalıcı kural:** yalnız güvenlik yaması içeren, CI'ı yeşil değişiklik için sahip onayı tek cümle; haftalık `npm audit` / bağımlılık uyarısı | Gelecekteki açıklar hızlı kapanır | Küçük süreç disiplini |
| B. Yalnız kaydı kapat | — | Sonraki açıkta aynı tartışma |

**Öneri: A.** Depoda otomatik bağımlılık uyarısı yapılandırması görülmedi; GitHub bağımlılık uyarıları açılabilir.

**Uzman teyidi:** Gerekmez.

### D-17 · Elle işletim ve otomasyon eşiği

**Soru:** Ne zaman ödeme/hatırlatma otomasyonuna geçilecek?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. Sinyal tabanlı eşik:** 5 ücretli müşteri **veya** ayda 2+ geciken ödeme **veya** ayda 4+ saat elle tahsilat işi | Gereksiz kod yok; ölçülebilir | Aylık ölçüm gerekir |
| B. Sabit tarih (ör. 6 ay sonra) | Planlanabilir | Gerçek ihtiyaçla ilgisiz |
| C. Hemen otomasyon | Elle iş biter | PCI/KVKK yükü, yeni alt işleyen, bakım; erken |

**Öneri: A.** Aylık mutabakat (OPS-03) sırasında üç sinyal not edilir; biri aşılınca D-08 teklif süreci başlar.

**Uzman teyidi:** Gerekmez.

### D-18 · Olay/destek sorumlusu ve hizmet taahhüdü

**Soru:** Kim sorumlu, destek saatleri ne, sözleşmede SLA olacak mı?

| Seçenek | Artı | Eksi |
| --- | --- | --- |
| **A. "En iyi çaba", sayısal SLA ve kredi yok;** yazılı destek saatleri ve ilk yanıt hedefi | Tek kişilik kapasiteyle uyumlu; verilemeyecek söz verilmez | Kurumsal müşteri sayısal SLA isteyebilir |
| B. %99,9 aylık erişilebilirlik + hizmet kredisi | Satışta güven | %99,9 yılda yaklaşık 8,7 saat kesintiye izin verir [K27]; Vercel/Supabase kesintileri kontrolünüz dışında; tek kişiyle taahhüt riskli |
| C. Yalnız Kurumsal planda SLA | Ayrışma | Erken |

**Öneri: A.** Sözleşmede: destek kanalı e-posta + telefon, hafta içi 09:00–18:00; S1 (site/panel tamamen kapalı) için mesai içinde 4 saat
içinde ilk yanıt **hedefi** (taahhüt değil); planlı bakım önceden duyurulur ve düşük trafik saatinde. RPO ≤ 24 saat / RTO ≤ 4 saat **iç hedef**
kalır. Piyasada hizmet kredisi çoğu zaman tek çare olarak yazılır ve en düşük planlarda SLA verilmeyebilir [K27] — ileride B/C'ye geçilirse
bu yapı kullanılabilir. **Veri ihlali:** KARAYS (veri işleyen) ihlali ofise **gecikmeksizin** bildirir; ofisin (veri sorumlusu) Kurul'a bildirim
süresi en geç 72 saattir [K21]; bu yüzden sözleşmede KARAYS için daha kısa bir süre (ör. 24 saat) yazılması önerilir. Tüm hesaplarda 2FA.

**Uzman teyidi:** **[HUKUKÇU]** Sorumluluk sınırı, "en iyi çaba" maddesi, ihlal bildirim süresi.

**Kaynaklar:** [K21], [K27].

---

## 9. Kaynaklar

Tüm erişimler **02.11.2026**. "(arama özeti)" = sayfa bu oturumda açılamadı; bilgi arama motorunun o sayfadan verdiği özetten alındı.
İkincil kaynaklar (hukuk bürosu, blog) açıkça belirtildi.

| No | Kaynak | Tür |
| --- | --- | --- |
| K1 | KVKK — Yurt Dışına Aktarım: https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim ; Yönetmelik metni (PDF): https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/aaf0eeec-9599-4c68-8b7a-33039059ca41.pdf | Resmi (arama özeti) |
| K2 | KVKK — Kişisel Verilerin Yurt Dışına Aktarılması Rehberi: https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi | Resmi (arama özeti) |
| K3 | KVKK — Standart sözleşmelerde dikkat edilecek hususlar duyurusu: https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu | Resmi (arama özeti) |
| K4 | KVKK — Standart Sözleşme Bildirim Modülü duyurusu: https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu ; modül: https://standartsozlesme.kvkk.gov.tr/ | Resmi (arama özeti) |
| K5 | Supabase DPA: https://supabase.com/legal/dpa ; Veri yerleşimi ve aktarım SSS: https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq | Sağlayıcı (arama özeti) |
| K6 | Vercel DPA: https://vercel.com/legal/dpa | Sağlayıcı (arama özeti) |
| K7 | KVKK — VERBİS istisna kriteri (2023/1154): https://www.kvkk.gov.tr/Icerik/7646 ; 2025/1572 uygulama esasları: https://www.kvkk.gov.tr/Icerik/8577 ; Sorularla VERBİS: https://verbis.kvkk.gov.tr/sharedFolder/sorularla-verbis.pdf | Resmi (arama özeti) |
| K8 | iyzico Abonelik belgeleri: https://docs.iyzico.com/en/products/subscription ; işlemler: https://docs.iyzico.com/en/products/subscription/subscription-implementation/subscription-transactions ; "subscription api is not enabled by default": https://github.com/iyzico/iyzipay-node/issues/61 | Sağlayıcı + GitHub (arama özeti) |
| K9 | iyzico ücret yardım sayfası: https://www.iyzico.com/en/help-center/general/pricing (açılamadı); oran iddiaları üçüncü taraf: https://www.ticimax.com/blog/iyzico-komisyon-oranlari | Sağlayıcı (açılamadı) + ikincil |
| K10 | PayTR tekrarlayan ödeme: https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-kart-tekrarlayan-odeme ; oran yapısı (ikincil): https://www.ideasoft.com.tr/paytr-komisyon-oranlari/ | Sağlayıcı + ikincil (arama özeti) |
| K11 | Param geliştirici belgesi: https://dev.param.com.tr/api | Sağlayıcı (arama özeti) |
| K12 | Stripe Smart Retries: https://docs.stripe.com/billing/revenue-recovery/smart-retries ; ikincil: https://docs.stigg.io/documentation/native-integrations/billing/stripe/payment-retry-configuration , https://documentation.outpost.pub/features/failed-payment-flow | Sağlayıcı + ikincil (arama özeti) |
| K13 | Stripe küresel erişim: https://stripe.com/global (açılamadı); ikincil: https://osome.com/uk/blog/stripe-account-turkey-guide | İkincil |
| K14 | Mesafeli Sözleşmeler Yönetmeliği (tüketici tanımı), ikincil özet: https://www.erdem-erdem.av.tr/bilgi-bankasi/mesafeli-sozlesmelere-dair-yonetmelik | İkincil (resmi metin mevzuat.gov.tr'den okunmalı) |
| K15 | Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (m.6): https://www.lexpera.com.tr/mevzuat/yonetmelikler/ticari-iletisim-ve-ticari-elektronik-iletiler-hakkinda-yonetmelik | Mevzuat yayıncısı (arama özeti) |
| K16 | KVKK — Silme, Yok Etme veya Anonim Hale Getirme Yönetmeliği: https://www.kvkk.gov.tr/Icerik/5441/KISISEL-VERILERIN-SILINMESI-YOK-EDILMESI-VEYA-ANONIM-HALE-GETIRILMESI-HAKKINDA-YONETMELIK ; ikincil özet: https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/kisisel-verilerin-silinmesi-yok-edilmesi-veya-anonim-hale-getirilmesi-hakkinda-yonetmelik-yayimlandi/255 | Resmi + ikincil (arama özeti) |
| K17 | TTK/VUK saklama süreleri, TÜRMOB: https://www.turmob.org.tr/BasinOdasi/BasinArsiv/Detay/9682a497-ca2e-487e-abb6-fe3440cdfa69/vuk-a-gore-defter-ve-belgelerin-saklanma-sureleri-ve-ozellikli-durumlar ; https://www.alomaliye.com/2013/11/22/defter-ve-belgelerin-saklanmasinda-zaman-asimi-sureleri/ | Meslek kuruluşu + ikincil (madde metinleri mevzuat.gov.tr'den okunmalı) |
| K18 | GİB — 509 Sıra No.lu VUK Genel Tebliği güncel metni (2026): https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=MEVZUAT_TEBLIGLER%2FUNIVERSAL%2F2026%2FMEVZUAT_TEBLIGLER_2026_VukTeb509_Guncel.pdf ; geçiş takvimi tablosu: https://ebelge.gib.gov.tr/dosyalar/509_s.VUK_GT_Kapsaminda_Uygulamalara_Gecis_Takvimi_Tablosu_(3).pdf | Resmi (arama özeti) |
| K19 | e-Arşiv/e-Fatura eşikleri, ikincil: https://www.parasut.com/blog/e-arsiv-fatura-limitleri , https://sovos.com/tr/blog/kdv/2025te-e-arsiv-ve-e-fatura-zorunlulugu-nasil-degisti/ | İkincil — rakamlar birbirini tutmuyor |
| K20 | 7346 sayılı Cumhurbaşkanı Kararı (KDV %20): https://www.pwc.com.tr/tr/hizmetlerimiz/vergi/dolayli-vergi/bultenler/kdv-otv-bultenleri/2023/kdv-oranlarinda-degisiklik.html | İkincil (RG 07.07.2023/32241) |
| K21 | KVKK — Veri ihlali bildirimi, 2019/10 sayılı karar: https://www.kvkk.gov.tr/Icerik/5362/Veri-Ihlali-Bildirimi | Resmi (arama özeti) |
| K22 | Supabase bölgeler: https://supabase.com/docs/guides/platform/regions ; güvenlik/SOC 2: https://supabase.com/security | Sağlayıcı (arama özeti) |
| K23 | Supabase fiyatlandırma: https://supabase.com/pricing ; işlem kredisi: https://supabase.com/docs/guides/platform/manage-your-usage/compute | Sağlayıcı (arama özeti) |
| K24 | Vercel Pro: https://vercel.com/docs/plans/pro-plan ; Hobby: https://vercel.com/docs/plans/hobby ; Adil kullanım: https://vercel.com/docs/limits/fair-use-guidelines ; duraklatma: https://vercel.com/kb/guide/why-is-my-account-deployment-blocked | Sağlayıcı (arama özeti) |
| K25 | Cloudflare R2 fiyatlandırma: https://developers.cloudflare.com/r2/pricing/ | Sağlayıcı (arama özeti) |
| K26 | Resend fiyatlandırma: https://resend.com/pricing ; kotalar: https://resend.com/docs/knowledge-base/account-quotas-and-limits | Sağlayıcı (arama özeti) |
| K27 | SaaS SLA örnekleri: https://workspace.google.com/terms/sla ; https://www.cohesity.com/content/dam/cohesity/agreements-docs/saas-sla.pdf ; https://www.cloudnuro.ai/blog/saas-sla | Sağlayıcı + ikincil (arama özeti) |

**Bu araştırmada bulunamayan / doğrulanamayan:** iyzico, PayTR ve Param komisyon oranları; Stripe'ın resmi ülke listesi; e-Arşiv/e-Fatura
2026 hasılat ve tutar eşikleri; KVKK yeterlilik kararı listesi; SaaS hizmetinin KDV oranının özel listede olup olmadığı; Supabase yedeklerinin
fiziksel konumu; ödeme hatırlatmasının ticari ileti istisnasına girip girmediği; 6563 kapsamında sitede zorunlu tanıtıcı bilgilerin tam listesi.
