# K-17 · KARAYS sürümünün Production'a çıkışı (yayın kiti)

> **Durum (24.10.2026):** Hazır, ama **yayın yapılmadı**. Yayın iki ön koşula ve açık onaya bağlı (§1).
> Production dalı `ff2f7da`. Yayınlanacak içerik `claude/karay-ci-dogrulama` dalında. Yayından önce bu dalın **son commit'inde** `elvankent-ci` (quality + database) yeşil olmalı (§4 B1). Ürün kodu (K-8 … K-16) GitHub CI [#83](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/39215555083) ile doğrulandı; sonraki commit'lerin doğrulaması: [GELISTIRME_GUNLUGU.md](GELISTIRME_GUNLUGU.md).
> Bu belge depoda herkese açıktır. Ortama özgü kimlikler (Vercel/Supabase proje ve dağıtım kimlikleri, ortam değişkeni değerleri) burada yer almaz. Operatör bunları panelden okur.

## 0. Ne yayınlanıyor

Production dalının (`ff2f7da`) üstüne gelenler: FAZ 3, FAZ 4 ve K-8 … K-16 (ürün; CI #83'te bu 15 commit doğrulandı), K-17 (bu yayın kiti ve migration runbook'u) ve K-18 (CI tedarik zinciri). Kesin liste B1'de kurulan zincirden okunur: `git log --oneline ff2f7da..karays-yayin`.
- **Güvenlik yamaları:** next 16.4.3 (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r), zod 4.6.7 (GHSA-mrhx-c7xc-m3w5), sharp 0.35.5.
- **Doğrulanabilir yedek betikleri.**
- **CI düzeltmeleri:** E2E ortamı, Playwright tarayıcısı, sabit çalıştırıcı imajı.
- **CI tedarik zinciri (K-18):** action'lar node24 sürümlerinde ve tam commit SHA'sıyla sabit; Supabase CLI sürümü sabit; gitleaks arşivi SHA-256 ile doğrulanıyor.
- **Yazı tipleri:** depodan yükleniyor.
- **KARAYS markası:** ad, logo ailesi, KARO ve yardımcı maskot.
- **Tek migration:** `20261018000001_karays_brand.sql`.

Bu commit'lerin hiçbiri yeni bir ortam değişkeni veya yeni bir veritabanı çağrısı eklemez. Bu, `.rpc`/`.from` ve `process.env` farkıyla doğrulandı.

**İçeriğin kaynağı:** Doğrulama dalı, Production dalının üstünde bir Vercel koruma commit'i taşır (`a24fef8`, yalnızca o dal için `git.deploymentEnabled: false`). Yayın zinciri bu commit **hariç** kurulur (§4 B1).

## 1. Ön koşullar (P0 — ikisi de kapanmadan yayın yok)

| # | Ön koşul | Neden | Kapanış ölçütü |
| --- | --- | --- | --- |
| P0-1 | Doğrulanmış bir canlı yedek | `elvankent-backup` bugüne kadar hiç çalışmadı (her zamanlanmış çalışma `skipped`; `ELVANKENT_BACKUP_ENABLED` ≠ `true`). Sağlayıcı yedeği/PITR planı doğrulanmadı. Gerçek bir Supabase projesine geri yükleme hiç prova edilmedi | §4 A4: dump + parmak izi + sha256 doğrulandı, yedek canlıdan ayrı yerde |
| P0-2 | Canlı veritabanının kimliği ve şema durumu | Uygulamanın bağlı olduğu Supabase projesi, şema sürümü ve `company_name` bu depodan okunamaz | §4 A2: `01_preflight.sql` çıktısında DUR yok; şema `20261011000001` (veya zaten `20261018000001`) |

## 2. Gerekli onaylar

| # | Onay | Kim yapar |
| --- | --- | --- |
| O-1 | Ortam teyidi (A1). Yalnızca panelde bakılır | Sahip |
| O-2 | Canlıda salt okunur ön kontrol (01, 02) | Sahip / operatör |
| O-3 | Yedek yöntemi ve çalıştırılması (A4). GitHub iş akışı seçilirse sır ve değişken tanımlamak ayrı bir onaydır | Sahip |
| O-4 | Production push'u (B2). Production'a dağıtım başlatır | Sahip onaylar, Claude çalıştırır |
| O-5 | Canlıda migration (C2) | Sahip / operatör |
| O-6 | Geri alma ölçütleri ve yetkisi (§6) | Sahip |

## 3. Riskler

**P1 · yayından önce bilinmeli**
- **Canlıdaki güvenlik açığı (K-18):** Production (`ff2f7da`) next 16.3.6 ve sharp 0.35.4 ile çalışıyor. GHSA-p3m5-59mp-jv5r (Server Actions üzerinden DoS, yüksek) uygulamada geçerli: 28 dosyada Server Action var. GHSA-2464-fhr4-w9xw (SVG ile Image Optimization RCE, kritik) için duyurunun geçici çözümü sharp ≥ 0.35.5; canlıda bu sürüm yok. Vercel'in görüntü işleme yolunun bunu etkileyip etkilemediği doğrulanmadı. Bu yayın ikisini de kapatır. Yayın geciktikçe açık canlıda kalır.
- Rollback seçeneği panelde gözle teyit edilmeli (A1). Hobby planda yalnızca **hemen önceki** Production dağıtımına dönülebilir; hedefimiz zaten o.
- Yedek değişkeni push'tan **önce** açılırsa Production dalındaki **eski** yedek iş akışı çalışır. Eski sürüm tablo satır sayılarını ve dump boyutunu herkese açık Actions loguna yazar. Yeni sürüm yazmaz. Push'tan önce otomatik yedek gerekiyorsa iş akışı doğrulama dalından çalıştırılır.
- Production dalı korumasız ve varsayılan dal; her push doğrudan Production'a gider (PF-04, D-14).
- Storage (fotoğraf) yedeği de yok. Bu migration Storage'a dokunmaz; A4'te alınması önerilir.

**P2 · bilgi**
- Deploy ile migration arası: `/karay` alt bilgisi ve JSON-LD şirket adı veritabanından gelir ve "KARAY" gösterir. Migration'dan sonra en geç 5 dk içinde (ISR) "KARAYS" olur.
- Tarayıcılar eski favicon'u bir süre önbellekte tutabilir.
- KARO animasyonu 4,2 MB'tır. Yalnızca geniş ekranda ve hareket serbestken, bir kez indirilir.
- Push'tan sonra gece yedeği, yedek açılana kadar her gün görünür bir "Yedek alınmadı" uyarısı verir. Bu yeni iş akışının beklenen davranışıdır.
- Yedek işinin action sürümü (checkout v7.0.1, K-18) hiç çalışmadı: CI bu işi çalıştırmaz, yedek kapalıyken yalnızca uyarı işi koşar. İlk çalıştırma (A4, iş akışı yolu) bunu da doğrular; hata verirse yedek alınmaz, başka bir şey değişmez.

## 4. İşlem sırası

Önce kod, sonra migration. İki sıra da uyumludur (§5); bu sırada derleme başarısız olursa hiçbir şey değişmez.

### A · Ön koşullar (canlıya yazmaz)

**A1 · Panel kontrolü (Vercel production projesi)**
- `NEXT_PUBLIC_SUPABASE_URL` hangi Supabase projesini gösteriyor?
- `SITE_ENV` değeri (`production` / `demo`)?
- Root Directory = `elvankent-gayrimenkul`?
- Ignored Build Step boş mu?
- Önceki Production dağıtımının (ff2f7da) menüsünde "Instant Rollback" ya da "Promote" var mı?

**A2 · Ön kontrol (salt okunur)**
- O Supabase projesinin SQL Editor'ünde `supabase/ops/karays_brand/01_preflight.sql` çalıştırılır; çıktının **tamamı** saklanır.
- Ölçüt: DUR yok.

**A3 · Geri dönüş betiği (salt okunur)**
- `02_rollback_script.sql` çalıştırılır.
- Çıktı `geri-donus-<tarih>.sql` olarak saklanır.

**A4 · Yedek (P0-1)**
- a) Supabase › Database › Backups: plan, son yedek zamanı ve PITR durumu not edilir.
- b) KARAY yedeği iki yoldan biriyle alınır:
  - **Elle:** Doğrulama dalının checkout'unda çalıştırılır. pg_dump/psql sürümü sunucu sürümüne eşit ya da daha yeni olmalı.
    ```bash
    SUPABASE_DB_URL=<Session pooler adresi> OUT_DIR=./yedek-k17 bash scripts/backup-db.sh
    (cd yedek-k17 && sha256sum -c db-*.sha256)
    npm run backup:storage -- --out=./yedek-k17/storage
    npm run restore:storage -- --from=./yedek-k17/storage --verify
    ```
  - **İş akışı:** Sırlar ve değişkenler tanımlanır ([BACKUP_RESTORE.md](BACKUP_RESTORE.md) › Açılış kapısı). Ardından `elvankent-backup` **`claude/karay-ci-dogrulama` dalından** "Run workflow" ile çalıştırılır. Production dalından çalıştırılmaz (§3).
