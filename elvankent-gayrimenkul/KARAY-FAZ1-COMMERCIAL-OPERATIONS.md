# KARAY — FAZ 1: Ticari Operasyonlar ve P1 Kapatma (Commercial Operations)

Tarih: 05–10.10.2026 · Dal: `claude/elvankent-real-estate-platform-vxq9dj` · Önceki faz: FAZ 0 (`a5a2cfa`)
Production'a dokunulmadı (veritabanı, Vercel, DNS). Ödeme entegrasyonu başlatılmadı. Altyapı göçü yapılmadı.

Soru: **"Yarın ilk gerçek emlakçı müşterimizi KARAY'a alsak, baştan sona problemsiz yönetebilir miyiz?"**
FAZ 1 öncesi cevap: **hayır** — en kritik neden, Başlangıç/Profesyonel planındaki bir müşterinin sitesinin
hiçbir adreste açılamaması ve KARAY'ın 20 müşteriyi "hangisi kurulumda / yayında / sorunlu" diye
görememesiydi. FAZ 1 sonrası: **evet, elle yürütülen birkaç operasyon adımıyla** (bölüm 9).

---

## 1. Audit — FAZ 0 maddelerinin kodla doğrulanması

Sadece raporda yazdığı için P1 kabul edilmedi; her madde kodda yeniden kontrol edildi.

| ID | Alan | Durum (kod) | Ticari etki | Öncelik | Faz |
| --- | --- | --- | --- | --- | --- |
| P1-1 | Ekip üyesi daveti | Geçici şifre ile ekleniyordu (`admin-users.ts`) | Sahip ekibini eklerken şifreyi elle iletmek zorunda; güvenlik + destek yükü | P1 | **FAZ 1 — yapıldı** |
| P1-2 | Sayfa metinleri gerçek taslağı | Anında yayın, etiketli (FAZ 0) | Düşük — etiket dürüst | P2 | Sonraki |
| P1-3 | Deneme bitişi | Otomasyon yok, görünürlük yok | KARAY bitmiş denemeyi fark etmiyor | P1 (görünürlük) | **FAZ 1 — görünürlük yapıldı**; otomasyon billing fazı |
| P1-4 | Alarm kuralları | Health var, eşik/prosedür yok | Kesintiyi müşteri bildirir | P1 (belge) | **FAZ 1 — belgelendi** |
| P1-5 | CSP nonce | `unsafe-inline` | Nonce her sayfayı dinamik yapar → ISR (5 dk) kaybolur; XSS yüzeyi zaten React kaçışıyla dar | MEDIUM | Sonraki (bkz. §7) |
| P1-6 | Depo gizliliği | Herkese açık | Kod görünür; sır yok (gitleaks temiz) | MEDIUM | **Sahip kararı** (GitHub ayarı) |
| P1-7 | Uzun yük sonrası RSC askısı | Yerelde yeniden üretilemedi | Belirsiz | P2 (izleme) | Sonraki |
| P1-8 | Sıfırlama bağlantısında onay adımı | Yok | Bağlantı tarayıcısı tek kullanımlık bağlantıyı tüketebilir → kullanıcı tekrar ister | P2 | Sonraki |
| P1-9 | CI'da geri yükleme provası | Yerel prova var, CI yok | Operasyonel güven | P2 | Sonraki |
| P1-10 | E-posta teslim durumu (bounce) | Yok | Davet gelmezse "gönderildi" görünür | P2 | Sonraki (FAZ 1: "gönderildi" artık yalnızca sağlayıcı kabul edince) |
| P2-1 | Vercel API ile alan adı | Elle (karar korunuyor) | 20 müşteride sorun değil | P2 | Sonraki |
| P2-2 | Birincil alan adı yedeği | — | Düşük | P2 | Sonraki |
| P2-3 | `x-forwarded-host` yedek yolu | İstismar yolu yok | Düşük | P2 | Sonraki |
| P2-4 | Ayrı OG alanları | — | SEO ince ayar | P2 | Sonraki |
| P2-5 | Marka görseli yetim dosyalar | — | Depolama | P2 | Sonraki |
| P2-6 | Yükleme eşzamanlılık belirteci | — | Nadir | P2 | Sonraki |
| P2-7 | Site ikonu önbellek süresi | — | Kozmetik | P2 | Sonraki |
| TD-1…8 | FAZ 0 teknik borçları | Değişmedi | — | TD | §12 |
| D-1…6 | Vercel API, DNS otomasyonu, www→kök 301, birincil yedeği, altyapı adaptörleri, ödeme | Kararlar korunuyor | — | DEFERRED | — |

