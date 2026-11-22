# KARAYS – Hukuk uyum doğrulama ve risk notu (22.11.2026)

> **Bu bir hukuki görüş veya tavsiye değildir.** Avukata götürülecek teknik/uyum notudur. Taslak metinler avukat onayı olmadan yayına alınmamalıdır. `[Köşeli parantez]` = doldurulacak alan.
>
> **Önceki belge:** `docs/HUKUK_ARASTIRMA_2026-11.md` (07.11.2026), `LEGAL_DATA_MAP.md`, `src/modules/karay/legal.ts`, `src/modules/content/default-pages.ts` (istenen `src/modules/site/default-pages.ts` yolu yok; ofis metinleri bu dosyada). Önceki belgede yazılanlar burada tekrar edilmedi. Yalnızca doğrulama, düzeltme ve eksikler var.
>
> **Erişim kısıtı (önemli):** Bu oturumda `mevzuat.gov.tr`, `kvkk.gov.tr`, `resmigazete.gov.tr`, `ticaret.gov.tr`, `btk.gov.tr`, `iys.org.tr` ve `vercel.com` adreslerine doğrudan bağlanılamadı (DNS/ağ izni yok). Bu yüzden resmî metinlerin tam hâli okunamadı. Doğrulama web araması üzerinden yapıldı. Arama sonuçları resmî sayfaların URL'sini ve başlığını, çoğu durumda da ikincil kaynaklardaki alıntıları gösterdi. Her satırda kaynağın türü belirtildi: **[R]** = resmî kurum sayfası (en azından başlık/URL ile teyit edildi), **[İ]** = ikincil kaynak (hukuk bürosu, mevzuat sitesi, haber). Yalnızca [İ] dayanaklı satırlar resmî metinden teyit edilmelidir. Hiç kaynak bulunamayan noktalar **"doğrulanamadı"** diye işaretlendi. Tam doğrulama için oturum ağ ayarlarında yukarıdaki alan adlarına izin verilmelidir.


