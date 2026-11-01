# PR #3 · Gece yedeği iş akışı + production CI onarımı — kontrollü hazırlık

> 01.11.2026 · PR #3 **taslak**. Merge YOK, production push YOK (production `650fd4e`), migration ve canlı veri değişikliği YOK.
> `npm audit`, veritabanı ve E2E testleri bastırılmadı.

## 1. Neden

| Sorun | Kanıt |
| --- | --- |
| Gece yedeği varsayılan daldaki **eski** iş akışıyla çalışıyor ve düşüyor | Backup #46 (zamanlanmış, `ff2f7da`): PG 16.15 istemcisi, sunucu PG 17.6. Elle, çalışma dalından #45 ve #47 yeşil |
| Production'ın CI'ı E2E hazırlığında düşüyor | CI #129 (push) / #130 (PR #2 pull_request), `650fd4e`: `.env.local: line 12: syntax error near unexpected token 'newline'` — `EMAIL_FROM=KARAY CI <davet@example.test>` tırnaksız yazılıyor, bash `<`'yi yönlendirme sanıyor |

## 2. PR #3 dalının yeni hâli (`claude/backup-workflow-default-branch`, zorla push yok)

```
ff2f7da ── fb74b82  yedek iş akışı + betikler + testleri (önceki PR #3)
   └── 650fd4e (production, O-4 A) ──┐
                                      c2d0ef3  merge: production 650fd4e → PR #3 dalı (çakışma yok)
                                      fea4e01  CI onarımı
```
- **Taban = bugünkü production `650fd4e`.** PR'ın production'a göre farkı yalnız: yedek iş akışı, `backup-db.sh`, `rclone-log-summary.sh`,
  `backup_fingerprint.sql`, `backup_table_counts.sql`, iki birim testi (yedek değişiklikleri) + `elvankent-ci.yml` ve `playwright.config.ts` (CI onarımı).
  Uygulama kodu, migration, `vercel.json` değişmez. Merge edilirse production'a fast-forward olur (`650fd4e` atasıdır).
