# KARAYS — Geliştirme günlüğü

Projenin **tek ve sürekli** geliştirme günlüğü. Her çalışma oturumu "Girişler"in en üstüne bir giriş ekler ve "Güncel durum"u yeniler. Faz ve yayın belgeleri (`PHASE*`, `KARAY-FAZ*`, `K17_KARAYS_RELEASE.md`) yazıldıkları günün raporudur; bir maddenin bugünkü durumu burada izlenir.

> Depo herkese açıktır. Buraya proje veya dağıtım kimliği, ortam değişkeni değeri ya da varlığı, alan adı ayarı, kayıt sayısı veya sır yazılmaz.

## Güncel durum (31.10.2026)

| Konu | Durum |
| --- | --- |
| Production dalı | `ff2f7da`, değişmedi. KARAYS yayını kapıları bekliyor (aşağıda) |
| Çalışma dalı | `claude/karays-mission-control-vn8g65` (26.10: `claude/karay-ci-dogrulama` `7bd583f`'ün fast-forward devamı). Vercel dağıtımı iki dalda da kapalı (`a24fef8` ve K-20); yayın zinciri bu commit'ler hariç kurulur |
| Son kod commit'i | `751dc11` (K-23: WP-A2 C depolama yuvaları, bekleyen; KI-21 şerit iskeleti; KI-18) |
| GitHub | K-13…K-16 GitHub'da (`a24fef8..968e3ad`). Production dalının yerel kopyasındaki 15 commit kaybolmadı: zincir uzak dallardan birebir yeniden kurulabiliyor (aşağıda) |
| CI | [#105](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41211573470) yeşil (`cc706e0`, 31.10.2026): quality, database ve database-legacy-schema. #104 = `87337a5` yeşil. `751dc11` + K-23 günlüğü sonraki koşuda (K-23 girdisi) |
| Güvenlik | Production'da next 16.3.6 ve sharp 0.35.4 var; yeni Next.js duyurularının etki alanında ([K17 §3](K17_KARAYS_RELEASE.md)). Düzeltme bu dalda; canlıya çıkması yayın onayına bağlı (O-4) |
| Açık kapılar | P0-1 canlı yedek yok: sağlayıcı yedeği/PITR yok (Free Plan, 31.10 kanıtı), kendi gece yedeği (O-3) henüz açılmadı · P0-2 canlı veritabanının kimliği ve şema durumu doğrulanmadı · onaylar O-1…O-6 ([K17 §1–§2](K17_KARAYS_RELEASE.md)) |
| Bekleyen kararlar | D-01…D-18 ([PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md)). Özellikle D-05 (iptal ve veri saklama; OPS-02'nin kalıcı düzeltmesi buna bağlı), D-14 (dal ve yayın stratejisi), D-15 (güvenlik başlıkları, SVG) · PHASE4 §8 K-4…K-7 |

**Yayın hazırlığı:** [K19_YAYIN_HAZIRLIK.md](K19_YAYIN_HAZIRLIK.md) (Go/No-Go, kalite kapısı, toplu karar paketi). **Kalan işler:** [KALAN_ISLER.md](KALAN_ISLER.md) (tek liste, KI-01…KI-37).

**Sıradaki adım:** Sahibin K-17 kapılarını açması: A1–A4 (panel teyidi, salt okunur ön kontrol, geri dönüş betiği, yedek). Ardından O-4 ile kod yayını, O-5 ile migration. Canlıdaki güvenlik açığı nedeniyle bu sıranın öne alınması önerilir. Güvenlik düzeltmesini migration'dan önce, yalnızca kod olarak yayınlamak teknik olarak mümkün (yeni kod eski veritabanıyla çalışır, [K17 §5](K17_KARAYS_RELEASE.md)). Yedek kapısının (P0-1) bu kod yayınını da bekletip bekletmeyeceği sahibin kararıdır.

## Girişler

### 02.11.2026 (15) · K-39: dört bağımsız çalışma — KI-23 fonksiyon farkı, gece yedeği, KI-24 hazırlık, müşteri yolculuğu

- **KI-23 #6 (77 fonksiyon FARKLI):** yerelde tarihî demo paketleri CRLF ile kurulunca canlı #6 deseni birebir üretildi (751 AYNI,
  77 FARKLI yalnız fonksiyon, yetkiler AYNI, G TAMAM); `\r` çıkarılınca gövdeler ve başlıklar 77/77 aynı; gövdelerde satır sonu içeren
  dize sabiti 0 → davranış aynı. Canlının nedeni henüz kanıtlanmadı; salt okunur sayı-teşhisi hazırlandı (`canli_fonksiyon_teshis.sql`,
  ikinci SHA, aynı işlem; "TAMAM (biçim farkı)" kuralı). Prova 6. adım (CRLF) + KI-24 yolu + 2 negatif. KI23 §8.
- **Gece yedeği:** cron `23 1 * * *` (01:23 UTC) doğru, iş akışı `active`, varsayılan dalda aynı. Geçmiş zamanlanmış koşular 06:15–07:38 UTC'de
  başlamış (GitHub kuyruğu 5–6 saat gecikiyor). #46 (01.11 07:38) eski varsayılan dal commit'i `ff2f7da` ile çalıştı ve başarısız oldu;
  düzeltilmiş iş akışı varsayılan dala `a0f0a67` ile (01.11 15:47) geldi → 02.11 koşusu düzeltilmiş sürümün ilk zamanlanmış koşusu.
  04:12 UTC itibarıyla henüz başlamamıştı (gecikme deseniyle uyumlu). 08:00 UTC'de yeniden kontrol (mevcut hatırlatma).
- **KI-24:** sahip ayarları (okuma anahtarı, ortam onayı) doğrulandı; K6 25 dosya hedefi zorunlu hâle getirildi (listeleme hatası durur);
  9. adıma fonksiyon teşhisi. Değişken açılmadı, prova başlatılmadı. KI24 §9.
- **Müşteri yolculuğu:** `docs/MUSTERI_YOLCULUGU.md` — 6 akış nesne→migration eşlemesiyle; bulgu: yeni ofis açılışı yeni sahip e-postasıyla
  canlıda çalışmaz (`platform_create_organization` 5 parametreli sürüm; kod `p_invite_token_hash` gönderir → 20261008000001).

### 01.11.2026 (14) · K-38: KI-23 canlı #4 — havuz PGOPTIONS'ı iletmedi; kapı = gerçek işlemin transaction_read_only'si

- **#4 (sahip):** tetik başarılı, bağlantı kuruldu, `default_transaction_read_only=off`, `transaction_read_only=on`; betik denetimi
  göndermeden çıkış 3 (eski kural ikisini istiyordu). Canlıda hiçbir şey çalışmadı/yazılmadı. #3: satır başında boşluk → tetikte durdu.
- **Düzeltme:** kapı = aynı bağlantı/aynı işlemde `transaction_read_only` (BEGIN READ ONLY sonrası); off → denetim kesinlikle yok;
  varsayılan ayar yalnız bilgi; tek işlem + ROLLBACK aynen. Sentetik T14 (varsayılan off/işlem on, uçtan uca), T15 (işlem off → yok),
  T10 güncellendi → 15/15. KT-09: istek dosyası açık/kapalı kabul (CI #154 kırmızısı); KT-10 tek kullanımlık kural aynen.
  İstek dosyası yeniden kapalı. Kapsam (828 + G1–G4), günlük gizliliği, SHA-256 sabitlemesi değişmedi.
- CI: K-37 `19e6901` → elvankent-ci **#152 yeşil**; sahip commit'leri `bdc9f3a` → **#153** ve `f7bebb6` → **#154 kırmızı** (ikisi de KT-09: istek dosyası kapalı bekleniyordu).

### 01.11.2026 (13) · K-37: KI-23 canlı denetim — tek işlem (BEGIN READ ONLY) ve tek kullanımlık tetik (ÇALIŞTIRILMADI)

- **Tek bağlantı/tek işlem:** `scripts/ki23-canli-denetim.sh` tek `psql` çağrısı: BEGIN READ ONLY → aynı işlemde ayar kontrolü
  (`\gset` + `\if`) → denetim (`\i`, SHA ve bekçi önceden) → ROLLBACK; hata → çıkış 3, güvenli sınıf.
- **Tek kullanımlık tetik:** `scripts/ki23-tetik-kontrol.sh` (önceki ↔ yeni commit; yalnız kapalı→açık), iş akışında `fetch-depth: 0`,
  `github.run_attempt == 1`; istek dosyası talimatları güncellendi.
- **Testler:** sentetik T10–T13 (13/13, `GITHUB_ACTIONS=true` ile de), birim KT-09 güncellendi + KT-10 (11 durum). Birim 744/744.
- CI: K-36 düzeltmesi `6671673` → elvankent-ci **#151 yeşil**.

### 01.11.2026 (12) · K-36: KI-23 canlı denetimi GitHub Actions'ta (salt okunur) — hazır, ÇALIŞTIRILMADI

**İstek:** 84 KB `canli_sema_denetimi.sql` Android SQL Editor'ü donduruyor; kapsam azaltmadan, mevcut `SUPABASE_DB_URL` ile,
`default_transaction_read_only=on` başlangıçlı, yalnız SELECT, günlükte yalnız sayılar; yalnız sahibin elle tetiklemesi.

- **Yeni:** `.github/workflows/elvankent-ki23-canli-denetim.yml` (tetik: istek dosyası düzenlemesi + workflow_dispatch; koşul sahip +
  `Claude-Session:` yok; `CALISTIR=evet` satırı açık değilse bağlanmaz; `contents: read`; tek sır; SHA-256 sabit; artifact yok),
  `scripts/ki23-canli-denetim.sh` (maskeleme, SHA, bekçi, PGOPTIONS ile salt okunur oturum + doğrulama, yalnız sayılar, güvenli
  hata sınıfı), `scripts/ki23-denetim-guard.mjs`, `ops-requests/ki23-canli-denetim.request` (kapalı).
- **Sentetik:** `scripts/ki23-canli-denetim-test.sh` T1–T9 (CI'da `canli-denetim-prova.sh` 4b): temiz/bozuk şema, onaysız dosya, bekçi,
  yanlış parola, kapalı port, salt okunur oturumda yazma 25006, maskeler, RLS'i aşamayan rol. Bulgular: (1) RLS'i aşamayan rolle
  `storage.buckets` görünmüyor → kova EKSİK; betik bunu ayrıca işaretler; (2) test rolünün search_path'i farklıydı → betik bunu yazar.
- **Güvenlik incelemesi:** sır yalnız son adımda; günlüğe giden her satır sabit metin ya da sayı; ham psql çıktısı/hatası yazılmaz;
  bekçi ve SHA bağlantıdan önce; birim KT-09; LR-09/LR-11 listelerine eklendi.
- **Varsayılan dal:** istek dosyası yolu varsayılan dal olmadan çalışır; "Run workflow" düğmesi için varsayılan dal (= production)
  gerekir → yapılmadı, ayrı onay. Bilinen risk: havuzun PGOPTIONS desteği; desteklemezse iş denetimi göndermeden durur.
- **CI #150 kırmızı (`62aa6fe`, database › KI-23 canlı denetim provası, T5):** CI'da `GITHUB_ACTIONS=true` olduğundan betik yanlış
  test parolasını da `::add-mask::` satırına yazdı; testin "parola günlükte yok" denetimi bu satırı buldu (GitHub bu satırları
  göstermez — #150 günlüğünde de görünmüyor). Düzeltme: T1–T7 değişken olmadan (yereldeki gibi), T8 açıkça verir; `GITHUB_ACTIONS=true`
  ile yerelde 9/9. Yeni iş akışının ilk tetiklenmesi (#1, `62aa6fe`, push) **skipped** — geliştirme gönderimi canlıya bağlanmadı.

### 01.11.2026 (11) · K-35: KI-23 İÇERİKSİZ migration geçmişi — kök neden, köken ve şema/güvenlik denetimleri (canlıya dokunulmadı)

**Kaynak:** sahibin `canli_migration_gecmisi.sql` canlı çıktısı (CSV): `İÇERİKSİZ=21, KAYITSIZ=10`, `AYNI=0`; 21 kayıt · en yeni
`20261001000001`. Beklenen `AYNI=21` doğrulanmadı. K-34'teki iki varsayım düzeltildi ("CLI ile kaydedilmiş", "İÇERİKSİZ = repair").

- **Kök neden (kanıtlar):** yerel deney — CLI 2.122.0 `migration repair --status applied` dosyayı okuyup ifadeleri **doldurur**
  (30), nesne oluşturmaz; `db push` da doldurur. Depoda `(version, name)` ile içeriksiz kayıt yazan tek mekanizma `supabase/demo`
  SQL Editor paketleri. 06 paketinin kayıt listesi `d721428` (28.09) sürümünde `20261001000001`'de biter = canlı. Tarihî paketlerin
  27 migration bölümü bugünkü dosyalarla bayt bayt aynı. Boş yığına tarihî paketler (tek işlem) → sahibin iki CSV'si birebir.
  **Varsayım, canlıda doğrulanmadı:** canlı DB demo paketleriyle kurulmuş (paket başlıkları "canlıda çalıştırmayın" der) — KI-23
  "canlı DB kimliği" sorusuna doğrudan girdi.
- **Ayrım yöntemi:** paket = tek işlem, kayıt satırı sonda → kayıt aynı işlemde yazıldıysa gövdeler eksiksiz uygulanmıştır.
  `supabase/ops/canli_kayit_kokeni.sql` (salt okunur): demo işareti, statements NULL/boş, işlem no (`xmin`) ve o işlemde oluşturulup
  duran katalog satırları → ŞEMA İLE AYNI İŞLEM / BELİRSİZ. Bulgu: yeniden çalıştırılan paketin ilk işlemi BELİRSİZ görünür (katalog
  satırları yenilenir) → 0 satır "ayrı yazıldı" kanıtı sayılmaz.
- **Şema/güvenlik denetimi:** `supabase/ops/canli_sema_denetimi.sql` (salt okunur, yalnız katalog): G1–G4 mutlak kurallar (RLS kapalı,
  kiracı tablosunda koşulsuz anon politika, sabitsiz SECURITY DEFINER, korumasız anon yazma) + 828 nesnelik parmak izi (tablo,
  yetki, politika, fonksiyon, kısıt, tetikleyici, indeks, enum, kova); beklenen `scripts/sema-denetimi-build.sh` (CLI başvurusu).
  Demo yoluyla kurulmuş yerel DB: 828/828 AYNI, G TAMAM. 6 negatif kontrol yakalandı. Bulgu: tanımlar `search_path`'e göre yazılır
  (`supabase_admin` yolunda `auth` var → FK/politika FARKLI görünür); restore-drill denetimi SQL Editor yoluyla çalıştırır, sorgu yolu yazar.
- **KI-24 yolu:** `restore-drill.sh` 9. adım (yalnız geçmişi `20261001000001`'de biten yedekte; G HATA → çıkış 3, `DENETIM_P=`).
  Yerelde: yedek → geri yükleme → G TAMAM / P AYNI; RLS kapalı kopya → ŞEMA HATA. Sentetik prova A/B/C/D/S yeniden yeşil (9. adım ATLANDI).
- **CI:** `database` işine `fetch-depth: 0` + "KI-23 canlı denetim provası" adımı (`scripts/canli-denetim-prova.sh`). Birim KT-05…07.
- **O-5a ENGELLİ** (O5_YAYIN_PLANI 0.4, KI23 §2.7). Kayıt defteri düzeltilmedi; migration uygulanmadı.
- CI: K-34 `ceb7821` → elvankent-ci **#146 yeşil**.
- **CI #147 kırmızı (`2d71287`, quality › gitleaks: 141 bulgu) — yanlış alarm, düzeltildi:** bulguların hepsi
  `canli_sema_denetimi.sql`'in beklenen değerleri; kısıt adlarındaki `_key`/`_pkey`/`_fkey` (ve bir `facebook_url` sütunu) hemen
  ardından gelen 32 haneli MD5'i "anahtar" gibi gösterdi (aynı sürüm gitleaks 8.24.2 ile yerelde birebir üretildi). Sır yok.
  Düzeltme: (1) satır biçimi `(kategori, özet, nesne)` — özet adın önünde; yeni biçim yok sayma listesi olmadan temiz;
  (2) geçmiş zorla değiştirilmediği için `2d71287`'nin 141 bulgusu kök dizindeki `.gitleaksignore`'da **tek tek parmak iziyle**
  (commit:dosya:kural:satır) yok sayıldı; başka commit/dosya yok, tarama ayarı değişmedi (birim testi KT-08). Yerel tam tarama:
  144 commit, bulgu yok. Database işleri #147'de çalışmadı (quality'ye bağlı).
- **CI #148 yeşil (`4862e29`):** quality (gitleaks dahil), database (KI-24 sentetik prova + **KI-23 canlı denetim provası**: tarihî
  demo paketleri → İÇERİKSİZ=21/KAYITSIZ=10, köken, 828 nesne AYNI, 6 negatif, KI-24 9. adım), database-legacy-schema.

### 01.11.2026 (10) · K-34: KI-23 canlı tespit sonucu, migration geçmişi incelemesi, O-5a dosyaları (canlıya dokunulmadı)

**Kaynak:** sahibin `canli_sema_tespiti.sql` çıktısı (CSV, 01.11): 21 VAR / 10 YOK, ilk eksik `20261002000001_karay_platform.sql`,
`schema_migrations` 21 kayıt · en yeni `20261001000001`, `karay_schema_version()` yok, TUTARLILIK TAMAM, 8 bekleyen YOK.
K-33'teki "kesin 5 / olası 12" tahmini düzeltildi (10).

- **Geçmiş incelemesi:** nesne kontrolü kesin kanıt sayılmadı. Kayıt defteri özeti nesne sonucuyla birebir (21 = 21, en yeni aynı);
  depo tam geçmişi indirildi (klon sığdı): 21 dosyanın her biri tek commit, sonradan değişmemiş. Sürüm sürüm içerik için
  `supabase/ops/canli_migration_gecmisi.sql` (tek SELECT; ifade sayısı + MD5, beklenenler CLI 2.122.0 ile yerelden). Canlı benzeri
  yığın (kesim `20261002000000`) sahibin CSV'sini birebir verdi ve geçmiş sorgusu `AYNI=21, KAYITSIZ=10`; geri alınan işlemde
  negatif kontroller FARKLI / İÇERİKSİZ / DEPODA YOK yakaladı.
- **O-5a dosyaları:** `supabase/ops/o5a/01…09` = migration birebir + aynı işlemde `schema_migrations` kaydı (KARAYS runbook'unun
  emsali). `scripts/o5a-build.sh` üretir / `--check`; birim testleri KT-04, O5A-01. İkinci uygulama `duplicate key` ile reddedildi,
  hiçbir şey değişmedi. O-5a sonrası (KARAYS öncesi) postflight'ta yalnız 27. satır HATA, `karay_schema_version()` = `20261011000001`,
  KARAYS 01 DUR yok.
- **Prova:** `o5-upgrade-rehearsal.sh` 7. adım (geçmiş) eklendi; canlı durumdan 39/39, geçmiş 31 tutarlı (`AYNI=21`, `O-5a=9`,
  `KARAYS runbook=1`), ardından `test:rls` **201/201**.
- **Bulgu (canlı, bugün):** KARAYS "Bilgi al / Demo talep et" formu `submit_platform_lead` olmadığından gönderilemiyor; KARAY konsolu
  ana sayfası ve müşteri listesi `platform_customer_overview` olmadığından hata veriyor. Düzeltmesi O-5a (onay bekliyor).
- Belgeler: KI23_CANLI_SEMA_ON_KONTROL (yeniden yazıldı), O5_YAYIN_PLANI (ön koşul 0.3 yapıldı, 0.4 geçmiş sorgusu, Aşama 1 = 9 dosya),
  KALAN_ISLER KI-23 (doğrulanıyor) / KI-27.
- CI: K-33 commit'i `48886df` → elvankent-ci **#145 yeşil** (quality, database, database-legacy-schema; E2E dahil).

### 01.11.2026 (9) · K-33: D-04/D-05 kararları, KI-23 şema tespiti, KI-24 yeniden denetim, O-5 planı (canlıya dokunulmadı)

**Kapsam:** yalnız çalışma dalı. Production push, migration, canlı SQL, Vercel/R2/ayar değişikliği, bayrak açma yok;
`RESTORE_DRILL_REAL_DATA_APPROVED` açılmadı, gerçek prova başlatılmadı.

- **D-04/D-05 (sahip kararı 01.11):** PHASE2_DECISION_REGISTER, OPS02_ABONELIK_DURUMLARI §5 (eşleme tablosu, 7 açık alt karar,
  risk analizi), operations/README, BILLING_ARCHITECTURE, KALAN_ISLER KI-29/30/21. Açık bırakılanlar: hatırlatma zamanları,
  7 gün sonrası kısıtın türü, "salt okunur"un kapsamı, askıdaki sitenin görünümü, saklama/silme (hukuki).
- **cancelled/expired riski:** canlıda bugün `org_plan()` bu durumlarda satır döndürmüyor = sınırsız (yalnız SQL ya da gelecekteki
  ödeme webhook'uyla tetiklenebilir; konsol bu durumları sunmuyor). Düzeltme mevcut bekleyen dosyada (bayrak, varsayılan kapalı).
  Yeni test SL-08: bayrak açıkken `past_due` ve iptal edilmiş-ama-dönemi-süren abonelik tam erişim; `cancelled` olunca kısıt.
  Mutasyon denetimi: `org_plan`'dan `past_due` çıkarılınca SL-08 kırmızı. 18/18.
- **KI-23:** `supabase/ops/canli_sema_tespiti.sql` (tek SELECT, 31+8 dosya VAR/YOK, ilk eksik, TUTARLILIK) + birim testi KT-01…03.
  Bilinenlerden alt sınır `20261008000001` (5 dosya), olası `20260930000002` (12). docs/KI23_CANLI_SEMA_ON_KONTROL.md.
- **O-5 provası:** `scripts/o5-upgrade-rehearsal.sh` (yalnız yerel). Canlı benzeri yığında 12 ve 5 eksikten 39/39'a, postflight 0 HATA,
  8 runbook 01→05→01→03→04; ardından `test:rls` **201/201** (iki başlangıç). Bulgu: `live-like-stack.sh` TOTP'yi kapalı açıyordu
  (ilk koşuda 4 MFA testi ortam yüzünden düştü) → CI ile aynı ayar; ayrıca `start` çalışan yığını önce durduruyor (eski veritabanı
  yeniden kullanılıyordu, kesim uygulanmıyordu). docs/O5_YAYIN_PLANI.md (ön koşullar, 4 aşama, her aşamada yedek/kontrol/geri dönüş/onay).
- **KI-24:** sentetik prova A/B/C1/C2/D1–D4/S1–S2 yerelde yeniden yeşil; gerçek iş akışının tek koşusu skipped; plan §8'e 11 adımlı
  gerçek prova kontrol listesi.

### 01.11.2026 (8) · K-32: PR #3 YAYINLANDI; varsayılan daldan elle yedek başarılı

**Onay:** sahibin yazılı onayı (yalnız `74013a5` → `a0f0a67` fast-forward). Zorla push, yeni merge commit'i, migration, canlı SQL, yeni özellik yok.

**Yayın:** ön kontroller ✓ (production `74013a5`, hedef PR #3 ucu, fark 7 yedek dosyası, CI #137/#138 yeşil) · `74013a5..a0f0a67` · GitHub PR #3'ü kendiliğinden merged kapattı (15:47:13) · Vercel production success 15:47:42.

**Canlı kontrol #9:** health 200 db ok, ana sayfa 5/5, `/satilik`, ilan 6/6, `/karay` 7/7, `/platform/giris` 4/4.

**Elle yedek (varsayılan daldan, GitHub API workflow_dispatch):** Backup #48 success — DB `db-2026-11-01T1549Z` (4 dosya, `rclone check` temiz), Storage 4/4 kova hata yok, saklama ✓. Uyarı: parmak izinde canlıda olmayan tablo (eski şema; beklenen).

**Açık:** ilk zamanlanmış gece yedeği 02.11 01:23 UTC'de (henüz çalışmadı); A aşaması onu görmeden kapanmaz.

### 01.11.2026 (7) · K-31: KARAY-01 YAYINLANDI

**Onay:** sahibin yazılı onayı ("KARAY-01 düzeltmesinin canlıya alınmasını onaylıyorum"; yalnız `650fd4e` → `74013a5` fast-forward). PR #3 merge, migration, canlı SQL, zorla push, başka özellik yok.

**Ön koşullar:** production `650fd4e` ✓ · `74013a5` ← `30c038a` (CI onarımı) ← `650fd4e` ✓ · 19 dosya, migration/`vercel.json`/`next.config` yok ✓ · geri dönüş: `650fd4e` production dağıtımı (success) · son yedek #47 (10:36 UTC; veritabanı değişikliği yok).

**Yayın:** `git push origin 74013a5…:refs/heads/claude/elvankent-real-estate-platform-vxq9dj` → `650fd4e..74013a5`. Vercel production dağıtımı success 15:06:32 UTC.

**Canlı kontrol** (`elvankent-uretim-saglik`, KARAY-01 denetimleri eklendi; yerelde sahte sunucuyla iki yönde denendi): önce #5 `/karay` 2/7, `/platform/giris` 0/4 (307 → giriş); sonra #8 `/karay` **7/7**, `/platform/giris` **4/4**, `/api/health` 200 db ok, ana sayfa 5/5, `/satilik`, ilan 6/6; ekran görüntüleri `/_next/static/immutable/media/…`'dan, eski yol yok. #6/#7'deki "eski yol" satırı denetimin yanlış negatifiydi (URL-kodlu adres + Turbopack medya dizini) — düzeltildi.

**Sıradaki:** PR #3 merge (`74013a5` → `a0f0a67`), ayrı onay. Arada gece yedeği yerine çalışma dalından elle yedek.

### 01.11.2026 (6) · K-30: A seçeneği — KARAY-01 düzeltmesi ve PR #3 tamamen yeşil

**Onay:** "A seçeneği onaylandı (teknik hazırlık için)". Production push ve PR merge yok (ayrı onaylar); production `650fd4e`; PR #3 taslak.

- **KARAY-01 dalı `claude/karay01-duzeltme`** (`650fd4e` tabanı, PR #3'ten ayrı): `30c038a` CI onarımı (`fea4e01` ile aynı içerik; `.env.local` hatası giderilmiş) + `74013a5` KARAY-01. Kök neden: proxy `/karay/*` ve `/platform/*`'u uzantıdan bağımsız yakalıyor → ekran görüntüleri görsel iyileştiricide 404, logolar oturumsuz ziyaretçide girişe yönleniyor. Düzeltme: ekran görüntüleri statik import (P3-F1, baytlar aynı), marka dosyaları `public/brand/karay/` (`09e935b` çakışmasız, testleriyle; marka KARAY kaldı). Proxy kuralı, migration, başka özellik değişmedi.
- **Doğrulama:** yerel birim 391/391, build, audit 0. [CI #136](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41306682162) yeşil: birim 391, RLS/MFA 105, **E2E 202 / 0 başarısız** / 4 atlandı; KARAY-01, KARAY-02…18 (önceden çalışmıyordu) ve yeni KARAY-19 geçti.
- **PR #3** `a0f0a67` = PR #3 + KARAY-01 dalının merge'ü (çakışmasız); KARAY-01 dalına göre fark yalnız 7 yedek dosyası. [#137](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41308555131)/[#138](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41308559532) yeşil: birim 409, RLS/MFA 105, E2E 202/0. **PR #3 merge'e hazır.**
- **Sıra (ayrı onaylar):** (1) production `650fd4e` → `74013a5` (KARAY-01 yayını, fast-forward) + sağlık kontrolü; (2) production `74013a5` → `a0f0a67` (PR #3, fast-forward). Arada gece yedeği yerine çalışma dalından elle yedek.

**CI (çalışma dalı):** #139 = `64969cc` **iptal** (sonraki push `cancel-in-progress` ile durdurdu; dikkatsizlik); #140 = `524dc3f` (içeriği kapsar) yeşil.

### 01.11.2026 (5) · K-29: PR #3 production tabanında; production CI onarımı

**Başlangıç:** `9eef002`. **CI #132 = `9eef002` yeşil** (quality, database, database-legacy-schema; #131 = `40f1304` yeşil). Production `650fd4e` (O-4 A; sahip bağımsız doğruladı: Vercel Production READY, Backup #47, sağlık #4). PR #3 taslak; merge, production push, migration yok.

**Sahip bulgusu:** production CI #129 (push) ve #130 (PR #2) `650fd4e`'de E2E hazırlığında düştü: tırnaksız `EMAIL_FROM=KARAY CI <…>` (`.env.local: line 12: syntax error near unexpected token 'newline'`; günlükle doğrulandı).

**Yapılan (PR #3 dalı `claude/backup-workflow-default-branch`, zorla push yok):** `c2d0ef3` production `650fd4e`'nin merge'ü (çakışma yok; yedek dosyaları çalışma dalındakiyle birebir aynı) · `fea4e01` CI onarımı: `env_line` (K-11) + bash okuma denetimi, `SITE_ENV=demo` ve süper admin test yöneticisi (K-10), `playwright.config.ts` `channel: 'chromium'` ve masaüstü logo fixture'ı (K-14), `ubuntu-24.04`, Supabase CLI 2.121.0. Uygulama koduna dokunulmadı.

**Doğrulama:** yerel birim 406/406, `npm audit` 0, typecheck ✓, ESLint 0 hata. [CI #133](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41302169798) (push) ve [#134](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41302173738) (pull_request): quality ✓ (audit dahil), RLS/MFA/kiracı ✓, E2E hazırlık ✓ (hata giderildi), E2E **183 geçti / 1 başarısız (KARAY-01)** / 4 atlandı / 17 çalışmadı (seri dosya). KARAY-01: `/karay`'da 2 kırık ekran görüntüsü (`public/karay/*.png`), production'da önceden var; çalışma dalında uygulama koduyla düzeltildi (statik import + `09e935b`).

**Karar:** PR #3 **HAZIR DEĞİL** (CI kırmızı, neden PR değil). Seçenekler A (önce KARAY-01 düzeltmesi, ayrı onay) / B (yazılı istisna ile merge): [PR3_HAZIRLIK_PLANI.md](PR3_HAZIRLIK_PLANI.md). CI #135 = `9e0618a` yeşil.

### 01.11.2026 (4) · K-28: O-4 A YAYINLANDI (yalnız güvenlik yaması)

**Onay:** sahibin yazılı ve açık onayı ("O-4 A production yayını için açık onay"). GitHub entegrasyonu üzerinden deneme "Resource not accessible by integration" ile olmamıştı.

**Ön koşullar (push'tan hemen önce):** uzak production dalı `ff2f7da` ✓ · yayın commit'i `650fd4e` ağacı `29f81af` ✓, tek ebeveyn `ff2f7da` ✓, fast-forward ✓, `913b7c0` dahil değil ✓, değişen 4 dosya ✓ · A1 manuel yedek: Backup #47 (10:36 UTC, çalışma dalından) success.

**Yayın:** `git push origin 650fd4e…:refs/heads/claude/elvankent-real-estate-platform-vxq9dj` → `ff2f7da..650fd4e` (zorla push yok). Migration, canlı SQL, PR #3 merge, başka kod değişikliği yok.

**Doğrulama:** Vercel production dağıtımı (GitHub dağıtım kaydı, vercel[bot]) **success** 10:52 UTC. Vercel API'si bu oturumda dağıtım/hata uçlarını 403 ile reddediyor; container ağ politikası `vercel.app`'e izin vermiyor → kontroller GitHub çalıştırıcısından, yalnız GET (`elvankent-uretim-saglik`). #4 yeşil: `/api/health` 200, status ok, **db ok**; ana sayfa 200, görseller 5/5; `/satilik` 200; ilan ayrıntısı 200, görseller 6/6; `/karay` 200 (bilinen KARAY-01 logoları yayın öncesinden). **Alias'ın sunduğu sürüm:** istemci JS'inde `"16.4.3"` var, `"16.3.6"` yok → production `650fd4e` derlemesini sunuyor. Benzersiz dağıtım adresleri Vercel korumasında (iki adres aynı koruma sayfası) → bu karşılaştırma sonuçsuz.
Sağlık iş akışının ilk üç koşusu betik hatalarıyla kırmızıydı (bash -e'de bulunamayan desen; yanlış varlık deseni; korumalı adresler) — production hatası değil, her biri yerelde sahte sunucuyla yeniden üretilip düzeltildi.

**Açık:** kontrol listesi D2–D5 (giriş/MFA, görsel yükleme ve SVG reddi, iletişim formu, önizleme) yazma/giriş gerektirdiği için sahibin elle teyidi; Vercel panelinde "Current" = `650fd4e` görsel teyidi; PR #3 sırası (O4_YAYIN_KONTROL_LISTESI §5).

### 01.11.2026 (3) · K-27: O-4 yayın öncesi son kontroller — YAYINA HAZIR (teknik)

**Başlangıç:** `e8710eb` (CI #126 yeşil). Production `ff2f7da`; PR #3 taslak; merge, production push, migration yok; gerçek veri provası kapalı. Sahip bildirimi: Backup #46, varsayılan daldaki eski iş akışının PG 16.15 istemcisi yüzünden (sunucu 17.6) düştü; PR #3 giderir, taslak kalır.

- **Node 22/24:** `elvankent-o4-onkontrol` #1 (yayın commit'i `650fd4e`, salt okunur): iki Node'da typecheck, ESLint, birim 388/388 (SP-01…06), build (Next 16.4.3), `npm audit` 0 açık (bastırma yok), RLS/MFA/kiracı 105/105.
- **8 E2E hatası:** 7'si test düzeneği (Headless Shell + Secure önizleme çerezleri: 6; masaüstünde eksik fixture: 1), 1'i canlıda var olan ürün hatası (KARAY-01, `/karay` logoları; B'de `09e935b`). Düzenek düzeltilmiş koşuda taban 205/1, aday 205/1; yeni gerileme 0. K19 §3'teki "8'i de canlıda" ifadesi düzeltildi.
- **Production farkı:** GitHub dağıtım kaydına göre son production dağıtımı `ff2f7da` (11.10, success). Vercel MCP proje listesini gösteriyor, dağıtım listesini 403 ile reddediyor → panel teyidi kontrol listesinde (A2). Fark: 4 dosya; kilit dosyasında 39 kayıt (next/@next 16.4.3, sharp/@img 0.35.5, libvips 1.3.4, zod 4.6.7, source-map-js 1.2.2).
- **Kontrol listesi:** [O4_YAYIN_KONTROL_LISTESI.md](O4_YAYIN_KONTROL_LISTESI.md) (manuel yedek çalışma dalından, Vercel teyidi, fast-forward push, sağlık, temel senaryolar, Instant Rollback ölçütü ve adımları, PR #3 sırası).
- **Testler:** O4-01…03; LR-09/LR-11 aynı depodaki yeniden kullanılabilir iş akışı çağrılarını kabul eder (yalnız `./.github/workflows/elvankent-*.yml`) ve depodaki her iş akışının LR-09 listesinde olmasını ister. Birim 711/711, ESLint temiz.

**CI:** [#127](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41294282135) = `cea98cf` yeşil; o4-onkontrol #1 yeşil; #128 = `e40a52d` yeşil.

### 01.11.2026 (2) · K-26: KI-24 canlının gerçek durumu (sürüm fonksiyonu yok), K6 Storage doğrulaması; O-4 hazırlık dalı

**Başlangıç:** `5298dbe` (CI #123 yeşil). Production `ff2f7da`, değişmedi; PR #3 taslak; canlıya bağlanılmadı, migration uygulanmadı, gerçek veri kullanılmadı; gerçek veri iş akışının kapıları kapalı.

**Sahip bulgusu (01.11):** canlıda `karay_schema_version()` yok ve birden çok migration eksik; B senaryosu yalnız tek migration geride ve fonksiyonu olan şemayı deniyordu. K6 gerçek iş akışında yoktu.

**Kırmızı → yeşil:** canlı benzeri şemadan alınan sağlam yedek eski betikte `ŞEMA: HATA (3)` alıyordu (25–27 "…uygulanmamış", sürüm yokken gecikme sayılmıyordu).
- `restore-drill.sh`: sürüm fonksiyonu yokken de şema geride sayılır; "…uygulanmamış" satırları yalnız eksikler denetlenen migration'ların **son kısmıysa** bilgi; tutarsız eksik (arada eksik / sürümle çelişen) ve diğer tüm HATA satırları çıkış 3. `SEMA_ILK_EKSIK`.
- `scripts/live-like-stack.sh`: ikinci yerel Supabase yığını (ayrı proje, 553xx), kesim `20261010000000` (28/31 migration, sürüm fonksiyonu yok), demo verisi.
- Sentetik prova D1 (BİLGİ), D2 RLS kapalı, D3 kiracı listesi açık politika (tutarsız eksik), D4 davet fonksiyonu `anon`'a açık → üçü de HATA. CI'da zorunlu.
- K6: `scripts/storage-roundtrip-drill.mjs` (yalnız yerel Storage; özel geçici kova; opak nesne adları; SHA-256; kova her durumda silinir; bağımlılıksız). Sentetik S1/S2 CI'da zorunlu; gerçek iş akışına K6 adımı (R2'den rastgele 20 + 5 dosya, yollar günlüğe yazılmaz), kapalı.
- Testler: RD-02 +6, RD-03 +4 (K6 adımı, canlı benzeri yığın, iş akışı `run` betiklerinin bash sözdizimi), SR-01…04 (11).

**Doğrulama (yerel):** birim **702/702**, ESLint temiz. Sentetik prova A, B, C1, C2, D1–D4, S1–S2 **10/10** (yerel PostgreSQL 17.11 yığınları, gerçek yerel Storage). Gerçek iş akışının K6 adımı sahte rclone + gerçek yerel Storage ile 22/22; geçici kova kalmadı.

**CI:** #124 = `46746c0` **kırmızı**: sentetik prova adımında canlı benzeri yığın demo verisi dosyasını bulamadı (CI, ana yığından önce `supabase/seed.sql`'i `/tmp/seed.sql`'e taşıyor; yerelde bu taşıma yoktu). Hiçbir senaryo koşmadı. Düzeltme `025e68e` (`LIVE_LIKE_SEED`, önden denetim; yerelde dosya taşınmış hâlde yeniden üretildi). [#125](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41289627206) = `025e68e` (`e7652af` dahil) **yeşil**: quality, database (A, B, C1, C2, D1–D4, S1–S2 hepsi ✓; D1 "ilk eksik migration 20261010000001", S1 25/25), database-legacy-schema.

**O-4 hazırlık dalı** `claude/karays-guvenlik-yamasi`: yayın commit'i `650fd4e` (`ff2f7da` + yama, ağaç `29f81af`), hazırlık commit'i `913b7c0` (bu dal için Vercel dağıtımı kapalı, production CI'ı bu dalda atlanır, doğrulama iş akışları; production'a gitmez). [elvankent-o4-hazirlik #1](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41289097024) **yeşil**: kimlik ✓; taban ve aday aynı tam test kümesi (typecheck, ESLint, birim, build, RLS/MFA/kiracı izolasyonu) ✓; adayda `npm audit` ✓ (bastırma yok); E2E taban 205 test / 8 başarısız, aday 205 / 8 — **yeni başarısızlık 0** (8'i bilinen canlı işlev hataları, B ile kapanır). Push'ta dağıtım açılmadı (deployments 0); production `ff2f7da`. Yerelde kimlik denetimi iki bozuk varyantı reddetti; karşılaştırma mantığı sentetik Playwright sonuçlarıyla denendi. İlk taslakta `download-artifact` için doğrulanmamış bir SHA yazılmıştı; gönderilmeden fark edildi, artifact'siz (iş çıktısı) tasarıma geçildi.

**Bu commit'in CI'ı:** [#126](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41291606535) = `e8710eb` yeşil.

### 01.11.2026 · K-25: KI-24 iş akışı ve sentetik kuru prova; O-4 + PR #3 yayın sırası

**Başlangıç:** `17663e7` (CI #122 yeşil). Production `ff2f7da`, değişmedi; PR #3 taslak (merge yok); canlı veritabanına bağlanılmadı, migration uygulanmadı, gerçek yedek indirilmedi/geri yüklenmedi; Vercel, DNS, OPS-02 bayrağı ve `.claude/` değişmedi.

**Sahip kararları (01.11):** PR #3 taslak; önce O-4 ile güvenli yayın sırası; `npm audit` bastırılmaz. KI-24 iş akışı + sentetik prova onaylı, iki şartla: (Ş1) bütünlük ve güncel şema uygunluğu ayrı kontroller, canlıda uygulanmamış migration'lar başarısızlık sayılmaz; (Ş2) geri yükleme yalnız izole yerel test veritabanına, otomatik testle kanıtlı. Gerçek müşteri verisinin GitHub çalıştırıcısında işlenmesine onay yok.

**Bu commit:**
- `scripts/restore-drill.sh`: yalıtım koruması (yalnız loopback adres + veritabanı adı; sorgu parametresi, çoklu ana makine, uzak ad, `PGHOSTADDR`/`PGSERVICE`/`PGSERVICEFILE` hiçbir araç çağrılmadan çıkış 2; `localhost` loopback'e çözülmeli; bağlantı sonrası genel ağ adresi → çıkış 2). BÜTÜNLÜK ve ŞEMA ayrı kararlar; şema geride iken postflight "…uygulanmamış / şema sürümü eski" satırları migration gecikmesi (BİLGİ); RLS/yetki hataları her durumda çıkış 3. `DRILL_RESULT` özeti. Eski hata: fark listesinde `set -e` + `pipefail` yüzünden `fail` mesajı hiç yazılmıyordu (çıkış yine 1) → düzeltildi.
- `scripts/restore-drill-synthetic.sh` (A güncel şema, B geride şema, C1 bozuk dump, C2 uzak hedef) ve CI `database` işinde "KI-24 sentetik geri yükleme provası" adımı (PG 17 istemcisi, sır yok).
- `.github/workflows/elvankent-restore-drill.yml` (gerçek veri, **kapalı**: `RESTORE_DRILL_REAL_DATA_APPROVED` + `restore-drill` ortamı + sahip tetiği; canlı sır yok, R2 yalnız okuma anahtarı `RESTORE_S3_*`, artifact yok) ve `ops-requests/restore-drill.request`.
- `tests/unit/restore-drill.test.mjs` RD-01 (yalıtım, 24), RD-02 (ayrı kontroller, 11), RD-03 (iş akışları, 3); LR-09/LR-11 listelerine yeni iş akışı.
- Belgeler: [KI24_GERI_YUKLEME_PLANI.md](KI24_GERI_YUKLEME_PLANI.md) §0 ve §5, [BACKUP_RESTORE.md](BACKUP_RESTORE.md) tatbikat, [YAYIN_SIRASI_O4_PR3.md](YAYIN_SIRASI_O4_PR3.md) (yeni), KALAN_ISLER KI-24/KI-26.

**Doğrulama (yerel):** testler önce kırmızı (6/26), sonra yeşil. Birim **682/682**, ESLint temiz. Sentetik prova yerel Supabase yığınında (PostgreSQL 17.11): A 17/17 parmak izi, 80/80 tablo, şema TAMAM, 0 HATA; B şema BİLGİ, 1 migration gecikmesi, 0 HATA (eski betik başarısız sayardı); C1 çıkış 1; C2 çıkış 2. Bekleyen 8 dosya uygulanmışken de aynı. Artık geçici veritabanı yok.

**Bulgu:** tam Supabase yedeği yerel yığının `postgres` rolüyle geri yüklenemiyor (realtime şeması, "permission denied to set parameter"); Faz 3 doğrulaması süper kullanıcılı düz PostgreSQL 16'daydı. Prova yerel `supabase_admin` ile yapılır.

**Yayın sırası kanıtı (geçici yerel çalışma ağacı, push yok):** yama SHA-256 OK, ağaç `29f81af` beklenenle aynı; yama ile PR #3 dosya kesişimi yok, iki sıra da çakışmasız. `npm audit --omit=dev --audit-level=high`: PR #3 tek başına başarısız, A + PR #3 **0 açık**. Öneri: A → PR #3 A'nın üstüne → A yayını → kontrol → PR #3 merge.

**CI:** [#123](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41285876677) = `5298dbe` **yeşil** (quality, database — sentetik prova adımı A/B/C1/C2 ✓ —, database-legacy-schema). `elvankent-restore-drill` #1 aynı push'ta **atlandı** (onay kapısı kapalı).

### 31.10.2026 (2) · K-24: KI-38 bir kez yazma, kilit ve başıboş dosya süpürmesi; sahip adım listesi

**Başlangıç:** `a0e7c52` (K-23, CI #106 yeşil). Production `ff2f7da`, değişmedi; canlı veritabanına bağlanılmadı; Vercel, DNS, OPS-02 bayrağı ve `.claude/` değişmedi.

**Commit'ler:**
- `7b93ee7` [SAHIP_ADIMLARI.md](SAHIP_ADIMLARI.md): sahibin adımları bağlantılarıyla (gece yedeğinin açılışı, geri yükleme provası, kararlar). Not: gece zamanlanmış yedek varsayılan daldaki (production) eski iş akışıyla çalışır ve herkese açık günlüğe tablo kayıt sayılarını yazar; karar sahipte.
- `f072115` KI-38: C nesneleri bir kez yazar; `renewMediaUpload` var olan orijinali yeniden yüklemez; D `media_stray_objects` + cron süpürmesi; runbook `media_stray_sweep/`; K-19 §8 birim 4g.
- Bu commit: inceleme düzeltmeleri. A `media_finalize` FOR SHARE; C yalnız içerik/ad/kova değişikliğini engeller; sürümleme denetimi (C 01 14. satır); D kova başına pay; cron kapatma anahtarı `MEDIA_STRAY_SWEEP=off`; istemci `x-upsert` göndermez. Günlük, KALAN_ISLER (KI-38 hazır-canlıda değil, KI-39), TASARIM §12.

**Doğrulama (yerel, CI adımının kopyası):** kırmızı/yeşil (SW testleri önce 7, kilit testi 2 kaldı); runbook provası **8/8**; birim **605/605**; güvenlik **198/198**; typecheck, ESLint temiz; medya + KI-21 E2E **31/31** (tüm bekleyenler), **28/28** (bekleyen dosyasız); gerçek cron çağrısında 2 başıboş dosya silindi, güncel varyant korundu; eski şemada süpürme atlandı.

**İncelemeler:** `ecc:*` ajanları bu oturumda yok; genel amaçlı ajanlara veritabanı ve güvenlik uzmanı görevi verildi (salt okunur, yalnız yerel). Güvenlik: açık CRITICAL/HIGH yok; MEDIUM düzeltildi. Veritabanı: D onay, C'nin koşulu (#1 HIGH) düzeltildi ve testlendi; #2 (ölçek) KI-39'a. Ayrıntı: [drafts/wpa2/TASARIM.md](drafts/wpa2/TASARIM.md) §12.

**CI:** #106 = `a0e7c52` **yeşil** (quality, database, database-legacy-schema). #107 = `f072115` (`7b93ee7` dahil) quality ve database-legacy-schema yeşil; database işi bu commit yazılırken sürüyordu, sonucu sahibe verilen raporda. Bu commit'in koşusu sahibe verilen raporda.

**Kota düzeni (sahip isteği, 31.10):** bu oturuma iki zamanlanmış görev: her 5 saatte bir ve her cumartesi 16:05 (TR) "yarım iş varsa devam et". Mission Control (`.claude/mission-control/`) değişmedi.

### 31.10.2026 · K-23: P0-1 kanıtı (sağlayıcı yedeği yok), KI-37 depolama yuvaları (C), KI-18, KI-21 iskeleti

**Başlangıç:** `d2c01e5` (Mission Control izleme v2). Production `ff2f7da`, değişmedi; canlı veritabanına bağlanılmadı; Vercel, DNS ve OPS-02 bayrağına dokunulmadı; `.claude/` değişmedi.

**Commit'ler (dağıtımı kapalı çalışma dalında):**
- `87337a5` P0-1 kanıtı: 31.10'da sahip Supabase › elvankent-demo (eu-central-1, main PRODUCTION) › Database › Backups'ta "Free Plan does not include project backups" gösterdi: zamanlanmış sağlayıcı yedeği ve PITR **yok**. O-3 kararı: KARAY'ın kendi gece yedeği (`elvankent-backup.yml`); **henüz çalışmıyor** (kova, anahtarlar ve GitHub sırları sahipte). KI-22, KI-28, [BACKUP_RESTORE.md](BACKUP_RESTORE.md).
- `8b4d3b3` KI-37 / WP-A2 C: `pending/20261027000003_media_storage_slots.sql` (yuva isteyen storage politikaları + `storage.objects` tetikleyicisi + bakım penceresi), runbook `supabase/ops/media_storage_slots/` 01–05 + README, provada; B'nin 05'i C varken durur; CI'da yeni `database-legacy-schema` işi (PENDING=none). K-19 §8 birim 4f.
- `d415c90` KI-18: ESLint 0 uyarı.
- `cc706e0` KI-21 iskeleti: panel abonelik şeridi + "Verilerinizi indirin" (metinler D-05'e kadar yer tutucu).
- `751dc11` KI-37 inceleme düzeltmeleri: geri alınabilirlik kapısı (supautils), varyant yuvası sınırları, 24 saatlik pencere CHECK'i.
- Bu commit: günlük, KALAN_ISLER (başlık, KI-18/21/37 durumları, KI-38), TASARIM §11.

**Ölçüm (yerel, storage-api v1.82.1):** Storage RLS'yi istek ve imzalama anında denetliyor; imzalı adresle asıl yükleme RLS'yi atlıyor (`service_role` olarak, sahibi token kullanıcısı). Yalnız politika sonlandırma sonrası üzerine yazmayı kapatmıyordu → tetikleyici.

**Doğrulama (yerel Supabase, CI adımının kopyası, CLI 2.121.0):**
- Kırmızı/yeşil: SL testleri C olmadan 15/19 kaldı; inceleme sınırları için yeni 5 test önceki C'de kaldı. Son hâlde tümü yeşil.
- Runbook provası **7/7**; birim **597/597**; güvenlik kümesi **189/189**; ESLint 0 hata / 0 uyarı; typecheck, build temiz.
- E2E: C uygulanmış şemada medya + KI-21 (`admin`, `acceptance`, `subscription-strip`) **31/31**; bekleyen dosyasız şemada medya **28/28**. Tam E2E kümesi yerelde çok yavaş olduğu için yarıda bırakıldı (yarıda kesilen koşu demo verisini kirletti; temiz veritabanıyla tekrarlandı); tam küme CI'da koşar.

**İncelemeler (bağımsız):** Bu oturumda `ecc:*` ajanları yüklü değil; eşdeğer olarak genel amaçlı ajanlara veritabanı ve güvenlik uzmanı görevi verildi (ikisi de salt okunur, yalnız yerel yığın).
- Veritabanı: koşullu onay. #1 HIGH (05 için gereken DROP TRIGGER/POLICY yetkisi 01'de denetlenmiyordu) → 01 13. satır + 03 kapısı. #3 MEDIUM pencere sınırı → CHECK. #4 LOW → `media` kovasında üzerine yazma yok. #2 TUS testi → güvenlik incelemesinde elle doğrulandı. #5 LOW → KI-38.
- Güvenlik: açık CRITICAL/HIGH yok; imzalı adres, TUS, upsert, taşıma, kopyalama, kovalar ve kiracılar arası denemeler reddedildi. MEDIUM (sınırsız sayılmayan varyant alanı) → 2 taban × 6 dosyayla sınırlandı; kalıcı çözüm KI-38.

**CI `PENDING` matrisi kararı (KI-37):** tam matris yerine paralel `database-legacy-schema` işi: yeni kod + bekleyen dosyasız şema (canlıdaki şema), medya E2E. Duvar süresi artmaz. PENDING=a ayağı güvenlik testlerinde (MF-07, SL-13).

**CI (koşu = commit):**
- #104 = `87337a5` **yeşil**.
- #105 = `cc706e0` (`8b4d3b3` ve `d415c90` aynı gönderimde; ara commit'lerin kendi koşusu yok) **yeşil**: quality; database (runbook provası, birim + güvenlik, tam Playwright E2E); yeni `database-legacy-schema` (PENDING=none medya E2E).
- `751dc11` ve bu commit birlikte gönderildi; koşu numarası ve sonucu sahibe verilen raporda (bu commit kendi sonucunu içeremez).

**Açık (sahip):** O-3 açılışı (R2 kovası + anahtar, Supabase S3 anahtarı + session pooler adresi, GitHub sırları/değişkenleri, ilk elle çalıştırma), ardından KI-24 geri yükleme provası (test veritabanında). P0-2, O-1, O-2, O-4, O-5 (4f dahil; 01'in 6./13. satırı canlıda), O-6, D-04, D-05 (KI-21 metni), D-15, PR #2. OPS-02 bayrağı kapalı.

### 26.10.2026 (4) · K-22: WP-A2 güvenli medya sonlandırma; eksik runbook'lar; CI'da prova

**Başlangıç:** `952043c` (son çalışma dalı ucu). Production `ff2f7da`, değişmedi; canlı veritabanına bağlanılmadı; OPS-02 bayrağı kapalı. Kaynak: K-21 bağımsız inceleme talimatı §6 ve K-19 durum raporu (PDF).

**Commit'ler (hepsi dağıtımı kapalı çalışma dalında):**
- `2f090b2` WP-A2 taslağı ve 11 bulgusu `docs/drafts/wpa2/` altında (`.taslak`, çalışmaz; sır taraması temiz).
- `ee617ab` [KALAN_ISLER.md](KALAN_ISLER.md): PDF + K-19 + günlükten tek liste (KI-01…KI-35; sonra KI-36, KI-37).
- `98d1d1d`, `64d6ea0`, `dc361b9` WP-A2 tasarım sözleşmesi, DB onay koşulları, dondurulmuş arayüz, inceleme sonuçları ([drafts/wpa2/TASARIM.md](drafts/wpa2/TASARIM.md)).
- `e93d6a7` Runbook'lar `media_quota_lock/`, `company_name/` (+ ayrı VALIDATE adımı); `scripts/rehearse-runbooks.sh` (yalnız yerel; 01/02/04 salt okunur oturumda; ilk/son 01 eşit; negatif ve olumlu kontrol) CI database işinde bekleyen dosyalardan önce çalışır; SL-07 yetkisiz isteğin başka kurumun kilidini beklemediğini kanıtlar.
- `b9d1eab` WP-A2: bekleyen A (`media_finalize`, `media_mark_failed`, silme kuyruğu, `media_queue_claim/done`, `media_storage_report`) ve B (authenticated UPDATE/INSERT sütun düzeyinde daraltma + şekil koruması; A yoksa durur); runbook'lar `media_finalize_rpc/`, `media_privileges/`; uygulama: `processMedia` RPC ile sonlandırır, hazır fotoğraf asla düşürülmez ve orijinali silinmez (KI-36, canlıdaki hata), cron kanonik klasörü siler ve kuyruğu yalnız kendi kurum yollarıyla boşaltır.

**Doğrulama (yerel Supabase, CI adımının kopyası; son ağaç `b9d1eab` ile birebir):**
- Runbook provası 6/6; güvenlik kümesi **165/165**; Playwright tam küme 3 projede **208 geçti / 0 kaldı / 4 koşullu atlandı**.
- Yeni kod + bekleyen dosyasız şema (yedek yol): medya E2E 28/28. Yeni kod + yalnız A: 28/28; sonlanan 6 satırda `byte_size` = depolamadaki gerçek boyut.
- Cron: doğrudan silinen satırın 6 dosyası kuyruktan silindi; eski bekleyen satırın klasörü silindi; başka kurum yolunu gösteren satır ve kuyruk öğesi **silinmedi** (`deferred`, `unsafe`).
- Birim 582/582, typecheck, ESLint, build temiz. Kırmızı/yeşil: yeni testler A/B olmadan kaldı; SL-07 erken dönüş kaldırılınca kaldı.

**İncelemeler (bağımsız):** `ecc:code-reviewer` bloklayan yok (4 düzeltme yapıldı: başka kurum klasörünü silme riski dahil). `ecc:database-reviewer` tasarım ve uygulamada koşullu onay (R1 NULL boyut, R2 geri dönüş sırası düzeltildi). `ecc:security-reviewer` **H1** (kuyruk + service-role cron ile başka kurumun dosyalarının silinmesi) buldu; düzeltildi ve yeniden incelemede açık HIGH/CRITICAL kalmadı. Kalan: M1 sonlandırma sonrası nesnenin üzerine yazılması ve satırsız yükleme → yalnız tespit; önleme C'ye bağlı (**KI-37, yayın koşulu**). CI `PENDING` matrisi bu turda eklenmedi (süre); eski şema ayağı yerelde koşuldu.

**Ajanlar ve skill'ler (gerçek çağrılar):** ecc:planner (kalan iş listesi), ecc:architect (WP-A2 tasarımı), ecc:database-reviewer ×4, ecc:tdd-guide ×4 (WP-D, WP-E, WP-A2 uygulama, WP-A2 DB), ecc:code-reviewer, ecc:security-reviewer ×2, ecc:e2e-runner ×2. Skill: `ecc:context-budget` bir kez; çıktısı: canlı bağlam/token ölçümü skill ile yapılamaz, Claude Code'da `/context` ve `/usage` kullanılır. Token sayısı ölçülmediği için raporlanmadı.

**CI:** #94 = `952043c` yeşil. #96–#98 yeni gönderimlerle iptal. #99 = `e93d6a7` **yeşil** (runbook provası, güvenlik, E2E). #100 = `dc361b9` yeşil. #101 = `b9d1eab` yeni gönderimle iptal; aynı kodu içeren **#102 = `ebf7607` yeşil** (quality + database: runbook provası 6/6, güvenlik testleri, E2E).

**Açık (sahip):** Değişmedi: P0-1, P0-2, O-1…O-6, D-04, D-05, D-15, PR #2. Yeni onay birimleri 4d (A) ve 4e (B; önce kod) K-19 §8'de. OPS-02 bayrağı kapalı.

### 26.10.2026 (3) · K-21: uzman ajanlarla O-5 hazırlığı ve bekleyen migration sertleştirmesi

**Başlangıç:** `8b2de09`. Production `ff2f7da`, değişmedi; canlı veritabanına bağlanılmadı; OPS-02 bayrağı kapalı.

**Ajanlar (ECC v2.2.3, claude.ai hesabından eşitlenen eklenti; katalogda ve oturumda 71 ajan):**
- Aşama 1 (salt okunur): `ecc:planner` iş paketleri, `ecc:database-reviewer` bekleyen 3 migration, `ecc:code-architect` medya boyutu tasarımı.
- Aşama 2 (paralel, ayrı dosya setleri): `ecc:tdd-guide` × 3: WP-A medya boyutu, WP-B O-5 runbook'ları, WP-C `company_name` CHECK.
- Aşama 3: `ecc:security-reviewer`, `ecc:database-reviewer`, `ecc:code-reviewer` paralel inceleme; `ecc:e2e-runner` yerel Supabase doğrulaması (iki tur).

**`dc6594a`:**
- `supabase/ops/quota_lock/` ve `supabase/ops/ops02_limits/`: sahibin çalıştıracağı O-5 runbook'ları (karays_brand düzeni: 01 ön kontrol, 02 durum, 03 tek işlemde uygulama, `lock_timeout` 3 sn / `statement_timeout` 30 sn, 04 son kontrol, 05 geri dönüş). OPS-02'nin 03'ü kilit yoksa DUR der; hiçbir betik bayrağı açmaz. LR-14 birim testleri.
- `20261026000001`: API rolleri (anon, authenticated) yetkisi olmadığı kuruma ekleme yaparsa tetikleyici kilit almadan döner; RLS tek tip reddeder, kota durumu sızmaz (inceleme bulgusu: anon yolu da kapsandı). `service_role` revoke listesinde.
- `20261026000002`: `company_name` için kontrol/görünmez/yön karakterlerini reddeden `NOT VALID` CHECK (`single-line.ts` ile aynı sınıflar).

**Doğrulama (yerel Supabase, CI adımının kopyası, CLI 2.121.0):**
- Yeni dosyalar olmadan: 125 testten 2'si kaldı, `company_name` bloğu (6 test) çalışmadı (hata yeniden üretildi).
- Yeni dosyalarla: 125/125, arka arkaya 3 kez; tüm güvenlik kümesi **128/128**.
- Runbook provası: `quota_lock` 01→02→03→04→05→01 ve yeniden uygulama; 05 sonrası 01 ilkine birebir eşit. OPS-02 03 kilit yokken DUR ile geri alındı. Başka oturum tabloyu kilitliyken 03, 55P03 ile durdu ve iz bırakmadı. OPS-02 04'teki `text || "char"` hatası bulundu ve düzeltildi; düzeltmeden sonra 01→03→04→05→01 temiz.
- Medya E2E (önceki tur): `admin.spec.ts` + `acceptance.spec.ts` 28/28. Birim 505/505, typecheck ve ESLint temiz.

**Bu commit'e alınmayan iş (WP-A2):** medya boyutunun gerçek değerle eşlenmesi (`media_record_sizes` RPC + doğrudan güncelleme koruması). İncelemede bloklayan ve yüksek bulgular çıktı: RPC hatasında kayıt silinmiş görsellere işaret ediyordu; üye `public_base` / `original_path` değiştirerek başka kurumun dosya boyutunu okuyabiliyor ve kotayı yine aşabiliyordu; eski kod canlıdayken uygulanırsa yükleme bozuluyordu. Doğru çözüm `authenticated` için UPDATE'in sütun düzeyinde daraltılması ve sonlandırmanın tek bir definer RPC'ye taşınması; ayrı iş paketi.

**Açık (sahip):** Değişmedi: P0-1, P0-2, O-1…O-6, D-04, D-05, D-15, PR #2. Yeni onay birimleri 4b ve 4c (K-19 §8). OPS-02 bayrağı kapalı.

### 26.10.2026 (2) · K-20: depolama kotası veritabanında (bekleyen migration)

**Başlangıç:** `7bd583f` (`claude/karay-ci-dogrulama`'nın son commit'i). Çalışma dalı `claude/karays-mission-control-vn8g65` buna fast-forward edildi; geçmiş korunur, force push yok. Production `ff2f7da`, değişmedi; canlı veritabanına ve OPS-02 bayrağına dokunulmadı.

- **Kalite kapısı (`7bd583f`, yerel, alt ajan):** birim 486/486, typecheck temiz, ESLint 0 hata (3 eski uyarı), build 73/73, `npm audit --omit=dev` 0 açık. K-19 ile aynı.
- **Bulgu (K-19 §7'nin düzeltilmiş tanımı):** depolama kotası yalnızca uygulamada, `media_upload_allowed()` RPC'siyle, `media_assets` kaydı eklenmeden önce ayrı bir istekte denetleniyordu. Eşzamanlı kayıtlar aynı toplamı görüyordu; `media.manage` yetkili kullanıcı kaydı RLS üzerinden doğrudan ekleyip denetimi hiç çağırmayabiliyordu. Yerel Supabase'de kanıtlandı: 8 eşzamanlı 10 MB kaydın 8'i de kabul edildi (sınır 4); kotayı aşan tek kayıt da kabul edildi.
- **`dd32fa7`:** `supabase/pending/20261026000001_media_quota_lock.sql`: `media_assets` eklemesinde kurum başına işlem kilidi ve kota denetimi veritabanında (aynı formül, %35 varyant payı). `media_assets_org`'dan sonra çalışır. `plan_limit_storage` mevcut kota mesajına bağlandı. SL-06 (3 test) eklendi. K-19 §7, OPS02 ve `quota_lock.sql` başlığındaki yanlış tanım düzeltildi; K-19 §8'e ayrı onay birimi 4b eklendi.
- **Doğrulama (yerel Supabase, CI adımının birebir kopyası, CLI 2.121.0):** yeni migration olmadan SL-06'nın 2 testi kaldı (hata yeniden üretildi); migration ile 13/13, arka arkaya 3 kez. Tüm güvenlik kümesi **121/121** (118 + 3). Migration iki kez uygulanabiliyor; başlıktaki geri dönüş satırları tetikleyici ve fonksiyonu kaldırıyor, yeniden uygulama çalışıyor. Birim 486/486, typecheck ve ESLint temiz, demo SQL güncel.
- **Vercel:** `vercel.json` (kök ve proje) yeni çalışma dalında da Git dağıtımını kapatır.
- **Kalan risk (bilinçli):** `byte_size` istemcinin bildirdiği boyuttur, işlem sonrası gerçek boyutla eşlenmez; kaydı olmadan `organizations/{org}/` altına yüklenen dosya sayılmaz (`storage.objects` tetikleyicisi gerektirir).

**Açık (sahip):** Değişmedi: P0-1, P0-2, O-1…O-6, D-04, D-05, D-15, PR #2. Yeni: birim 4b'nin canlıya çıkması ayrı onay. OPS-02 bayrağı kapalı.

### 26.10.2026 · CI #91 ve güvenlik adayı #3 sonuçları; ajan izleme

**Başlangıç:** `a6169bc` (rapor anındaki son commit; dalda yeni commit yoktu). Production `ff2f7da`, değişmedi.

- **CI [#91](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40169352877)** (`a6169bc`): yeşil. quality ve database başarılı; E2E 208 geçti, 4 koşullu atlandı (#89 ile aynı).
- **Güvenlik adayı [#3](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40169223417)** (`fc0434f`): taban (`ff2f7da`, next 16.3.6) ve aday (ağaç `29f81af`, next 16.4.3) birebir aynı: 142 geçti, aynı 8 başarısızlık, 4 atlandı, 51 çalışmadı. İş akışının "failure" sonucu bu 8 bilinen canlı hatadan; yama gerileme getirmiyor (üçüncü bağımsız koşu). A seçeneğinin kanıtı tamam, yayın yine O-4 onayına bağlı.
- **Ajan izleme:** Depo kökünde `.claude/settings.json` ve `.claude/mission-control/relay.mjs` eklendi (`3300de6`). Bulut oturumlarındaki ajan, görev ve araç olaylarını maskeleyip ayrı bir izleme projesine gönderen salt okunur hook'lar; karar vermez, çıktı yazmaz, ortam değişkenleri yoksa hiçbir şey yapmaz. Proje klasörünün dışında olduğu için CI'ı ve Vercel dağıtımını tetiklemez (doğrulandı: koşu ve dağıtım yok). Uygulamaya, veritabanına ve kiracı verisine dokunmaz.

**Açık (sahip):** Değişmedi: P0-1, P0-2, O-1…O-6, D-04, D-05, D-15, PR #2. OPS-02 bayrağı kapalı.

### 24.10.2026 (4) · K-19: yayın hazırlığı, OPS-02 uygulaması, güvenlik adayı CI'ı, erişilebilirlik

**Başlangıç:** `cf7c99d` (CI #86 yeşil). Ayrıntılı kanıt ve karar paketi: [K19_YAYIN_HAZIRLIK.md](K19_YAYIN_HAZIRLIK.md).

**Commit'ler** (`cf7c99d..7997852`): `9b07f3e`, `1d16cc6`, `be80a97`, `9431889`, `993e79c`, `e5067fc`, `aa5d72e`, `823bb9e`, `3a044f7`, `7997852`.

- **Veri güvenliği:** Storage geri yüklemede `--apply` yalnızca `--target=<ana makine>` ile çalışıyor (yanlış proje koruması). P0-1 ve P0-2 hâlâ sahipte: Supabase projesi bu oturumdan görünmüyor.
- **Yalnız güvenlik yaması:** `57fdbb7` yalnızca bu VM'deydi; patch olarak `release/security-only/` altına alındı (özet ve ağaç sabit). `elvankent-security-candidate` iş akışı `ff2f7da`'yı yamasız ve yamalı sınıyor. İki koşuda iki kol birebir aynı sonuç verdi (ilk koşu eski CI ayarıyla 25, düzeltilmiş ortamla 8 aynı başarısızlık). Yama gerileme getirmiyor. Kalan 8 başarısızlık canlıdaki kodun bugünkü hataları; doğrulama dalında düzeltilmiş durumda.
- **OPS-02:** Eşzamanlı limit aşımı DOĞRULANDI (limit 3, 8 istek → 4–7 ilan). Düzeltme ve bayraklı abonelik limiti `supabase/pending/` altında; CI bu dosyaları uyguluyor. ECC security-reviewer: kritik/yüksek yok, iki orta bulgu var. Bunlardan durum sızıntısı düzeltildi; destek akışının engellenmesi D-04/D-05'e bırakıldı.
- **Kiracı izolasyonu:** Rol düşürme, üyelik kapatma ve silme açık oturuma hemen yansıyor (3 yeni test); açık bulunmadı.
- **CSP:** Üretim test edilebilir modülde. Kendi depolama adresimiz açıkça listeleniyor. Joker D-15'e kadar duruyor.
- **Marka:** Kodda kullanıcıya görünen eski ad yok. KARAY-23 bunu davranışsal olarak doğruluyor. Canlıdaki `company_name` güncellemesi KARAYS migration'ıyla (O-5).
- **Erişilebilirlik ve performans (Lighthouse, yerel):** KARAYS sayfası küçük metin kontrastı ve favori düğmesinin adı düzeltildi, a11y 100. Performans mobilde 86–97, masaüstünde 99; CLS 0.
- **Yerel ortam:** Docker bu VM'de çalıştı. Supabase görüntüleri Docker Hub'dan alındı; ECR'nin CDN'i proxy'de kapalı. Yerelde RLS 118/118 (3 kez) ve tam E2E 205/4 atlandı (bekleyen migration'lar uygulanmış).
- **CI:** #87 (`1d16cc6`) yeşil. #88 (`823bb9e`) kırmızı: yeni testte kurum öneki çakışması (test hatası); `7997852` ile düzeltildi. [#89](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40130502489) (`7997852`) yeşil: RLS/MFA/kiracı izolasyonu + OPS-02 + üyelik testleri geçti; E2E 208 geçti, 4 koşullu atlandı (yeni testlerle toplam 212).
- **ECC:** `ecc:security-reviewer` (OPS-02 SQL) ve `ecc:code-reviewer` (K-19 aralığı) gerçek alt ajan olarak çalıştı. İkincisinin kararı APPROVE, 4 düşük not var. `persist-credentials: false` notu son belge commit'iyle uygulandı.

**Açık (sahip):** P0-1, P0-2, O-1…O-6, D-04, D-05, D-15, PR #2. Öneri: C (önce yalnız güvenlik yaması, sonra B, migration'lar sırayla).

### 24.10.2026 (3) · ECC v2.2.3 incelemesi ve düşük bulguların giderilmesi

**Başlangıç:** `6c93d67`. Çalışma ağacı temizdi.

**CI:** [#85](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40121218238) · `6c93d67` · yeşil.
- quality başarılı.
- database: yerel Supabase, birim + RLS/MFA/kiracı izolasyonu, Playwright E2E **205 geçti, 4 koşullu atlandı** (#84 ile aynı).

**ECC incelemesi (`5034a41..6c93d67`):**
- `ecc:code-reviewer` ve `ecc:security-reviewer` gerçek alt ajan olarak çalıştı, `ecc:security-review` skill'i doğrudan çağrıldı.
- Kritik, yüksek veya orta bulgu yok; altı düşük bulgu var.

**Commit'ler:**
- `b303df6` (davranış değişmez):
  - Şirket/site ayarları ve KARAYS profil şemaları `'use server'` dosyalarından `src/modules/content/settings-schema.ts` ve `src/modules/karay/profile-schema.ts` modüllerine taşındı. Böylece birim testleri kaynak metni değil, şemanın davranışını sınıyor.
  - `hoursSchema` takma adı kaldırıldı.
- `4afd83f` (düzeltme):
  - `singleLine` görünmez biçim karakterlerini siliyor: U+200B, U+2060–U+2064, U+FEFF.
  - Yön geçersiz kılma, gömme ve yalıtma karakterleri (U+202A–U+202E, U+2066–U+2069) sessizce silinmiyor; alan adıyla açık hata veriliyor.
  - ZWJ/ZWNJ ile LRM/RLM/ALM korunuyor. Türkçe, uluslararası, sağdan sola ve emoji içeren adlar bozulmuyor; testi var.
  - KARAYS `company_name` alanında `<` ve `>` açık hatayla reddediliyor. Kullanım noktaları doğrulandı ve hepsi kaçışlı: React metni, JSON-LD (`<` unicode kaçışıyla yazılır), geri dönüş betiğinde `quote_literal`. Ret, ileride ham HTML'de (ör. e-posta) kullanılırsa diye ek katman.
  - Ham `.max(160)` sınırı Türkçe mesaj veriyor.
- Regresyon testleri önce yazıldı ve eski kodda başarısız oldu. Her savunma tek tek kaldırılarak 6 mutasyon denendi; 6'sı da yakalandı.

**Ertelenen bulgu: CSP `img-src` / `connect-src` içindeki `https://*.supabase.co`.**
- Tarayıcıdaki büyük dosya yüklemeleri `PROJE.storage.supabase.co` adresine gidiyor. Bu adres `src/lib/env.ts` içinde türetiliyor; `next.config.ts` ise yalnızca açıkça tanımlanan Storage değişkenini görüyor.
- Joker kaldırılırsa production'da yüklemeler kırılır. CI yerel Supabase ile koştuğu için bu yolu sınayamaz.
- Önerilen yol:
  1. Türetme kuralı `next.config.ts` ile paylaşılır.
  2. Gerçek Supabase'e bağlı bir önizlemede Auth, Storage yükleme ve görseller denenir.
  3. Ardından joker kaldırılır.
- D-15 (güvenlik başlıkları) ile birlikte ele alınmalı.

**Testler (yerel):**
- birim 468/468
- typecheck temiz
- ESLint 0 hata (3 eski uyarı)
- build 73/73
- gitleaks temiz
- RLS ve E2E CI'da koşar. Migration yok, RLS değişmedi.

**Açık:** Önceki girişteki kapılar aynı: P0-1, P0-2, O-4, O-5, D-04, D-05, D-15, PR #2. Ek olarak `company_name` için veritabanı CHECK'i hâlâ öneri; migration ve O-5 gerektirir.

### 24.10.2026 (2) · K-18: SEC-06, P2 doğrulamaları, yalnız güvenlik yaması, OPS-02 tasarımı

**Başlangıç:** `5034a41` (CI #84 yeşil). Çalışma ağacı temizdi.

**Commit'ler** (`claude/karay-ci-dogrulama`):
- `ab8d15f`: CI #84 sonucu günlüğe işlendi.
- `08257da`: SEC-06. `next/image` uzak kaynakları yalnızca kendi Supabase adreslerimiz; joker `*.supabase.co` kaldırıldı. Next.js'in kendi eşleyicisiyle test edildi.
- `8d0f282`: `singleLine()`. Platform `company_name` ve ofis metin alanlarında kontrol karakteri ve satır sonu kalmıyor. Çalışma saatlerinde gün listesi en fazla 7 öğe ve tekil.
- Bu commit: [OPS02_ABONELIK_DURUMLARI.md](OPS02_ABONELIK_DURUMLARI.md) (durum makinesi ve karar tablosu); yayın kiti §8 (A seçeneği) ve §9 (kapı durumu).

**Yalnız güvenlik yaması (A seçeneği):**
- Yerel dal `claude/karays-guvenlik-yamasi`: `ff2f7da` üzerine `57fdbb7`. **Push edilmedi**; yeni dal Vercel Preview üretebilir, onay gerekiyor.
- Yerel sonuçlar:
  - audit 0
  - typecheck temiz
  - ESLint 0 hata
  - birim 388/388
  - build 73/73
- RLS ve E2E için CI gerekir.
- Konteyner yenilenirse yerel dal kaybolur. Yama, yayın kiti §8'deki adımlarla birebir yeniden üretilebilir.

**Testler (yerel):**
- birim 460/460
- typecheck temiz
- ESLint 0 hata (3 eski uyarı)
- build 73/73
- Yeni korumaların 3 mutasyonu da yakalandı.

**Atlanan 4 E2E testi:**
- 3'ü `mobile` projesinde tasarım gereği atlanıyor: responsive genişlik testi, filtre paneli ve paylaşım menüsü. Aynı testler masaüstünde koşuyor; telefon davranışı acceptance 10–14 ve 15–22 adımlarında.
- 1'i FAM-05, yalnızca `SHOT_DIR` tanımlıyken çalışan bir ölçüm testi.
- Kapsam boşluğu yok.

**OPS-02:** Boşluk güncel kodda sürüyor (plan satırı yokken üç limit kontrolü de sınırsız sayıyor). Kalıcı çözüm D-05 ve D-04 kararlarını bekliyor; tasarım bayraklı ve varsayılanı kapalı bir migration öneriyor.

**Açık:**
- Canlı güvenlik yayını: A ya da B, O-4 onayı
- P0-1 ve P0-2
- O-5
- D-04, D-05, D-15 (PF-10 HSTS, SEC-02 CSP)
- PR #2 (head production dalı, base `claude/photo-to-stl-app-rxbvev`): kapatma kararı sahipte

### 24.10.2026 · K-18: yayın kiti depoda, CI tedarik zinciri, güvenlik yükseltmesi

**Başlangıç durumu:** K-17 denetimi "henüz geçilemez" sonucuyla bitmişti (P0-1, P0-2). Yayın kiti ve runbook yalnızca oturum içindeydi; konteyner yenilenince kayboldu ve yeniden yazıldı. PHASE4'teki K-3 (CI sertleştirme) açık kalmıştı. CI #83, Node.js 20 kullanımdan kaldırma uyarısı veriyordu.

**Commit'ler** (`claude/karay-ci-dogrulama`):
- `f69d8e4`: K-17 yayın kiti ([K17_KARAYS_RELEASE.md](K17_KARAYS_RELEASE.md)) ve `supabase/ops/karays_brand/` runbook'u (01 ön kontrol · 02 geri dönüş betiği üretimi · 03 uygulama · 04 son kontrol · 05 genel geri dönüş). Birim testi LR-10.
- `99622c7`: CI tedarik zinciri (PHASE4 §5.3–§5.4, K-3).
  - action'lar node24 sürümlerinde ve tam commit SHA'sıyla sabit
  - Supabase CLI 2.121.0
  - gitleaks arşivi SHA-256 ile doğrulanıyor
  - `npx --yes wait-on` kaldırıldı
  - Birim testi LR-11.
- `b5ba5ba`: Runbook inceleme düzeltmeleri.
  - boş tabloda ve boş veritabanında okuyan betikler artık hata vermiyor
  - değerler XML kaçışı olmadan okunuyor
  - 03 daha yeni bir şema sürümünde duruyor
  - 02 varsayılan veya eksik yetkileri birebir geri alıyor
  - 05 başlığı betiğin davranışıyla uyumlu
  - LR-11 adım ayırma hatası düzeltildi
- `1c0dbfd`: next 16.3.8 → 16.4.3, zod 4.6.5 → 4.6.7 (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r, GHSA-mrhx-c7xc-m3w5). CI'daki `npm audit` adımı bu duyurular yüzünden kırmızıya dönmüştü.
- `11410e9`: Bu günlük ve yayın kiti güncellemesi: K-17/K-18 commit'leri, CI kanıtı kuralı, güvenlik notu.
- `92ad985`: 02'nin ürettiği yorum satırları artık tek satır. Güvenlik incelemesinin bulgusu: satır sonu içeren bir `company_name`, üretilen geri dönüş betiğinde yorumdan taşıp veritabanı sahibi yetkisiyle komut olarak çalışabiliyordu. Yerel veritabanında kanıtlandı ve kapatıldı.
- Bu commit: OPS-02 geçici kuralı ([operations/README.md](operations/README.md)) ve günlük güncellemesi.

**Testler (yerel):**
- birim 447/447
- typecheck temiz
- ESLint 0 hata. 3 uyarı önceden vardı: `tests/e2e/karay-site.spec.ts:104`
- demo SQL güncel
- build 73/73 sayfa (Next.js 16.4.3)
- `npm audit --omit=dev` 0 açık
- gitleaks temiz

**Kanıt:**
- **Mutasyon:** LR-11'in 6 mutasyonu ve inceleme testlerinin 5 mutasyonu yakalandı. Dosyalar sha256 ile aynen geri yüklendi.
- **Runbook provası (yerel PostgreSQL 16): 18/18 senaryo geçti.**
  - uygulama, tekrar uygulama ve iki geri dönüş yolu
  - kilit zaman aşımı (5 sn)
  - eski ve yeni şema korumaları
  - elle girilmiş ad ve özel karakterler
  - boş tablo ve boş veritabanı
  - NULL ve eksik yetkiler
  - satır sonu içeren ad: yorumdan taşmıyor, komut çalışmıyor
- **Yerelde çalıştırılamayanlar:** RLS ve Playwright E2E (Docker yok). Bunlar CI database işinde koşar.

**İnceleme:**
- Yerleşik `code-review` 7 bulgu verdi; 7'si de doğrulandı ve düzeltildi.
- Provada bir sorun daha bulundu: boş veritabanında 01, `'…'::regprocedure` yüzünden hata veriyordu. Bu da düzeltildi.
- Yerleşik `security-review` bir aday bulgu verdi: 02'de ikinci derece SQL enjeksiyonu. Yanlış pozitif süzgeci onu raporlama eşiğinin altında buldu (3/10): süper admin hesabı, A3 anında yerleştirilmiş bir değer ve elle çalıştırılan bir geri dönüş gerekiyor. Mekanizma yerelde kanıtlandığı ve düzeltmesi tek satır olduğu için yine de kapatıldı (`92ad985`).
- **ECC (v2.2.3) bu oturumda yok.** Doğrulanan durum:
  - eklenti eşitleme klasörü boş
  - depoda ve kullanıcı ayarlarında eklenti tanımı yok
  - hesapta etkin eklenti listesi boş
  - Belgelere göre bulut oturumu, yerelde `/plugin` ile kurulan, kullanıcı ayarlarında ya da deponun `.claude/settings.json` dosyasında açılan eklentileri yüklemez; `/plugin` komutu bulutta yoktur. Yalnızca depoya commit'lenmiş `.claude/agents|skills|commands`, kuruluşun yönetilen ayarları ve claude.ai'da açılmış skill'ler taşınır.
  - Eşdeğer olarak yerleşik Plan/Explore ajanları ile `code-review` ve `security-review` kullanıldı. ECC'nin güvenlik kancalarının yerine her commit'ten önce gitleaks çalıştı ve push öncesi inceleme kapısı uygulandı.

**GitHub doğrulaması (24.10):**
- `968e3ad` yalnızca `claude/karay-ci-dogrulama` dalında; CI #83 bu commit'te yeşil.
- Production dalının yerel kopyasındaki 15 commit hiç push edilmemişti; konteyner yenilenince yerel kopya gitti. İçerikleri kaybolmadı: `82dcd06`'ya `a24fef8..968e3ad` cherry-pick edilerek ayrı bir klonda yeniden kuruldu.
  - 15 commit temiz uygulandı ve konuları birebir aynı.
  - `968e3ad` ile tek fark iki Vercel koruma dosyası.
  - `ff2f7da` zincirin atası (fast-forward).
- Açık PR'lar: #2 (head production dalı, base `claude/photo-to-stl-app-rxbvev`) ve #1 (BREAKLINE). İkisine de dokunulmadı.

**CI:** [#84](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40100992371) · `5034a41` · 24.10.2026 · yeşil.
- quality: typecheck, ESLint, birim testleri, demo SQL, build, `npm audit --omit=dev` (yüksek/kritik yok), gitleaks
- database: yerel Supabase (CLI 2.121.0, sabit SHA'lı setup-cli v3), birim + RLS/MFA/kiracı izolasyonu adımı başarılı (sayı bu kayıtta okunmadı), Playwright E2E **205 geçti, 4 koşullu atlandı** (CI #83 ile aynı)
- Vercel'de bu commit için dağıtım yok; Production `ff2f7da`.

**Açık kalanlar:**
- K-17 yayın kapıları (P0-1, P0-2, O-1…O-6).
- Canlıdaki güvenlik açığı. Yayın kararı sahipte.
- Yedek işinin action sürümü (checkout v7.0.1) hiç çalışmadı. CI bu işi koşmaz; ilk elle çalıştırma (A4) doğrular.
- **OPS-02:** Geçici kural artık [operations/README.md](operations/README.md)'de: abonelik iptal edilmez, organizasyon askıya alınır. Kalıcı düzeltme (aboneliği olmayan ofiste yeni ilan, üye ve yükleme reddi, RLS testiyle) D-05 ve D-04 kararlarını bekliyor; karar verilmeden uygulanmayacak.
- Öneri (P2): `admin-settings` içindeki `days` dizisine `.max(7)` eklenmesi. zod düzeltmesine ek bir savunma olur.
- Öneri (P2): `platform_settings.company_name` için kontrol karakterlerini reddeden bir CHECK ve zod kuralı. 02'deki sertleştirmeye ek bir savunma olur, ancak migration gerektirir.