> **Claude doğrulaması (22.11.2026, ek web araması):** EİDS bulgusu (R-1) resmî duyuruyla teyit edildi: Ticaret Bakanlığı, kimlik ve
> yetki doğrulamasının Instagram, Facebook ve WhatsApp dahil elektronik ortamdaki tüm taşınmaz ilanlarını kapsadığını ve sosyal
> medyada yalnız EİDS doğrulamalı ilan bağlantısı paylaşılabileceğini duyurdu; kurala aykırı ilan veren emlak işletmelerine idari
> para cezası uygulandı ([ticaret.gov.tr duyurusu](https://ticaret.gov.tr/haberler/ticaret-bakanligi-tasinmaz-ve-tasit-ticaretinde-uygulanmakta-olan-elektronik-ilan-dogrulama-sistemi-eids-kapsaminda-kimlik-ve-yetki-dogrulamasi-zorunlulugunu-instagram-facebook-ve-whatsapp-da-dahil-olmak-uzere-elektronik-ortamda-verilen-tum-tasinmaz-ve-tasi),
> [ikinci duyuru](https://ticaret.gov.tr/haberler/ticaret-bakanligi-sosyal-medyadaki-sahte-ilanlara-gecit-vermiyor-eids-kurallarina-aykiri-paylasimlara-karsi-yaptirimlar-kararlilikla-uygulaniyor)).
> EİDS'ye entegre firmalar listesinde portalların yanında kendi sitelerinde ilan yayımlayan ofis ağları (ör. Remax, Realty World) da
> yer alıyor ([alomaliye, 13.01.2026](https://www.alomaliye.com/2026/01/13/tasinmaz-ilanlarinda-eidsye-entegre-olan-firmalara-iliskin-duyuru/));
> bu, ofisin kendi sitesinin de kapsamda sayılabileceğine işaret eder. Ofis sitesinin açıkça kapsamda olduğuna dair resmî metin
> bulunamadı. **Uygulanan:** ofis sitelerinden WhatsApp/Facebook/X paylaşım düğmeleri kaldırıldı (bağlantı kopyalama kaldı).
> **Açık:** ofis sitesindeki ilanların EİDS kapsamı (avukat sorusu 2 ve İl Müdürlüğüne yazılı soru).

---

## 0. Önceki belgeden bu yana en önemli değişiklikler (kısa)

1. **KVKK İlke Kararı 2026/347** (18.02.2026; RG 24.03.2026/33203 [İ]): aydınlatma ve açık rıza ayrı metin olmalı. Aydınlatma için **onay/kabul istenemez**, yalnızca "okudum" geri bildirimi alınabilir. Hukuki sebep açık rıza değilse ayrıca rıza metni sunulmamalı. Mevcut formlar ("…Aydınlatma Metni'ni okudum.") bu karara **uygun**. Önceki belgedeki ve DPA kabul akışındaki "okudum, kabul ediyorum" kalıbı yalnızca **sözleşme kabulü** için kullanılabilir, aydınlatma için kullanılamaz.
2. **EİDS genişledi:** satılık konut ilanlarında yetki doğrulaması 2026 Şubat'ında zorunlu oldu (1 Şubat mı 15 Şubat mı, kaynaklar çelişiyor). Ticaret Bakanlığı 2026'da EİDS zorunluluğunun **Instagram, Facebook ve WhatsApp dahil elektronik ortamdaki tüm taşınmaz ilanlarını** kapsadığını duyurdu [R]. Ofisin **kendi web sitesinin** kapsamda olup olmadığı açık değil (**doğrulanamadı**). Önceki belgedeki "KARAYS'ın EİDS yükümlülüğü muhtemelen yok" değerlendirmesi artık zayıf kalıyor. Bkz. R-1.
3. **VUK Genel Tebliği Sıra No 595** (RG 05.09.2026/33361) [İ]: taşınmaz satış/kiralama **ilanlarının yayımlanmasına aracılık eden yer sağlayıcılar** GİB'e aylık bildirim yapmakla yükümlü oldu. KARAYS'ın kapsama girip girmediği belirsiz. Bkz. R-2.
4. **Taşınmaz Ticareti Yönetmeliği** 29.04.2026 (RG 33238) ve 01.10.2026 (RG 33387) tarihlerinde değişti [İ]. Taşınmaz satışlarında güvenli ödeme sistemi 01.12.2026'dan itibaren zorunlu olacak. Önceki belgede bu değişiklikler yok.
5. **VERBİS:** 2025/1572 kararının uygulama esasları 2025/2393 kararıyla (25.12.2025) netleşti [İ]. Bilanço usulü dışında defter tutanlar (şahıs/işletme hesabı) için **yalnızca çalışan sayısı** esas alınıyor. 2026/1026 kararıyla kayıt süresi 05.06.2026'ya uzatılmıştı; bu süre doldu [R/İ].
6. **Resend verileri ABD'de saklanıyor** [İ: Resend'in kendi GDPR sayfası]. `legal.ts` ve önceki belgede yazan "Resend – AB" ifadesi **yanlış**.
7. **Vercel Hobby planı ticari kullanıma kapalı.** Ücretsiz pilot da "ticari" tanımına giriyor [İ: Vercel docs alıntısı]. Bkz. R-6.
8. **Önceki belgede atıf yapılan 2015 tarihli "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik" eskimiş.** Güncel düzenleme: RG 29.12.2022/32058 sayılı "Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik"; 5. maddesi 08.03.2025'te değişti [İ].
9. **Kod-metin çelişkisi:** `legal.ts` "Kabul ve ret seçenekleri bantta eşit olarak sunulur" diyor. Oysa `src/components/common/cookie-consent.tsx:126-131` hâlâ dolu "Kabul et" ile çerçeveli "Yalnızca zorunlu" düğmesini gösteriyor. Yetki belgesi numarası yalnızca altbilgide gösteriliyor (`site-footer.tsx:187`, `patterns/footer/parts.tsx:91`). İlan detayı, ilan kartı ve WhatsApp paylaşım metninde yok.

---

## 1. Mevcut belgedeki mevzuat iddialarının doğrulaması

Durum: ✅ doğrulandı · ⚠️ eksik veya düzeltilmeli · ❌ yanlış veya eskimiş · ❓ doğrulanamadı

| # | Mevcut iddia (HUKUK_ARASTIRMA_2026-11 / legal.ts) | Durum | Bulgu ve kaynak |
|---|---|---|---|
| 1 | 7499 s.K. RG 12.03.2024/32487; m.9'un yeni hâli 01.06.2024'te yürürlüğe girdi, eski hâliyle birlikte uygulama 01.09.2024'e kadar sürdü | ✅ | 7499 RG 12.03.2024/32487 [İ hukukihaber]; yürürlük 01.06.2024 [İ ey.com]; geçiş süresi 01.09.2024'te bitti [İ]. https://www.hukukihaber.net/kvk-kanununda-ozel-nitelikli-kisisel-verilerin-islenmesi-ve-yurt-disina-veri-aktarimi-kapsaminda-yapilan-degisikliklere-iliskin-degerlendirmeler · https://ey.com/content/dam/ey-unified-site/ey-com/tr-tr/services/law/documents/ey-tr-kisisel-verilerin-korunmasi.pdf |
| 2 | Yurt Dışı Aktarım Yönetmeliği RG 10.07.2024/32598 | ✅ (tarih) | https://www.alomaliye.com/2024/07/10/kisisel-verilerin-yurt-disina-aktarilmasi/ [İ]. Sayı numarası birebir teyit edilmedi. |
| 3 | Standart sözleşme 4 modül (VS-VS, VS-Vİ, Vİ-Vİ, Vİ-VS) | ✅ | KVKK "Standart Sözleşmeler" sayfası [R] https://www.kvkk.gov.tr/Icerik/7929/Standart-Sozlesmeler · Modül 3 = veri işleyenden veri işleyene [R başlık]. |
| 4 | Standart sözleşme değiştirilmeden kullanılır; yalnızca seçimlik veya alternatif maddeler değiştirilebilir | ✅ | KVKK Şubat 2025 duyurusu [R] https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu |
| 5 | İmzalar tamamlandıktan sonra **5 iş günü** içinde fiziki olarak, KEP ile veya "Standart Sözleşme Bildirim Modülü" üzerinden bildirim | ✅ ⚠️ | Aynı duyuru [R] ve modül duyurusu (25.10.2024) [R] https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu. **Ek:** bildirim süresinin tespit edilebilmesi için her iki tarafın imza tarihi sözleşme üzerinde yazılmalı [İ alıntı, R duyuru]. Önceki belgede bu yoktu. |
| 6 | Yeterlilik kararı verilmiş ülke yok | ✅ (bugün itibarıyla bulunamadı) | Liste yayımlanmamış [İ EY 2025, Lexpera]. 2026 bültenlerinde de rastlanmadı [İ erdem-erdem 2026 Q3]. **Not:** 10.11.2025'te ilk kez "uluslararası sözleşme niteliğinde olmayan anlaşma" ile aktarım izni verildi, ancak bu yalnızca kamu kurumları (Göç İdaresi–BMMYK) için geçerli; KARAYS'ı ilgilendirmiyor [R] https://www.kvkk.gov.tr/Icerik/8538/uluslararasi-sozlesme-niteliginde-olmayan-anlasma-ile-yurt-disina-kisisel-veri-aktarimina-izin-verilmesi-hakkinda-duyuru |
| 7 | Açık rıza (arızi aktarım) düzenli aktarımda kullanılamaz | ✅ | Yurt Dışına Aktarım Rehberi (02.01.2025): olağan faaliyet akışındaki aktarımlar arızi sayılmaz [İ erdem-erdem]. Açık rıza ancak muhtemel riskler hakkında bilgilendirme yapılırsa geçerli [İ]. https://www.erdem-erdem.av.tr/bilgi-bankasi/yurt-disina-kisisel-veri-aktarimi-rehberi-neleri-duzenliyor |
| 8 | Standart sözleşme bildirmeme cezası 2026 için ~90.308–1.806.377 TL | ⚠️ | Alt sınır 90.308 TL [İ]. Üst sınır kaynaklarda **1.806.377 veya 1.806.177** olarak geçiyor (çelişki). Resmî tablo: https://www.kvkk.gov.tr/Icerik/8145/6698-sayili-kisisel-verilerin-korunmasi-kanunu-kapsaminda-idari-para-cezasi-tutarlari (açılamadı). |
| 9 | 2026 cezaları: aydınlatma 85.437–1.709.200 TL; veri güvenliği 256.357–17.092.242 TL; VERBİS 341.809–17.092.242 TL; yeniden değerleme oranı %25,49 | ✅ [İ] | https://www.mondaq.com/turkey/data-protection/1729106/ · https://cottgroup.com/tr/mevzuat/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari · VERBİS aralığı [İ mondaq 2026]. |
| 10 | m.6 özel nitelikli veri (önceki belgede yalnızca "DPA'da amaçlanmaz" diye geçiyordu) | ⚠️ eksik | 7499 ile m.6 yeniden düzenlendi. Açık rıza artık tek yol değil; m.6/3'te başka işleme şartları da var (kanunda öngörülme, fiilî imkânsızlık, alenileştirme, hakkın tesisi vb.). m.6/4 uyarınca Kurul'un belirlediği yeterli önlemler alınmalı. Sağlık ve cinsel hayat verisinin ayrı rejimi kalktı [İ]. KVKK rehberi (Haziran 2025): açık rıza dışında bir şart varsa ayrıca rıza alınmamalı [R başlık]. https://www.kvkk.gov.tr/Icerik/8364/Ozel-Nitelikli-Kisisel-Verilerin-Islenme-Sartlari · https://www.kvkk.gov.tr/Icerik/8184/Ozel-Nitelikli-Kisisel-Verilerin-Islenmesine-Iliskin-Rehber. **KARAYS için:** CRM notları ve değerleme mesajı gibi serbest metin alanlarına sağlık, din ya da ceza mahkûmiyeti bilgisi girilebilir (örnek: "engelli yakını için asansörlü daire"). DPA'da "amaçlanmaz" yazması yetmez; panelde alan altı uyarı ve DPA'da talimat gerekir (bkz. R-11). |
| 11 | Aydınlatma Tebliği RG 10.03.2018/30356; Tebliğ m.5: açık rıza ile aydınlatma ayrı yapılır, "ve benzeri" gibi genel ifadeler kullanılmaz, ispat yükü veri sorumlusundadır | ✅ | RG 10.03.2018 [R] https://resmigazete.gov.tr/eskiler/2018/03/20180310-5.htm · Tebliğ m.5 bentleri [İ lexpera] · KVKK Tebliğ sayfası [R] https://www.kvkk.gov.tr/Icerik/4132/aydinlatma-yukumlulugunun-yerine-getirilmesinde-uyulacak-usul-ve-esaslar-hakkinda-teblig |
| 12 | "Tebliğ değişikliği RG 28.04.2019, 30758" | ❓ | Bu değişikliğe ait hiçbir kaynak bulunamadı. Doğrulanamadı; avukat teyit etmeli veya ifade belgeden çıkarılmalı. |
| 13 | Aydınlatma ile açık rızanın ayrılması (Tebliğ m.5) | ⚠️ güncellenmeli | **Yeni:** İlke Kararı 2026/347 (karar tarihi 18.02.2026; RG 24.03.2026/33203) [İ, çok sayıda kaynak]. Aydınlatma için yalnızca "okudum/bilgi edindim" geri bildirimi alınır; "onaylıyorum/kabul ediyorum" ifadesi kullanılmaz. Tek kutuda aydınlatma ile rıza birleştirilemez. Hukuki sebep rıza değilse rıza metni sunulmaz. https://www.lexpera.com.tr/mevzuat/kurul-kararlari/kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-karari-2026-347-1 · https://www.alomaliye.com/2026/03/24/kvkkdan-yeni-ilke-karari-acik-riza-metni-ile-aydinlatma-metni-artik-ayri-duzenlenmeli/ · https://www.legal500.com/intelligence/turkey/privacy/2026347-say%C4%B1l%C4%B1-Ilke-karar%C4%B1-sonras%C4%B1nda-ac%C4%B1k-r%C4%B1za-ve-ayd%C4%B1nlatma-metinleri |
| 14 | Çerez Rehberi: ilk sürüm 20.06.2022; güncel sürüm KVKK Yayınları No:69, Temmuz 2025 | ✅ | KVKK rehber sayfası [R] https://kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber · güncelleme duyurusu 28.07.2025 [İ] https://www.erdem-erdem.av.tr/bilgi-bankasi/kisisel-verileri-koruma-kurumu-cerez-uygulamalari-hakkinda-rehberi-guncelledi |
| 15 | "Reddet düğmesi kabul düğmesiyle eşit olmalı" | ❓ | Rehberin 2025 metnindeki birebir ifade bulunamadı. İkincil kaynaklar "Tümünü Reddet, Tümünü Kabul Et kadar görünür olmalı" diyor [İ]. Rehber tavsiye niteliğindedir. Yine de düşük maliyetli bir düzeltme: düğmeleri eşitleyin (bkz. §3). |
| 16 | VERBİS: <50 çalışan **ve** <100 milyon TL bilanço **ve** ana faaliyeti özel nitelikli veri işleme olmayanlar muaf (2018/87, 2023/1154); 2025/1572 ile ana faaliyeti özel nitelikli veri olanlar için <10 çalışan ve <10 milyon TL | ✅ ⚠️ | KVKK duyurusu [R] https://kvkk.gov.tr/Icerik/8388/KAMUOYU-DUYURUSU · 2025/1572 RG 01.10.2025 [İ] · **Eksik:** 2025/2393 (25.12.2025) uygulama esasları: bilanço usulü dışında defter tutanlar için yalnızca **çalışan sayısı** esas alınır [İ] https://cottgroup.com/tr/blog/kvkk-gdpr/item/verbise-kayit-yukumlulugu-istisnasina-iliskin-uygulama-esaslari-netlestirildi · 2026/1026 kararı: 2025 bilançosuyla eşiği aşan kurumlar vergisi mükellefleri için son kayıt tarihi 05.06.2026 [R] https://www.kvkk.gov.tr/Icerik/8752/… · **Yurt dışına aktarım yapmak VERBİS muafiyetini kaldırmıyor.** Böyle bir koşula hiçbir kaynakta rastlanmadı (doğrulanamadı; resmî karar metniyle kontrol edilmeli). Yurt dışında yerleşik veri sorumlularının kayıt yükümlülüğü ise ayrıdır ve KARAYS'ı ilgilendirmez. |
| 17 | Veri ihlali: öğrenildikten sonra en geç 72 saat içinde Kurul'a bildirim (2019/10); veri işleyen gecikmeksizin veri sorumlusuna bildirir | ✅ | KVKK sayfası [R] https://www.kvkk.gov.tr/Icerik/5362/Veri-Ihlali-Bildirimi · https://www.alomaliye.com/2019/01/24/kvkk-karari-2019-10-kisisel-veri-ihlali-bildirim-usul-ve-esaslari/ [İ]. **İlgili kişilere bildirim:** bir ikincil kaynak "etkilenenler belirlendikten sonra en geç 72 saat" diyor, mevcut belge "makul en kısa süre" diyor. **Çelişkili; doğrulanamadı.** Güvenli uygulama: 72 saat. İlgili kişiye bildirimin asgari içeriği 2019/271 kararında belirlenmiş [R] https://kvkk.gov.tr/Icerik/5547/2019-271 |
| 18 | Kurul 2025/2451: ihlal ilanları Kurum sitesinde 60 gün yayımlanır | ⚠️ | 60 gün süresi teyit edildi [İ CMS] https://cms.law/en/tur/legal-updates/kvkk-limits-publication-period-for-data-breach-notices-to-60-days. Karar numarası ve tarihi doğrulanamadı. |
| 19 | Önceki belgede atıf yapılan "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik (RG 26.08.2015/29457) md.5" | ❌ eskimiş | Güncel düzenleme: **Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik**, RG 29.12.2022/32058; m.5 08.03.2025'te değişti [İ] https://www.resmigazete.gov.tr/eskiler/2022/12/20221229-5.htm · https://www.alomaliye.com/2025/03/08/elektronik-ticaret-araci-hizmet-saglayici-ve-elektronik-ticaret-hizmet-saglayicilar/. 2015 yönetmeliğinin yürürlükten kaldırıldığı birebir teyit edilemedi. |
| 20 | 6563 m.6 / Ticari İletişim Yönetmeliği: esnaf ve tacirlere önceden onay alınmadan ileti gönderilebilir, ret hâlinde durdurulur; gönderimden önce adresler İYS'ye kaydedilir ve ret kontrolü yapılır | ✅ [İ] | Yönetmelik metni alıntısı [İ] https://www.lexpera.com.tr/mevzuat/yonetmelikler/ticari-iletisim-ve-ticari-elektronik-iletiler-hakkinda-yonetmelik · https://www.parasut.com/blog/ileti-yonetim-sistemi-hakkinda-bilmeniz-gerekenler |
| 21 | Ret talebi 3 iş günü içinde uygulanır | ❓ | Bu turda kaynak bulunamadı; doğrulanamadı. |
| 22 | TTK m.39: ticari mektuplarda ve defter kayıtlarına dayanak belgelerde ticaret sicil no, unvan ve işletme merkezi gösterilir; MERSİS no sicil no yerine geçer | ✅ [İ] | https://www.alomaliye.com/2013/11/23/yeni-turk-ticaret-kanununa-gore-ticari-belgelerde-1-ocak-2014-tarihinden-itibaren-yer-almasi-gereken-zorunlu-bilgiler · İnternet sitesi açma zorunluluğu (TTK m.1524) yalnızca bağımsız denetime tabi sermaye şirketleri için geçerli. Bu tur yeniden doğrulanmadı; önceki kaynağa bakılabilir. |
| 23 | Taşınmaz Ticareti Yönetmeliği: ilanlarda yetki belgesi no ve iletişim bilgisi zorunlu | ✅ | Bakanlık açıklaması: "işletmeler … ilanlarında yetki belgesi numarasına ve iletişim bilgilerine yer verecekler" [R haber başlığı] https://ticaret.gov.tr/haberler/emlakcilik-faaliyetlerinde-yeni-duzen · Kural "ilan ve reklamlar" için konmuş, sadece portal ilanları için değil [İ taslak metin]. Madde numarası doğrulanamadı. |
| 24 | Yönetmelikteki önemli değişiklikler: 14.10.2020, 2023, 14.05.2024 | ⚠️ eksik | 2023 değişikliği **31.08.2023** tarihlidir (ilan platformlarına kimlik/yetki doğrulama yükümlülüğü) [İ] https://www.alomaliye.com/2023/08/31/tasinmaz-ticareti-hakkinda-yonetmelikte-degisiklik-31-08-2023/ · **Yeni:** RG 29.04.2026/33238 (güvenli ödeme sistemi, yetki belgesi tadili) ve RG 01.10.2026/33387 (geçici m.1 tarihi 01.07.2026 → 01.12.2026) [İ] https://www.alomaliye.com/2026/04/29/tasinmaz-ticareti-hakkinda-yonetmelikte-degisiklik-29-04-2026/ · https://www.mizan.com.tr/2026/10/02/tasinmaz-ticareti-hakkinda-yonetmelikte-degisiklik/ |
| 25 | EİDS: 15.09.2024'te devreye girdi; kademeli zorunluluk; yükümlülük öncelikle ilan platformlarında; KARAYS'ın yükümlülüğü muhtemelen yok | ⚠️ zayıfladı | Kimlik doğrulaması 01.11.2023'ten, kiralıkta yetki doğrulaması 01.01.2025'ten, satılıkta 2026 Şubat'ından itibaren zorunlu (1 mi 15 mi, çelişkili) [İ AA] https://www.aa.com.tr/tr/ekonomi/satilik-tasinmaz-ilanlari-icin-subattan-itibaren-dogrulama-donemi-basliyor/3813941 · Bakanlık: zorunluluk "Instagram, Facebook ve WhatsApp dahil … elektronik ortamda verilen tüm taşınmaz ve taşıt ilanlarını" kapsıyor [R] https://koop.ticaret.gov.tr/haberler/ticaret-bakanligi-tasinmaz-ve-tasit-ticaretinde-uygulanmakta-olan-elektronik-ilan-dogrulama-sistemi-eids-kapsaminda-kimlik-ve-yetki-dogrulamasi-zorunlulugunu-instagram-facebook-ve-whatsapp-da-dahil-olmak-uzere-elektronik-ortamda-verilen-tum-tasinmaz-ve-tasi · Sosyal medyada EİDS doğrulamalı ilan linki paylaşma zorunluluğu [R başlık] https://ticaret.gov.tr/haberler/ticaret-bakanligi-sosyal-medyadaki-sahte-ilanlara-gecit-vermiyor-eids-kurallarina-aykiri-paylasimlara-karsi-yaptirimlar-kararlilikla-uygulaniyor · **Ofisin kendi sitesi açıkça kapsamda mı: doğrulanamadı.** |
| 26 | 5651: yer sağlayıcı trafik bilgisini 1–2 yıl saklar; Yönetmelikte 6 ay geçiyor | ⚠️ | Kanun m.5/3: "bir yıldan az ve iki yıldan fazla olmamak üzere yönetmelikte belirlenecek süre" [İ, kanun kopyaları] https://aile.gov.tr/uploads/chgm/uploads/pages/kanunlar/5651-sayili-internet-ortaminda-yapilan-yayinlarin-duzenlenmesi-ve-bu-yayinlar-yoluyla-islenen-suclarla-mucadele-edilmesi-hakkinda-kanun.pdf (Aile Bakanlığı'nda yayımlanmış kanun metni). Yönetmelikteki güncel süre **doğrulanamadı**. Pratik öneri: kanuna uymak için en az 1 yıl. |
| 27 | 5651: yer sağlayıcılık bildirimi yapmayana idari para cezası | ⚠️ | Kanun metninde "yer sağlayıcılık bildiriminde bulunmayan … yüz bin Türk lirasından bir milyon Türk lirasına kadar" ifadesi var [İ, kanun kopyası]. Tutarın güncel olup olmadığı doğrulanamadı. Bildirim yeri ve şekli için yalnızca forum kaynağı bulundu (yersaglayici.btk.gov.tr, e-Devlet, alan adı CSV listesi; 2020'den beri "belge yerine bildirim" usulü) — **doğrulanamadı**. |
| 28 | Mesafeli Sözleşmeler Yönetmeliği ve 6502 yalnızca tüketici işlemlerine uygulanır | ✅ (genel ilke; bu tur yeniden kaynak aranmadı) | Ofis tacir/esnaf sıfatıyla hareket eder. Pilotta ücret alınmıyor, yani mesafeli **satış** da yok. Önceki belgedeki kaynaklara bakılabilir. |
| 29 | `legal.ts`: "Resend (bildirim e-postası iletimi; AB)" | ❌ | Resend'e göre gönderim bölgesi (eu-west-1) yalnızca iletimi belirler. **Hesap verileri, ileti içerikleri, loglar ve webhook verileri ABD'de saklanır**; bunları AB'ye taşıyan bir ayar yok [İ: Resend'in kendi sayfası] https://resend.com/security/gdpr · https://resend.com/docs/dashboard/domains/regions |
| 30 | "Supabase AB/Frankfurt" (bölge AB olduğuna göre aktarım sınırlı) | ⚠️ | Supabase, verinin seçilen bölgede **"öncelikle"** işlendiğini söylüyor. Yedekler, loglar, Edge Functions ve alt işleyenler bölge dışına çıkabilir. Sözleşme tarafı Supabase Inc. (ABD) [İ: Supabase'in kendi belgeleri] https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq · https://supabase.com/docs/guides/security/gdpr-compliance |
| 31 | "Cloudflare R2 ([AB yargı alanı])" | ✅ koşullu | R2'de kova düzeyinde `eu` yargı alanı seçilebiliyor ve depolama garanti ediliyor. Seçim kova **oluşturulurken** yapılır [İ: Cloudflare docs] https://developers.cloudflare.com/r2/reference/data-location/. Sahip, kovanın `eu` ile oluşturulup oluşturulmadığını kontrol etmeli. |

---

## 2. Eksik veya zayıf kalan riskler (önceki belgede yok ya da yetersiz)

Ciddiyet: **Y** yüksek, **O** orta, **D** düşük. "Pilot öncesi" sütunu tek ofisli, ücretsiz pilot için yazıldı.

| # | Risk | Kime | Ciddiyet | Pilot öncesi zorunlu mu? | Maliyet | Somut yapılacak |
|---|---|---|---|---|---|---|
| **R-1** | **EİDS kapsamının ofis sitesini ve WhatsApp paylaşımını da içermesi.** Bakanlık zorunluluğu "elektronik ortamda verilen tüm taşınmaz ilanları" için ilan etti [R]; sosyal medya ve WhatsApp paylaşımlarında EİDS doğrulamalı ilan linki istiyor. KARAYS'ın paylaşım düğmesi (`property-actions.tsx:191`, `wa.me/?text=`) ofis sitesindeki **doğrulanmamış** ilan linkini WhatsApp, Facebook ve X'e gönderiyor. Ofisin kendi sitesinin açıkça kapsamda olduğuna dair resmî metin bulunamadı (**doğrulanamadı**). Basına yansıyan yaptırımlar arasında erişim engeli ve yetki belgesi iptali var [R/İ]. | Ofis (ilan veren). KARAYS da ürün tasarımı nedeniyle etkileniyor. EİDS API'sine entegre "ilan platformu" sayılırsa doğrudan KARAYS'a düşer. | **Y** | Evet: en azından paylaşım düğmesi ve ilan alanı | Ücretsiz (kod değişikliği). EİDS API entegrasyonu ayrı bir iş ve maliyeti bilinmiyor. | (1) Pilot süresince ofis sitesindeki **WhatsApp/Facebook/X paylaşım düğmelerini kapatın** veya paylaşımı ofisin EİDS doğrulamalı portal ilanının linkine yönlendirin. (2) İlan formuna zorunlu alanlar ekleyin: "EİDS doğrulamalı ilan linki/numarası" ve "Mülk sahibi e-Devlet yetkisi alındı (tarih)". Alan boşsa ilan yayımlanmasın veya sitede gösterilmesin. (3) Ofisin bağlı olduğu Ticaret İl Müdürlüğüne yazılı soru sorun (ücretsiz): "Emlak işletmesinin kendi alan adındaki web sitesinde yayımladığı ilan EİDS kapsamında mıdır?" (4) KARAYS'ın ortak portal veya arama sayfası açmaması. |
| **R-2** | **VUK 595 (RG 05.09.2026): ilan yayımlanmasına aracılık eden yer sağlayıcılar GİB'e aylık bildirim yapar** [İ]. KARAYS ofislerin taşınmaz ilanlarını barındırıyor. Ancak ilan ofisin kendi sitesinde, ofisin kendi ilanı olarak yayımlanıyor; "aracılık" sayılıp sayılmayacağı belirsiz. Eşik ve istisna bulunamadı; ilk bildirim tarihi tebliğde ayrıca düzenlenmemiş [İ]. | KARAYS | **O** (tek ofislik pilotta pratik risk düşük, ölçeklenince yüksek) | Hayır, ama avukat veya mali müşavir görüşü alınmalı | Danışmanlık ücreti olabilir. GİB'den özelge istemek ücretsizdir. | Mali müşavirden tebliğ metnine göre görüş alın; gerekirse GİB'den özelge isteyin. Görüş gelene kadar ürün ve pazarlama dilinde "ilan platformu/portal" ifadesini kullanmayın; "ofisin kendi web sitesi yazılımı" deyin. https://www.pwc.com.tr/tr/hizmetlerimiz/vergi/bultenler/2026/vergi-usul-kanunu-genel-tebligi-sira-no-595.html · https://www.alomaliye.com/2026/09/05/vergi-usul-kanunu-genel-tebligi-sira-no-595/ |
| **R-3** | **Yurt dışı aktarımın pratikte kurulamaması.** Sağlayıcıların DPA'ları yalnızca AB SCC'lerine dayanıyor. Vercel, Cloudflare ve Sentry için KVKK standart sözleşmesi bulunamadı. Google Cloud DPA'sında "Turkish SCCs" tanımı var, ama fatura adresi Türkiye'de olan ve ayrı koşulları kabul eden Cloud/Workspace müşterileri için [İ: Google DPA]. AB SCC'si KVKK standart sözleşmesinin yerini tutmaz [İ]. **Tüketici Gmail hesabı için Google'ın veri işleme sözleşmesi bulunmadığı düşünülüyor (doğrulanamadı).** Standart sözleşme de bildirim de yokken düzenli aktarım yapmak hukuka aykırı aktarım riski taşır. Kurul'un bu durumu m.12/m.18-1(b) kapsamında cezalandırdığı ikincil kaynaklarda aktarılıyor (doğrulanamadı). Ceza aralığı 256.357–17.092.242 TL. | KARAYS (kendi verisi için VS, ofis verisi için Vİ, Modül 3). Ofis de veri sorumlusu olarak müteselsilen sorumlu (m.12/2). | **Y** | Evet: en azından **deneme ve belgeleme** pilot öncesi yapılmalı | Sözleşme ücretsiz; KEP veya modülle bildirim ücretsiz. Sağlayıcı imzalamazsa TR barındırma ücretli. | (1) Her sağlayıcıya (Supabase, Vercel, Resend, Sentry, Cloudflare) KVKK **Modül 3** (KARAYS kendi verisi için Modül 2) metnini doldurup e-imza talebiyle gönderin. İngilizce çeviri KVKK sitesinde var [R] https://kvkk.gov.tr/Icerik/7998/Standart-Sozlesme-Metinlerinin-Ingilizce-Cevirisine-Iliskin-Duyuru. (2) İmzalanırsa 5 iş günü içinde Bildirim Modülü üzerinden bildirin. (3) Yazışmaları saklayın. (4) Gerekmeyen aktarımları azaltın: `NOTIFY_EMAIL_DETAILS=minimal` kalsın (Resend'e kişisel veri gitmesin); destek için Gmail yerine alan adlı bir e-posta seçin; Sentry'de kişisel veri gönderimini kapatın. (5) Pilot ofis için Supabase'e **gerçek müşteri verisi girilmeden** önce avukat kararı alın. Avukat "risk kabulü" derse bunu pilot sözleşmesinde açıkça yazın (bkz. §5 m.8). |
| **R-4** | **AB'de barındırma m.9'u ortadan kaldırmaz.** KVKK'da kıstas Türkiye dışı olmaktır. Frankfurt da yurt dışıdır. Yurt dışındaki bulut sağlayıcısı veya alt işleyen, Rehber'e göre yurt dışı aktarım sayılır [İ]. Ayrıca sözleşme tarafı ABD şirketi (Supabase Inc., Vercel Inc., Functional Software Inc., Cloudflare Inc.). Supabase de bölge dışında işleme yapılabileceğini kabul ediyor [İ]. AB'de barındırmanın tek faydası, alıcı ülkenin AB olmasının risk değerlendirmesini kolaylaştırmasıdır. | KARAYS + ofis | Y (R-3'ün parçası) | — | — | Aydınlatma metinlerinde ülkeleri doğru yazın (AB-Almanya, AB-İrlanda, ABD). "Verileriniz AB'de, dolayısıyla güvende" gibi ifade kullanmayın. https://www.erdem-erdem.av.tr/bilgi-bankasi/yurt-disina-kisisel-veri-aktarimi-rehberi-neleri-duzenliyor |
| **R-5** | **Metinler gerçeği yansıtmıyor (aydınlatmaya aykırılık).** `legal.ts` ve `default-pages.ts` yurt dışı aktarımın "standart sözleşme ve Kurum'a bildirim ile yapıldığını" yazıyor; bu henüz yapılmadı. Resend "AB" yazıyor ama veriler ABD'de. Çerez politikası "eşit sunulur" diyor ama düğmeler eşit değil. Aydınlatma Tebliği'ne göre ispat yükü veri sorumlusunda. Yanlış beyan, aydınlatma ihlali (85.437–1.709.200 TL) ve güven kaybı riski taşır. | KARAYS (kendi sitesi); ofis (ofis sitesi) | **Y** | **Evet** | Ücretsiz | §3'teki eski → yeni değişiklikleri uygulayın. |
| **R-6** | **Vercel Hobby planında ticari kullanım.** Vercel'e göre Hobby yalnızca ticari olmayan kişisel kullanım içindir; "ticari kullanım", projede emeği geçen herhangi birinin maddi kazanç amacıyla kullandığı her deployment'tır [İ: Vercel docs alıntısı] https://vercel.com/docs/limits/fair-use-guidelines. KARAYS ticari bir ürün; pilot site ise bir emlak ofisinin müşteri edinme sitesi. Ücret alınmasa da **ticari sayılır**. Sonucu hesabın askıya alınması olabilir; pilot sitesi kesintiye uğrar (sözleşmesel risk, ceza değil). | KARAYS | **O-Y** (kesinti riski) | Evet (canlı ofis sitesi için) | Vercel Pro ücretli (fiyat bu turda doğrulanmadı). **Ücretsiz alternatif:** Netlify Free planı ticari projelere açıkça izin veriyor [İ: Netlify duyurusu] https://www.netlify.com/blog/introducing-netlify-free-plan. Cloudflare Workers Free'de ticari kullanım yasağı bulunamadı; Next.js için OpenNext adaptörü 1.0 öncesi ve uyumluluk riski var [İ] https://opennext.js.org/cloudflare | (a) Pilot canlıya Vercel Pro ile çıksın, **veya** (b) ücretsiz kalınacaksa Netlify Free veya Cloudflare'e taşıma hazırlansın ve test edilsin. Taşınırsa alt işleyen listesi ve aydınlatma metinleri güncellenmeli. Hobby'de canlı pilot önerilmez. |
| **R-7** | **5651 yer sağlayıcı yükümlülükleri.** Bildirim yapılması gerekip gerekmediği, kanun metnindeki para cezası ve 1–2 yıllık trafik kaydı [İ]. Belge yerine bildirim usulü ve CSV ile alan adı listesi yalnızca forumdan biliniyor (**doğrulanamadı**). | KARAYS | O | Avukat kararına bağlı. Bildirim gerekiyorsa pilot ofisin alan adı yayına girmeden önce yapılmalı. | Bildirim ücretli değil gibi görünüyor (doğrulanamadı). Log arşivi R2 ücretsiz katmanında tutulabilir (kotası doğrulanmadı). | (1) Avukata ve gerekirse BTK'ya yazılı olarak sorun. (2) Trafik kaydı: Vercel ve Supabase loglarının saklama süresi kısa. En az 1 yıl için ayrı arşiv tutun (IP, zaman damgası, istek yolu, alan adı). Tutulacaksa KVKK aydınlatmasına "5651 trafik kaydı – hukuki yükümlülük – [1–2] yıl" ekleyin. (3) Künyeye 5651 m.3 tanıtıcı bilgilerini ekleyin. |
| **R-8** | **Elektronik ticaret aracı hizmet sağlayıcı (ETAHS) sayılma ve ETBİS.** ETAHS tanımı: "başkalarına ait iktisadi ve ticari faaliyetlerin yapılmasına elektronik ticaret ortamı sağlayan" [İ]. KARAYS ofislere site sağlıyor ve sitelerde sipariş veya ödeme yok; yalnızca ilan ve iletişim formu var. Pazar yeri yok. Güçlü argüman: ortam ofise ait ve sözleşme ofisle müşteri arasında internet dışında kuruluyor. Yine de ortak portal açılırsa risk artar. ETBİS kaydı "kendine ait elektronik ticaret ortamında" satış yapan hizmet sağlayıcılar ve aracı hizmet sağlayıcılar için [İ]. KARAYS ücretsiz pilotta çevrim içi satış yapmıyor. Çevrim içi abonelik satışı başlarsa yeniden değerlendirilmeli. | KARAYS | D (pilot), O (ölçek) | Hayır | Ücretsiz | Ürün ve pazarlamada "pazar yeri/portal" dili kullanmayın. Çevrim içi ödeme açılmadan önce ETBİS kaydını değerlendirin. https://www.alomaliye.com/2022/12/29/elektronik-ticaret-araci-hizmet-saglayici-ve-elektronik-ticaret-hizmet-saglayicilari/ |
| **R-9** | **Sahibin şahıs olması ve vergi kaydının olmaması.** Pilot ücretsiz olsa da ticari faaliyete fiilen başlanmış sayılabilir. Gerçek kişilerde işe başlama bildirimi 10 gün içinde yapılır (VUK m.153) [İ]. Bedelsiz hizmette KDV veya fatura gerekip gerekmediğine dair özelge bulunamadı (**doğrulanamadı**). Ayrıca sözleşmeyi "KARAYS" yerine sahibin kendi adına imzalaması, sorumluluğun kişisel malvarlığına gitmesi demektir. | Sahip | O | Pilot sözleşmesi şahıs adına imzalanabilir, ama mali müşavire danışılmalı | Mali müşavir ücreti olabilir. Vergi dairesinden bilgi almak ücretsiz. | Mali müşavire üç soru sorun: (a) ücretsiz pilot "işe başlama" sayılır mı; (b) bedelsiz hizmet için fatura veya KDV gerekir mi; (c) genç girişimci istisnası gibi ücretsiz seçenekler var mı (doğrulanmadı). Pilot sözleşmesine "bedelsizdir, ticari bedel doğurmaz" ve "taraf [Ad Soyad], TCKN [ ]" yazın. https://hukukcularevi.com/ise-baslama-mukellefiyet-tesisi-ve-vergi-levhasi/ |
| **R-10** | **Ofis sitesinde pazarlama izni yok, ama ofis CRM'den toplu SMS/e-posta gönderebilir.** Ziyaretçiler tüketici. 6563'e göre ticari elektronik ileti için önceden onay ve İYS kaydı gerekir. Bilgi formu yalnızca talebin yanıtlanması içindir. 2026/347'ye göre pazarlama onayı aydınlatma kutusundan **ayrı**, isteğe bağlı ve işaretsiz olmalı. Temel İYS işlemleri ücretsiz görünüyor [İ]. 250 binin altında adresi olan hizmet sağlayıcılar İYS'ye entegratör üzerinden erişiyor [İ]. | Ofis (ileti gönderen). KARAYS ise ürün içinde form ve kayıt tutar. | O | Ofis pazarlama iletisi göndermeyecekse hayır. Gönderecekse evet. | İYS temel kullanım ücretsiz (doğrulanamadı) | Ofis formuna isteğe bağlı, işaretsiz ayrı kutu ekleyin (metin §4.C). Onay zamanını, metin sürümünü ve kanalı kaydedin. Ofis ileti göndermeden önce İYS'ye kayıt olmalı ve onayları yüklemeli. Pilotta toplu gönderim özelliği sunmayın. https://www.parasut.com/blog/ileti-yonetim-sistemi-hakkinda-bilmeniz-gerekenler |
| **R-11** | **Özel nitelikli veri (m.6).** CRM notu, değerleme mesajı ve randevu notu gibi serbest metin alanlarına sağlık, din ya da engellilik bilgisi girilebilir. m.6/4 kapsamındaki ek önlemler bu veriler için de gerekir. | Ofis (veri sorumlusu) + KARAYS (güvenlik) | O | Hayır, ama düşük maliyetli | Ücretsiz | Serbest metin alanlarının altına uyarı ekleyin: "Sağlık, din, etnik köken, ceza mahkûmiyeti gibi özel nitelikli bilgileri bu alana yazmayınız." DPA'ya talimat maddesi ekleyin. Ziyaretçi formunun mesaj alanına da kısa bir uyarı koyun. |
| **R-12** | **Yetki belgesi numarası ilanda değil, yalnızca altbilgide.** Bakanlık açıklaması "ilanlarında" diyor [R]. Mevcut kod (`site-footer.tsx:187`) numarayı yalnızca altbilgide gösteriyor; numara girilmemişse hiç göstermiyor. İlan detayı, ilan kartı, paylaşım metni ve OG görselinde yok. | Ofis (ceza), KARAYS (ürün) | **Y** | **Evet** | Ücretsiz | Numara girilmeden site yayına alınmasın. İlan detayında fiyatın yanında "Yetki Belgesi No: …" ve ofis telefonu gösterilsin. Paylaşım metnine ve JSON-LD'ye eklensin. |
| **R-13** | **Fikri mülkiyet.** (a) **Yazı tipleri:** `public/fonts/site/*` altındaki Inter, Manrope, Fraunces, DM Sans, Lora, Newsreader, Outfit, Playfair, Space Grotesk ve Cormorant kendi sunucumuzdan sunuluyor. Bunların OFL 1.1 lisanslı olduğu varsayılıyor (**her biri için doğrulanmadı**). OFL ticari kullanıma ve web gömmeye izin verir; yeniden dağıtımda telif ve lisans metninin pakette bulunması gerekir [İ: SPDX/OFL SSS] https://spdx.org/licenses/OFL-1.1.html. Repoda OFL metni bulunamadı. (b) **İlan fotoğrafları:** fotoğraflar FSEK kapsamında korunabilir; internette erişilebilir olmaları kullanım izni anlamına gelmez; m.68 rayiç bedelin üç katına kadar tazminat öngörür [İ] https://www.hukukihaber.net/telif-hakki-ihlalinden-dogan-parasal-talepler-yargitay-kararlari-isiginda. Ofis portallardan veya rakiplerden fotoğraf kopyalarsa barındıran KARAYS da muhatap olabilir (5651 ihbar ve kaldırma). (c) Demo ve şablon görselleri: kaynak ve lisans kaydı tutulmalı (**durumu doğrulanmadı**). | (a) KARAYS (b) Ofis + KARAYS (ihbar) (c) KARAYS | (a) D (b) O (c) O | (a) Hayır (b) sözleşme maddesi evet (c) evet | Ücretsiz | (a) Her yazı tipi klasörüne `OFL.txt` ekleyin ve lisansı tek tek kontrol edin. (b) Pilot sözleşmesine "ofis yüklediği içeriğin haklarına sahiptir" taahhüdü ve ihbar-kaldır süreci ekleyin. Yükleme ekranına kısa uyarı koyun. (c) `docs/` altına görsel kaynak/lisans listesi; kaynağı bilinmeyen demo görselleri kaldırın. |
| **R-14** | **WhatsApp ve telefon bağlantıları.** `tel:` ve `wa.me` bağlantıları kendi başına veri toplamaz. Ancak ziyaretçi WhatsApp'tan yazdığında veri ofisin WhatsApp (Meta) hesabına gider. Bu ofisin kendi yurt dışı aktarımıdır ve aydınlatma metninde toplama kanalı olarak yazılmalı. Paylaşım düğmesi için EİDS riski: R-1. | Ofis | D-O | Aydınlatma metnine eklenmeli (evet) | Ücretsiz | Ofis aydınlatma metnine "WhatsApp üzerinden iletişime geçmeniz hâlinde mesajlarınız WhatsApp/Meta altyapısında işlenir" ifadesini ekleyin (§4.A). |
| **R-15** | **Destek e-postası `karays.support@gmail.com`.** Tüketici Gmail hesabı. Google'ın Türk SCC koşulları Cloud/Workspace müşterilerine yönelik [İ]. KVKK başvuru kanalı olarak da kurumsal görünmüyor. | KARAYS | O | Hayır (pilot için kabul edilebilir), ama aydınlatmada açıkça yazılmalı | Workspace ücretli. Ücretsiz seçenekler (alan adlı e-posta yönlendirme, ücretsiz e-posta paketleri) bu turda **doğrulanmadı**. | Kısa vadede: aydınlatmada "Google LLC (ABD)" olarak açıkça gösterin ve destek yazışmalarında kişisel veri istemeyin. Orta vadede alan adlı bir e-posta ve KEP adresi alın. |
| **R-16** | **Pilot ofisle imzalı yazılı DPA yok.** KVKK m.12/2 müteselsil sorumluluk öngörüyor; panel içi "kabul" akışı da yok. | İkisi | **Y** | **Evet** | Ücretsiz | §5'teki sözleşmeyi ıslak veya e-imza ile imzalayın. |

---

## 3. Mevcut metinlerde düzeltilecek cümleler (eski → yeni)

### 3.1 `src/modules/karay/legal.ts`

| Yer | Eski | Yeni |
|---|---|---|
| `ALT_ISLEYENLER` | `Resend (bildirim e-postası iletimi; AB)` | `Resend, Inc. (bildirim e-postası iletimi; gönderim AB-İrlanda üzerinden, hesap ve ileti kayıtları ABD'de saklanır)` |
| `ALT_ISLEYENLER` | `Vercel Inc. (barındırma ve içerik dağıtımı; AB/Almanya – Frankfurt bölgesi, şirket ABD)` | `Vercel Inc. (barındırma ve içerik dağıtımı; sunucu işlevleri AB/Almanya – Frankfurt, içerik dağıtım ağı ve hizmet kayıtları ABD dahil küresel; şirket ABD)` |
| `ALT_ISLEYENLER` | `Supabase Inc. (… sunucu AB/Almanya – Frankfurt)` | `Supabase Inc. (… birincil sunucu AB/Almanya – Frankfurt; şirket ABD; yedek, kayıt ve destek işlemleri bölge dışında da yapılabilir)` |
| `ALT_ISLEYENLER` | `Functional Software Inc. – Sentry (hata kaydı; e-posta ve telefon maskelenir; AB)` | `Functional Software Inc. – Sentry (hata kaydı; e-posta ve telefon maskelenir; veri bölgesi [AB – sahip teyit edecek]; şirket ABD)` |
| `ALT_ISLEYENLER` | `Cloudflare Inc. – R2 (şifreli yedek depolama)` | `Cloudflare Inc. – R2 (şifreli yedek depolama; AB yargı alanına sabitlenmiş kova [sahip teyit edecek]; şirket ABD)` |
| `ALT_ISLEYENLER` | `Google LLC – Gmail (destek e-postası; ABD)` | aynı kalsın (doğru). |
| kvkk › Aktarım | `…aktarım, KVKK md.9 ve … Yönetmelik uyarınca Kurul'ca ilan edilen standart sözleşmeler ve Kurum'a bildirim gibi uygun güvencelerle yapılır. [HUKUK DANIŞMANI: …]` | `Bu sağlayıcıların sunucuları veya şirket merkezleri Türkiye dışında (Avrupa Birliği ve Amerika Birleşik Devletleri) bulunduğundan verileriniz yurt dışına aktarılmaktadır. Türkiye için yeterlilik kararı bulunmadığından KARAYS, KVKK md.9 uyarınca Kurul'un ilan ettiği standart sözleşmeleri sağlayıcılarla imzalamak ve imzadan itibaren beş iş günü içinde Kurum'a bildirmek için gerekli işlemleri yürütmektedir. Sağlayıcı bazında güncel durum: [Ek: Aktarım tablosu – imza/bildirim tarihi veya "süreç devam ediyor"].` **[AVUKAT: süreç tamamlanmadan bu metinle yayına çıkılıp çıkılmayacağına karar verilmeli.]** |
| kvkk › İşlenen veriler | `…işlem güvenliği (IP adresinin geri döndürülemez özeti, …)` | sonuna ekle: `; yer sağlayıcılık faaliyeti kapsamında 5651 sayılı Kanun'un gerektirdiği trafik kayıtları (IP adresi, zaman, erişilen adres) [avukat kararından sonra]` |
| kvkk › Amaçlar | `Formdaki onay kutusu bu metni okuduğunuzu belirtir; açık rıza değildir.` | `Formdaki kutu yalnızca bu metni okuduğunuzu belirtir; onay veya açık rıza değildir. Talebinizin yanıtlanması için açık rızanız gerekmez.` (2026/347 ile uyumlu) |
| kvkk › Saklama | `…spam olarak işaretlenen kayıtlar [90 gün].` | ekle: `5651 kapsamındaki trafik kayıtları [1 yıl – avukat]. Destek e-postaları son yazışmadan itibaren [2 yıl].` |
| gizlilik › Paylaşım | `Kişisel verilerinizi satmayız …: ${ALT_ISLEYENLER}` | ekle: `Sağlayıcıların bir kısmı yurt dışındadır; ayrıntı ve güvenceler KVKK aydınlatma metnindedir.` |
| cerez-politikasi › Tercihinizi değiştirme | `Kabul ve ret seçenekleri bantta eşit olarak sunulur.` | Kod düzeltilene kadar **cümleyi kaldırın**. Kod düzeltildikten sonra: `Bantta "Kabul et" ve "Reddet" seçenekleri aynı görünüm ve büyüklükte sunulur.` **Kod:** `cookie-consent.tsx:126-131` → her iki düğme `variant="outline"` (veya ikisi de dolu), ikinci düğmenin etiketi `Reddet`. |
| kullanim-kosullari › Taraflar | `…Müşteri sözleşmeyi ticari veya mesleki faaliyeti kapsamında kurar ve tüketici sıfatı taşımaz; bu nedenle tüketici mevzuatı … uygulanmaz.` | `…Müşteri sözleşmeyi ticari veya mesleki faaliyeti kapsamında kurduğunu ve tüketici sıfatı taşımadığını beyan eder; bu beyan doğru olduğu sürece 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uygulanmaz.` |
| kullanim-kosullari › Müşterinin sorumlulukları | `…mülk sahibiyle yazılı yetkilendirme sözleşmesi olmadan ilan yayımlamamayı…` | ekle: `…elektronik ortamda yayımlanan ilanlar için Elektronik İlan Doğrulama Sistemi (EİDS) kapsamındaki kimlik ve yetki doğrulama yükümlülüklerine uymayı, ilan fotoğraf ve metinleri üzerinde gerekli haklara sahip olmayı…` |
| kullanim-kosullari › İçerik bildirimleri | `…içeriği yayından kaldırabilir ve Müşteriyi bilgilendirir.` | ekle: `KARAYS, 5651 sayılı Kanun kapsamında yer sağlayıcı sıfatıyla hareket eder.` |
| kullanim-kosullari › Sorumluluk | `…zarar tarihinden önceki [12] ayda ödenen ücretle sınırlıdır.` | ekle: `Ücretsiz kullanım dönemlerinde sorumluluk, kast ve ağır ihmal hâlleri saklı kalmak üzere [● TL] ile sınırlıdır.` (Aksi hâlde ödenen ücret 0 olduğundan sınır sıfır olur; bu, TBK m.115 ve genel işlem koşulları denetimi bakımından avukat kararı gerektirir.) |
| kullanim-kosullari › yetki | `…ticari uyuşmazlıklarda dava şartı arabuluculuk uygulanır.` | `…ticari uyuşmazlıklarda kanunen gerekli olduğu hâllerde dava şartı arabuluculuk uygulanır.` (Taraflardan biri tacir değilse uygulanmayabilir.) |
| veri-isleme-sozlesmesi › Alt işleyenler | `Yurt dışına aktarım KVKK md.9'daki uygun güvencelerle (standart sözleşme ve Kurum'a bildirim) yapılır.` | `KARAYS, yurt dışındaki alt veri işleyenlerle Kurul'un ilan ettiği Standart Sözleşme – Modül 3'ü (veri işleyenden veri işleyene) imzalamak ve imzadan itibaren beş iş günü içinde Kurum'a bildirmekle yükümlüdür; imza ve bildirim durumunu Ofis'e yazılı olarak bildirir.` |
| veri-isleme-sozlesmesi › Niteliği | `Özel nitelikli kişisel veri işlenmesi amaçlanmaz; Ofis serbest metin alanlarına bu tür veri girmemeyi taahhüt eder.` | ekle: `Buna rağmen girilmesi hâlinde Ofis, KVKK md.6/3'teki işleme şartının ve Kurul'un belirlediği yeterli önlemlerin varlığından sorumludur; KARAYS, Ofis talimatıyla bu verileri siler.` |
| basvuru › yöntemler | (mevcut metin doğru) | ekle: `…veya bu amaçla geliştirilmiş bir yazılım ya da uygulama aracılığıyla.` (yalnızca böyle bir kanal varsa) |
| kunye › Bilgilendirme | `Bu bilgiler 6563 … md.3 ve TTK md.39 kapsamındaki zorunlu bilgilerdir.` | `Bu bilgiler 5651 sayılı Kanun md.3, 6563 sayılı Kanun md.3 ve Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik ile, tacir olunması hâlinde TTK md.39 kapsamında yayımlanır.` |
| `KARAYS_COMPANY.mersis` | `'[MERSİS no / şahıs işletmesiyse TC kimlik no yerine vergi no]'` | `'[MERSİS no – yoksa "—"]'` ve ayrı alan `vkn: '[vergi dairesi / VKN]'`. Şahıs ve kayıtsız ise `unvan: '[Ad Soyad] (KARAYS markası)'`. Ticaret siciline kaydı yoksa MERSİS alanını boş göstermeyin, kaldırın. |

### 3.2 Önceki belgedeki taslaklar (4.A–4.G)

| Bölüm | Eski | Yeni |
|---|---|---|
| 4.A §4 tablo, son satır | `Ürün güncellemeleri … kişisel veriler bakımından [açık rıza / meşru menfaat – AVUKAT KARARI]` | `Ürün güncellemeleri ve kampanya iletileri: yalnızca formdaki ayrı ve isteğe bağlı kutuyu işaretlemeniz hâlinde, KVKK md.5/1 açık rıza ve 6563 sayılı Kanun md.6 onay. Tacir/esnaf alıcılar için 6563 m.6/2 kapsamındaki onay istisnası ve ret hakkı saklıdır.` (2026/347: rıza metni aydınlatmadan ayrı sunulmalı.) |
| 4.A §6 | `Supabase … (AB/Almanya); … Resend [şirket unvanı] (AB); …` | §3.1'deki `ALT_ISLEYENLER` metniyle aynı olsun (Resend → ABD). |
| 4.A §6 Yurt dışına aktarım | `…standart sözleşmeler imzalanarak ve … 5 iş günü içinde Kurum'a bildirilerek gerçekleştirilir.` | §3.1'deki "Aktarım" metni (durum bildiren, koşullu). |
| 4.C §2 | `karays.com'da analitik … çerezi kullanılmamaktadır; bu nedenle çerez onay bandı gösterilmez.` | **Kod ile çelişiyor.** `legal.ts`'e göre KARAYS sayfasında Vercel Web Analytics ve Speed Insights rızaya bağlı ve bant var. Yeni metin: `Vercel Web Analytics ve Speed Insights yalnızca çerez bandında "Kabul et"i seçmeniz hâlinde yüklenir; bu hizmetler çerez kullanmaz ancak tarayıcınızdan sayfa ve performans bilgisi toplar.` |
| 4.D m.1 | `…geçerli bir Taşınmaz Ticareti Yetki Belgesi (No: [ ]) bulunduğunu beyan eder.` | ekle: `…ve ilanlarında EİDS dahil ilan mevzuatına uyacağını…` |
| 4.D m.9 | sorumluluk sınırı "ödenen ücret" | §3.1'deki ücretsiz dönem ifadesi. |
| 4.E m.6.1 | `[AVUKAT: Ofis'in de VS→Vİ modülü kapsamında taraf/bildirim yükümlüsü olup olmadığı …]` | Açıklama ekle: `Ofis (Türkiye) → KARAYS (Türkiye) aktarımı yurt içindedir; yurt dışı aktarımı yapan taraf KARAYS'tır (Modül 3). KARAYS'ın Türkiye'de yerleşik olması bu sonuç için ön koşuldur.` (avukat teyidi) |
| 4.E Ek-2 | `Resend [unvan] | … | AB` | `Resend, Inc. | Bildirim e-postası | Gönderim AB-İrlanda; saklama ABD` · ve `Google LLC – Gmail (destek)` satırı eklensin. |
| 4.F | `5651 trafik kayıtları [1–2 yıl – AVUKAT]` | Kanunda alt sınır 1 yıl [İ]. Öneri: `[1 yıl]`. |
| 4.G | (doğru) | ekle: `Başvurunuzu kimliğinizi doğrulayamadığımız bir kanaldan yaparsanız ek bilgi isteyebiliriz.` |
| §2 A6 önerisi | `Formu göndererek … işleneceğini bilirsiniz.` (kutu yerine bilgi notu) | Her iki yol da 2026/347 ile uyumlu. Mevcut "…okudum." kutusu korunabilir. "**kabul ediyorum**" ifadesi hiçbir aydınlatma kutusunda kullanılmamalı. |
| §2 A10 | `Hizmet Sözleşmesi ve Veri İşleme Sözleşmesi'ni okudum, kabul ediyorum` | Sözleşme olduğu için "kabul ediyorum" doğru. Ama aynı kutuya "Aydınlatma Metni" **eklenmemeli**; aydınlatma için ayrı bağlantı ve ayrı "okudum" ifadesi kullanılmalı. |

### 3.3 `src/modules/content/default-pages.ts` (ofis şablonları)

| Yer | Eski | Yeni |
|---|---|---|
| kvkk §2 | (talep türleri) | ekle: `- Değerleme talebinde mülk bilgisi: adres/konum, mülk özellikleri (mülk sahibi iseniz)` · `- WhatsApp veya telefonla iletişimde: mesaj içeriği, telefon numarası` |
| kvkk §4 | 3 hukuki sebep | ekle: `"bir hakkın tesisi, kullanılması veya korunması için veri işlemenin zorunlu olması" (olası uyuşmazlıklarda delil)`. Pazarlama onayı varsa: `Ticari elektronik ileti gönderimi yalnızca ayrıca vereceğiniz isteğe bağlı onaya dayanır.` |
| kvkk §5 alt işleyenler | `Resend (yeni talep bildirim e-postalarının iletilmesi)` | `Resend, Inc. (yeni talep bildirim e-postalarının iletilmesi; kayıtlar ABD'de saklanır)` |
| kvkk §5 yurt dışı | `Yurt dışına aktarım, … standart sözleşmenin imzalanması ve sözleşmenin Kurum'a bildirilmesi yoluyla gerçekleştirilir.` | `Bu aktarımlar, hizmet sağlayıcımız KARAYS tarafından KVKK md.9 uyarınca Kurul'un ilan ettiği standart sözleşmeler esas alınarak yürütülmektedir; güncel imza ve bildirim durumu hakkında {{eposta}} adresinden bilgi alabilirsiniz.` [AVUKAT] |
| kvkk §6 | `…formlar, telefon ve WhatsApp üzerinden elektronik ortamda toplanır.` | ekle: `WhatsApp üzerinden yazmanız hâlinde mesajlarınız WhatsApp LLC/Meta Platforms altyapısında (yurt dışı) işlenir; bu kanalı kullanmak isteğinize bağlıdır.` |
| kvkk §7 | `Talepler, sonuçlanmasından itibaren [SÜRE] boyunca saklanır…` | `Sözleşmeye dönüşmeyen talepler son iletişimden itibaren [2 yıl]; sözleşmeye dönüşen işlemlere ait kayıtlar ilgili mevzuat (TTK md.82, VUK md.253) gereği [10 yıl]; spam olarak işaretlenen kayıtlar [90 gün] saklanır…` |
| kvkk §8 son paragraf | (Kurul'a şikâyet yok) | ekle: `Başvurunuzun reddedilmesi, cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâlinde, cevabı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz (KVKK m.14).` |
| kvkk §1 | `**{{unvan}}** ({{sirket}}, adres: {{adres}})` | `**{{unvan}}** ({{sirket}}; Taşınmaz Ticareti Yetki Belgesi No: {{yetki_belgesi}}; MERSİS/VKN: {{mersis}}; adres: {{adres}}; e-posta: {{eposta}}; KEP: {{kep}})` |
| privacy › Harita | `[HARİTA SAĞLAYICISI]` | Gerçek sağlayıcı adı yazılsın (kodda proxy var; sağlayıcının kim olduğu **doğrulanmadı**). |
| privacy › Üçüncü taraf | `WhatsApp ve sosyal medya paylaşım bağlantıları yalnızca tıkladığınızda ilgili hizmete yönlendirir.` | R-1 nedeniyle paylaşım düğmeleri kaldırılırsa bu cümle de kaldırılsın. |
| cookies › Analitik | `Vercel Inc. (ABD)` | doğru. Ekle: `"Kabul et" ve "Reddet" seçenekleri eşit şekilde sunulur.` (yalnızca kod düzeltildikten sonra) |
| terms › giriş | `Site, {{unvan}} ({{sirket}}) tarafından işletilmektedir.` | `Site, Taşınmaz Ticareti Yetki Belgesi No {{yetki_belgesi}} ile faaliyet gösteren {{unvan}} ({{sirket}}) tarafından işletilmektedir. Site altyapısı KARAYS tarafından yer sağlayıcı sıfatıyla sunulmaktadır.` |
| terms › İlan bilgileri | — | ekle: `İlanlar, mülk sahibiyle yapılan yazılı yetkilendirme sözleşmesine ve mevzuatın gerektirdiği hâllerde Elektronik İlan Doğrulama Sistemi (EİDS) yetkisine dayanılarak yayımlanır.` |
| terms › Uygulanacak hukuk | `[İL]` | `{{il}}` |

---

## 4. Ofis sitesi için tam metin taslakları

> Değişkenler `{{…}}` ofis ayarlarından gelir. `[…]` avukat veya sahip tarafından doldurulur. Önceki belgede bu üç metin tam hâliyle yoktu.

### 4.A Ofis web sitesi – Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni

**{{sirket}} – WEB SİTESİ ZİYARETÇİLERİ VE MÜŞTERİ ADAYLARI AYDINLATMA METNİ**
Sürüm: [1.0] · Son güncelleme: [GG.AA.YYYY]

**1. Veri sorumlusu.** 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz veri sorumlusu sıfatıyla **{{unvan}}** ("Ofis") tarafından işlenir. Taşınmaz Ticareti Yetki Belgesi No: {{yetki_belgesi}} · MERSİS/VKN: {{mersis}} · Adres: {{adres}} · Telefon: {{telefon}} · E-posta: {{eposta}} · KEP: {{kep}}

**2. Kapsam.** Bu metin; {{alan_adi}} web sitesini ziyaret eden, sitedeki bilgi, randevu veya değerleme formlarını dolduran ve Ofis'le telefon ya da WhatsApp üzerinden iletişime geçen kişileri kapsar.

**3. İşlenen kişisel veriler.**
- Kimlik: ad, soyad.
- İletişim: telefon numarası, e-posta adresi.
- Talep: form mesajı, ilgilendiğiniz ilan, randevu tarihi ve saati; değerleme talebinde paylaştığınız mülk bilgileri (adres/konum, mülk özellikleri).
- İşlem güvenliği: IP adresinin geri döndürülemez özeti, tarayıcı bilgisi, form gönderim zamanı.
- Pazarlama: yalnızca ayrıca onay vermeniz hâlinde, iletişim tercihiniz ve onay kaydı.
Formlardaki serbest metin alanlarına sağlık, din, etnik köken veya ceza mahkûmiyeti gibi özel nitelikli kişisel verilerinizi yazmamanızı rica ederiz.

**4. Amaçlar ve hukuki sebepler (KVKK m.5/2).**
| Amaç | Hukuki sebep |
|---|---|
| Bilgi, randevu ve değerleme talebinizin yanıtlanması; gösterim ve görüşmenin ayarlanması | (c) Bir sözleşmenin kurulmasıyla doğrudan ilgili olması |
| Site güvenliği, spam ve kötüye kullanımın önlenmesi | (f) Meşru menfaat |
| Yasal yükümlülükler (Taşınmaz Ticareti Hakkında Yönetmelik, vergi mevzuatı) ve yetkili kurum talepleri | (ç) Hukuki yükümlülük |
| Olası uyuşmazlıklarda delil | (e) Bir hakkın tesisi, kullanılması veya korunması |
| Yeni ilan ve kampanya bilgilendirmesi (SMS/e-posta/arama) | Yalnızca ayrıca vereceğiniz isteğe bağlı açık rıza ve 6563 sayılı Kanun kapsamındaki onay |

**5. Toplama yöntemi.** Web sitesi formları, telefon ve WhatsApp aracılığıyla, elektronik ortamda ve otomatik olmayan yollarla.

**6. Aktarım.** Verileriniz yukarıdaki amaçlarla sınırlı olarak (i) talebinizle ilgilenen Ofis çalışanları ve danışmanlarına; (ii) web sitesi ve müşteri yönetim yazılımı hizmetini aldığımız **[KARAYS unvanı / Ad Soyad]**'a (veri işleyen); (iii) KARAYS'ın alt veri işleyenlerine: Supabase Inc. (veritabanı; AB-Almanya, şirket ABD), Vercel Inc. (barındırma; AB-Almanya ve küresel içerik dağıtım ağı, şirket ABD), Resend, Inc. (bildirim e-postası; ABD), Functional Software Inc./Sentry (hata kaydı, kişisel veriler maskelenir; [AB], şirket ABD), Cloudflare Inc. (şifreli yedek; [AB], şirket ABD); (iv) talep hâlinde yetkili kamu kurumlarına aktarılabilir. WhatsApp üzerinden yazarsanız mesajlarınız WhatsApp LLC/Meta Platforms altyapısında işlenir.
**Yurt dışına aktarım:** (ii)–(iii)'teki sağlayıcıların sunucuları veya merkezleri Türkiye dışındadır. Bu aktarımlar KVKK m.9 uyarınca Kurul'un ilan ettiği standart sözleşmeler esas alınarak yürütülür. [AVUKAT: imza ve bildirim durumu yazılmalı.]

**7. Saklama süresi.** Sözleşmeye dönüşmeyen talepler: son iletişimden itibaren [2 yıl]. Sözleşmeye dönüşen işlemler: ilgili belgeler için [10 yıl]. Spam kayıtları: [90 gün]. Pazarlama onayı: geri alınana kadar, geri alındıktan sonra ispat amacıyla [ ] yıl. Süre sonunda veriler silinir, yok edilir veya anonim hâle getirilir.

**8. Haklarınız (KVKK m.11).** Verilerinizin işlenip işlenmediğini öğrenme, bilgi isteme, amaca uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, düzeltme, silme veya yok etme isteme, bu işlemlerin aktarılan kişilere bildirilmesini isteme, otomatik analiz sonucu aleyhinize çıkan sonuca itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.

**9. Başvuru.** Başvurunuzu Türkçe olarak; ıslak imzalı dilekçeyle {{adres}} adresine şahsen veya noter aracılığıyla, {{kep}} KEP adresine, güvenli elektronik imza veya mobil imzayla ya da daha önce bize bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden {{eposta}} adresine iletebilirsiniz. Başvurularınız en geç 30 gün içinde ücretsiz sonuçlandırılır; işlem ayrıca maliyet gerektirirse Kurul tarifesindeki ücret alınabilir. Başvurunuz reddedilir, cevabı yetersiz bulur veya süresinde cevap alamazsanız, cevabı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvurudan itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz. Web sitesi hizmet sağlayıcımız KARAYS'a ulaşan başvurular [3] iş günü içinde tarafımıza iletilir.

### 4.B Ofis web sitesi – Çerez Aydınlatma Metni (kısa, bant + politika)

**Çerez bandı metni:**
> Sitemizde yalnızca sitenin çalışması için gerekli çerezler ve tarayıcı depolaması kullanılır. Ziyaret istatistiği ve sayfa hızı ölçümü (Vercel Web Analytics ve Speed Insights; Vercel Inc., ABD) yalnızca izin verirseniz çalışır. Ayrıntılar: [Çerez Politikası].
> **[Reddet]** **[Kabul et]** *(iki düğme aynı görünüm ve boyutta)* · [Tercihler]

**Çerez Politikası (ofis):** Mevcut `default-pages.ts › cookies` şablonu içerik olarak yeterli. Yapılacak eklemeler:
1. Başa: `Veri sorumlusu: {{unvan}} ({{eposta}}). Bu politika Kişisel Verileri Koruma Kurumu'nun Çerez Uygulamaları Hakkında Rehberi (Temmuz 2025) dikkate alınarak hazırlanmıştır.`
2. "Zorunlu çerezler" başlığının altına: `Hukuki sebep: KVKK m.5/2-(c) ve (f). Bu kayıtlar için izin istenmez.`
3. "Analitik" başlığının altına: `Hukuki sebep: açık rızanız. Rızanızı vermemeniz sitenin kullanımını engellemez. Verdiğiniz rızayı sayfa altındaki "Çerez tercihleri" bağlantısından aynı kolaylıkla geri alabilirsiniz. Bu hizmetler Vercel Inc. (ABD) tarafından sunulduğundan ölçüm verileri yurt dışına aktarılır.`
4. Sona: `Tercihiniz tarayıcınızda 12 ay saklanır; süre dolunca yeniden sorulur.` (Kodda `vercel-insights.tsx`'in de 12 aylık süreyi kontrol ettiği doğrulanmalı. Önceki belgede B11 olarak işaretlenmişti, durumu bu turda kontrol edilmedi.)

### 4.C Ofis bilgi / randevu / değerleme formu – onay ve bilgilendirme metinleri

1. **Aydınlatma kutusu (zorunlu, mevcut metin korunur – 2026/347 ile uyumlu):**
   `☐ Talebimin yanıtlanması amacıyla kişisel verilerimin işlenmesine ilişkin [KVKK Aydınlatma Metni]'ni okudum.`
   Hata mesajı: `Devam etmek için Aydınlatma Metni'ni okuduğunuzu işaretleyin.` ("onaylayın" demeyin.)
   *Alternatif (kutusuz):* gönder düğmesinin üstünde `Formu göndererek talebinizin yanıtlanması için verilerinizin [Aydınlatma Metni]'nde açıklandığı şekilde işleneceğini bilirsiniz.`
2. **Pazarlama kutusu (isteğe bağlı, işaretsiz, ayrı başlık altında; yalnızca ofis gönderim yapacaksa):**
   Başlık: **Açık rıza ve ticari elektronik ileti onayı (isteğe bağlı)**
   `☐ {{unvan}} tarafından yeni ilanlar ve kampanyalar hakkında SMS, e-posta ve telefon araması yoluyla bilgilendirilmek istiyorum. Bu amaçla ad, soyad ve iletişim bilgilerimin işlenmesine açık rıza veriyorum. Onayımı her iletideki ret bağlantısından veya {{eposta}} adresinden ücretsiz geri alabilirim.`
   Altına küçük not: `Bu onayı vermemeniz talebinizin yanıtlanmasını etkilemez.`
   Kayıt: onay zamanı, metin sürümü, kanal ve IP özeti. Ofis gönderim yapmadan önce onayları İYS'ye yükler.
3. **Serbest metin alanı altı uyarı:** `Lütfen sağlık, din, etnik köken gibi özel nitelikli bilgilerinizi bu alana yazmayınız.`
4. **Değerleme formu (mülk sahibi):** ek not: `Paylaştığınız mülk bilgileri yalnızca değerleme talebinize yanıt vermek için kullanılır; ilan yayımlanması ayrı ve yazılı bir yetkilendirme sözleşmesi gerektirir.`

---

## 5. Taslak: Ücretsiz Pilot Kullanım ve Veri İşleme Sözleşmesi

> TASLAKTIR. Avukat incelemesi olmadan imzalanmamalıdır. İki nüsha olarak hazırlanır; ıslak imza veya güvenli e-imzayla imzalanır.

**ÜCRETSİZ PİLOT KULLANIM VE VERİ İŞLEME SÖZLEŞMESİ**

**Madde 1 – Taraflar**
1.1 **Hizmet Sağlayıcı / Veri İşleyen:** [Ad Soyad] (KARAYS markasıyla), TCKN/VKN: [ ], Vergi Dairesi: [ ], Adres: [ ], E-posta: [ ], Telefon: [ ] ("KARAYS"). *(Şirket kurulursa sözleşme yazılı bildirimle şirkete devredilir; bkz. m.14.)*
1.2 **Pilot Kullanıcı / Veri Sorumlusu:** [Ofis ticaret unvanı], MERSİS/VKN: [ ], Taşınmaz Ticareti Yetki Belgesi No: [ ], Oda sicil no: [ ], Adres: [ ], Yetkili: [Ad Soyad, unvan], E-posta/KEP: [ ] ("Ofis").
1.3 Ofis, bu sözleşmeyi ticari faaliyeti kapsamında kurduğunu ve tüketici sıfatı taşımadığını beyan eder.

**Madde 2 – Konu**
KARAYS, Ofis'e pilot süresince şu hizmetleri **bedelsiz** olarak sunar: Ofis'in alan adında ([alan adı]) yayımlanan web sitesi, ilan yönetimi, müşteri/talep (CRM), randevu ve bilgi formları, danışman kullanıcı hesapları ve teknik destek ("Hizmet"). Hizmet deneme amaçlıdır ve geliştirme aşamasındadır.

**Madde 3 – Süre**
3.1 Sözleşme imza tarihinde başlar ve [GG.AA.YYYY]'ye kadar ([3] ay) sürer. Taraflar yazılı olarak uzatabilir.
3.2 Her iki taraf da [15] gün önceden yazılı bildirimle (e-posta yeterlidir) sözleşmeyi gerekçe göstermeden ve tazminatsız feshedebilir.
3.3 Pilot sonunda ücretli hizmete geçiş ancak ayrı ve yazılı bir sözleşmeyle olur. Otomatik yenileme veya ücretlendirme yoktur.

**Madde 4 – Bedelsizlik**
Hizmet için ücret, komisyon veya başka bir bedel talep edilmez. Ofis'in alan adı, e-posta, SMS ve üçüncü taraf hizmet giderleri kendisine aittir. Pilot sırasında ürün geri bildirimi Ofis'in isteğine bağlıdır.

**Madde 5 – Ofis'in yükümlülükleri**
5.1 İlan ve site içeriğinin (fiyat, metrekare, imar, fotoğraf, metin) doğruluğu ve hukuka uygunluğu Ofis'e aittir.
5.2 Ofis; ilanlarında yetki belgesi numarasını ve iletişim bilgilerini göstermeyi, mülk sahibiyle yazılı yetkilendirme sözleşmesi yapmadan ilan yayımlamamayı ve elektronik ilanlar için Elektronik İlan Doğrulama Sistemi (EİDS) dahil Taşınmaz Ticareti Hakkında Yönetmelik hükümlerine uymayı kabul eder. Ofis, ilanları sosyal medyada veya WhatsApp'ta paylaşırken mevzuatın öngördüğü doğrulamalı ilan bağlantısını kullanmaktan kendisi sorumludur.
5.3 Ofis, yüklediği fotoğraf, metin, logo ve diğer içerikler üzerinde gerekli haklara sahip olduğunu taahhüt eder. Üçüncü kişilerin bu içerikler nedeniyle yönelttiği taleplerden KARAYS'ı ari tutar.
5.4 Ofis, ticari elektronik ileti göndermeden önce alıcıların onayını almak ve İleti Yönetim Sistemi (İYS) kaydını yapmakla yükümlüdür. Hizmet, pilot süresince toplu ileti gönderimi içermez.
5.5 Ofis, kullanıcı hesaplarının ve parolaların güvenliğinden, işten ayrılan çalışanların erişimini kapatmaktan sorumludur.

**Madde 6 – KARAYS'ın yükümlülükleri**
6.1 KARAYS Hizmet'i makul özenle sunar. Kesintisizlik veya belirli bir erişilebilirlik oranı taahhüt etmez. Planlı bakımları önceden e-posta ile bildirir.
6.2 KARAYS, Ofis içeriğini önceden denetlemekle yükümlü değildir. 5651 sayılı Kanun kapsamında yer sağlayıcı sıfatıyla, hukuka aykırı içeriğe ilişkin usulüne uygun bildirim veya yetkili merci kararı üzerine içeriği yayından kaldırabilir ve Ofis'i derhâl bilgilendirir.
6.3 KARAYS günlük yedek alır. Yedekler [30] gün saklanır.

**Madde 7 – Kişisel verilerin işlenmesi (KVKK m.12)**
7.1 **Roller:** Ofis web sitesi ziyaretçileri, Ofis'in müşterileri ve adayları ile Ofis çalışanlarına ait veriler bakımından Ofis **veri sorumlusu**, KARAYS **veri işleyendir**.
7.2 **Talimat:** KARAYS verileri yalnızca Ofis'in belgelenmiş talimatı (bu sözleşme, panel ayarları ve yazılı talimatlar) doğrultusunda ve Hizmet'in sunulması amacıyla işler. Verileri kendi amaçları için kullanmaz, satmaz, pazarlamada kullanmaz. Talimatın mevzuata aykırı olduğunu düşünürse Ofis'i bilgilendirir.
7.3 **İşlemenin niteliği:** İlgili kişiler: site ziyaretçileri ve form dolduranlar, müşteri ve adayları, mülk sahipleri, Ofis çalışanları. Veri kategorileri: kimlik, iletişim, talep ve müşteri işlem bilgileri, gayrimenkul bilgileri, işlem güvenliği kayıtları. İşlemeler: kaydetme, depolama, barındırma, yedekleme, görüntüleme, e-posta bildirimi, dışa aktarma, silme.
7.4 **Özel nitelikli veri:** İşlenmesi amaçlanmaz. Ofis, serbest metin alanlarına bu tür veri girmemeyi ve çalışanlarını buna göre yönlendirmeyi kabul eder. Girilmesi hâlinde KVKK m.6 kapsamındaki işleme şartından Ofis sorumludur; KARAYS, Ofis talimatıyla bu verileri siler.
7.5 **Güvenlik (KVKK m.12/1):** KARAYS en az şu tedbirleri alır: TLS ile şifreli iletim; ofisler arası satır bazlı yetkilendirme; rol bazlı erişim ve iki adımlı doğrulama seçeneği; denetim kayıtları; form kayıtlarında ham IP yerine geri döndürülemez özet; hız sınırlama; şifreli yedekleme ve geri yükleme testi; hata kayıtlarında e-posta ve telefonun maskelenmesi; verilere yalnızca zorunlu hâllerde ve kayıt altında erişim.
7.6 **Gizlilik:** KARAYS ve verilere erişen kişiler gizlilik yükümlülüğü altındadır. Bu yükümlülük sözleşme sona erdikten sonra da devam eder.
7.7 **İlgili kişi başvuruları:** KARAYS, Ofis'in KVKK m.11 başvurularını yanıtlayabilmesi için dışa aktarma, düzeltme ve silme işlevlerini sağlar. KARAYS'a doğrudan gelen başvuruları [3] iş günü içinde Ofis'e iletir ve başvuruyu kendisi yanıtlamaz.
7.8 **Veri ihlali:** KARAYS, Ofis verilerini etkileyen bir ihlali öğrendiği andan itibaren gecikmeksizin ve en geç **24 saat** içinde Ofis'e bildirir. Bildirimde bilinen ölçüde ihlalin niteliği, zamanı, etkilenen veri kategorileri ve kişi sayısı, olası sonuçları ve alınan tedbirler yer alır. Ofis'in Kurul'a 72 saat içinde ve ilgili kişilere bildirim yapabilmesi için gereken desteği verir.
7.9 **Müteselsil sorumluluk ve rücu:** Taraflar, KVKK m.12/2 uyarınca veri güvenliği tedbirlerinde müteselsilen sorumlu olduklarını bilir. İç ilişkide, ihlale kusuruyla sebep olan taraf diğerine rücu edilebilir.
7.10 **Denetim:** Ofis, [30] gün önceden bildirimle ve makul kapsamda bu maddeye uyumun belgelerini isteyebilir.

**Madde 8 – Alt veri işleyenler ve yurt dışına aktarım**
8.1 Ofis, aşağıdaki alt veri işleyenlerin kullanılmasına yazılı onay verir:

| Alt veri işleyen | Hizmet | Konum | Aktarım güvencesi |
|---|---|---|---|
| Supabase Inc. (ABD) | Veritabanı, kimlik doğrulama, dosya | AB-Almanya (Frankfurt); bölge dışı sınırlı işlem | KVKK Standart Sözleşme Modül 3 – [durum/tarih] |
| Vercel Inc. (ABD) | Barındırma, içerik dağıtım ağı | AB-Almanya (fra1) + küresel CDN | [durum/tarih] |
| Resend, Inc. (ABD) | Bildirim e-postası | Gönderim AB-İrlanda; saklama ABD | [durum/tarih] |
| Functional Software Inc. – Sentry (ABD) | Hata kaydı (kişisel veri maskelenir) | [AB] | [durum/tarih] |
| Cloudflare Inc. (ABD) – R2 | Şifreli yedek | [AB yargı alanı] | [durum/tarih] |
| [Google LLC – Gmail] (ABD) | Destek yazışmaları | ABD | [durum/tarih] |

8.2 KARAYS, yeni bir alt veri işleyen eklemeden en az [15] gün önce Ofis'e e-posta ile bildirir. Ofis haklı gerekçeyle itiraz ederse fesih hakkını kullanabilir.
8.3 Alt veri işleyenlerin sunucuları veya merkezleri Türkiye dışında olduğundan verilerin yurt dışına aktarılması söz konusudur. KARAYS, KVKK m.9 uyarınca Kurul'un ilan ettiği standart sözleşmeyi (Modül 3) alt veri işleyenlerle imzalamak ve imzadan itibaren 5 iş günü içinde Kurum'a bildirmek için gerekli girişimleri yapar. Durumu yukarıdaki tabloda ve talep hâlinde yazılı olarak bildirir.
8.4 **[AVUKAT KARARI – seçeneklerden biri:]**
   (A) Standart sözleşmeler imzalanıp bildirilmeden Ofis'in gerçek müşteri verisi sisteme girilmez; pilot yalnızca ilan ve kurgusal veriyle yürütülür. **veya**
   (B) Ofis, 8.3'teki sürecin tamamlanmadığını ve bunun hukuki riskini bildiğini yazılı olarak kabul eder. *(Avukatın bu seçeneği değerlendirmesi gerekir: risk kabulü idari sorumluluğu ortadan kaldırmaz.)*

**Madde 9 – Pilot sonu: verilerin iadesi ve silinmesi**
9.1 Sözleşme herhangi bir nedenle sona erdiğinde Ofis, [30] gün boyunca panelden verilerini (ilanlar, müşteri ve talepler, randevular) dışa aktarabilir. Talep ederse KARAYS verileri makine tarafından okunabilir bir biçimde (CSV/JSON) teslim eder.
9.2 Bu sürenin sonunda KARAYS, Ofis verilerini canlı sistemden [30] gün içinde, yedeklerden yedek döngüsü sonunda ve en geç [90] gün içinde siler. Talep hâlinde silindiğini yazılı olarak beyan eder.
9.3 Alan adı Ofis'e aittir. KARAYS, DNS ve yönlendirme kayıtlarının devrine yardım eder.
9.4 Mevzuattan doğan saklama yükümlülükleri (ör. 5651 trafik kayıtları) saklıdır. Bu kayıtlar yalnızca o amaçla saklanır.

**Madde 10 – Gizlilik**
Taraflar, pilot süresince öğrendikleri ticari bilgileri (müşteri listeleri, fiyatlar, yazılım ve iş planları) gizli tutar, yalnızca bu sözleşmenin amacı için kullanır ve sözleşmenin bitiminden sonra [2] yıl boyunca üçüncü kişilere açıklamaz. Kanunen açıklanması zorunlu bilgiler saklıdır.

**Madde 11 – Fikri mülkiyet**
Yazılım, tema, şablon ve KARAYS markası KARAYS'a aittir. Ofis'e pilot süresince devredilemez, münhasır olmayan bir kullanım hakkı tanınır. Ofis içeriği ve verileri Ofis'e aittir. KARAYS, Ofis'i referans olarak ancak Ofis'in yazılı izniyle gösterebilir.

**Madde 12 – Sorumluluğun sınırı**
12.1 Hizmet bedelsiz ve deneme amaçlı olduğundan "olduğu gibi" sunulur.
12.2 KARAYS'ın bu sözleşmeden doğan toplam sorumluluğu **[● TL]** ile sınırlıdır. Dolaylı zararlar (kâr kaybı, müşteri kaybı) kapsam dışıdır.
12.3 Kast, ağır ihmal ve kişisel verilerin korunmasına ilişkin müteselsil sorumluluk (m.7.9) hâllerinde bu sınır uygulanmaz (TBK m.115). [AVUKAT: m.7.9 ile m.12.2 arasındaki ilişki]

**Madde 13 – Bildirimler**
Taraflar m.1'deki e-posta ve KEP adreslerine yapılan bildirimleri geçerli kabul eder. Adres değişiklikleri karşı tarafa yazılı olarak bildirilir.

**Madde 14 – Devir**
KARAYS, sözleşmeyi kuracağı şirkete yazılı bildirimle devredebilir. Ofis bu devre şimdiden onay verir; ancak devirden itibaren [15] gün içinde fesih hakkı vardır.

**Madde 15 – Uygulanacak hukuk ve yetki**
Türk hukuku uygulanır. Uyuşmazlıklarda [İL] mahkemeleri ve icra daireleri yetkilidir. Kanunen gerekli olduğu hâllerde dava şartı arabuluculuk saklıdır.

**Madde 16 – Ekler ve öncelik**
Ek-1: Teknik ve idari tedbirler (ayrıntılı). Ek-2: Alt veri işleyen ve aktarım tablosu (güncel). Kişisel verilere ilişkin konularda Madde 7–9 önceliklidir.

İmza tarihi (KARAYS): [ ]  İmza tarihi (Ofis): [ ] *(Her iki tarafın imza tarihi ayrı yazılır.)*
KARAYS: [Ad Soyad / imza]  Ofis: [Yetkili / kaşe / imza]

---

## 6. Sahipten istenecek bilgiler (kesin liste)

1. Pilot sözleşmesini **kim imzalayacak**: şahıs mı (ad soyad, TCKN), kurulacak şirket mi (tür, unvan)? Tahmini kuruluş tarihi.
2. Vergi kaydı var mı? (vergi dairesi, VKN, faaliyet kodu); mali müşavirin adı. Yoksa işe başlama planı.
3. İşletme veya tebligat adresi (aydınlatma, başvuru yolu ve künye için).
4. İletişim: KVKK başvuru e-postası, varsa KEP adresi, telefon. Gmail'de mi kalınacak?
5. Vercel planı (Hobby/Pro) ve pilot sitesinin hangi planda yayına gireceği. Ücretsiz kalınacaksa Netlify veya Cloudflare'e taşıma kararı.
6. Sentry organizasyonunun veri bölgesi (AB/ABD); R2 kovasının `eu` yargı alanıyla oluşturulup oluşturulmadığı; Supabase projesinin bölgesi (ekran görüntüsü).
7. `NOTIFY_EMAIL_DETAILS` değeri canlıda `minimal` mi?
8. Sağlayıcılara KVKK standart sözleşmesi (Modül 2 ve 3) gönderilip gönderilmediği ve yanıtları.
9. Pilot ofisin bilgileri: unvan, MERSİS/VKN, yetki belgesi no, oda sicil no, alan adı, yetkili kişi, KEP.
10. Pilot ofis ilanlarını hangi portallarda EİDS ile yayımlıyor? Ofis kendi sitesindeki ilanlar için EİDS linki verebilir mi?
11. Ofis pilotta SMS/e-posta ile pazarlama iletisi gönderecek mi? İYS kaydı var mı?
12. Ofis gerçek müşteri verisini (CRM) pilotta girecek mi, yoksa yalnızca ilan mı?
13. Ofis çalışan sayısı (ofisin kendi VERBİS durumu için; ofisin sorumluluğunda).
14. Demo ve şablon görsellerinin ve yazı tiplerinin kaynak listesi (lisans kontrolü için).
15. Harita döşemelerinin sağlayıcısı (gizlilik metnindeki `[HARİTA SAĞLAYICISI]` için).
16. 5651 trafik kaydı tutulacaksa: saklama yeri (R2) ve süre tercihi.

## 7. Avukata sorulacak sorular (10)

1. **Yurt dışı aktarım:** Sağlayıcılar KVKK standart sözleşmesini (Modül 2 ve 3) imzalamazsa pilot hangi koşulda başlayabilir? §5 m.8.4'te (A) mı (B) mi? Bir veri işleyen olarak KARAYS'ın imza ve bildirim yükümlülüğünün sınırı nedir?
2. **EİDS:** Emlak ofisinin kendi alan adındaki sitesinde yayımladığı ilanlar ve bu ilanların WhatsApp'ta paylaşılması EİDS kapsamında mı? KARAYS EİDS API entegrasyonu zorunluluğu olan bir "ilan platformu" sayılabilir mi?
3. **VUK 595:** KARAYS, "taşınmaz ilanlarının yayımlanmasına aracılık eden yer sağlayıcı" olarak GİB'e aylık bildirim yükümlüsü mü? Tek ofislik ücretsiz pilotta da mı?
4. **5651:** KARAYS'ın BTK'ya yer sağlayıcılık bildirimi yapması gerekiyor mu? Trafik kaydı süresi (kanunda 1–2 yıl) ve kapsamı ne olmalı?
5. **İlke Kararı 2026/347:** Formlardaki zorunlu "Aydınlatma Metni'ni okudum" kutusu ile pazarlama için ayrı açık rıza ve İYS onay kutusu tasarımı karara uygun mu?
6. **Şahıs olarak başlamak:** Sözleşmenin sahibin kendi adına imzalanmasının sorumluluk ve vergi sonuçları; pilot ücretsiz olsa da "işe başlama" sayılır mı? (mali müşavirle birlikte)
7. **Sorumluluk sınırı:** Ücretsiz pilotta sabit bir TL sınırı ile KVKK m.12/2 müteselsil sorumluluk ve TBK m.115 nasıl bağdaştırılır?
8. **Aydınlatma metinlerindeki aktarım cümlesi:** Standart sözleşme süreci devam ederken "süreç yürütülmektedir" şeklinde bir ifade yeterli mi, yoksa aktarım başlamadan önce mi tamamlanmalı?
9. **Fikri mülkiyet ve 5651:** Ofisin yüklediği fotoğraflar için telif ihbarında yer sağlayıcı olarak KARAYS'ın kaldırma süresi ve süreci ne olmalı? Sözleşmedeki "ari tutma" (5.3) maddesi yeterli mi?
10. **Vercel ve sağlayıcı koşulları:** Hobby planında ticari kullanım (sözleşme ihlali) nedeniyle oluşabilecek kesintiye karşı pilot sözleşmesinde ayrıca bir hüküm gerekir mi?

---

## 8. Kaynaklar (bu turda kullanılanlar)

**Resmî [R]**
- KVKK – Standart Sözleşmeler: https://www.kvkk.gov.tr/Icerik/7929/Standart-Sozlesmeler
- KVKK – Standart Sözleşme Bildirim Modülü Duyurusu: https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu
- KVKK – Standart sözleşmelerde dikkat edilecekler: https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu
- KVKK – Standart sözleşmelerin İngilizce çevirisi: https://kvkk.gov.tr/Icerik/7998/Standart-Sozlesme-Metinlerinin-Ingilizce-Cevirisine-Iliskin-Duyuru
- KVKK – Uluslararası nitelikte olmayan anlaşma duyurusu (10.11.2025): https://www.kvkk.gov.tr/Icerik/8538/uluslararasi-sozlesme-niteliginde-olmayan-anlasma-ile-yurt-disina-kisisel-veri-aktarimina-izin-verilmesi-hakkinda-duyuru
- KVKK – VERBİS duyurusu: https://kvkk.gov.tr/Icerik/8388/KAMUOYU-DUYURUSU
- KVKK – 2025 bilançosuna göre VERBİS kayıt süresi: https://www.kvkk.gov.tr/Icerik/8752/2025-yili-mali-bilanco-toplami-bakimindan-sicile-kayit-yukumlulugu-dogan-kurumlar-vergisi-mukellefi-tuzel-kisi-veri-sorumlularinin-verbis-kayit-suresi-hakkinda-kamuoyu-duyurusu
- KVKK – Özel nitelikli veri işleme şartları: https://www.kvkk.gov.tr/Icerik/8364/Ozel-Nitelikli-Kisisel-Verilerin-Islenme-Sartlari · Rehber: https://www.kvkk.gov.tr/Icerik/8184/Ozel-Nitelikli-Kisisel-Verilerin-Islenmesine-Iliskin-Rehber
- KVKK – Aydınlatma Tebliği: https://www.kvkk.gov.tr/Icerik/4132/aydinlatma-yukumlulugunun-yerine-getirilmesinde-uyulacak-usul-ve-esaslar-hakkinda-teblig
- KVKK – Çerez Rehberi: https://kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber
- KVKK – Veri İhlali Bildirimi: https://www.kvkk.gov.tr/Icerik/5362/Veri-Ihlali-Bildirimi · 2019/271: https://kvkk.gov.tr/Icerik/5547/2019-271
- KVKK – 2026 idari para cezası tablosu: https://www.kvkk.gov.tr/Icerik/8145/6698-sayili-kisisel-verilerin-korunmasi-kanunu-kapsaminda-idari-para-cezasi-tutarlari
- Resmî Gazete 10.03.2018 (Aydınlatma Tebliği): https://resmigazete.gov.tr/eskiler/2018/03/20180310-5.htm
- Resmî Gazete 29.12.2022 (E-ticaret yönetmeliği): https://www.resmigazete.gov.tr/eskiler/2022/12/20221229-5.htm
- Resmî Gazete 05.09.2026 (VUK 595): https://www.resmigazete.gov.tr/eskiler/2026/09/20260905-26.htm
- Ticaret Bakanlığı – EİDS kapsamı (Instagram/Facebook/WhatsApp): https://koop.ticaret.gov.tr/haberler/ticaret-bakanligi-tasinmaz-ve-tasit-ticaretinde-uygulanmakta-olan-elektronik-ilan-dogrulama-sistemi-eids-kapsaminda-kimlik-ve-yetki-dogrulamasi-zorunlulugunu-instagram-facebook-ve-whatsapp-da-dahil-olmak-uzere-elektronik-ortamda-verilen-tum-tasinmaz-ve-tasi
- Ticaret Bakanlığı – Sosyal medyada EİDS yaptırımları: https://ticaret.gov.tr/haberler/ticaret-bakanligi-sosyal-medyadaki-sahte-ilanlara-gecit-vermiyor-eids-kurallarina-aykiri-paylasimlara-karsi-yaptirimlar-kararlilikla-uygulaniyor
- Ticaret Bakanlığı – Emlakçılık faaliyetlerinde yeni düzen (yetki belgesi no): https://ticaret.gov.tr/haberler/emlakcilik-faaliyetlerinde-yeni-duzen
- Ticaret Bakanlığı – EİDS yetki doğrulama: https://ticaret.gov.tr/kurumsal-haberler/elektronik-ilan-dogrulama-sistemi-eids-yetki-dogrulama-uygulamasi-hayata-gecirildi
- Ticaret Bakanlığı (X) EİDS açıklaması: https://x.com/ticaret/status/2034194035124892012
- 5651 kanun metni (Aile Bakanlığı'nda yayımlanmış kopya): https://aile.gov.tr/uploads/chgm/uploads/pages/kanunlar/5651-sayili-internet-ortaminda-yapilan-yayinlarin-duzenlenmesi-ve-bu-yayinlar-yoluyla-islenen-suclarla-mucadele-edilmesi-hakkinda-kanun.pdf

**Sağlayıcı belgeleri**
- Vercel Fair Use Guidelines: https://vercel.com/docs/limits/fair-use-guidelines · Vercel DPA: https://vercel.com/legal/dpa
- Supabase veri yerleşimi SSS: https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq · GDPR: https://supabase.com/docs/guides/security/gdpr-compliance
- Resend GDPR/regions: https://resend.com/security/gdpr · https://resend.com/docs/dashboard/domains/regions
- Cloudflare R2 veri konumu: https://developers.cloudflare.com/r2/reference/data-location/
- Google Cloud DPA (Turkish SCCs): https://cloud.google.com/terms/data-processing-addendum
- Netlify Free planı: https://www.netlify.com/blog/introducing-netlify-free-plan · OpenNext Cloudflare: https://opennext.js.org/cloudflare
- OFL 1.1: https://spdx.org/licenses/OFL-1.1.html

**İkincil [İ]**
- 2026/347 ilke kararı: https://www.lexpera.com.tr/mevzuat/kurul-kararlari/kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-karari-2026-347-1 · https://www.alomaliye.com/2026/03/24/kvkkdan-yeni-ilke-karari-acik-riza-metni-ile-aydinlatma-metni-artik-ayri-duzenlenmeli/ · https://www.legal500.com/intelligence/turkey/privacy/2026347-say%C4%B1l%C4%B1-Ilke-karar%C4%B1-sonras%C4%B1nda-ac%C4%B1k-r%C4%B1za-ve-ayd%C4%B1nlatma-metinleri
- VERBİS 2025/2393: https://cottgroup.com/tr/blog/kvkk-gdpr/item/verbise-kayit-yukumlulugu-istisnasina-iliskin-uygulama-esaslari-netlestirildi · 2025/1572: https://www.alomaliye.com/2026/01/13/kisisel-verileri-koruma-kurulunun-2025-1572-sayili-kararinin-uygulama-esaslari/ · https://cms.law/en/tur/legal-updates/expanded-verbis-exemptions-for-small-scale-data-controllers
- Yurt dışı aktarım rehberi: https://www.erdem-erdem.av.tr/bilgi-bankasi/yurt-disina-kisisel-veri-aktarimi-rehberi-neleri-duzenliyor · https://ey.com/content/dam/ey-unified-site/ey-com/tr-tr/services/law/documents/ey-tr-kisisel-verilerin-korunmasi.pdf · https://advocateturkey.com/2026/08/25/your-data-is-in-turkiye-but-your-ai-is-abroad-is-your-saas-already-making-an-international-data-transfer-under-the-kvkk/
- 2026 cezaları: https://www.mondaq.com/turkey/data-protection/1729106/ · https://cottgroup.com/tr/mevzuat/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari
- Veri ihlali: https://www.alomaliye.com/2019/01/24/kvkk-karari-2019-10-kisisel-veri-ihlali-bildirim-usul-ve-esaslari/ · https://cms.law/en/tur/legal-updates/kvkk-limits-publication-period-for-data-breach-notices-to-60-days
- Taşınmaz Ticareti 2026 değişiklikleri: https://www.alomaliye.com/2026/04/29/tasinmaz-ticareti-hakkinda-yonetmelikte-degisiklik-29-04-2026/ · https://www.mizan.com.tr/2026/10/02/tasinmaz-ticareti-hakkinda-yonetmelikte-degisiklik/ · https://paksoy.av.tr/2026/05/tasinmaz-satislarinda-guvenli-odeme-sistemi-zorunlu-hale-geliyor/ · 2023: https://www.alomaliye.com/2023/08/31/tasinmaz-ticareti-hakkinda-yonetmelikte-degisiklik-31-08-2023/
- EİDS tarihleri ve listesi: https://www.aa.com.tr/tr/ekonomi/satilik-tasinmaz-ilanlari-icin-subattan-itibaren-dogrulama-donemi-basliyor/3813941 · https://www.alomaliye.com/2026/09/30/tasinmaz-ilanlarinda-eidsye-entegre-olan-firmalar-guncellendi-eylul-2026/
- VUK 595: https://www.pwc.com.tr/tr/hizmetlerimiz/vergi/bultenler/2026/vergi-usul-kanunu-genel-tebligi-sira-no-595.html · https://www.alomaliye.com/2026/09/05/vergi-usul-kanunu-genel-tebligi-sira-no-595/
- 6563/İYS: https://www.lexpera.com.tr/mevzuat/yonetmelikler/ticari-iletisim-ve-ticari-elektronik-iletiler-hakkinda-yonetmelik · https://www.parasut.com/blog/ileti-yonetim-sistemi-hakkinda-bilmeniz-gerekenler
- ETAHS/ETBİS: https://www.alomaliye.com/2022/12/29/elektronik-ticaret-araci-hizmet-saglayici-ve-elektronik-ticaret-hizmet-saglayicilari/ · https://www.ffkpartnerhukuk.com.tr/etbis-kaydi-kimler-icin-zorunludur-2026-guncel-rehber/ · https://www.alomaliye.com/2025/03/08/elektronik-ticaret-araci-hizmet-saglayici-ve-elektronik-ticaret-hizmet-saglayicilar/
- 5651 yer sağlayıcı bildirimi (forum, zayıf): https://www.r10.net/off-topic/2470918-btk-yer-saglayici-hk-2.html · faaliyet belgesi yönetmeliği: https://www.lexpera.com.tr/mevzuat/yonetmelikler/telekomunikasyon-kurumu-tarafindan-erisim-saglayicilara-ve-yer-saglayicilara-faaliyet-belgesi
- TTK m.39: https://www.alomaliye.com/2013/11/23/yeni-turk-ticaret-kanununa-gore-ticari-belgelerde-1-ocak-2014-tarihinden-itibaren-yer-almasi-gereken-zorunlu-bilgiler
- FSEK m.68: https://www.hukukihaber.net/telif-hakki-ihlalinden-dogan-parasal-talepler-yargitay-kararlari-isiginda
- İşe başlama bildirimi: https://hukukcularevi.com/ise-baslama-mukellefiyet-tesisi-ve-vergi-levhasi/

**Bu turda doğrulanamayanlar (özet):** Aydınlatma Tebliği'ndeki "RG 28.04.2019/30758" değişikliği; Çerez Rehberi'nde reddet düğmesine ilişkin birebir ifade; ilgili kişiye ihlal bildirimi süresi (72 saat mı, makul süre mi); 5651 Yönetmeliğindeki güncel trafik kaydı süresi, yer sağlayıcı bildirim usulü ve güncel ceza tutarı; standart sözleşme bildirmeme cezasının üst sınırı; EİDS'nin ofisin kendi sitesine uygulanıp uygulanmadığı ve satılık ilanlarda zorunluluğun başlangıç tarihi (1 mi 15 Şubat 2026 mı); VUK 595'te eşik ve istisna; ticari ileti retlerinin 3 iş günü içinde uygulanması; bedelsiz hizmette KDV ve fatura; yazı tiplerinin tek tek lisansı; tüketici Gmail hesabı için DPA bulunmaması; Cloudflare Workers Free'de ticari kullanım koşulu; 2015 e-ticaret yönetmeliğinin yürürlükten kaldırılması.
