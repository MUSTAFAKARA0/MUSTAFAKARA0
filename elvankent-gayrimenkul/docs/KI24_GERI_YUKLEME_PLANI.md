# KI-24 · Gerçek yedekle geri yükleme provası — test planı

> 01.11.2026 · **Durum:** iş akışı yazıldı; **sentetik kuru prova** yerelde yeşil, CI'da her gönderimde koşar (§5).
> **Gerçek veriyle prova KAPALI:** sahip, müşteri verisinin GitHub çalıştırıcısında işlenmesine henüz onay vermedi (01.11).
> `elvankent-restore-drill` iş akışı `RESTORE_DRILL_REAL_DATA_APPROVED` değişkeni, `restore-drill` ortam onayı ve sahibin
> tetiği olmadan çalışmaz. Hiçbir gerçek geri yükleme başlatılmadı.

## 0. Sahibin iki şartı (01.11) ve karşılığı

| Şart | Uygulama | Otomatik kanıt |
| --- | --- | --- |
| **Ş1** Canlıda henüz uygulanmamış migration'lar yüzünden prova yanlışlıkla başarısız sayılmasın; yedek bütünlüğü ve güncel şema uygunluğu ayrı kontroller olsun | `restore-drill.sh` iki ayrı karar yazar: **BÜTÜNLÜK** (SHA-256, dump, tek işlem geri yükleme, parmak izi, tablo sayıları → hata: çıkış 1) ve **ŞEMA** (şema sürümü ↔ depodaki son migration, bekleyen dosyalar, postflight → TAMAM / BİLGİ / HATA). Şema geride ise postflight'ın "…uygulanmamış" / "şema sürümü eski" satırları **migration gecikmesi = BİLGİ** (çıkış 0). `supabase/pending` dosyaları yalnız bilgi. RLS / yetki / istemciye açık fonksiyon hataları şema geride olsa da **HATA** (çıkış 3), gizlenmez | `tests/unit/restore-drill.test.mjs` RD-02 (11 test); sentetik prova senaryo B (gerçek PG 17 Supabase yığınında) |
| **Ş2** Geri yükleme yalnız izole yerel test veritabanına yapılabilsin | Hedef adresi yalnız `127.0.0.1` / `localhost` / `[::1]` + veritabanı adı; sorgu parametresi (`?host=`, `?hostaddr=`, `?service=`), birden çok ana makine, uzak ad, anahtar=değer biçimi ve `PGHOSTADDR`/`PGSERVICE`/`PGSERVICEFILE` reddedilir — **hiçbir veritabanı aracı çağrılmadan** (çıkış 2). `localhost` yalnız loopback'e çözülüyorsa kabul. Bağlandıktan sonra sunucu kendini genel ağ adresiyle görüyorsa veritabanı oluşturulmadan durur. Yalnız yeni `karay_restore_drill_*` veritabanı oluşturulur, her durumda silinir. Gerçek veri iş akışında canlı sır hiç yoktur | RD-01 (24 test, sahte psql/pg_restore çağrı günlüğü boş); RD-03 (iş akışında canlı sır / yazma anahtarı / artifact / R2 yazma komutu yok; sentetik betik de yalnız yerel); sentetik prova senaryo C2 |

**Ş1 eki (01.11, ikinci tur):** canlı veritabanında `karay_schema_version()` **yok** ve birden çok migration eksik. Sürüm
fonksiyonu yokken de şema "geride" sayılır; ancak yalnız eksikler **tutarlıysa**: postflight'ın "…uygulanmamış" dediği migration'lar
denetlenen migration listesinin **son kısmı** olmalı (ilk eksikten sonraki hepsi eksik). Arada bir eksik görünüp sonrakiler uygulanmışsa
(ör. açık bir kiracı politikası 14. satırda "…uygulanmamış" yazdırır) ya da sürüm "uygulandı" diyorsa → **HATA**. RLS, yetki ve
istemciye açık fonksiyon satırları hiçbir durumda bilgiye çevrilmez. Sonuç dosyası `SEMA_ILK_EKSIK=<id>` yazar.

Not (Docker): yerel Supabase konteynerde çalışır; loopback port yönlendirmesiyle bağlanılır ve sunucu kendini köprü ağı adresiyle
(ör. `172.18.0.x`) görür. Bu yüzden çalışma anı kontrolü "loopback" değil "genel ağ değil" denetler; asıl güvence istemci tarafındaki
loopback zorunluluğudur (loopback adresi yalnız aynı makinedeki süreçlere ulaşır).

