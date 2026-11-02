# O-4 · Yalnız güvenlik yaması yayını — son kontroller ve uygulama kontrol listesi

> 01.11.2026 · Hazırlık belgesi. **Yayın yapılmadı.** Production `ff2f7da`, PR #3 taslak; merge, production push ve migration yok.
> Gerçek yayın sahibin ayrı **yazılı** onayıyla yapılır ("O-4 A onaylıyorum"). Yayın commit'i: **`650fd4e`**
> (dal `claude/karays-guvenlik-yamasi`; üstündeki hazırlık commit'i `913b7c0` production'a GİTMEZ).

## 1. Son kontrollerin sonucu

**Karar: YAYINA HAZIR (teknik).** Tüm otomatik kontroller yeşil; yama kaynaklı gerileme yok. Yayın, §4 A1 (manuel yedek)
ve A2 (Vercel'de production'ın `ff2f7da` olduğunun ve Node sürümünün panelde teyidi) tamamlanıp sahip yazılı onay verince yapılır.

| # | Kontrol | Kanıt | Sonuç |
| --- | --- | --- | --- |
| 1 | Yayın commit'i Node **22** | [elvankent-o4-onkontrol #1](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41294282197) `node-22`: sürüm denetimi, npm ci, typecheck, ESLint, birim **388/388** (SP-01…06 dahil), build, `npm audit` (yüksek/kritik, bastırma yok), RLS/MFA/kiracı izolasyonu **105/105** | ✓ |
| 1 | Yayın commit'i Node **24** | aynı koşu `node-24` (Node 24.22.1, npm 11.19.1): birim **388/388**, Next.js **16.4.3** build, `npm audit` **0 açık**, RLS/MFA/kiracı **105/105** | ✓ |
| 2 | E2E, eski test düzeneği | [o4-hazirlik #1](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41289097024): taban 205 / 8 başarısız, aday 205 / 8; hata mesajları ve satırları **birebir aynı**; yeni 0 | ✓ |
| 2 | E2E, düzeltilmiş test düzeneği (uygulama kodu aynen) | o4-onkontrol #1 `compare`: taban **205 / 1**, aday **205 / 1** (yalnız KARAY-01); yeni 0, düzelen 0 | ✓ |
| 3 | Production ↔ yayın commit'i farkı | §3 | ✓ (Vercel panel teyidi A2'de) |
| — | Çalışma dalı CI | [#127](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41294282135) `cea98cf` yeşil (quality, database, database-legacy-schema) | ✓ |
| — | Yerel | ff2f7da ↔ 650fd4e kilit dosyası farkı, `npm audit` A + PR #3 = 0 açık (K-25), birim 711/711 | ✓ |

## 2. Mevcut 8 E2E başarısızlığının sınıflandırması

Kaynak: `elvankent-o4-hazirlik` #1 (eski test düzeneğiyle) taban ve aday günlükleri — hata mesajları ve satırları **birebir aynı**;
ve `elvankent-o4-onkontrol` (düzeltilmiş test düzeneğiyle, uygulama kodu aynen).

| # | Test | Hata (iki kolda aynı) | Sınıf | Neden | Düzeltildiği yer | Yama ile ilgisi |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | TEST-KARAY-09 | "ÖNİZLEME" şeridi yok | **Test düzeneği** | Headless Shell, `http://*.e2e.test` test alan adlarında **Secure** önizleme çerezlerini (`eg_site_preview`, `__prerender_bypass`) reddediyor; önizleme hiç açılmıyor | `a052a7e` (K-14, yalnız `playwright.config.ts`) | Yok |
| 2 | LC-4 | "ÖNİZLEME" şeridi yok | Test düzeneği | aynı | aynı | Yok |
| 3 | OFS-01 | "ÖNİZLEME" şeridi yok | Test düzeneği | aynı | aynı | Yok |
| 4 | TEST-SITE-02 | "ÖNİZLEME" şeridi yok | Test düzeneği | aynı | aynı | Yok |
| 5 | SF-02 | "ÖNİZLEME" şeridi yok | Test düzeneği | aynı | aynı | Yok |
| 6 | SEO-A | önizleme başlığı taslak değil canlı ("Eski SEO …") | Test düzeneği | aynı (önizleme kipi açılmadığı için canlı başlık okunuyor) | aynı | Yok |
| 7 | OBR-A | `ENOENT … tests/e2e/.fixtures/kabul-logo.png` | **Test düzeneği** | Logo dosyasını yalnız **mobil** projede koşan `acceptance.spec` üretiyor; masaüstü OBR-A ona bağımlı | `a052a7e` (test, dosyayı kendi üretir) | Yok |
| 8 | KARAY-01 | `/karay` sayfasında 4 kırık görsel | **Ürün hatası (canlıda var)** | `public/platform/` altındaki logolar `/platform/*` konsol rotasına düşüyor; oturumsuz ziyaretçi görsel yerine giriş sayfasına yönleniyor (platform giriş sayfası da etkileniyor) | `09e935b` (K-15, B sürümünde) | Yok (yama `processing.ts` ve bağımlılıklar; bu yol değişmedi) |

**Kanıt:** test düzeneği düzeltilmiş koşuda (yalnız `channel: 'chromium'` + önceden üretilen fixture; iş akışı başka dosya değişmediğini
denetler) 1–7 **hem tabanda hem adayda geçti**, yalnız 8 kaldı (iki kolda). Yani 1–7 canlıdaki ürün hatası **değil**; gerçek tarayıcıda
önizleme çalışır (yayın günü D5'te gözle teyit). Bu, K19 §3'teki "8'i de canlıda var" ifadesini düzeltir: canlıda var olan **1** (KARAY-01).
**Yama kaynaklı yeni gerileme: yok** (iki düzenekte de aday = taban).

## 3. `ff2f7da` (production) ↔ `650fd4e` (yayın commit'i) farkı — yeniden doğrulandı

| Denetim | Sonuç |
| --- | --- |
| Production'daki commit | GitHub dağıtım kaydı (vercel[bot], ortam "Production – mustafakara-0-7hh3"): son production dağıtımı **`ff2f7da`**, 11.10.2026, durum **success**; sonrasında production dağıtımı yok. Vercel API'si bu oturumda proje listesini gösteriyor, dağıtım listesini **403** ile reddediyor (takım kapsamı yetkisi yok) → Instant Rollback / elle "Promote" ile yapılmış bir değişiklik GitHub kaydına düşmez; **sahip panelde teyit eder** (§4 A2) |
| Ebeveyn / ağaç | `650fd4e`'nin tek ebeveyni `ff2f7da`; ağaç `29f81af` (README'deki beklenen) |
| Değişen dosyalar | Yalnız 4: `package.json`, `package-lock.json`, `src/modules/media/processing.ts`, `tests/unit/security-patch.test.mjs` |
| Paketler (lockfile, 39 kayıt) | `next` ve `@next/*` 16.3.6 → **16.4.3**; `sharp` ve `@img/*` 0.35.4 → **0.35.5** (libvips 1.3.3 → 1.3.4); `zod` 4.6.5 → **4.6.7**; `source-map-js` 1.2.1 → 1.2.2. Başka paket değişmedi |
| Kod | `processing.ts`: görsel çözücüye yalnız JPEG, PNG, WebP, HEIF/AVIF imzaları ulaşır; SVG/XML, GIF, TIFF çözülmeden reddedilir (librsvg açığı GHSA-wq5f-xc86-pv6w yolu kapanır). Kabul edilen biçimler aynı; tek kullanıcı farkı: "<" ile başlayan geçersiz içerik "desteklenmeyen format" mesajı alır |
| Değişmeyenler | `supabase/` (migration yok), `vercel.json`, `next.config.ts`, iş akışları, ortam değişkenleri, veritabanı |

## 4. Uygulama kontrol listesi (yayın günü; sırayla)

**Roller:** S = sahip (panel, onay), C = Claude (yalnız yazılı onaydan sonra push ve izleme). Süre: ~60 dk.

### A. Yayından önce (T−30 dk)
- [ ] **A1 · Manuel yedek (S):** GitHub › Actions › **elvankent-backup** › *Run workflow* › "Use workflow from": **`claude/karays-mission-control-vn8g65`** (varsayılan daldaki eski iş akışı PG 16.15 ile çalışır ve PG 17.6 sunucuda düşer — Backup #46) › Run. Yeşil bitmeli (Backup #45 gibi); koşu numarası ve `db-<STAMP>` not edilir.
- [ ] **A2 · Vercel teyidi (S):** Vercel › proje **mustafakara-0-7hh3** › Deployments: "Current" production dağıtımı commit **`ff2f7da`** olmalı. Bu dağıtımın adını/ID'sini not edin — **geri dönüş hedefi** budur. Settings › General › Node.js Version: **22.x veya 24.x** olmalı (yayın commit'i ikisinde de doğrulandı). Ortam değişkenlerine dokunulmaz.
- [ ] **A3 · Taban sağlık (S veya C):** canlı `/api/health` → 200. Ana sayfa ve bir ilan sayfası açılıyor (yayın sonrası karşılaştırma için).
- [ ] **A4 · Yazılı onay (S):** "O-4 A onaylıyorum".

### B. Yayın (T0, C)
- [ ] **B1:** `git fetch origin && git merge-base --is-ancestor ff2f7da 650fd4e` (fast-forward mümkün) ve production dalı hâlâ `ff2f7da` (`git ls-remote`). Değilse DUR.
- [ ] **B2:** `git push origin 650fd4e:claude/elvankent-real-estate-platform-vxq9dj` (**zorla push yok**; yalnız yayın commit'i — hazırlık commit'i `913b7c0` gitmez).
- [ ] **B3:** Vercel production derlemesi başlar; günlükte Next.js **16.4.3**, derleme **Ready**. Derleme düşerse: hiçbir şey yapılmaz, canlı `ff2f7da`'da kalır (Vercel başarısız derlemeyi yayınlamaz); production dalı sonra `ff2f7da`'ya geri alınır (ayrı onay).

### C. Sağlık kontrolü (T+0…10 dk)
- [ ] **C1:** `/api/health` → **200**.
- [ ] **C2:** Vercel › Deployments: yeni production dağıtımı commit `650fd4e`, durum Ready, "Current".
- [ ] **C3:** Vercel › Logs / Runtime errors: yayından sonra yeni 5xx yok.

### D. Temel kullanıcı senaryoları (T+10…30 dk; gerçek müşteri verisi DEĞİŞTİRİLMEZ)
- [ ] **D1 Ziyaretçi:** ana sayfa, ilan listesi (filtre), bir ilan ayrıntısı ve fotoğraf galerisi açılıyor; görseller yükleniyor.
- [ ] **D2 Giriş:** yönetici paneline giriş (MFA açıksa doğrulama kodu dahil); çıkış.
- [ ] **D3 Görsel yükleme (yamanın dokunduğu yol):** panelde **taslak/test** bir ilanda JPG yükle → kabul; PNG/WebP → kabul; bir **SVG** dosyası → "Bu dosya desteklenmeyen bir formatta…" ile **reddedilmeli** (beklenen yeni davranış). Test görselini sonra silin.
- [ ] **D4 İletişim formu:** yalnız kendi test bilgilerinizle (ad "O-4 test") bir talep → panelde görünür; sonra silin/arşivleyin.
- [ ] **D5 Önizleme:** panelde site önizlemesi "ÖNİZLEME" şeridiyle açılır (gerçek tarayıcı; §2'ye göre çalışması beklenir).
- Bilinen, yayından ÖNCE de var olan: `/karay` ve platform giriş sayfasında anonim ziyaretçide kırık logolar (§2, KARAY-01) — **gerileme sayılmaz**, B sürümüyle kapanır.

### E. Geri dönüş (Instant Rollback) — ölçüt ve adımlar
**Ölçüt (herhangi biri):** C1 başarısız · C3'te yeni ve süren 5xx · D1/D2/D3'ten biri yayın öncesine göre bozuk.
- [ ] **E1 (S, ~1 dk):** Vercel › Deployments › A2'de not edilen **`ff2f7da`** dağıtımı › ⋯ › **Instant Rollback**. Veritabanı değişmediği için geri dönüş yalnız koddur; veri kaybı yok.
- [ ] **E2:** `/api/health` 200 ve D1 tekrar.
- [ ] **E3 (not):** Instant Rollback sonrası Vercel yeni production dağıtımlarını otomatik atamaz ("Undo Rollback"a kadar). Production dalı `650fd4e`'de kalır; dalın geri alınması (yeni commit, zorla push yok) ayrı onaydır.

### F. Kayıt (C)
- [ ] Yedek koşu no, dağıtım ID'si, saatler, C/D sonuçları → `GELISTIRME_GUNLUGU.md`; KALAN_ISLER KI-26 "kapandı" (ancak C ve D temizse).

## 5. PR #3 (gece yedeği iş akışı) — yamadan SONRA güvenli birleştirme sırası (korunuyor)

1. O-4 yayını (§4) tamamlanır ve D temiz çıkar; 24 saat gözlem önerilir.
2. PR #3 dalı **yayın commit'i `650fd4e`'nin** üstüne yeniden kurulur (yeni dal ya da yeni commit; zorla push yok). Taban `ff2f7da` iken PR #3'ün CI'ı `npm audit`'te kırmızıdır (production'daki eski next/sharp) — **bastırılmaz**; A'nın üstünde temizdir (yerelde 0 açık, `elvankent-o4-onkontrol` her iki Node'da audit yeşil).
3. PR #3 CI'ı yeşil → sahip onayı → merge (fast-forward). Uygulama kodu A ile aynı kalır; Vercel aynı kodu yeniden dağıtır (§4 C1–C3 kısa tekrar).
4. İlk zamanlanmış gece yedeği (01:23 UTC) varsayılan daldan **yeşil** olmalı (Backup #46'nın PG 16 hatası kapanır).
**Arada (PR #3 merge edilene kadar):** varsayılan daldaki gece yedeği düşmeye devam eder (#46 gibi) → gerekirse A1'deki gibi çalışma dalından **elle** yedek alınır.