- Yedek dosyaları, canlıda yeşil çalışan çalışma dalı sürümüyle **birebir aynı** (Backup #45/#47; `da7cfca` BACKUP_ önekli rclone değişkenleri dahil).

### CI onarımı (`fea4e01`) — yalnız CI/test yapılandırması, hepsi çalışma dalında önceden kanıtlanmış
| Değişiklik | Kaynak |
| --- | --- |
| `.env.local` her değer tek tırnakla (`env_line`), ardından bash ile okunabilirlik denetimi | K-11 |
| E2E ortamı: `SITE_ENV=demo`, test yöneticisi `--super-admin` (testlerin beklediği) | K-10 |
| `playwright.config.ts`: `use.channel 'chromium'` (Headless Shell Secure önizleme çerezlerini reddediyordu); masaüstü logo fixture'ı E2E'den önce üretilir | `a052a7e` (K-14) |
| `runs-on: ubuntu-24.04`, Supabase CLI `2.121.0` (kayan `latest` yerine) | LR-09 / K-16 |

## 3. Doğrulama sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Yerel (PR #3 ağacı): `npm ci`, typecheck, ESLint (0 hata; 3 uyarı production'da zaten var), birim **406/406**, `npm audit --omit=dev --audit-level=high` **0 açık** | ✓ |
| [CI #133](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41302169798) (push, `fea4e01`) · quality (typecheck, lint, birim, build, **npm audit**, gitleaks) | ✓ |
| CI #133 · database: yerel Supabase + migration'lar, **birim + RLS/MFA/kiracı izolasyonu** | ✓ |
| CI #133 · E2E hazırlık (`.env.local` hatası **giderildi**), build, sunucu | ✓ |
| CI #133 · Playwright E2E | **183 geçti, 1 başarısız (KARAY-01)**, 4 atlandı, 17 çalışmadı |
| [CI #134](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41302173738) (pull_request, aynı commit) | aynı: 183 / 1 / 4 / 17 |

**KARAY-01** (`/karay` sayfasında 2 kırık ekran görüntüsü, `public/karay/*.png`): production'da **zaten var olan** ürün hatası; `ff2f7da` ve
`650fd4e`'de aynı (o4-onkontrol #1). PR #3 bu yola dokunmaz. Çalışma dalında görseller `src/app/karay/_images/` altına statik import
olarak taşınarak (ve platform logoları `09e935b` ile `public/brand/karay/`'e) düzeltildi — **uygulama kodu**, PR #3 kapsamında değil.
**"17 çalışmadı":** `karay-site.spec.ts` seri çalışır; KARAY-01 düşünce aynı dosyadaki KARAY-02…18 koşmaz. Bu testlerin production
kodunda bugün doğrulanmamış olması ayrı bir kapsama boşluğudur.

## 4. Karar (ilk tur, `fea4e01`): PR #3 — HAZIR DEĞİL (CI kırmızı; neden PR'ın kendisi değil) → §5'te A ile giderildi

Yedek değişikliği ve CI onarımı hazır ve doğrulandı. Ancak "her birleştirme yeşil CI ile" kuralına göre PR #3 CI'ı, production'da zaten
var olan KARAY-01 yüzünden kırmızı. Test bastırılmadı, atlanmadı.

**Seçenekler (sahip kararı):**
- **A (önerilen, temiz):** KARAY-01 için ayrı, küçük bir düzeltme (yalnız `/karay` görselleri ve platform logoları; çalışma dalındaki
  `09e935b` + statik import değişikliği) → kendi CI'ı ve onayıyla production'a → PR #3 o tabanın üstüne alınır → CI yeşil → merge.
  Uygulama kodu değiştiği için ayrı yazılı onay ve kısa bir yayın kontrolü gerekir.
- **B (en hızlı yedek):** PR #3'ü, KARAY-01'in tek ve önceden var olan başarısızlık olduğunu yazılı kabul ederek merge etmek
  (bastırma değil; istisna kaydı). Production uygulaması değişmez; gece yedeği o gece varsayılan daldan çalışır.
- Her iki durumda da A/B kararına kadar: gerektiğinde çalışma dalından elle yedek (#47 gibi). Gece zamanlanmış yedek düşmeye devam eder.

**Birleştirme sırası (onaydan sonra):** (A ise önce KARAY-01 düzeltmesi) → PR #3 CI yeşil (ya da B istisnası) → sahip onayı → PR #3
"Ready for review" → merge (fast-forward) → Vercel yeniden dağıtır (uygulama kodu aynı; sağlık kontrolü `elvankent-uretim-saglik`) →
ilk gece yedeği 01:23 UTC varsayılan daldan **yeşil** olmalı.

## 5. A seçeneği uygulandı (01.11.2026, K-30) — sahip onayı: "A seçeneği onaylandı (teknik hazırlık için)"

### 5.1 KARAY-01 düzeltmesi — ayrı dal `claude/karay01-duzeltme` (PR #3'ten bağımsız; production'a push YOK)
```
650fd4e (production) ── 30c038a  CI onarımı (fea4e01 ile aynı içerik; production CI'ının .env.local hatası burada da giderildi)
                     ── 74013a5  fix(karay): KARAY-01
```
- **Kök neden:** proxy `matcher`'ı `/karay/:path*` ve `/platform/:path*` yollarını uzantıdan bağımsız yakalar (SURF-10, bilerek).
  `/karay/ekran-*.png` görsel iyileştiricinin iç isteğinde 404 aldı (KARAY-01'in yakaladığı 2 kırık ekran görüntüsü);
  `/platform/*.svg|png|ico` oturumsuz ziyaretçide giriş sayfasına yönlendi (logo ve simgeler).
- **Düzeltme (B sürümündeki hazır düzeltmeler, marka KARAY olarak kaldı):** iki ekran görüntüsü `src/app/karay/_images/`'e taşındı ve
  statik import edildi (P3-F1; baytlar aynı); platform marka dosyaları değişmeden `public/brand/karay/`'e taşındı, yollar
  `PLATFORM_BRAND`'de (`09e935b` çakışmasız cherry-pick, testleriyle). Proxy kuralı değişmedi. Migration, başka özellik yok.
- **Değişen dosyalar (74013a5):** `src/app/karay/page.tsx`, `src/platform/branding/platform-brand.ts`, 9 marka dosyası
  (`public/platform/` → `public/brand/karay/`, içerik aynı), 2 ekran görüntüsü (`public/karay/` → `src/app/karay/_images/`, içerik aynı),
  testler: `tests/e2e/karay-site.spec.ts` (KARAY-01 tüm görseller + simgeler, yeni KARAY-19), `karay-branding.spec.ts`
  (TEST-KARAY-01/06), `owner-separation.spec.ts` (TEST-OWNER-08), yeni `tests/unit/platform-brand-assets.test.mjs`.
- **Doğrulama:** yerel typecheck ✓, ESLint 0 hata, birim 391/391, build ✓, `npm audit` 0. [CI #136](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41306682162)
  (`74013a5`) **yeşil**: quality (audit dahil) ✓; database: birim 391/391, RLS/MFA/kiracı 105/105, E2E hazırlık ✓ (`.env.local`),
  **E2E 202 geçti, 0 başarısız**, 4 atlandı (önceki koşularla aynı tasarım gereği atlananlar), çalışmayan yok — KARAY-01, KARAY-02…18
  ve KARAY-19 dahil.

### 5.2 PR #3 güncel taban üzerinde (`claude/backup-workflow-default-branch`, taslak; zorla push yok)
`a0f0a67` = PR #3 dalı + KARAY-01 dalının merge'ü (çakışmasız; iki CI onarımı commit'i aynı içerik). PR'ın KARAY-01 dalına göre farkı
**yalnız yedek değişiklikleri** (7 dosya). Yerel birim 409/409, ESLint 0 hata. CI: [#137](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41308555131) (push) ve [#138](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/41308559532) (pull_request) **yeşil**: quality (typecheck, ESLint, birim, build, `npm audit`, gitleaks) ✓; database: birim 409/409, RLS/MFA/kiracı 105/105, E2E **202 geçti, 0 başarısız**, 4 atlandı. **PR #3: MERGE'E HAZIR** (KARAY-01 yayınından sonra; ayrı onayla).

### 5.3 Onay sırası (her biri ayrı yazılı onay)
1. **KARAY-01 yayını:** production `650fd4e` → `74013a5` (fast-forward; `30c038a` CI onarımı + `74013a5`). Uygulama değişikliği yalnız
   `/karay` görselleri ve platform logo yolları. Sonra `elvankent-uretim-saglik` + `/karay` ve `/platform/giris` gözle kontrol.
2. **PR #3 merge:** production `74013a5` → `a0f0a67` (fast-forward). Uygulama kodu değişmez; ilk gece yedeği 01:23 UTC varsayılan daldan yeşil olmalı.
Arada: gece yedeği düşmeye devam eder → çalışma dalından elle yedek (Backup #47 yöntemi).
