# KARAY şirket sayfası (/karay) ve KARAY talepleri

KARAY, emlak ofislerine (kiracılara) web sitesi, ilan, CRM ve marka yönetimi sağlayan platformun **kendi** şirketidir. `/karay` KARAY'ın ürün tanıtım (SaaS) sayfasıdır; hiçbir emlak ofisinin sitesi değildir.

## Nerede açılır?

| Alan adı | `/karay` | Kök `/` |
| --- | --- | --- |
| `KARAY_HOSTS` içindeki alan adı (ör. `karay.com.tr`) | KARAY sayfası | KARAY sayfası (proxy `/karay`'a yeniden yazar) |
| Platform/paylaşılan alan adı (localhost, `*.vercel.app`, `PLATFORM_ROOT_DOMAIN`) | KARAY sayfası | Varsayılan kiracı sitesi |
| Kiracının özel alan adı (ör. `elvankentgayrimenkul.com`) | **404** (kiracı sitesine yönlenir, orada böyle sayfa yok) | Kiracı sitesi |

Mantık: `src/platform/tenant/host.ts › karayHostKind`, uygulama: `src/proxy.ts`. Test: KARAY-16.

## Marka ayrımı

- KARAY sayfası kendi header/footer'ını (`src/components/karay/*`), KARAY logosunu ve platform renklerini kullanır; kiracı teması, rengi, logosu veya adı sayfaya girmez (KARAY-11).
- KARAY şirket bilgileri (`platform_settings`) kiracı sitelerinde görünmez (KARAY-12).
- Demo bandı (`DEMO ORTAMI`) KARAY sayfasında gizlidir; kiracı demo sitelerinde aynen kalır.

## Şirket bilgileri (Platform › KARAY ayarları)

`/platform/ayarlar` — yalnızca süper admin. Şirket adı, kısa tanım, e-posta, telefon, WhatsApp, adres, şehir, web sitesi, sosyal medya (yalnızca `https://`), SEO başlığı/açıklaması, indekslenebilirlik, talep bildirim adresleri (en fazla 5).

**İletişim bilgileri boş başlar ve uydurulmamıştır.** Boş alan sayfada hiç gösterilmez (footer, iletişim bölümü, JSON-LD). Kaydedince `karay` önbellek etiketi yenilenir; sayfa hemen güncellenir (değişiklik `platform.settings_updated` olarak denetim kaydına yazılır).

## KARAY talepleri (Bilgi al / Demo talep et)

- Form: `/karay#iletisim` (`#demo` bağlantısı "Demo talep et"i seçili açar).
- Kayıt: **`platform_leads`** tablosu. Kiracıların `leads` / `customers` tablolarından tamamen ayrıdır; hiçbir ofisin CRM'ine düşmez, alan adından kiracı çözülmez, istemciden kiracı kimliği alınmaz (KARAY-04, RLS testleri).
- Görüntüleme: `/platform/talepler` (Açık / Yeni / Kapananlar / Tümü), durum ve iç not güncelleme (`platform_update_lead`, denetim: `platform.lead_updated`, kiracısız).
- Bildirim: `lead_notify_emails` adreslerine e-posta (e-posta sağlayıcısı yoksa talep yine kaydedilir).

### Güvenlik

| Katman | Önlem |
| --- | --- |
| Tarayıcı | gizli alan (honeypot), en az 2,5 sn doldurma süresi, KVKK onayı zorunlu |
| Sunucu eylemi | zod doğrulama (ad, e-posta/telefon biçimi, uzunluklar), e-posta veya telefondan biri zorunlu |
| Veritabanı | `submit_platform_lead` **yalnızca service role** çağırabilir (herkese açık anahtarla doğrudan çağrılamaz); IP özeti zorunlu; aynı IP 10 dk'da 3, 24 saatte 10; genel saatte 300 |
| Okuma/güncelleme | RLS: yalnızca süper admin; doğrudan INSERT politikası yok |
| Gizlilik | IP adresi saklanmaz, yalnızca tuzlu özeti (`IP_HASH_SALT`) |

## SEO

- `/karay` indekslenebilir (ayar ile kapatılabilir), kanonik adres, Open Graph görseli (`/karay/og-karay.png`), `Organization` JSON-LD, `/karay/sitemap.xml`, `/karay/robots.txt`.
- Demo ortamında kiracı sayfalarındaki `X-Robots-Tag: noindex` aynen korunur; yalnızca `/karay` bu kuralın dışındadır (`next.config.ts`). Test: KARAY-02.
- Yasal metinler (`/karay/yasal/*`) **TASLAK** olarak işaretlidir ve noindex'tir. Hukuk onayından ve gerçek şirket bilgileri girilmeden yayına alınmamalıdır.

## Görseller

Ürün ekran görüntüleri (`public/karay/ekran-*.png`) gerçek Site Kontrol Merkezi ekranlarıdır; geçici "Örnek Gayrimenkul" kiracısıyla alınmış, kiracı sonra silinmiştir. Sahte müşteri, istatistik, yorum veya referans yoktur. Görseller `next/image` ile AVIF/WebP ve boyutlandırılmış sunulur.

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `KARAY_HOSTS` | (isteğe bağlı) KARAY sayfasının kendi alan adları, virgülle |
| `PLATFORM_ROOT_DOMAIN` | (isteğe bağlı) platform kök alan adı; KARAY sayfası burada da `/karay`'da açılır |

## Testler

- E2E: `tests/e2e/karay-site.spec.ts` — KARAY-01…18
- RLS: `tests/security/rls.test.mjs` › "KARAY şirket bilgileri ve KARAY talepleri"

---

# Genel denetim (P0–P3) — 02–03.10.2026

| Öncelik | Bulgu | Durum |
| --- | --- | --- |
| P0 | KARAY formu: doldurma süresi `setState` ile gönderim anında yazılıyordu; ilk gönderimde her kullanıcı "çok hızlı gönderildi" hatası alıyordu | Düzeltildi (ref ile doğrudan yazım) |
| P0 | KARAY formu: doğrulama hatasından sonra React form sıfırlaması seçimi siliyordu; "Demo talep et" seçili görünürken talep "Bilgi al" olarak kaydediliyordu | Düzeltildi (durumdan beslenen gizli alan) |
| P0 | `/platform/talepler` çöküyordu: istemci modülünden dışa aktarılan sabit sunucu bileşeninde kullanılıyordu | Düzeltildi (ortak modül) + tüm proje tarandı, başka örnek yok |
| P1 | `submit_platform_lead` herkese açık anahtarla doğrudan çağrılabiliyordu (honeypot/süre atlanır, IP özeti boş geçilerek IP sınırı aşılırdı) | Düzeltildi (yalnızca service role, IP özeti zorunlu) + RLS testi |
| P1 | KARAY sayfası tema vitrini için şema doğrulayıcısını (zod, ~90 KB gzip) tarayıcıya gönderiyordu | Düzeltildi: varsayılan yapılandırma sunucuda üretiliyor; sayfa JS'i 295 KB → 204 KB (mobil ölçüm) |
| P1 | Platform genel bakışında paneller en uzun panelin boyuna esneyip büyük boşluklar bırakıyordu; mobil tema önizlemesinde ilan detayı sıkışıyordu | Düzeltildi |
| P1 | Panel sayfalarında hata sınırı yoktu (beklenmeyen hata tüm ekranı boşaltıyordu) | Eklendi: platform ve ofis paneli `error.tsx` (tekrar dene, hata kodu) |
| P1 | Tema galerisinde 10 "Bu temayı seç / Önizle" düğmesi aynı ada sahipti (ekran okuyucu ayırt edemiyordu) | Düzeltildi (`Marble temasını seç` vb.) |
| P1 | Platform genel bakışı: web sitesi durumu, bekleyen taslaklar, KARAY talepleri ve son işlemler görünmüyordu | Eklendi (yalnızca gerçek veri) |
| P1 | Site geçmişinde yayını kimin yaptığı görünmüyordu | Eklendi (denetim kaydından) |
| P2 | Site Kontrol Merkezi'nde yeni kiracı için ne eksik olduğu belli değildi | Eklendi: kurulum kontrol listesi (8 madde, ilgili sekmeye bağlantılı) |
| P2 | Sürüm karşılaştırma (diff) arayüzü yok | Rapor: sürümler tam anlık görüntü sakladığı için altyapı hazır; arayüz sonraki aşamada |
| P2 | KARAY sayfası çok dilli değil | Rapor: şimdilik yalnızca Türkçe |
| P3 | Yasal metinler taslak | Rapor: hukuk onayı ve gerçek şirket bilgileri bekleniyor |
| P3 | KARAY iletişim bilgileri boş | Rapor: Platform › KARAY ayarları'ndan girilecek (uydurulmadı) |
