# KARAY — FAZ 0: Ticari Yayına Hazırlık (Commercial Launch Readiness)

Tarih: 5 Ekim 2026 · Başlangıç commit'i: `030e25c` · Kapsam: canlıya çıkışı ve ilk müşteriyi engelleyen eksiklerin kapatılması. Yeni özellik yok.

> **Kısa sonuç:** Kod tarafındaki tüm P0 (launch blocker) maddeleri kapatıldı ve test edildi. KARAY **henüz production-ready DEĞİLDİR**: canlıya çıkış için KARAY ekibinin yapması gereken **7 operasyonel adım** kaldı (bölüm 9). Bunlar kod değil; hesap, sır (secret) ve DNS işlemleridir ve bu çalışmada bilerek yapılmadı (production'a dokunulmadı).

---

## 1. Başlangıç durumu

| Ölçüt | Değer (030e25c) |
| --- | --- |
| Birim testleri | 280 / 280 |
| RLS (veritabanı güvenliği) | 96 / 96 |
| E2E | 191 koşu: 187 geçti, 4 atlandı |
| Mutasyon (P0.4) | veritabanı 12/13 + iki oturumlu yarış kanıtı + 1 eşdeğer mutant; birim 18/18 |
| Mutasyon (P0.5) | veritabanı 14/14; birim 18/18 |
| Typecheck / lint | temiz / 0 hata, 3 uyarı |
| Canlı veritabanı | V1 şeması (geçiş belgesi 18 dosya listeliyordu; 6 dosya eksikti) |
| Otomatik yedek | iş akışı var, kapalı (7/7 çalışma atlandı) |
| CI veritabanı testleri | iş tanımlı, kapalı |

## 2. Audit

| Alan | Durum | Öncelik | Bulgular | Gerekli iş |
| --- | --- | --- | --- | --- |
| Production | 🔴 | P0 | Geçiş belgesi 24 dosyanın 18'ini listeliyordu; son kontrol (postflight) son 6 migration'ı hiç denetlemiyordu; ön kontrol (prelaunch) şema sürümünü bilmiyordu. Yeni ofislerin davet bağlantısı, kendi alan adı yokken **varsayılan kiracının (başka bir müşterinin) alan adına** düşüyordu. | Belge + son kontrol + şema sürümü; nötr panel adresi (KARAY_HOSTS) |
| Backup | 🔴 | P0 | Yedek iş akışı `pg_dump --no-privileges` kullanıyordu: bu yedekten geri yüklemede **81 sunucu fonksiyonu anonim istemciye açılıyordu** (prova ile kanıtlandı). Geri yükleme hiç doğrulanmamıştı; parmak izi yoktu; sağlayıcı yedeği ile KARAY yedeği ayrılmamıştı. Otomasyon kapalı. | Yetkileri koruyan yedek, parmak izi, doğrulanmış geri yükleme prosedürü; otomasyonu açmak (operasyonel) |
| Email | 🔴 | P0 | Davet ve talep e-postaları KARAY sağlayıcısıyla gidiyordu ama yeniden deneme / tekrar-gönderim koruması yoktu. Şifre sıfırlama Supabase Auth'un kendi e-postasına bağlıydı: canlıda ayrı SMTP gerektiriyor ve **her özel alan adının Supabase "Redirect URL" listesine elle eklenmesini** gerektiriyordu (yoksa ofis alan adında sıfırlama bozulur). Sıfırlama adresi istemcinin değiştirebildiği `X-Forwarded-Host`'tan üretiliyordu. | Sağlayıcı arayüzü + sınırlı yeniden deneme + tekrar-gönderim anahtarı; şifre sıfırlamanın KARAY sağlayıcısına ve güvenilir adrese taşınması; hız sınırı |
| Domain | 🟡 | P1 | P0.5 akışı sağlam (24 kontrol). Barındırmaya (Vercel) ekleme elle; www → kök 301 barındırma katmanında; birincil yedeği yok. | **Karar:** ilk 10–20 müşteri için elle ekleme yeterli; Vercel API otomasyonu yapılmadı (bölüm 5) |
| Customer lifecycle | 🟡 | P0 | Adımlar ayrı ayrı test ediliyordu; yeni müşteri → davet → aktivasyon → alan adı → taslak → yayın → geri alma tek zincirde hiç doğrulanmamıştı. | Uçtan uca yaşam döngüsü E2E testi |
| Draft/publish | 🟡 | P0 | Marka, SEO, tasarım, menü taslakta. Sabit sayfa metinleri ve yönlendirmeler **"Kaydet" düğmesiyle anında canlıya çıkıyordu**; ekran bunu söylemiyordu ("Site yönetimi" ise "önce taslağa kaydedilir" diyor). | Anında yayına çıkan düzenleyicilerin açıkça etiketlenmesi (gerçek taslak akışı P1) |
| Security | 🟡 | P0/P1 | Kritik bulgu: yedekten geri yüklemede yetki kaybı (yukarıda). Şifre sıfırlama zehirleme riski (X-Forwarded-Host). Diğerleri bölüm 7. | P0'lar kapatıldı; kalanlar P1/P2 |
| Performance | 🟢 | P1 | Uzun süreli yük sonrası tek `next start` sürecinde RSC askısı (OBR-A) — üretimde sunucusuz örnekler geri dönüştürüldüğü için launch'ı engellemez; izlenmeli. Map First / Leaflet paket izolasyonu testli. | Kök neden araştırması (P1) |
| Monitoring | 🟡 | P1 | JSON log, `/api/health`, isteğe bağlı Sentry/webhook. Alarm kuralı yok. | Uptime izleme + hata hedefi (operasyonel, P1) |
| Recovery | 🟡 | P0 | Geri dönüş planı vardı ama yedekten tam geri yükleme ve tek ofis kurtarma tarif edilmemişti. | Doğrulanmış tam/kısmi geri yükleme prosedürü |

### Sayılar

| Sınıf | Adet | Maddeler |
| --- | --- | --- |
| **P0 — LAUNCH BLOCKER** | **6** (kod) + **7** (operasyonel) | Kod: P0-1…P0-6 (bölüm 3). Operasyonel: bölüm 9 |
| **P1 — İlk müşterilerden önce / birlikte** | **10** | bölüm 10 |
| **P2 — Launch sonrası** | **7** | bölüm 10 |
| **TECH DEBT** | **8** | bölüm 11 |
| **DEFERRED** | **6** | bölüm 5 |
| **NOT REQUIRED FOR LAUNCH** | AI, büyük CRM genişlemesi, mobil uygulama, gelişmiş analitik, marketplace, yeni tema/desen, Supabase→AWS / Vercel göçü | — |

### Üç seviye

| Seviye | Soru | Sonuç |
| --- | --- | --- |
| LEVEL 1 | Kod tamamlanmış mı? | **PASS** — launch için gereken akışların tamamı kodda ve uçtan uca testli |
| LEVEL 2 | Sistem güvenli ve stabil mi? | **PARTIAL** — kod tarafında kritik bulgu kalmadı; ancak yedek otomasyonu, CI veritabanı testleri ve alarmlar henüz açık değil |
| LEVEL 3 | Gerçek müşteriden para alıp operasyon yapılabilir mi? | **PARTIAL** — ilk 10–20 müşteri elle faturalandırma + KARAY'ın elle plan ataması ile yönetilebilir; ödeme / abonelik otomasyonu yok |

## 3. P0 bulguları (kod)

| # | Bulgu | Neden blocker |
| --- | --- | --- |
| P0-1 | Canlı geçiş belgesi 6 migration eksik; son kontrol bunları denetlemiyor; şema sürümü yok | Güncel kod eksik şemayla çalışmaz (davet, alan adı, ofis site yönetimi); eksik dosya fark edilmeden canlıya çıkılabilirdi |
| P0-2 | Yedekten geri yükleme yetkileri kaybediyor (`--no-privileges`); geri yükleme doğrulanmamış | Bir felaket anında geri yüklenen sistem, davet kabulü / alan adı / sıfırlama gibi sunucu fonksiyonlarını herkese açardı |
| P0-3 | Şifre sıfırlama: Supabase SMTP + her özel alan adı için elle Redirect URL gerektiriyor; adres `X-Forwarded-Host`'tan; e-postada yeniden deneme yok | Ofis kendi alan adına geçince "şifremi unuttum" bozulurdu; sahte başlıkla zehirleme riski; geçici sağlayıcı hatasında davet / talep e-postası kaybolurdu |
| P0-4 | Alan adı olmayan yeni ofisin davet bağlantısı başka müşterinin alan adına gidiyor | White-label / güven ihlali: yeni müşteri, başka bir emlak ofisinin alan adında ve onun renkleriyle aktivasyon yapardı |
| P0-5 | Sayfa metinleri / yönlendirmeler "Kaydet" ile anında yayına çıkıyor, ekran bunu söylemiyor | "Siteyi düzenledim" diyen kullanıcının beklemediği canlı değişiklik (fazın açık hedefi) |
| P0-6 | Yaşam döngüsü uçtan uca kanıtlanmamış | "İlk müşteri güvenle alınır" iddiası kanıtsızdı |

## 4. Yapılan değişiklikler

**P0-1 Canlı geçiş güvenliği**
- `docs/PRODUCTION_MIGRATION.md`, `docs/DEPLOYMENT_RUNBOOK.md`: 25 dosyanın tam listesi; FAZ 0 provası kaydı.
- `supabase/ops/postflight_v2.sql`: 19–25 numaralı kontroller (her migration kendi satırında; istemciye açık fonksiyon denetimi; aktif olmayan birincil alan adı denetimi).
- Yeni migration `20261010000001_password_reset_requests.sql`: `karay_schema_version()` (şema sürümü).
- `supabase/demo/06_platform_updates.sql`: yeni migration demo kurulumuna eklendi (`npm run demo:sql`; CI kontrolü).
- `scripts/prelaunch-check.mjs`: şema sürümü = depodaki son migration; production'da `KARAY_HOSTS`/`PLATFORM_ROOT_DOMAIN` zorunlu, `EMAIL_PROVIDER=log` yasak; `DOMAIN_TARGET_*` uyarısı.

**P0-2 Yedek ve geri yükleme**
- `.github/workflows/elvankent-backup.yml`: `--no-privileges` kaldırıldı (yetkiler yedekte kalır); kritik veri parmak izi her gece yedeğin yanına yazılır.
- Yeni `supabase/ops/backup_fingerprint.sql`: 17 kritik tablonun sayı + kimlik özeti (kişisel veri yok).
- `docs/BACKUP_RESTORE.md` yeniden yazıldı: sağlayıcı yedeği ≠ KARAY yedeği, RPO/RTO, saklama, açılış kapısı, tam ve kısmi (tek ofis) geri yükleme, migration geri dönüş stratejisi, doğrulama kaydı.

**P0-3 Production e-posta**
- `src/modules/notifications/email.ts`: `EmailProvider` arayüzü (resend / log), `sendEmail` = `sendTransactional`: geçici hatada (ağ, zaman aşımı, 429, 5xx) en fazla 2 yeniden deneme, kalıcı hatada (4xx) deneme yok; her gönderimde `Idempotency-Key` (yeniden denemede çift e-posta gitmez).
- Yeni `src/modules/notifications/auth-emails.ts`: `sendPasswordResetEmail` (+ şablon). Davet (`sendOwnerInvitation`), talep ve KARAY talep bildirimleri tekrar-gönderim anahtarıyla gönderilir.
- `src/app/actions/auth.ts` › `requestPasswordReset`: bağlantı Auth yönetici API'siyle (`generateLink`) üretilir, KARAY sağlayıcısıyla gider; hız sınırı veritabanında (e-posta başına saatte 3, IP başına 10; e-posta tuzlu özet olarak saklanır); bağlantı üretimi ve gönderim `after()` içinde (hesap var/yok farkı yanıt süresinden anlaşılmaz); adres **güvenilir kök** (`trustedRequestOrigin`: yalnızca ortamda tanımlı, geliştirme veya veritabanında aktif alan adı olarak çözülen adresler; `X-Forwarded-Host` kullanılmaz). E-posta yapılandırılmamışsa (yerel) Supabase Auth yoluna düşer.
- Migration `20261010000001`: `auth_password_reset_allowed` (yalnızca sunucu anahtarıyla).

**P0-4 Nötr panel adresi**
- `src/platform/tenant/host.ts` › `tenantBaseUrls` (saf fonksiyon) ve `Tenant.panelBaseUrl`: ofisin aktif alan adı → o; platform alt alan adı → o; ikisi yoksa **KARAY alan adı** (`KARAY_HOSTS`); varsayılan kiracının alan adı artık başka ofislerin davetinde kullanılmaz.

**P0-5 Taslak dürüstlüğü**
- Sayfa metni düzenleyicisi: "Kaydet ve yayınla" + "Bu sayfanın metni taslak akışında değildir" uyarısı; yönlendirme penceresi: "Taslak yoktur"; Site yönetimi › Sayfalar: kapsam açıklaması.

**P0-6 Yaşam döngüsü kanıtı**
- Yeni `tests/e2e/launch-lifecycle.spec.ts` (LC-1…LC-8) ve `tests/unit/launch-readiness.test.mjs` (LR-01…LR-07, 32 test).

## 5. Yapılmayanlar ve kararlar

| Konu | Karar | Gerekçe |
| --- | --- | --- |
| Vercel API ile alan adı ekleme | **DEFERRED** — ilk 10–20 müşteri için elle | Ekleme müşteri başına bir kez, ~2 dakikalık bir panel işlemi. Doğrulama ve aktivasyon zaten otomatik ve güvenli (TXT + CNAME/A kontrolü). Otomasyon, sır yönetimi (token) ve hata senaryoları getirir; bugünkü hacimde değer üretmez. Gerektiğinde mevcut izole bağlayıcı (`src/modules/domains/provider.ts`: `createVercelProvider` / `createManualProvider`) kullanılır — uygulamanın başka hiçbir yerine Vercel API yayılmaz. |
| DNS sağlayıcı otomasyonu | DEFERRED | Müşteri kendi DNS panelinde iki kayıt ekliyor; yönergeler ekranda |
| www → kök 301 | DEFERRED (operasyonel) | Vercel › Domains'te "Redirect to" ile yapılır; uygulamada kanonik adres zaten birincil alan adı |
| Birincil alan adı yedeği | DEFERRED | Birincil kaldırılırsa site varsayılan adresle kanonikleşir; ofis yeni birincil seçer |
| Ekip üyesi daveti (geçici şifre yerine) | P1 | Geçici şifre ilk girişte değiştirilmek zorunda; sahip daveti güvenli. İlk müşterilerle birlikte kapatılmalı |
| Sayfa metinlerinin gerçek taslak akışı | P1 | P0'da dürüst etiketleme yapıldı; gerçek taslak bir şema değişikliği ister |
| Altyapı adaptörleri (DB / auth / storage / kuyruk) | NOT REQUIRED FOR LAUNCH | E-posta ve alan adı adaptörleri yeterli; Supabase çağrılarının taşınması sonraki faz |
| Ödeme / abonelik | DEFERRED (Faz 2) | İlk müşteriler elle faturalandırılır; plan KARAY konsolundan atanır |

## 6. Test sonuçları

| Test | Başlangıç | FAZ 0 sonu | Fark |
| --- | --- | --- | --- |
| Birim | 280/280 | **312/312** | +32 (launch-readiness) |
| RLS | 96/96 | **96/96** | — |
| E2E | 191 koşu (187 geçti, 4 atlandı) | ****199 koşu: 195 geçti, 4 atlandı, 0 hata**** | +8 (launch-lifecycle) |
| Yaşam döngüsü E2E (LC-1…8) | — | 8/8, 3 ardışık koşuda 3/3 | yeni |
| Birim mutasyon (FAZ 0) | — | **18/18** yakalandı | yeni |
| Veritabanı mutasyon P0.5 | 14/14 | **14/14** | temel korundu |
| Veritabanı mutasyon P0.4 | 12/13 + yarış kanıtı + 1 eşdeğer | **12/13 + yarış kanıtı (orijinal 1 kabul, mutant 2 kabul) + aynı eşdeğer mutant** | temel korundu |
| Typecheck | temiz | temiz | — |
| Lint | 0 hata, 3 uyarı | 0 hata, 3 uyarı | — |
| Build | başarılı | başarılı | — |
| Gitleaks | temiz | temiz (değişen dosyalar + 46 commit) | — |

Test sayısı azalmadı. Değiştirilen tek mevcut test: `custom-domains.test.mjs` CD-10 — kanonik adres mantığı `tenantBaseUrls`'a taşındığı için eski kaynak satırını birebir arayan iddia, aynı davranışı doğrulayan iddiayla değiştirildi (birincil aktif alan adı → `https://alanadı`).

## 7. Security sonucu

| Önem | Bulgu | Durum |
| --- | --- | --- |
| CRITICAL | Yedekten geri yüklemede yetki kaybı → 81 sunucu fonksiyonu anonim istemciye açık | **Kapatıldı** (iş akışı + belge + son kontrol yakalar) |
| HIGH | Şifre sıfırlama bağlantısı istemci başlığından (`X-Forwarded-Host`) üretiliyordu (zehirleme) | **Kapatıldı** (güvenilir kök; ayrıca Next.js sahte başlıklı server action isteğini reddediyor — LC-7) |
| HIGH | Yeni ofisin daveti başka müşterinin alan adında | **Kapatıldı** (panelBaseUrl) |
| MEDIUM | Şifre sıfırlama için uygulama tarafında hız sınırı (yeni yol) | **Eklendi** (3/saat e-posta, 10/saat IP; testli) |
| MEDIUM | Ekip üyesi geçici şifreyle ekleniyor | Açık — P1 |
| MEDIUM | CSP `unsafe-inline` | Açık — P1 |
| MEDIUM | Kod deposu herkese açık | Açık — karar (P1) |
| LOW | `tenant.ts` yedek yolu `x-forwarded-host` okuyor (proxy her istekte doğru anahtarı yazdığı için istismar yolu yok) | Açık — P2 |
| LOW | E-posta bağlantı tarayıcıları (link scanner) GET ile tek kullanımlık sıfırlama bağlantısını tüketebilir | Açık — P2 (onay adımı) |
| LOW | Doğrulama kodu HMAC anahtarı = service role anahtarı (anahtar döndürülünce bekleyen TXT kodları geçersizleşir) | Tech debt |

Yeniden doğrulanan kontroller: RLS 96/96 · kiracı izolasyonu (LC-6: başka ofisin ayar/talep okuma, taslak yazma, alan adı ekleme reddedildi) · Host / `x-tenant-key` / `X-Forwarded-Host` sahteciliği (LC-6, E12) · davet tokenı (tek kullanım, bozuk token reddi — LC-2) · servis anahtarının istemciye sızmaması (boundaries testi) · SVG yükleme (betik/dış kaynak reddi, PNG'ye çevirme) · loglarda token/e-posta yok. Kritik güvenlik bulgusu kalmadı.

## 8. Backup / restore sonucu

| Deneme | Sonuç |
| --- | --- |
| V1 canlı kopyası → 25 migration | 25/25 başarılı; son kontrol 21/21 TAMAM (25 satır; 4'ü önceki sayılarla KARŞILAŞTIRMA satırı); ilan 8→8, fotoğraf 24→24, talep 3→3 |
| Eksik migration'lı kopya (ilk 18) | son kontrol 19–25'te HATA (yakalanıyor) |
| 19–25 dosyalarının iki kez yeniden çalıştırılması | sorunsuz |
| Güncel şema + 2 ofis → yedek → boş veritabanına geri yükleme | 2 sn, 0 hata, parmak izi 17/17 aynı, son kontrol 21/21 TAMAM |
| Aynısı `--no-privileges` ile | 81 fonksiyon herkese açıldı → düzeltildi |
| Storage: 1971 dosya yedek → bir dosya silindi → geri yükleme | yalnızca eksik dosya yüklendi; SHA-256 aynı |

**Doğrulanamayan:** gerçek Supabase projesinde geri yükleme (production'a dokunulmadı) ve Supabase planının sunduğu yedek/PITR süresi. Bunlar bölüm 9'daki açılış kapısında.

## 9. Production readiness sonucu — canlıya çıkış için kalan operasyonel adımlar

KARAY bugün **production-ready değildir**. Kod tarafında P0 kalmadı; aşağıdaki adımlar KARAY ekibinin hesap / sır / DNS işlemleridir:

1. **Yedeği aç:** yedek deposu + GitHub secrets/variables (`ELVANKENT_BACKUP_ENABLED=true`), "Run workflow" ile ilk yedek, bu yedeğin test projesine geri yüklenip parmak izinin karşılaştırılması (docs/BACKUP_RESTORE.md › Açılış kapısı). Supabase planının yedek/PITR durumu belgeye yazılır.
2. **CI veritabanı testlerini aç:** GitHub › Variables › `ELVANKENT_CI_DB_TESTS=true`; `quality` ve `database` işleri production dalı için "required status check".
3. **E-posta:** Resend'de gönderici alan adı (SPF, DKIM, DMARC), `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`; bir davet ve bir şifre sıfırlamanın gerçekten ulaştığının kontrolü.
4. **Ortam:** `SITE_ENV=production`, `KARAY_HOSTS` (KARAY'ın alan adı), `DOMAIN_TARGET_CNAME` / `DOMAIN_TARGET_A` (Vercel › Domains'in verdiği gerçek değerler), `CRON_SECRET`, `IP_HASH_SALT`, `SENTRY_DSN` veya `ERROR_WEBHOOK_URL`; ardından `npm run prelaunch -- --production` **0 kritik**.
5. **Canlı geçiş provası:** canlı yedeğin kopyasında 25 dosya + son kontrol 21/21 TAMAM (25 satır; 4'ü önceki sayılarla KARŞILAŞTIRMA satırı) (docs/PRODUCTION_MIGRATION.md › Canlıdan önce son prova); sonra bakım penceresinde gerçek geçiş ve dağıtım (docs/DEPLOYMENT_RUNBOOK.md).
6. **Uptime izleme:** `/api/health` için 5 dakikalık dış izleme ve bildirim.
7. **Alan adı prosedürü (her yeni müşteri için, elle):** müşteri panelde alan adını ekler ve TXT kaydını girer → "Doğrula" → KARAY, Vercel › Domains'e kök + www ekler (www → kök yönlendirmesi) → müşteri ekranda gösterilen CNAME/A kaydını girer → "Bağlantıyı kontrol et" → aktif (SSL Vercel'de otomatik).

## 10. Kalan P1 / P2

**P1 — ilk müşterilerden önce / birlikte:** ekip üyesi daveti (geçici şifre yerine) · sayfa metinleri ve yönlendirmelerin gerçek taslak akışı · deneme süresinin bitişi ve bildirimi · alarm kuralları · CSP nonce · kod deposunun gizli yapılması · uzun yük sonrası RSC askısının kök nedeni · sıfırlama bağlantısında onay adımı (bağlantı tarayıcılarına karşı) · yedekten geri yüklemenin CI'da otomatik provası (Supabase CLI ile) · e-posta teslim durumunun panelde görünmesi (bounce/şikayet).

**P2 — launch sonrası:** Vercel API ile alan adı ekleme · birincil alan adı yedeği · `tenant.ts` `x-forwarded-host` yedek yolunun kaldırılması · ayrı OG başlık/açıklama alanları · marka görseli yetim dosya temizliği · görsel yüklemede eşzamanlılık belirteci · site ikonunun önbellek süresi.

## 11. Technical debt

1. Supabase istemcisi 49 dosyada doğrudan (veritabanı adaptörü yok) — sonraki faz.
2. Hız sınırları `audit_logs` sayımına dayanıyor (büyük ölçekte ayrı depo gerekir).
3. Paylaşılan ISR önbellek işleyicisi yok (kendi sunucuya geçişte gerekir).
4. Eski `seo_title`/`seo_description` sütunları ve `platform_add_domain` duruyor.
5. `session_context` host aramasında alan adı durumunu dikkate almıyor.
6. Doğrulama kodu HMAC anahtarı service role anahtarı.
7. Görsel regresyon / mutasyon / paket ölçüm betikleri depo dışında.
8. Davet yarış testi HTTP üzerinden (deterministik kanıt psql iki oturumla).

## 12. Sonraki faz önerisi

Önce bölüm 9'daki 7 operasyonel adım ve canlı geçiş. Ardından yalnızca P1 listesi (ilk müşteri ile paralel). Yeni özellik, ödeme ve altyapı göçü bundan sonra ayrı fazlarda değerlendirilmeli.

---

## Üç ayrı sonuç

**PRODUCT READINESS — PASS**
- Yeni müşteri → davet → aktivasyon → alan adı → taslak → önizleme → yayın → geri alma tek zincirde testli (LC-1…LC-8, 3/3 kararlı).
- Taslak/yayın sınırı dürüst: anında yayına çıkan iki düzenleyici açıkça etiketli.
- Şifre sıfırlama ofisin kendi alan adında da çalışır (Supabase Redirect URL listesine bağımlılık kalktı).
- Tüm test paketleri yeşil; test sayısı arttı, azalmadı.
- Eksikler ürün kapsamı değil, operasyon (bölüm 9) ve P1 iyileştirmeleri.

**SECURITY READINESS — PARTIAL**
- Kod tarafında kritik bulgu yok; yeni bulunan CRITICAL (geri yüklemede yetki kaybı) ve iki HIGH kapatıldı.
- RLS 96/96, kiracı izolasyonu ve başlık sahteciliği yeniden doğrulandı; mutasyon temel değerleri korundu.
- Ancak yedek otomasyonu ve CI veritabanı testleri canlıda henüz açık değil.
- Açık MEDIUM'lar: ekip üyesi geçici şifresi, CSP `unsafe-inline`, herkese açık depo.
- Gerçek Supabase projesinde geri yükleme provası henüz yapılmadı.

**COMMERCIAL READINESS — PARTIAL**
- İlk 10–20 müşteri KARAY ekibinin elle plan ataması ve elle alan adı eklemesiyle yönetilebilir.
- Ödeme, abonelik yenileme ve deneme süresi bitişi otomasyonu yok (elle faturalandırma gerekir).
- Canlı ortam henüz kurulmadı (bölüm 9).
- E-posta ve yedek operasyonel olarak açılmadan müşteri alınmamalı.
- Destek / yardım içeriği yok; ilk müşterilerde birebir kurulum gerekir.

## Definition of Done

- [x] P0 launch blocker (kod) kalmadı — 6/6 kapatıldı
- [x] Production environment gereksinimleri belgeli (`.env.example`, DEPLOYMENT_RUNBOOK, prelaunch kontrolü)
- [x] Production email akışı hazır (kod; gönderici alan adı doğrulaması operasyonel — bölüm 9/3)
- [x] Backup stratejisi doğrulanmış (yerel tam prova; canlı açılış kapısı tanımlı)
- [x] Restore prosedürü test edilmiş (yerel) ve operasyonel olarak tanımlanmış
- [x] Customer lifecycle uçtan uca çalışıyor (LC-1…LC-8)
- [x] Draft → preview → publish → rollback güvenilir (LC-4, LC-5)
- [x] Custom domain lifecycle güvenilir (LC-3 + custom-domain.spec)
- [x] Tenant isolation tekrar doğrulandı (RLS 96/96, LC-6)
- [x] Critical security bulgusu yok
- [x] Critical performance/stability problemi yok (OBR-A askısı P1 olarak izleniyor)
- [x] Build · Typecheck · Lint · Unit · E2E · RLS başarılı
- [x] Mutation testleri başarılı / baseline korunmuş
- [x] Production'a deploy edilmedi; production veritabanına, Vercel'e ve DNS'e dokunulmadı
- [x] Son commit oluşturuldu; git temiz