- c) Mümkünse dump, yerel bir test PostgreSQL'ine `scripts/restore-drill.sh` ile geri yüklenir.

### B · Kod yayını

**B1 · Yayın zinciri ve son kontroller**

Zincir, Production dalının üstüne doğrulama dalındaki commit'ler alınarak kurulur. Vercel koruma commit'i (`a24fef8`) hariç tutulur:
```bash
git fetch origin claude/karay-ci-dogrulama claude/elvankent-real-estate-platform-vxq9dj
git checkout -B karays-yayin 82dcd06                               # ff2f7da + 6 ortak commit (FAZ 3 … K-12)
git cherry-pick a24fef8..origin/claude/karay-ci-dogrulama          # K-13 … K-18; a24fef8 HARİÇ
git diff --stat origin/claude/karay-ci-dogrulama HEAD              # yalnızca vercel.json ve elvankent-gayrimenkul/vercel.json
git merge-base --is-ancestor origin/claude/elvankent-real-estate-platform-vxq9dj HEAD && echo fast-forward
```

Push'tan önce şunlar kontrol edilir:
- Doğrulama dalının son commit'inde (`git rev-parse origin/claude/karay-ci-dogrulama`) `elvankent-ci` quality ve database işleri yeşil (Actions › elvankent-ci › o commit).
- `git ls-remote`: Production dalı hâlâ `ff2f7da`.
- Çalışma ağacı temiz.
- gitleaks temiz.