## 1. Amaç ve kabul ölçütü

Backup #45'in R2'ye yazdığı gerçek yedeğin **geri yüklenebildiğini** kanıtlamak (yalnız alınmış olması yetmez):

| # | Ölçüt | Kaynak |
|---|---|---|
| K1 | `sha256sum -c db-<STAMP>.sha256` → üç dosya OK | scripts/restore-drill.sh adım 1 |
| K2 | `pg_restore --list` okunuyor; tek işlemde (`--single-transaction`) geri yükleme hatasız | adım 2–4 |
| K3 | Parmak izi (kritik tablolar: sayı + özet) yedektekiyle **birebir** | adım 5 |
| K4 | Yedekteki her tablonun satır sayısı **birebir** | adım 6 |
| K5 | `postflight_v2.sql`: HATA satırı yok (RLS, yetkiler, yalnız sunucuya açık fonksiyonlar kapalı) | adım 7 |
| K6 | Storage örneği: R2'deki `storage/current/` kopyasından seçilen N dosya, yerel (geçici) Storage'a yüklenip geri indirildiğinde SHA-256 aynı | yeni adım |
| K7 | Geçici veritabanı ve dosyalar iş sonunda silinmiş; günlükte kayıt içeriği/sayısı, yol, kimlik yok | adım 8 + günlük denetimi |
| K8 | Süre (RTO ölçümü): indirme + geri yükleme + doğrulama toplamı kaydedilir | özet |

## 2. Neden bilgisayara kurulum gerekmez

