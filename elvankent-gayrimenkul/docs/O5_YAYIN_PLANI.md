# O-5 · Canlı veritabanı migration planı (sıralı, geri dönüşü tanımlı) — K-33, güncelleme K-34 (01.11.2026)

**Durum: Aşama 1 (O-5a, K-45) ve Aşama 2 (KARAYS marka, K-46) CANLIYA UYGULANDI (02.11.2026). Sıradaki: Aşama 3 — ayrı onay.** §2.7 üç koşulu sağlandı (K-42). (Önceki: ENGELLİ, K-35.) Hiçbir aşama başlatılmadı. Ön koşul 0.4 (İÇERİKSİZ geçmiş) çözülmeden hiçbir aşama
önerilmez. Her aşama **ayrı, açık, yazılı sahip onayı** ister; bir aşamanın onayı sonrakini
kapsamaz. OPS-02 bayrağı (`enforce_subscription_limits`) bu planın hiçbir aşamasında açılmaz (ayrı karar, K19 §8 birim 5b).

**Kaynak (K-34):** sahibin canlı tespit çıktısı (01.11, CSV): 31 temel migration'ın 21'i VAR, 10'u YOK; ilk eksik
`20261002000001_karay_platform.sql`; kayıt defteri 21 kayıt · en yeni `20261001000001`; `karay_schema_version()` yok;
TUTARLILIK TAMAM; 8 bekleyen YOK. Ayrıntı ve kanıt değerlendirmesi: [KI23_CANLI_SEMA_ON_KONTROL.md](KI23_CANLI_SEMA_ON_KONTROL.md).

Dayanaklar: [PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md) (dosya açıklamaları, SQL Editor kuralları),
[K19_YAYIN_HAZIRLIK.md](K19_YAYIN_HAZIRLIK.md) §8 (onay birimleri), [KI24_GERI_YUKLEME_PLANI.md](KI24_GERI_YUKLEME_PLANI.md) §8.

## Yerel prova kanıtı (canlıya dokunmadan)

`scripts/o5-upgrade-rehearsal.sh` bu planın 1–2. aşamalarını ve 3–4. aşamaların runbook'larını canlı benzeri yığında aynı sırayla
uyguladı; ardından aynı veritabanında `npm run test:rls` (kiracı yalıtımı, RLS, MFA, ilan/üye/depolama kotaları, abonelik sınırları,
medya, davet, alan adı):

| Başlangıç (canlıyı taklit) | Sonuç | Migration geçmişi | Güvenlik testleri |
| --- | --- | --- | --- |
| **Canlının CSV'deki durumu** (kesim `20261002000000`: 21 VAR, 21 kayıt) | 9 O-5a dosyası + KARAYS + 8 runbook 01→05→01→03→04; 39/39 VAR; postflight 22 TAMAM / 0 HATA | 31 kayıt, tutarsız yok (`AYNI=21`, `O-5a=9`, `KARAYS runbook=1`) | **201/201** |
| 12 dosya eksik (K-33) | 39/39 VAR, 0 HATA | — | 201/201 |
| 5 dosya eksik (K-33) | 39/39 VAR, 0 HATA | — | 201/201 |

## 0. Ön koşullar (hiçbir migration'dan önce, hepsi)

| # | Koşul | Neden | Kanıt |
| --- | --- | --- | --- |
| 0.1 | Faz A kapanışı: en az bir **zamanlanmış** gece yedeği başarılı | Elle yedeğe ek olarak otomatik zincir çalışıyor | Backup koşu no. |
| 0.2 | ✓ **Sağlandı (02.11):** KI-24 gerçek prova #2 — BÜTÜNLÜK TAMAM (17/17, 72/72), K6 23/23 | Free planda son çare geri dönüş R2 yedeğidir; geri yüklenebildiği kanıtlandı | KI24 §11 |
| 0.3 | ✓ **Yapıldı (01.11):** `canli_sema_tespiti.sql` → 21 VAR / 10 YOK, TUTARLILIK TAMAM | Eksik liste kesin | Sahibin CSV'si |
| 0.4 | ✓ **Sağlandı (02.11, K-42):** köken (21 migration atomik/eksiksiz), canlı denetim #8 (G TAMAM, fark yalnız CRLF), KI-24 gerçek prova 9. adım (G TAMAM, BICIM) | Kayıt defteri içeriksiz olsa da uygulamanın eksiksizliği üç bağımsız kaynaktan kanıtlandı | KI23 §8.2–8.3, KI24 §11 |
| 0.5 | Vercel production = beklenen commit (bugün `a0f0a67`) ve önceki dağıtımda Instant Rollback | Kod geri dönüşü hazır | Ekran |
| 0.6 | Sakin saat seçimi (müşteri trafiği az), sahip ve geliştirici aynı anda erişilebilir | İlk 30 dk yoğun kontrol | — |