**B2 · Push (O-4 ile)**
```bash
git push origin karays-yayin:refs/heads/claude/elvankent-real-estate-platform-vxq9dj
```
Bu komut Vercel'de bir Production dağıtımı başlatır.

**B3 · İzleme**
- Vercel Production dağıtımı READY olmalı.
- `elvankent-ci` (quality + database) yeşil olmalı.
- Derleme ERROR verirse Production önceki dağıtımda kalır; geri alma gerekmez.

**B4 · Smoke test**
- §7, "M-önce" sütunu.

### C · Migration

- **C1:** 01 tekrar çalıştırılır. A2 ile aynı olmalı; 11. satırdaki kilit sayısı hariç.
- **C2 (O-5 ile):** `03_apply.sql` SQL Editor'de **tek sorgu** olarak çalıştırılır.
  - Beklenen sonuç: COMMIT ve şu üç satır: `KARAYS` / `'KARAYS'::text` / `20261018000001`.
- **C3:** `04_postflight.sql` 6/6 TAMAM vermeli. Ardından `supabase/ops/postflight_v2.sql`: HATA yok, 27. satır TAMAM.
- **C4:** §7, "M-sonra" sütunu.

### D · İzleme

- İlk 30 dakika: Vercel Logs'ta `"level":"error"` aranır, `/api/health` takip edilir.
- Ardından 24 saat izlenir.