### FAZ 1 audit'inde yeni bulunanlar (müşteri akışı)

| ID | Alan | Bulgu | Ticari etki | Öncelik | Faz |
| --- | --- | --- | --- | --- | --- |
| **N1** | Site adresi | `PLATFORM_ROOT_DOMAIN` yoksa özel alan adı olmayan ofisin **sitesi ve önizlemesi hiçbir adreste açılmıyor**; Başlangıç/Profesyonel planda özel alan adı yok → bu müşteriler **yayına çıkamaz**. "Siteyi aç" ve /platform/siteler bağlantıları **başka müşterinin** (varsayılan kiracı) adresine gidiyordu | Satış yapılan plan teslim edilemez; yanlış müşteriye yönlendirme | **P0/P1** | **FAZ 1 — yapıldı** (F1-1) |
| N2 | Yayın anı | "Yeni organizasyon" yolu siteyi **açık** başlatıyor (sihirbaz taslak başlatıyordu) — boş site ziyaretçiye açık | İlk izlenim | P1 | **Yapıldı** (F1-2) |
| N3 | Müşteri yönetimi | Listede arama, durum, sahip, site, alan adı yok; "hangisi kurulumda / yayında / sorunlu" görülemiyor | 20 müşteride KARAY kör | P1 | **Yapıldı** (F1-3) |
| N4 | Onboarding | Ofis panelinde kurulum yönlendirmesi yok | Teknik olmayan müşteri nereden başlayacağını bilmiyor | P1 | **Yapıldı** (F1-4) |
| N5 | Destek | Müşteri başına not yok | Görüşme geçmişi kaybolur | P1 (küçük) | **Yapıldı** (F1-5) |
| N6 | Operasyon metrikleri | Genel bakışta yalnızca hacim | Darboğaz görünmez | P1 (küçük) | **Yapıldı** (F1-3) |
| N7 | Depolama limiti | **Audit düzeltmesi:** limit zaten yüklemede uygulanıyor (`media_upload_allowed`, beyan edilen boyut + %35 varyant payı). İlk audit'teki "yalnızca gösteriliyor" tespiti **yanlıştı** | — | — | Değişiklik yok (F1-7 düşürüldü). Not: kota beyan edilen boyuta göre; dosya başına 50 MB üst sınırı var → TD-9 |

## 2. Müşteri akışı — 18 adım

| Adım | FAZ 1 öncesi | FAZ 1 sonrası |
| --- | --- | --- |
| Satış → müşteri oluşturma | 2 yol, farklı site durumu | 2 yol, ikisi de **taslak** (ortak çekirdek) |
| Plan | Konsoldan atanıyor | Aynı; deneme bitişi / gecikme **Dikkat** olarak görünür |
| Owner daveti → aktivasyon | Güvenli (P0.4) | Aynı; "gönderilmedi" durumu görünür |
| Firma bilgileri, logo, aile, tema, içerik, SEO, ilanlar | Ekranlar var, yönlendirme yok | Ofis panelinde **"Sitenizi kurun"** listesi (adım → ilgili ekran) |
| Domain / DNS | Var (P0.5) | Aynı + **kendi adresi yoksa** açık uyarı, yanlış bağlantı yok |
| Yayın → müşteri teslimi | Belirsiz | **Teslim = KARAY taslaktan yayına alır** (yeni state yok); "Yayına hazır" filtresi |
| Müşteri kendi panelini kullanır | Ekip geçici şifreyle | Ekip **davetle** (şifresiz), "davet bekliyor / tekrar gönder" |
| KARAY müşteriyi yönetir | Liste + detay | Durum, kurulum %, sahip, site, alan adı, arama, filtre, notlar, metrikler |

Kalan manuel adımlar (bilinçli): alan adını Vercel'e eklemek, site durumunu "Yayında" yapmak (teslim kontrolü), planı atamak, faturalandırma.

