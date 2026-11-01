# O-5 · Canlı veritabanı migration planı (sıralı, geri dönüşü tanımlı) — K-33, 01.11.2026

**Durum: PLAN.** Hiçbir aşama başlatılmadı. Her aşama **ayrı, açık, yazılı sahip onayı** ister; bir aşamanın onayı sonrakini
kapsamaz. OPS-02 bayrağı (`enforce_subscription_limits`) bu planın hiçbir aşamasında açılmaz (ayrı karar, K19 §8 birim 5b).

Dayanaklar: [KI23_CANLI_SEMA_ON_KONTROL.md](KI23_CANLI_SEMA_ON_KONTROL.md) (eksik liste, uyum),
[PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md) (dosya açıklamaları, SQL Editor kuralları),
[K19_YAYIN_HAZIRLIK.md](K19_YAYIN_HAZIRLIK.md) §8 (onay birimleri), [KI24_GERI_YUKLEME_PLANI.md](KI24_GERI_YUKLEME_PLANI.md) §8.

## Yerel prova kanıtı (canlıya dokunmadan)

`scripts/o5-upgrade-rehearsal.sh` bu planın 1–3. aşamalarını ve 4. aşamanın runbook'larını canlı benzeri yığında aynı sırayla
uyguladı; ardından aynı veritabanında `npm run test:rls` (kiracı yalıtımı, RLS, MFA, ilan/üye/depolama kotaları, abonelik sınırları,
medya, davet, alan adı):

| Başlangıç (canlıyı taklit) | Sonuç | Güvenlik testleri |
| --- | --- | --- |
| 12 dosya eksik (`20260930000002`'den) | 39/39 nesne VAR, postflight 22 TAMAM / 0 HATA, 8 runbook 01→05→01→03→04 | 201/201 |
| 5 dosya eksik (`20261008000001`'den) | aynı | 201/201 |

## 0. Ön koşullar (hiçbir migration'dan önce, hepsi)

| # | Koşul | Neden | Kanıt |
| --- | --- | --- | --- |
| 0.1 | Faz A kapanışı: en az bir **zamanlanmış** gece yedeği başarılı | Elle yedeğe ek olarak otomatik zincir çalışıyor | Backup koşu no. |
| 0.2 | KI-24 gerçek prova **TAMAM** (BÜTÜNLÜK TAMAM, K6 TAMAM) | Free planda son çare geri dönüş R2 yedeğidir; geri yüklenebildiği kanıtlanmadan şema değiştirilmez | KI-24 kaydı |
| 0.3 | KI-23 tespiti: `supabase/ops/canli_sema_tespiti.sql` çıktısı, `TUTARLILIK = TAMAM` | Eksik liste kesinleşir; `DİKKAT` ise plan durur | Çıktı |
| 0.4 | Vercel production = beklenen commit (bugün `a0f0a67`) ve önceki dağıtımda Instant Rollback | Kod geri dönüşü hazır | Ekran |
| 0.5 | Sakin saat seçimi (müşteri trafiği az), sahip ve geliştirici aynı anda erişilebilir | İlk 30 dk yoğun kontrol | — |

## Aşama sırası

Her aşamada aynı kalıp: **ön kontrol → yedek → uygulama → son kontrol → güvenlik/duman testi → kayıt**. "Yedek" = varsayılan daldan
elle yedek iş akışı (Backup #48 gibi), SHA-256 ve parmak izi TAMAM; aşama başlamadan en fazla 1 saat önce.

### Aşama 1 — O-5a: eksik temel migration'lar (KI-23 §3 A+B, KARAYS hariç; 4 ya da 11 dosya)

- **Ön kontrol:** 0.3 çıktısı; listede ilk eksik dosya. Kodun yeni dağıtımı **gerekmez** (production kodu bu nesneleri bekliyor).
- **Uygulama:** SQL Editor'de her dosya ayrı sorgu, dosyanın tamamı, seçim yokken Run; RLS uyarısında **Run without RLS**
  (dosyalar RLS'i kendileri açar). Hata → **dur**, sonraki dosyaya geçme (dosya kendiliğinden geri alınmıştır).
- **Her dosyadan sonra:** `canli_sema_tespiti.sql` → o dosya `VAR`, TUTARLILIK TAMAM.
- **Son kontrol:** `supabase/ops/postflight_v2.sql` → 0 HATA (KARAYS satırı "gecikme" olabilir, 2. aşamada kapanır).
- **Duman testi (sahip, tarayıcı):** KARAY konsolu › Müşteriler listesi açılır; bir müşteriye not; deneme müşterisine davet
  bağlantısı (gerçek müşteri değil); bir kiracı sitesi ve ofis paneli açılır; şifre sıfırlama formu yanıt verir.
- **Güvenlik:** postflight'ın RLS / anon yetki satırları TAMAM; ofis panelinde başka ofisin verisi görünmez (yerelde 201/201).
- **Geri dönüş:** (a) dosya hata verdi → zaten geri alındı, dur; (b) uygulandı ama son kontrolde HATA ya da duman testi kırık →
  ilgili dosyanın sonundaki "Geri alma" bloğu **ters sırayla** (yalnız yeni tablolarda henüz gerçek kayıt yoksa; geliştirici
  bloğu o anki duruma göre gözden geçirir); (c) veri bozulması şüphesi → R2 yedeğinden yeni bir projeye geri yükleme
  (BACKUP_RESTORE.md, ayrı onay). Kod geri alınmaz (kod migration'sız da çalışır).
- **Onay cümlesi örneği:** "O-5a: KI-23 listesindeki şu dosyaların canlıya uygulanmasını onaylıyorum: …".

### Aşama 2 — KARAYS marka (`20261018000001`, runbook `supabase/ops/karays_brand/`)

- **Ön kontrol:** `01_preflight.sql` → DUR yok (artık `karay_schema_version()` = `20261011000001`).
- **Yedek:** `02_rollback_script.sql` çıktısını sakla (o anki `company_name` için geri dönüş betiği üretir).
- **Uygulama:** `03_apply.sql`. **Son kontrol:** `04_postflight.sql` → DUR/HATA yok; `canli_sema_tespiti.sql` 31/31 VAR.
- **Duman:** KARAYS sayfası alt bilgisi "KARAYS" (elle girilmiş ad varsa korunur).
- **Geri dönüş:** saklanan `02` çıktısı ya da `05_rollback.sql`. Tek satır, veri kaybı yok.

### Aşama 3 — O-5b/b'/c: kilitler ve OPS-02 dosyası (bayrak KAPALI)

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