## 5. Kanıt (yerel prova)

### Runbook — `supabase/ops/karays_brand/`

| Dosya | İşi | Yazar mı |
| --- | --- | --- |
| `01_preflight.sql` | 12 satırlık ön kontrol: DUR / TAMAM / BİLGİ / KAYDET | Hayır (tek SELECT) |
| `02_rollback_script.sql` | O veritabanına özgü, birebir geri dönüş betiği üretir | Hayır (tek SELECT) |
| `03_apply.sql` | Migration gövdesi birebir; tek işlem; `lock_timeout` 5 sn; eski şemada durur; işlem içi kontrol | **Evet** |
| `04_postflight.sql` | 6 kontrol | Hayır |
| `05_rollback.sql` | Genel geri dönüş. Korumalı; migration uygulanmamışsa reddeder | **Evet** |

Birim testi **LR-10** şunları denetler:
- 03'ün gövdesi migration dosyasıyla aynı.
- Okuyan betikler tek SELECT.
- Yazan betikler tek işlem.

### Prova sonuçları

İki ortamda prova yapıldı (19.10.2026 ve 24.10.2026):
- Yerel PostgreSQL 16'da tam şemalı kopya. Başlangıç Production'da beklenen durum: şema `20261011000001`, `company_name` KARAY.
- Migration dosyalarından birebir kurulan bir sahne.

| Senaryo | Sonuç |
| --- | --- |
| 01 (salt okunur oturum) | 12 satır, DUR yok |
| 03 gövdesi ↔ migration dosyası | Birebir |
| 03 | 68–114 ms; işlem içi kontrol geçti |
| 04 | 6/6 TAMAM |
| `postflight_v2.sql` (tam şema) | Önce yalnızca 27. satır HATA (beklenen). Sonra 23 TAMAM, 4 KARŞILAŞTIR, 0 HATA |
| 03 ikinci kez | Değişiklik yok |
| 02'nin ürettiği betik / 05 | Ön kontrol çıktısı ve 72 tablonun parmak izi başlangıçla birebir |
| 05, uygulanmamış veritabanında | DUR; hiçbir şey değişmez |
| Elle girilmiş ad | Uygulama ve geri dönüş ada dokunmaz |
| Tabloyu okuyan açık işlem varken | 5 sn'de "lock timeout" ile tamamen geri alındı |
| Eski şema (20261005000001) | DUR |

### Uyumluluk

Gerçek build'ler yerel yığında çalıştırıldı. `/karay` ISR'ı yerel önizleme kimliğiyle anında yenilendi.

| Kod | Veritabanı | `/karay` | Alt bilgi + JSON-LD | `/api/health` | `/platform/giris` | Kiracı `/` |
| --- | --- | --- | --- | --- | --- | --- |
| Yeni | Migration öncesi | 200 | KARAY | ok | 200 | 200 |
| Yeni | Migration sonrası | 200 | KARAYS | ok | 200 | 200 |
| Eski (ff2f7da) | Migration öncesi | 200 | KARAY | ok | 200 | 200 |
| Eski (ff2f7da) | Migration sonrası | 200 | KARAYS | ok | 200 | 200 |

**Sonuç:** Kod ve veritabanı birbirinden bağımsız ileri veya geri alınabilir.

## 6. Geri dönüş

### Karar tablosu

| Belirti | Uygulama | Veritabanı |
| --- | --- | --- |
| Derleme ERROR | Bir şey yapılmaz | Dokunulmaz |
| Dağıtım READY ama kritik hata | **R-A** | Gerekmez (eski kod yeni veritabanıyla çalışır) |
| 03 hata verdi | Değişmez | Otomatik geri alındı; 01 tekrar → A2 ile aynı |
| Migration sonrası beklenmeyen durum | Değişmez | **R-B** |
| Veri bozulması (bu migration için beklenmez) | Gerekirse R-A | **R-D** |

### Prosedürler