## 3. Ödeme — mimari (kod yok)

Ayrıntı: **docs/BILLING_ARCHITECTURE.md**. Özet:

- Bugün: 3 plan (limitler ve bayraklar DB'de uygulanıyor; fiyat alanı boş), abonelik durumu (`trialing/active/past_due/cancelled/expired`), elle plan değişimi, elle askı. Fatura/ödeme kaydı yok.
- Önerilen minimum model: `Organization → Subscription → Plan`, `Subscription → Invoice`, `PaymentEvent` (webhook olay kimliği tekil). Sağlayıcı tek gerçek kaynak; kart verisi KARAY'da tutulmaz; erişim kararı sağlayıcıya anlık bağımlı değil; sağlayıcı tek adaptörde.
- Sağlayıcı kriterleri: Türkiye üye işyeri, tokenizasyon, abonelik, webhook, başarısız ödeme, iade, e-Fatura/e-Arşiv (ayrı entegratör olabilir), KVKK, komisyon, B2B. **Ücret/oran yazılmadı** — sağlayıcıdan yazılı teyit gerekir.
- Billing fazından önce verilecek 5 karar belgede listeli (fiyat, deneme, gecikme ek süresi, sağlayıcı + e-fatura, düşürme politikası).

## 4. İlk 10–20 müşteri — "Bir KARAY yöneticisi 20 müşteriyi rahatça yönetebilir mi?"

| İhtiyaç | Durum |
| --- | --- |
| Liste, arama (ad / kısa ad / alan adı / sahip e-postası, Türkçe harf duyarsız) | ✓ |
| Durum (Davet bekliyor / Kurulumda / Yayına hazır / Yayında / Dikkat / Askıda) + sayılı filtreler | ✓ |
| Plan + abonelik rozeti | ✓ |
| Domain (birincil / bekleyen sayısı) ve site durumu (açık / taslak / bakım, yayın sürümü) | ✓ |
| Owner (e-posta, davet durumu), son etkinlik, oluşturulma | ✓ |
| Suspend / activate | ✓ (mevcut) |
| Resend invite (sahip) | ✓ (mevcut) |
| Reset password | Sahip "Şifremi unuttum" kullanır (FAZ 0 güvenli yol); KARAY'ın şifre belirlemesi bilinçli olarak YOK |
| Preview | ✓ — kendi adresi yoksa açık hata |
| Public site | ✓ — yalnızca kendi adresi varsa bağlantı |
| Plan değişimi | ✓ (mevcut) |
| Notlar | ✓ (yeni) |

**Cevap: Evet**, 20 müşteri tek ekrandan izlenebilir. Sınır: liste tek sorguda tüm müşterileri yükler (200+ müşteride sayfalama gerekir → TD-10).

## 5. Onboarding — "Teknik bilgisi olmayan emlakçı kendi sitesini kurabilir mi?"

Ofis paneli ana sayfasında **"Sitenizi kurun"** (sahip ve yönetici): Firma bilgileri → Logo → İletişim ve adres → Tasarım → İlk ilan → SEO → Değişiklikleri yayınla → (planında varsa) Alan adı → Site yayına açıldı (KARAY). İlerleme çubuğu, her adım mevcut ekrana gider, "sıradaki adım" bağlantısı; site açılıp her şey tamamlanınca liste kaybolur. Yeni dashboard yazılmadı; bayraklar veritabanında tek fonksiyonda (`_org_onboarding_flags`) hesaplanır, KARAY konsolu aynı hesabı kullanır.

**Cevap: Evet, alan adı hariç.** Alan adı (TXT + CNAME) hâlâ müşterinin DNS paneline girmesini gerektirir; ekran yönergeleri var, ilk müşterilerde KARAY desteği önerilir (docs/operations/domain-connection.md).

## 6. Handoff, destek, analitik

- **Handoff:** yeni state eklenmedi. Teslim = Web Siteleri › Site durumu › Yayında. "Yayına hazır" = sahip etkin + zorunlu adımlar tamam + site kapalı. Kontrol listesi: docs/operations/customer-handoff.md.
- **Support:** `platform_org_notes` — yalnızca süper admin okur/yazar, düzenleme/silme yok, yazar = oturum. Ticket sistemi yok.
- **Analytics (operasyon):** genel bakışta Dikkat / Davet bekliyor / Kurulumda / Yayına hazır / Yayında (+ yayınlanmış site sayısı) / Alan adı bekliyor / Askıda + plan dağılımı. Yeni altyapı yok; aynı müşteri listesinden sayılır.

## 7. Security P1 — yeniden değerlendirme

| Madde | Seviye | Gerçek risk mi | Launch etkisi | Kolaylık | Bozma riski | Karar |
| --- | --- | --- | --- | --- | --- | --- |
| Ekip geçici şifresi | MEDIUM | Evet: şifre insan kanalından iletiliyor, ilk değiştirmeye kadar geçerli | Orta | Orta (mevcut davet altyapısı) | Düşük | **Kapatıldı** — e-posta yapılandırılmışsa şifresiz hesap + tek kullanımlık davet; sahip daveti değişmedi (yalnızca `role = 'owner'` filtresi eklendi). E-posta yoksa eski yol (açık uyarıyla) |
| CSP `unsafe-inline` | MEDIUM | Sınırlı: kullanıcı içeriği React ile kaçışlanıyor, `dangerouslySetInnerHTML` yalnızca JSON-LD ve broşürdeki sunucuda üretilen QR SVG; Markdown HTML içermez | Düşük | Zor | **Yüksek** — nonce her isteği dinamik yapar, ISR ve önbellek kaybolur | Sonraki faz (hash tabanlı CSP veya ayrı ölçüm) |
| Herkese açık depo | MEDIUM | Sır yok (gitleaks temiz); iş mantığı görünür | Düşük | Çok kolay | Yok | **Sahip kararı** — GitHub › Settings › Change visibility |
| Yeni: davet rol kısıtının kaldırılması | — | Hayır: istemci davet yazamaz; kabul, davet rolü üyelik rolüyle eşleşmezse reddedilir (RLS testiyle kanıtlı) | — | — | — | Kabul |

Tenant izolasyonu ve auth yaşam döngüsü: RLS 105/105 (yeni 9 test), FAZ 0 LC-1…8 yeşil.

## 8. Monitoring — `/api/health`

| | |
| --- | --- |
| Health endpoint | `GET /api/health` |
| Beklenen | 200 `{"status":"ok","db":"ok",…}`, `Cache-Control: no-store`, sır/sürüm yok |
| Hata | 503 `{"status":"degraded","db":"error"}` — DB 3 sn'de yanıt vermezse |
| Doğrulama (yerel, 05.10.2026) | DB açık → 200 (29 ms); ağ geçidi durdurulunca → 503 (3004 ms, zaman aşımı); geri açılınca → 200 |
| Eşik | 5 dk aralık, art arda 2 başarısız (~10 dk) veya > 5 sn → alarm |

Ayrıntı: docs/operations/incident-response.md.

## 9. Yapılanlar (F1-1 … F1-8)

| # | Değişiklik | Dosyalar |
| --- | --- | --- |
| F1-1 | `tenantBaseUrls.ownAddress` + `Tenant.siteAddress`; önizleme kendi adresi yoksa açık hata; "Siteyi aç", "Geçerli adres", alan adı paneli ve /platform/siteler artık başka müşterinin adresine gitmez ("Adres yok"); prelaunch: production'da `PLATFORM_ROOT_DOMAIN` zorunlu | `platform/tenant/host.ts`, `tenant.ts`, `site-editor/preview-link.ts`, platform/admin alan adı sayfaları, `siteler/page.tsx`, `scripts/prelaunch-check.mjs` |
| F1-2 | Yeni müşteri sitesi her iki yolda taslak (`provisionOrganization`) | `modules/platform/provisioning.ts`, `actions/site-create.ts` |
| F1-3 | Müşteri listesi (durum, kurulum, sahip, site/alan adı, arama, filtre), detayda Müşteri durumu paneli, genel bakışta operasyon metrikleri | `modules/platform/customer-status.ts`, `customers.ts`, `org-table.tsx`, organizasyon sayfaları, `platform/(konsol)/page.tsx` |
| F1-4 | Ofis "Sitenizi kurun" listesi (settings.manage) | `components/admin/onboarding-checklist.tsx`, `admin/(panel)/page.tsx` |
| F1-5 | KARAY notları | `platform_org_notes`, `addOrgNote`, `OrgNoteForm` |
| F1-6 | Ekip daveti (şifresiz), "Davet bekliyor / gönderilmedi / süresi doldu", "Daveti tekrar gönder" | `modules/platform/invitations/member.ts`, `actions/admin-users.ts`, `member-controls.tsx`, `kullanicilar/page.tsx` |
| F1-7 | Depolama limiti | **Gerekmedi** (zaten uygulanıyor — N7) |
| F1-8 | Deneme bitti / ödeme gecikmede / abonelik yok → Dikkat | `customer-status.ts` |

Migration: `20261011000001_customer_operations.sql` (26. dosya; tekrar çalıştırılabilir; geri dönüş SQL'i başlıkta). Postflight 26. satır eklendi. `docs/PRODUCTION_MIGRATION.md` 26 dosya, runbook 22/22.
Belgeler: `docs/operations/` (README, customer-onboarding, domain-connection, customer-handoff, incident-response, backup-restore), `docs/BILLING_ARCHITECTURE.md`.

Değiştirilen mevcut testler (gerçek nedenleriyle):
- `launch-readiness` LR-04: `tenantBaseUrls` dönüşüne `ownAddress` eklendi (davranış genişlemesi).
- RLS P0.4 "davet yalnızca owner (tablo kısıtı)": kısıt ekip davetleri için bilinçli kaldırıldı; aynı güvenlik özelliği davranışsal olarak doğrulanıyor (istemci davet yazamaz; rolü değiştirilmiş davet kabul edilmez).
- E2E `acceptance` "Emlakçı hesabı": geçici şifre yerine davet → aktivasyon (aynı doğrulamalar: sahip rolü, /platform 404).
- E2E `launch-lifecycle` LC-1/LC-3: site taslak başlar → KARAY teslimi (Yayında) adımı eklendi.
- E2E `custom-domain` E2: **gerçek test yarışı** bulundu (ikinci "Doğrula" işlemi bitmeden DNS değiştiriliyordu, uçuştaki işlem doğru kaydı okuyordu); her denemede işlemin bitmesi bekleniyor. 3 ardışık koşu 8/8.

Uygulama sırasında yakalanan hatalar: (1) `platform_owner_invitation` yeniden tanımında sahip kartının durum sözleşmesini bozan `not_sent` (RLS testi yakaladı, düzeltildi); (2) `org_mark_member_invitation_sent` sahip rolündeki ekip davetini "gönderildi" işaretlemiyordu (mobil kabul testi yakaladı, düzeltildi, RLS testi eklendi); (3) son kontrolün 26. satırı, 26. migration uygulanmamış bir veritabanında `'public.platform_org_notes'::regclass` sabiti yüzünden **ayrıştırma anında çöküyordu** (eksik migration'ı tam yakalaması gereken durumda) — canlı geçiş provasının negatif kopyası yakaladı, `to_regclass()` ile düzeltildi, birim testi CO-12 eklendi (bu sınıf hatayı tüm son kontrol için denetler).

## 10. Test sonuçları

| Test | FAZ 0 sonu | FAZ 1 sonu | Fark |
| --- | --- | --- | --- |
| Birim | 312/312 | **366/366** | +54 (customer-operations CO-01…CO-12) |
| RLS | 96/96 | **105/105** | +9 (FAZ 1 bölümü); 1 test davranışsal hale getirildi |
| E2E | 199 koşu (195 geçti, 4 atlandı) | **205 koşu: 201 geçti, 4 atlandı, 0 hata** (24,1 dk) | +6 (customer-operations CO-1…6) |
| Ortam yeniden başlatıldıktan sonra (yeni build) | — | CO-1…6 + LC-1…8: **14/14** | — |
| custom-domain spec (yarış düzeltmesi sonrası) | — | 3 ardışık koşu **8/8** | — |
| FAZ 1 kod mutasyonu | — | **32/33 öldürüldü + 1 eşdeğer** (M03: açık ama yayınlanmamış site zaten "Dikkat"e düşer). İlk koşuda M28 hayatta kaldı (regex `2000`, `20000`'i de eşliyordu) → test güçlendirildi | yeni |
| FAZ 1 DB mutasyonu | — | **22/22 öldürüldü** (ilk koşuda 18/22; 4 test boşluğu kapatıldı) | yeni |
| Postflight 26 negatif kontrol | — | istemciye açık fonksiyon, not tablosunda RLS kapalı / update / anon select, rol kısıtı geri eklenmiş, migration eksik → hepsi HATA (fonksiyon gövdesi değişiklikleri RLS testlerinin işi) | yeni |
| FAZ 0 temel mutasyonlar | 18/18 · P0.5 14/14 · P0.4 12/13+yarış+1 eşdeğer | **18/18 · P0.5 14/14 (sayılar birebir aynı) · P0.4 aynı: 11 doğrudan + d03 yarış kanıtı (orijinal 1 kabul, mutant 2 kabul) + d15 eşdeğer (x15b ile doğrulanır)**; d05 artık 2 testle yakalanıyor (güncellenen rol testi) | korundu |
| Typecheck · Lint · Build | temiz · 0 hata 3 uyarı · başarılı | temiz · 0 hata 3 uyarı (aynı) · başarılı | — |
| Gitleaks | temiz | temiz (44 değişen dosya + geçmiş) | — |
| Canlı geçiş provası (V1 yedeği kopyası) | 25 dosya, 21/21 | **26/26 dosya; son kontrol 22/22 TAMAM (26 satır, 4 KARŞILAŞTIRMA); ilan 8→8, fotoğraf 24→24, talep 3→3; ikinci kez çalıştırma sorunsuz; 26. dosyası eksik kopyada 26. satır HATA** | +1 dosya |

## 11. Altyapı coupling noktaları (göç YOK, yalnızca tespit)

| Nokta | Bağımlılık | Not |
| --- | --- | --- |
| Veritabanı + RLS + definer fonksiyonları | Supabase Postgres (`auth.uid()`, `auth.users`) | İş kuralları SQL'de; Postgres taşınabilir, `auth` şeması değil |
| Kimlik | Supabase GoTrue (`generateLink`, `verifyOtp`, `admin.createUser`) | Davet/sıfırlama/aktivasyon akışı |
| Depolama | Supabase Storage (imzalı yükleme, TUS) | `modules/media` |
| İstemci | `@supabase/supabase-js` ~50 dosyada doğrudan (TD-1) | Adaptör yok |
| Barındırma | Vercel: ISR/`updateTag`, `after()`, Domains (elle), Analytics/Speed Insights | `proxy.ts` host çözümlemesi taşınabilir |
| E-posta | Resend (tek adaptör) | Taşınabilir |
| Alan adı | Vercel Domains (elle) + DoH doğrulama | Adaptör var |

## 12. Listeler

**DONE**
- Kendi adresi olmayan siteler için doğru davranış (bağlantı yok, açık önizleme hatası, prelaunch hatası)
- Yeni müşteri sitesi taslak başlar; teslim = KARAY yayına alır
- KARAY müşteri listesi: durum, kurulum, sahip, site, alan adı, arama, filtre; detayda durum paneli
- Operasyon metrikleri (genel bakış)
- Ofis kurulum listesi
- KARAY notları
- Ekip daveti (şifresiz) + tekrar gönder + durum
- Deneme bitti / ödeme gecikmede / abonelik yok / 3 günden uzun bekleyen alan adı → Dikkat
- Billing mimarisi ve sağlayıcı kriterleri (kod yok)
- docs/operations (5 belge + indeks), health/monitoring belgesi
- Testler: +54 birim, +9 RLS, +6 E2E, 55 FAZ 1 mutantı (33 kod + 22 DB)

**PARTIAL**
- Onboarding: alan adı adımı müşterinin DNS bilgisine bağlı (yönergeler var)
- Deneme / gecikme: yalnızca görünürlük; otomatik askı yok (billing fazı)
- E-posta teslimi: "gönderildi" = sağlayıcı kabul etti; bounce/şikayet görünmüyor
- `PLATFORM_ROOT_DOMAIN` alt alan adlarının barındırmaya eklenmesi elle (veya joker alan adı)

**DEFERRED**
- Ödeme entegrasyonu (sağlayıcı kararı bekliyor), AI, CRM genişletme, yeni tema/pattern, altyapı göçü
- Vercel API ile alan adı, DNS otomasyonu, www→kök 301
- CSP nonce/hash, sıfırlama onay adımı, CI geri yükleme provası, RSC askısı izleme
- Sayfa metinleri gerçek taslak akışı

**TECH DEBT** (FAZ 0'daki 8 maddeye ek)
- TD-9: Depolama kotası beyan edilen boyuta göre; gerçek boyut yalnızca 50 MB üst sınırla doğrulanıyor
- TD-10: Müşteri listesi tek sorgu (200+ müşteride sayfalama gerekir)
- TD-11: `customerStatus` içinde `live && published` koşulu savunmacı (M03 eşdeğer mutant)
- TD-12: Ekip davetinde e-posta sağlayıcısı yoksa geçici şifre yoluna düşülüyor (iki yol)

**NEXT PHASE**
1. Bölüm 9'daki operasyon adımları + FAZ 0 açılış kapıları (yedek, CI DB testleri, e-posta alan adı, ortam, prova, izleme) — `PLATFORM_ROOT_DOMAIN` artık zorunlu
2. Billing fazı: önce docs/BILLING_ARCHITECTURE.md §4'teki kararlar, sonra sağlayıcı entegrasyonu
3. Kalan P2'ler (onay adımı, bounce, CI provası, CSP)

---

## Dört sonuç

**PRODUCT READINESS — PASS**
- Müşteri oluşturma → davet → aktivasyon → kurulum listesi → önizleme → yayın → alan adı → teslim zinciri testli (LC-1…8, CO-1…6).
- Başlangıç/Profesyonel planı müşterileri artık kendi adresinde yayına çıkabilir (`PLATFORM_ROOT_DOMAIN` ile); adres yoksa sistem bunu söyler, yanlış müşteriye götürmez.
- Teknik olmayan sahip, panelde adım adım yönlendiriliyor.

**SECURITY READINESS — PASS (kod) / PARTIAL (operasyon)**
- Kritik/yüksek açık yok; ekip geçici şifresi kapatıldı; yeni tüm fonksiyonlar istemciye kapalı veya yetki kontrollü (RLS + mutasyonla kanıtlı).
- Tenant izolasyonu ve auth yaşam döngüsü korunuyor (RLS 105/105).
- Açık MEDIUM'lar: CSP `unsafe-inline` (bilinçli erteleme), herkese açık depo (sahip kararı). FAZ 0 operasyon kapıları (yedek, CI) hâlâ açılmadı.

**COMMERCIAL READINESS — PARTIAL**
- Planlar ve limitler çalışıyor; plan değişimi konsoldan.
- Ödeme mimarisi ve sağlayıcı gereksinimleri tanımlı; entegrasyon başlamadı (bilinçli).
- Fiyatlar belirlenmedi; faturalandırma elle.

**OPERATIONAL READINESS — PASS (ilk 10–20 müşteri için)**
- KARAY bir ekrandan müşterinin kurulumda / yayına hazır / yayında / sorunlu olduğunu görür, filtreler, not alır.
- Onboarding, alan adı, teslim, olay müdahalesi, yedek/geri yükleme belgeli; health belgeli ve doğrulandı.
- Elle kalan işler belgeli ve hacme uygun (alan adı ekleme, teslim, plan, fatura).

## Definition of Done

- [x] CUSTOMER: oluşturma, owner activation, site setup, preview, publish, domain, handoff uçtan uca (LC + CO)
- [x] ADMIN: müşteriyi bul, müşteri/site/domain/owner durumunu gör, yönetim işlemleri
- [x] COMMERCIAL: plan anlaşılır, limitler çalışıyor, payment architecture tanımlı, provider gereksinimleri çıkarılmış, ödeme entegrasyonu başlamamış
- [x] SECURITY: P1 kritik açık yok; tenant isolation ve auth lifecycle korunuyor
- [x] OPERATIONS: domain, backup/restore, incident belgeli; health belgeli
- [x] QUALITY: Unit / E2E / RLS / Mutation baseline / Build / Typecheck / Lint / Gitleaks — bölüm 10