## Aşama sırası

Her aşamada aynı kalıp: **ön kontrol → yedek → uygulama → son kontrol → güvenlik/duman testi → kayıt**. "Yedek" = varsayılan daldan
elle yedek iş akışı (Backup #48 gibi), SHA-256 ve parmak izi TAMAM; aşama başlamadan en fazla 1 saat önce.

### Aşama 1 — O-5a: 9 temel migration (`supabase/ops/o5a/01` … `09`)

Sıra (değişmez): `20261002000001_karay_platform` → `20261004000001_design_family_access` → `20261005000001_office_site_management`
→ `20261006000001_brand_content_draft` → `20261007000001_seo_draft` → `20261008000001_owner_invitations` →
`20261009000001_custom_domains` → `20261010000001_password_reset_requests` → `20261011000001_customer_operations`.

- **Neden `supabase/ops/o5a` dosyaları:** her dosya = migration'ın birebir içeriği + **aynı işlemde** kayıt defteri kaydı
  (`scripts/o5a-build.sh` üretir, birim testi O5A-01 denetler). Ham dosya SQL Editor'den uygulanırsa kayıt defteri 21'de kalır ve
  ileride `supabase db push` bu dosyaları yeniden çalıştırmaya kalkar. Sürüm zaten kayıtlıysa dosya hiç uygulanmaz.
- **Ön kontrol:** 0.3 ve 0.4 sonuçları (0.4 şu an ENGEL). Kodun yeni dağıtımı **gerekmez** (production kodu bu nesneleri bekliyor).
- **Uygulama:** SQL Editor'de her dosya ayrı sorgu, dosyanın tamamı, seçim yokken Run; RLS uyarısında **Run without RLS**
  (dosyalar RLS'i kendileri açar). Hata → **dur**, sonraki dosyaya geçme (dosya ve kaydı birlikte geri alınmıştır).
- **Her dosyadan sonra:** `canli_sema_tespiti.sql` → o dosya `VAR`, TUTARLILIK TAMAM; `canli_migration_gecmisi.sql` → o sürüm
  `AYNI (O-5a kaydı)`.
- **Son kontrol (9 dosyadan sonra):** `karay_schema_version()` = `20261011000001`; `supabase/ops/postflight_v2.sql` → tek kabul
  edilen HATA 27. satır (KARAYS marka geçişi, 2. aşamada kapanır); başka her HATA = dur.
- **Duman testi (sahip, tarayıcı):** KARAYS sayfasında "Bilgi al" formu (kendi bilgilerinizle bir deneme talebi) → KARAY konsolu ›
  Talepler'de görünür; KARAY konsolu ana sayfası ve Müşteriler listesi açılır; bir müşteriye not; deneme müşterisine davet
  bağlantısı (gerçek müşteri değil); bir kiracı sitesi ve ofis paneli açılır; şifre sıfırlama formu yanıt verir.
- **Güvenlik:** postflight'ın RLS / anon yetki satırları TAMAM; ofis panelinde başka ofisin verisi görünmez (yerelde 201/201).
- **Geri dönüş:** (a) dosya hata verdi → dosya ve kaydı birlikte geri alındı, dur; (b) uygulandı ama son kontrolde HATA ya da
  duman testi kırık → ilgili migration dosyasının başındaki/sonundaki "Geri alma" bloğu **ters sırayla** ve
  `delete from supabase_migrations.schema_migrations where version = '<sürüm>'` (yalnız yeni tablolarda henüz gerçek kayıt yoksa;
  geliştirici bloğu o anki duruma göre gözden geçirir, ayrı onay); (c) veri bozulması şüphesi → R2 yedeğinden yeni bir projeye geri
  yükleme (BACKUP_RESTORE.md, ayrı onay). Kod geri alınmaz (kod migration'sız da çalışır).
- **Onay cümlesi örneği:** "O-5a: supabase/ops/o5a altındaki 9 dosyanın sırayla canlıya uygulanmasını onaylıyorum."

### Aşama 2 — KARAYS marka (`20261018000001`, ayrı runbook `supabase/ops/karays_brand/`; ayrı onay) — uygulandı 02.11.2026 (K-46)

- **Ön kontrol:** `01_preflight.sql` → DUR yok (artık `karay_schema_version()` = `20261011000001`).
- **Yedek:** `02_rollback_script.sql` çıktısını sakla (o anki `company_name` için geri dönüş betiği üretir).
- **Uygulama:** `03_apply.sql` (kayıt defterine `20261018000001` kaydını aynı işlemde yazar). **Son kontrol:** `04_postflight.sql` →
  DUR/HATA yok; `canli_sema_tespiti.sql` 31/31 VAR; `postflight_v2.sql` 0 HATA; `canli_migration_gecmisi.sql` → 31 kayıt, tutarsız yok.
- **Duman:** KARAYS sayfası alt bilgisi "KARAYS" (elle girilmiş ad varsa korunur).
- **Geri dönüş:** saklanan `02` çıktısı ya da `05_rollback.sql`. Tek satır, veri kaybı yok.

### Aşama 3 — O-5b/b'/c: kilitler ve OPS-02 dosyası (bayrak KAPALI) — uygulandı 02.11.2026 (K-49)

**Uygulama yöntemi (K-47, hazır, çalıştırılmadı):** `elvankent-o5b-uygula.yml` + `scripts/o5b-uygula.sh` — O-5a ile aynı kapılar;
istek dosyası `ops-requests/o5b-uygula.request`. Alternatif: SQL Editor'den elle (aşağıdaki sıra).

Sıra ve runbook: `quota_lock` (20261025000001) → `ops02_limits` (20261025000002) → `media_quota_lock` (20261026000001) →
`company_name` (20261026000002). Her biri: `01` (DUR yok) → `02` çıktısını sakla → `03` → `04` (DUR/HATA yok) → tespit `VAR`.
`company_name` ayrıca `03b_validate.sql` (NOT VALID kısıtın doğrulanması) içerir; README'sindeki sırayla.
- **Bayrak:** `04` ve tespit sonrası `select enforce_subscription_limits from platform_settings` → **false** olmalı. Değilse dur.
- **Abonelik/kota güvencesi:** bayrak kapalıyken davranış değişmez (SL testleri); kilitler yalnız eşzamanlı eklemeyi sıraya koyar.
- **Duman:** bir ofiste ilan ekle/düzenle (deneme ofisi), ekip üyesi davet ekranı, görsel yükleme.
- **Geri dönüş:** her runbook'un `05_rollback.sql`'i (ters sırayla); veri değişmez.

### Aşama 4 — Medya birimleri (`20261027000001` → `…02` → `…03` → `20261031000001`)

- **Kod önkoşulu (K19 §8, 4d–4g):** özellikle `media_column_privileges` **eski medya kodunu bozar**: production'daki kodun yeni
  medya akışını (WP-A2) içerdiği ve yükleme/döndürme denemesinin geçtiği doğrulanmadan uygulanmaz. Bu aşama ayrı bir kod yayını
  kararına bağlıdır; bugün onay istenmez.
- Runbook'lar: `media_finalize_rpc`, `media_privileges`, `media_storage_slots`, `media_stray_sweep` (her biri 01→04, geri dönüş 05).
- **Depolama kotası güvencesi:** gerçek boyut sonlandırmada veritabanında hesaplanır; yerelde media-finalize / storage-slots /
  stray-sweep testleri yeşil.

## Sonraki ve ayrı kararlar (bu planın dışında)

- OPS-02 bayrağını açmak (D-04/D-05 açık alt kararları + aboneliksiz aktif ofis listesi incelemesi).
- Veri saklama/silme (hukuki görüş; otomatik silme yok).

## Aşama sonrası kayıt (her aşama)

KALAN_ISLER (KI-23 / KI-27), GELISTIRME_GUNLUGU (tarih, uygulanan dosyalar, tespit/postflight özeti, yedek koşu no.), bu belgede
aşama satırına "uygulandı (tarih)".

## O-5a uygulama yöntemi (K-43, 02.11.2026)

Sahip onayı (sohbette, 02.11.2026): **"O-5a: supabase/ops/o5a altındaki 9 dosyanın sırayla canlıya uygulanmasını onaylıyorum."**
Dosyalar 7–44 KB olduğundan (telefonda SQL Editor 84 KB'de donmuştu) ve SQL Editor'ün CRLF sorunu olmadan uygulamak için
**GitHub Actions iş akışı** seçildi: `.github/workflows/elvankent-o5a-uygula.yml` + `scripts/o5a-uygula.sh`.

| Kapı / adım | Ayrıntı |
| --- | --- |
| Tetik | Sahibin `ops-requests/o5a-uygula.request` dosyasında `CALISTIR=evet` satırını **kapalıdan açığa** geçirdiği gönderim; tek kullanımlık; Re-run ve geliştirme commit'leri çalıştırmaz |
| Onay ortamı | `o5a-uygula` (sahip: Required reviewers) → "Review deployments › Approve" |
| Taze yedek | Son 3 saatte başarılı `elvankent-backup` yoksa bağlanmadan durur (GitHub API, `actions: read`) |
| Paket bütünlüğü | 9 dosyanın sıralı SHA-256 özeti iş akışında sabit; dosyalar üreticiyle birebir (`o5a-build.sh --check`) |
| Ön kontrol (salt okunur) | 21 temel migration VAR, TUTARLILIK TAMAM; eksikler listenin son kısmı (kesintiden sonra kalan yerden devam) |
| Uygulama | Her dosya ayrı **tek işlem** (`lock_timeout` 10 sn, `statement_timeout` 300 sn; gövde + geçmiş kaydı); hata → geri alınır, sonrakine geçilmez |
| Ara kontrol | Her dosyadan sonra salt okunur tespit: o dosya VAR |
| Son kontrol | 30/30 VAR · `karay_schema_version()` = `20261011000001` · postflight_v2'de yalnız 27. satır (KARAYS, ayrı adım) · geçmişte 9 "AYNI (O-5a kaydı)" → "SONUÇ: TAMAM"; aksi çıkış 4 (geri dönüş kararı sahibin) |
| Günlük | Yalnız dosya adı, durum, sayılar, güvenli hata sınıfı; adres/parola maskeli; artifact yok |

**Sentetik doğrulama** (canlının kopyası gibi kurulmuş yığın: tarihî paketler, CRLF; `scripts/o5a-uygula-test.sh`, CI'da
`canli-denetim-prova.sh` 7. adım): U1 onaysız paket → hiçbir şey uygulanmadı · U2 `organizations` başka oturumda kilitliyken →
55P03, kısmi şema tutarlı, kalanlar uygulanmadı · U3 kilit kalkınca → kalan 8 dosya, son kontrol temiz (30 VAR, sürüm
20261011000001, yalnız 27 HATA, 9 O-5a kaydı) · U4 tekrar → "hepsi zaten uygulanmış", hiçbir şey yapılmadı.

**Sonrası:** duman testleri (Aşama 1 listesi) → KARAYS marka runbook'u (Aşama 2, ayrı onay). Özel alan adı için ayrıca Vercel'de
`VERCEL_API_TOKEN` ve `VERCEL_PROJECT_ID` gerekli — sahibin ekran görüntüsünde (02.11) **yok**; O-5a'dan sonra alan adı ekranı
"sağlayıcı yapılandırılmamış" durumunda kalır (ayrı adım, sahip).