**R-A · Uygulama**
- Vercel › Deployments › önceki Production dağıtımı (ff2f7da) › **Instant Rollback** (veya Promote).
- Veritabanı geri alınmaz.
- Production dalı yeni commit'i göstermeye devam eder. Kalıcı geri dönüş force-push ile değil, `git revert` commit'iyle yapılır (ayrı onay).

**R-B · Migration**
- A3'te üretilen betik çalıştırılır. Yoksa `05_rollback.sql`: yalnızca A2'de 3., 5. ve 6. satırlar beklenen değerlerdeyse (`20261011000001`, `KARAY`, `'KARAY'::text`); değilse dosyadaki üç sabit A2'ye göre düzenlenir.
- Ardından 01 tekrar çalıştırılır. 3, 5, 6, 8 ve 9. satırlar A2 çıktısıyla aynı olmalı.

**R-D · Felaket**
- Yedek **yeni** bir projeye yüklenir; canlının üstüne yüklenmez ([BACKUP_RESTORE.md](BACKUP_RESTORE.md), PHASE2 §3.4).
- Vercel ortam değişkenleri yeni projeye çevrilir.
- Tüm oturumlar düşer. Yedek anından sonra girilen veri kaybolur.

## 7. Production sonrası smoke testleri

**Kapsam:**
- `<adres>`: Vercel production alan adı.
- Testler gizli pencerede (oturumsuz), masaüstü ve telefon genişliğinde yapılır.

**Sütunlar:**
- **M-önce:** Deploy sonrası, migration öncesi.
- **M-sonra:** Migration sonrası.

| # | Kontrol | Beklenen | M-önce | M-sonra |
| --- | --- | --- | --- | --- |
| S1 | `<adres>/api/health` | 200; `"status":"ok","db":"ok"` | ✓ | ✓ |
| S2 | `<adres>/` (kiracı) | 200. Kiracı markası değişmemiş. Kaynakta `/brand/karays/` ve `data-platform-brand` yok | ✓ | ✓ |
| S3 | `<adres>/karay` | 200; başlıkta ve üstteki logoda KARAYS | ✓ | ✓ |
| S4 | `/karay` alt bilgisi ve JSON-LD | M-önce: "© 2026 KARAY · Gayrimenkul Teknolojileri". M-sonra: "KARAYS". JSON-LD Organization `logo` = `/brand/karays/karays-icon-512.png` | KARAY | KARAYS |
| S5 | **Favicon:** `/karay` ve `/platform/giris` sayfalarındaki her `link[rel=icon]` ve `apple-touch-icon` | 200 ve `image/*`: `/brand/karays/favicon.ico`, `-192.png`, `-180.png` | ✓ | ✓ |
| S6 | **OG görseli** | `og:image` ve `twitter:image` → `/karay/og-karays.png`; 1200×630; 200 `image/png` | ✓ | ✓ |
| S7 | **Giriş logosu:** `/platform/giris` (oturumsuz) | `alt="KARAYS"` logo görünür ve yüklenir (kırık görsel yok) | ✓ | ✓ |
| S8 | KARO (giriş sayfası) | ≥1024 px'te görünür, 390 px'te gizli | ✓ | ✓ |
| S9 | KARO (`/karay` hero) | Masaüstünde bir kez oynar ve sabit poza döner. "Hareketi azalt" açıkken ve telefonda animasyon dosyası indirilmez. Kırpılmaz, kayma yok | ✓ | ✓ |
| S10 | Yardımcı maskot: `/karay#iletisim` | İletişim formunun yanında; `alt=""` | ✓ | ✓ |
| S11 | Yardımcı maskot: konsol `/platform/talepler?durum=kapali` (süper admin) | Kapalı talep yoksa boş durumda görünür; varsa görünmez | ✓ | ✓ |
| S12 | Eski yollar | `/karay/og-karay.png` 404; `/platform/favicon.svg` sunulmaz | ✓ | ✓ |
| S13 | `/admin/giris` | 200; ofis markası; KARAYS maskotları yok | ✓ | ✓ |
| S14 | Vercel Logs (30 dk) | Yeni `error` kaydı yok | ✓ | ✓ |