Prova, GitHub'ın **tek kullanımlık** çalıştırıcısında (ubuntu-24.04) yapılır; iş bitince makine yok edilir:
- Hedef sunucu: çalıştırıcıda `supabase start` ile kurulan **yerel** Supabase yığını (CI'daki database işiyle aynı yöntem).
  Supabase rolleri (anon, authenticated, service_role …) hazır gelir — `restore-drill.sh`'nin ön koşulu.
- Araçlar: PostgreSQL 17 istemcisi ve sabit rclone v1.75.2 (yedek iş akışındaki kurulum ve sürüm kapıları aynen).
- Telefondan başlatma: istek dosyası (`ops-requests/restore-drill.request`) düzenlenir **ve** GitHub ortam onayı verilir (aşağıda).

## 3. İzolasyon ve güvenlik (yapısal güvenceler)

| Risk | Önlem |
|---|---|
| Canlı Supabase'e yazma | İş **hiçbir canlı Supabase sırrı almaz**: `SUPABASE_DB_URL`, `SUPABASE_S3_*` iş akışında yoktur (testle denetlenir). Hedef yalnız `127.0.0.1` (betik yerel olmayan adresi reddeder). Canlıya yazmak yapısal olarak imkânsızdır. |
| R2'deki yedeği değiştirme | Yalnız okuma: `rclone copy` R2 → çalıştırıcı. `sync`, `delete`, `move`, `purge` yok (testle denetlenir). **Önerilen:** sahibin ayrı, yalnız **Object Read** yetkili bir R2 anahtarı açıp `RESTORE_S3_*` sırlarına koyması; mevcut yazma anahtarı kullanılmaz. |
| Müşteri verisinin herkese açık günlüğe çıkması | Betikler yalnız adım durumu ve "eşleşen tablo sayısı" yazar (kayıt sayısı/içerik yok). rclone çıktısı dosyaya gider, ekrana `rclone-log-summary.sh` özeti basılır. Storage örneğinde yol yazılmaz, yalnız "N/N SHA-256 aynı". |
| Artifact ile veri çıkışı | İş akışında `upload-artifact` **yok**, `if: failure()` hata ayıklama çıktısı yok (testle denetlenir). Dump, çalıştırıcının geçici diskinde kalır ve iş sonunda silinir. |
| İzinsiz tetikleme | (1) İstek dosyası yalnız depo yazma yetkisiyle düzenlenebilir; geliştirme oturumunun commit'leri tetiklemez. (2) İş, **`restore-drill` GitHub ortamına** bağlıdır; ortamda **zorunlu onaylayıcı = sahip**. Her çalışma sahip "Approve" demeden başlamaz. (3) Fork PR'ları sırlara erişemez. |
| Yanlış/bozuk yedek | K1 başarısızsa hiçbir şey yüklenmez; bir önceki gecenin yedeğiyle tekrarlanır (BACKUP_RESTORE.md "Tatbikat başarısız olursa"). |
| Kişisel veri saklama | Dump yalnız iş süresince bellekte/geçici diskte. Kalıcı kopya oluşmaz. KVKK açısından veri, işlemci sıfatıyla GitHub'ın geçici makinesinde birkaç dakika işlenir — sahibin kabulü gerekir (Onay kapısı 1). |

## 4. Akış (iş akışı yazıldı, kapalı: `.github/workflows/elvankent-restore-drill.yml`)

1. **Hazırlık:** PG 17 istemcisi + rclone v1.75.2 (SHA-256 doğrulamalı) + `supabase start` (yerel, studio vb. kapalı).
2. **Yedek seçimi:** R2 `db/` altındaki **en yeni** (ya da istek dosyasında yazılan) `STAMP`; dört dosya çalıştırıcıya indirilir
   (yalnız `db-<STAMP>.*`; listeleme yalnız ad, boyut yazılmaz).
3. **Veritabanı provası:** `ADMIN_DB_URL=postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres bash scripts/restore-drill.sh <klasör> <STAMP>` → K1–K5, K7 (bütünlük ve şema ayrı; §0).
4. **Storage örneği (K6):** `storage/current/media-originals` altından rastgele N=20 dosya (ve `branding`'den 5) çalıştırıcıya indirilir,
   yerel Storage'a yüklenir, geri indirilir; SHA-256'lar karşılaştırılır. Yollar yazılmaz. **Yazıldı (kapalı iş akışında):**
   `scripts/storage-roundtrip-drill.mjs` — hedef yalnız yerel Storage (başka adres istek gönderilmeden çıkış 2), yeni **özel** geçici
   kova `karay-k6-<zaman>-<pid>`, nesne adları sıra numarası (gerçek yol Storage'a da gitmez), kova her durumda silinir.
5. **Özet:** her ölçüt için TAMAM/HATA, süreler (K8). Ham çıktı yok.
6. **Temizlik:** geçici veritabanı (betik siler), indirilen dosyalar, yerel Supabase (`supabase stop --no-backup`).

## 5. Sentetik "kuru prova" (müşteri verisi yok) — YAPILDI

`scripts/restore-drill-synthetic.sh`: yerel demo verisinin yedeği `backup-db.sh` ile alınır, `restore-drill.sh` ile yine yerel geçici
veritabanlarına yüklenir. CI'da `database` işinin "KI-24 sentetik geri yükleme provası" adımı her gönderimde aynısını koşar (sır yok).

| Senaryo | Beklenen | Yerel sonuç (01.11, yerel Supabase yığını PostgreSQL 17.11) |
| --- | --- | --- |
| A güncel şema | BÜTÜNLÜK TAMAM, ŞEMA TAMAM, çıkış 0 | Parmak izi **17/17**, tablolar **80/80**, şema `20261018000001` = depo, postflight 22 TAMAM + 4 karşılaştırma, **0 HATA** |
| B canlı gibi geride şema (son migration uygulanmamış: sürüm `20261011000001`, KARAYS sütun varsayılanı geri) | BÜTÜNLÜK TAMAM, ŞEMA **BİLGİ**, çıkış 0 | 17/17, 80/80; postflight 21 TAMAM, **1 migration gecikmesi** (27: KARAYS marka geçişi), 0 HATA. **Eski betik bu yedeği "Son kontrolde 1 HATA" ile başarısız sayardı** (Ş1'in düzelttiği durum) |
| C1 bozuk dump | BÜTÜNLÜK HATA, çıkış 1, veritabanı oluşturulmaz | SHA-256 uyuşmadı, durdu |
| C2 uzak hedef | YALITIM, çıkış 2 | Hiçbir araç çağrılmadan reddedildi |
| **D1 canlının gerçek durumu**: ikinci yerel yığın (`scripts/live-like-stack.sh`, portlar 553xx), yalnız 28/31 migration (`20261010000001` öncesi), `karay_schema_version()` **yok**, demo verisi | BÜTÜNLÜK TAMAM, ŞEMA BİLGİ, çıkış 0 | 17/17, 79/79; postflight 19 TAMAM, **3 migration gecikmesi** (25–27), 0 HATA; `SEMA_ILK_EKSIK=20261010000001`. Bu düzeltmeden önce aynı yedek "ŞEMA: HATA (3)" alıyordu |
| D2 aynı şema + RLS kapalı tablo | ŞEMA HATA, çıkış 3 | 2. satır HATA; gizlenmedi |
| D3 aynı şema + kiracı listesi herkese açık politika | ŞEMA HATA, çıkış 3 | 14. satır "…20260929000001 uygulanmamış" → tutarsız eksik olarak yakalandı, gecikmeler de bilgi sayılmadı |
| D4 aynı şema + davet fonksiyonu `anon`'a açık | ŞEMA HATA, çıkış 3 | 23. satır HATA; gizlenmedi |
| **S1 K6 sentetik Storage**: 25 sentetik dosya (boş ve 3 MB dahil) → yerel geçici kova → geri indirme | STORAGE=TAMAM | 25/25 SHA-256 aynı; geçici kova ve nesneler silindi (veritabanında 0 kalıntı) |
| S2 uzak Storage adresi | YALITIM, çıkış 2 | İstek gönderilmedi |

Bekleyen 8 dosya uygulanmış veritabanında (CI ile aynı koşul) da aynı sonuçlar. CI'da D ve S zorunludur (`REQUIRE_LIVE_LIKE=1`,
`REQUIRE_STORAGE=1`); birim testleri: RD-02 (canlı durumu, tutarsız eksik, gizlenmeyen hatalar), SR-01…04 (sahte yerel Storage ile
bozuk içerik, yükleme hatası, yalıtım, boş örnek). Gerçek iş akışının K6 adımı sahte rclone + gerçek yerel Storage ile yerelde
çalıştırıldı (22/22, günlükte yol yok). Her çalışmadan sonra
`karay_restore_drill_*` / `karay_kuru_eski_*` veritabanı kalmadı. Süre: dört senaryo toplam ≈ 8 sn (demo verisi).

**Bulgu (düzeltildi):** tam Supabase yedeği yerel yığının `postgres` rolüyle geri **yüklenemiyor** (`realtime.list_changes`:
"permission denied to set parameter log_min_messages"); Faz 3 doğrulaması süper kullanıcılı düz PostgreSQL 16'da yapılmıştı.
Prova yerel yığının süper kullanıcısıyla (`supabase_admin`, yalnız çalıştırıcıdaki yerel yığın) yapılır.

## 6. Onay kapıları (sırayla, her biri yazılı)

1. **Plan onayı:** "KI-24 planını onaylıyorum; müşteri verisinin GitHub'ın geçici çalıştırıcısında işlenmesini kabul ediyorum."
   **01.11:** iş akışı ve sentetik prova onaylandı; **gerçek veri işlenmesi onaylanmadı.** Onaydan sonra sahip
   `RESTORE_DRILL_REAL_DATA_APPROVED=true` depo değişkenini açar.
2. **İş akışının yazılması:** sentetik kuru prova + testler (CI yeşil) — geliştirici. **Yapıldı (01.11).**
3. **Sahip ayarları:** (a) R2'de yalnız *Object Read* yetkili yeni anahtar → `RESTORE_S3_ACCESS_KEY_ID`, `RESTORE_S3_SECRET_ACCESS_KEY`
   sırları (uç nokta ve bölge mevcut `BACKUP_S3_ENDPOINT`/`BACKUP_S3_REGION` ile aynı); (b) GitHub › Settings › Environments ›
   `restore-drill` › **Required reviewers: sahip**.
4. **Gerçek prova:** sahip istek dosyasını düzenler, ardından Actions'ta **Review deployments › Approve**.
5. **Kayıt:** sonuçlar KALAN_ISLER KI-24 ve BACKUP_RESTORE.md "Doğrulama kaydı"na; 3 ayda bir tekrar.

## 7. Bu planın kapsamadığı

- Canlıya geri yükleme (asla bu iş akışıyla yapılmaz; BACKUP_RESTORE.md "Tam geri yükleme" elle ve ayrı onayla).
- Yeni bir Supabase **bulut** projesine geri yükleme (Supabase'in rol/şema/veri ayrı döküm yöntemi) — ayrı iş.

## 8. Gerçek R2 yedeğiyle prova — kontrol listesi (K-33, 01.11; henüz BAŞLATILMADI)

Yeniden denetim (01.11, yalnız yerel, gerçek veri yok):

- Sentetik prova yeniden koşturuldu: A (güncel şema), B (geride şema = BİLGİ), C1 (bozuk dump reddedildi), C2 (uzak hedef: YALITIM),
  D1–D4 (canlının gerçek durumu; RLS/politika/yetki hataları gizlenmiyor), S1 (25/25 SHA-256 aynı), S2 (uzak Storage: YALITIM) — hepsi beklenen sonuç.
- Kapılar: `elvankent-restore-drill` iş akışının tek çalışması (#1, 01.11) **skipped**; iş koşulu
  `vars.RESTORE_DRILL_REAL_DATA_APPROVED == 'true'` + ortam `restore-drill` + geliştirme commit'i tetiklemez (`Claude-Session:`);
  izin `contents: read`; canlı Supabase sırrı yok; R2 yalnız `rclone copy` (sync/delete yok); artifact yok (RD-03 denetler).
- Değişken **açılmadı**, iş akışı **başlatılmadı**, R2'den hiçbir şey indirilmedi.

Sahip "başla" dediğinde, sırayla (her kutu işaretlenmeden sonrakine geçilmez):

| # | Adım | Kim | Kanıt |
| --- | --- | --- | --- |
| 1 | Yazılı onay: "Müşteri verisinin GitHub'ın geçici çalıştırıcısında (yalnız yerel veritabanı, iş sonunda silinir) işlenmesini kabul ediyorum" | Sahip | Mesaj |
| 2 | En az bir **zamanlanmış** gece yedeğinin başarılı olduğu (A aşamasının kapanışı); yedek seçimi: en yeni ya da istek dosyasına `STAMP=` | Sahip + geliştirici | Backup iş akışı koşu no. |
| 3 | R2 › Manage API tokens › **yalnız Object Read**, yalnız `karays-yedek` kovası, süreli (ör. 7 gün) yeni anahtar | Sahip | Ekran (anahtar değeri paylaşılmaz) |
| 4 | GitHub › Settings › Secrets › Actions: `RESTORE_S3_ACCESS_KEY_ID`, `RESTORE_S3_SECRET_ACCESS_KEY` | Sahip | Sır adları listede |
| 5 | GitHub › Settings › Environments › `restore-drill` › **Required reviewers: sahip**; "Prevent self-review" kapalı (sahip kendisi onaylayacak) | Sahip | Ekran |
| 6 | GitHub › Settings › Variables › `RESTORE_DRILL_REAL_DATA_APPROVED = true` | Sahip | Ekran |
| 7 | Tetik: `ops-requests/restore-drill.request` dosyasına bir satır (GitHub web arayüzünden, çalışma dalında) ya da Actions › Run workflow | Sahip | Koşu no. |
| 8 | Actions › Review deployments › **Approve** | Sahip | — |
| 9 | Sonuç okuma: BÜTÜNLÜK = TAMAM (zorunlu); ŞEMA = BİLGİ beklenir (canlı geride; `SEMA_ILK_EKSIK` KI-23 tespitiyle aynı olmalı); ŞEMA = HATA ise gerçek güvenlik bulgusu → durulur, incelenir; K6 STORAGE = TAMAM; **K-35:** 9. adım (KI-23 şema ve güvenlik denetimi, yedeğin geçmişi `20261001000001`'de bitiyorsa) `DENETIM_G=TAMAM`, `DENETIM_P=AYNI` — O-5a engelinin (İÇERİKSİZ geçmiş) üç koşulundan biri; FARKLI nesneler adlarıyla listelenir | Geliştirici | Özet satırları (ham veri yok) |
| 10 | Kapanış: değişkeni `false` yap, R2 okuma anahtarını **sil**, sırları sil (ya da süre dolsun) | Sahip | Ekran |
| 11 | Kayıt: KALAN_ISLER KI-24, BACKUP_RESTORE.md "Doğrulama kaydı", GELISTIRME_GUNLUGU | Geliştirici | Commit |

Durdurma ölçütleri: iş 45 dakikayı aşarsa iptal; BÜTÜNLÜK HATA → yedek iş akışı incelenir (O-5 bu yedeğe güvenerek başlatılmaz);
günlükte yol/e-posta/kayıt içeriği görülürse koşu günlüğü silinir ve iş akışı düzeltilir.

Bu provanın O-5 için önemi: Supabase Free planında panelden yedek geri yükleme/PITR'a güvenilemez; O-5'in son çare geri dönüşü
R2 yedeğidir. Bu yüzden O-5'in ilk migration'ından önce gerçek prova en az bir kez **TAMAM** olmalıdır (O5_YAYIN_PLANI.md §0).
