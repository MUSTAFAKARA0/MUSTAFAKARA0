# KARAY — Faz 3: Güvenlik yamaları ve yedekleme güvencesi

> **Tarih:** 11.10.2026
> **Başlangıç:** `ff2f7da`. Dal `claude/elvankent-real-estate-platform-vxq9dj`, origin ile aynı; çalışma ağacı temizdi, kullanıcı değişikliği yoktu.
> **Kapsam:** Yalnızca güvenlik yamaları, bağımlılık doğrulaması ve yedekleme / geri yükleme güvenilirliği. Yeni ödeme, abonelik, CRM, AI, tema veya müşteri özelliği **yok**.
> **Production:** Veritabanı, Vercel, DNS, gerçek Supabase projesi, gerçek müşteri verisi ve production ortam değişkenleri **değiştirilmedi**. Depo görünürlüğü, varsayılan dal ve koruma kuralları **değiştirilmedi**. CSP ve oturum çerezlerine dokunulmadı.
> **Gizli değerler:** Belgede yok; yalnızca değişken **adları** geçer.
> **Push:** **Yapılmadı.** Bu daldaki her push Vercel'de bir **Production** dağıtımı oluşturuyor (§8). Değişiklikler tek bir yerel commit'tedir.
> **Önceki belgeler:** [PHASE2_PRODUCTION_PREFLIGHT.md](PHASE2_PRODUCTION_PREFLIGHT.md) (PF-01, PF-02, PF-11, SEC-03, SEC-05, SEC-06) ve [PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md) (D-14, D-15, D-16).

## 0. Sonuç

| Alan | Durum | Özet |
| --- | --- | --- |
| Güvenlik yamaları | **Tamam (yerel)** | `next` 16.3.6 → **16.3.8**, `sharp` 0.35.4 → **0.35.5** (libvips 8.18.7, librsvg 2.63.2), `source-map-js` 1.2.1 → **1.2.2**. `npm audit --omit=dev --audit-level=high`: **0 açık** (önce 3 yüksek). İlan fotoğrafı yolunda SVG, GIF ve TIFF artık çözücüye (libvips/librsvg) hiç ulaşmıyor. |
| Test ve güvenlik kapısı | **Yerelde yeşil. GitHub CI bu değişikliklerle çalışmadı.** | Birim 407/407, RLS 105/105, E2E 201 geçti / 4 atlandı (tasarım gereği) / 0 başarısız. Typecheck 0, lint 0 hata (3 eski uyarı), build tamam (rota tablosu aynı), gitleaks temiz. 30 mutasyonun 30'u testlerce yakalandı. CI'daki veritabanı işi bir değişken kapalı olduğu için hiç çalışmadı (§3.6). |
| Yedekleme ve geri yükleme | **Kod ve yerel tatbikat tamam. Production'da yedek hâlâ kapalı.** | 14/14 atlanmanın nedeni `ELVANKENT_BACKUP_ENABLED` değişkeni; artık sessiz atlama yok, her çalışmada uyarı çıkar. Yeni `scripts/backup-db.sh`, dump, parmak izi, tablo sayıları ve SHA-256 özetini tek bir anlık görüntüden üretir. Yerelde ayrı bir geçici veritabanına geri yükleme yapıldı: parmak izi **17/17**, tablo sayıları **71/71**, son kontrolde 0 HATA. Yazma sürerken, bozuk dosyayla ve kurcalanmış özetle yapılan denemelerin hepsi yakalandı. Tatbikat yedek betiklerinde 2 gerçek hata buldu; ikisi de commit'ten önce düzeltildi. |
| Push | **Yapılmadı** | Push = Production dağıtımı. Kurallar gereği commit'te durdum (§8). |

---

## 1. Başlangıç doğrulaması

### 1.1 Depo

| Kontrol | Bulunan |
| --- | --- |
| Dal / HEAD / uzak | `claude/elvankent-real-estate-platform-vxq9dj` · `ff2f7da` = `origin` (commit öncesi `git fetch` ile yeniden doğrulandı) |
| Çalışma ağacı | Başlangıçta temiz; üzerine yazılacak kullanıcı değişikliği yoktu |
| Varsayılan dal / görünürlük | Bu dal varsayılan dal; depo **public** (GitHub API) |
| Açık PR | [PR #2](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/pull/2) — head bu dal, base `claude/photo-to-stl-app-rxbvev` |

### 1.2 Temel değerler (yükseltmeden önce bu konteynerde yeniden üretildi)

| Kontrol | Faz 1 kaydı (`6055693`) | Faz 3 başlangıcı (`ff2f7da`, next 16.3.6) |
| --- | --- | --- |
| Birim | 366/366 | **366/366** (97 grup) |
| RLS | 105/105 | **105/105** |
| E2E | 201 geçti / 4 atlandı / 0 başarısız | **198 geçti / 1 başarısız / 4 atlandı / 2 çalışmadı.** Başarısız test OBR-A; onunla aynı seri bloktaki 2 test bu yüzden çalışmadı. |
| Typecheck / lint | 0 / 0 hata | 0 / 0 hata, 3 uyarı (`tests/e2e/karay-site.spec.ts:103`, kullanılmayan değişken; önceden de var) |
| Build / demo SQL | tamam / güncel | tamam / güncel |

**OBR-A başarısızlığının nedeni:** `page.goto('/iletisim', { waitUntil: 'networkidle' })` 240 sn'de bitmedi. İzde, önizlemedeki bağlantıların RSC ön yükleme istekleri açık kaldığı için ağ hiç "boşta" olmuyor. Aynı build'de test 3 kez yeniden koşuldu ve 3'ünde de geçti (`office-brand.spec.ts`, her seferinde 3/3). Yükseltmeden sonraki tam E2E'de de geçti. Hata kodda değil, zamanlamaya bağlı bir test kararsızlığı. Testi değiştirmek bu fazın kapsamı dışında kaldığı için düzeltilmedi; öneri §7'de.

### 1.3 CI neden kırmızı (gerçek workflow logları)

`ff2f7da` üzerindeki iki çalışma: [#78 push](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/38122512238) ve [#79 PR #2](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/38122514490).

| İş / adım | Sonuç | Neden |
| --- | --- | --- |
| `quality` 1–9 (kurulum, `npm ci`, TypeScript, ESLint, birim, demo SQL, build) | başarılı | — |
| `quality` 10: `npm audit --omit=dev --audit-level=high` | **başarısız** | 3 yüksek: `next` 16.0.0–16.3.7 (6 bildirim), `sharp` <0.35.5 (GHSA-wq5f-xc86-pv6w), `source-map-js` 1.0.0–1.2.1 (GHSA-68fv-2mgg-jv7q) |
| `quality` 11: gitleaks | **atlandı** | Önceki adım başarısız olduğu için |
| `database` (RLS + E2E) | **atlandı** | İş düzeyinde `if: vars.ELVANKENT_CI_DB_TESTS == 'true'`. Değişken tanımlı değil. Bu iş hiçbir sır kullanmıyor; Supabase'i iş içinde CLI ile yerel kuruyor. Bugüne kadar hiç çalışmadı. |
| Uyarı | — | "Node.js 20 is deprecated": `actions/checkout@v4` ve `actions/setup-node@v4` Node 24'te zorla çalıştırılıyor |

Bağımlılık taraması yerelde de aynı sonucu verdi (yükseltme öncesi `npm audit --omit=dev`: 3 yüksek).

---

## 2. A — Güvenlik yamaları

### 2.1 Sürümler

| Paket | Önce | Sonra | Not |
| --- | --- | --- | --- |
| `next` (doğrudan, tam sabit) | 16.3.6 | **16.3.8** | 16.3 serisindeki en küçük yamalı sürüm. `npm audit fix --force`, 16.4.0'a (bildirilen aralığın dışına) geçmeyi öneriyordu; uygulanmadı. |
| `@next/env`, `@next/swc-*` (dolaylı) | 16.3.6 | 16.3.8 | `next` ile birlikte |
| `sharp` (doğrudan) | ^0.35.4 → 0.35.4 | **^0.35.5 → 0.35.5** | |
| libvips / librsvg (sharp içinde) | 8.18.6 / 2.62.91 | **8.18.7 / 2.63.2** | `sharp.versions` ile doğrulandı |
| `@img/sharp-*` / `@img/sharp-libvips-*` | 0.35.4 / 1.3.3 | 0.35.5 / 1.3.4 | sharp'ın platform paketleri |
| `source-map-js` (dolaylı) | 1.2.1 | **1.2.2** | Kilit dosyasındaki tek kopya |

**Kilit dosyası:** 38 paket girdisi değişti. Bunların hepsi yukarıdaki paketler; diff yalnızca sürüm, `resolved` ve `integrity` satırlarından oluşuyor (164+/164−). `npm install --package-lock-only`, ilgisiz 6 `inBundle` girdisi de eklemek istedi (`@tailwindcss/oxide-wasm32-wasi`); bunlar alınmadı. `npm ci` ve `npm ls --all` hatasız. Toplu güncelleme yapılmadı: `eslint-config-next` 16.3.6'da kaldı.

### 2.2 Resmî bildirim koşulları ↔ kurulu sürüm ↔ KARAY'ın kod yolu

| Bildirim | Konu ve koşul | KARAY'da | Sonuç |
| --- | --- | --- | --- |
| GHSA-cjq9-62q9-8jv4 (next) | Görüntü optimizasyonunda SSRF; `images.remotePatterns` ile uzak görsel optimizasyonu açık | **Uygulanıyordu.** Desen `*.supabase.co` + `/storage/v1/object/public/**` | 16.3.8 ile kapandı. Joker desen ayrıca daraltılmalı mı: karar D-15 / SEC-06 (§6) |
| GHSA-wq5f-xc86-pv6w (sharp, CVE-2026-96889) | librsvg açığı; sharp'a SVG verilmesi | **Uygulanıyordu.** İlan fotoğrafı (`inspectImage`) ve logo (`branding.ts`) yollarında SVG çözülüyordu | 0.35.5 (librsvg 2.63.2) ile kapandı. İlan yolunda SVG artık çözücüye hiç gitmiyor (§2.4) |
| GHSA-mcj8-r9mp-w47p (next) | SSG/ISR önbellek zehirlenmesi; kök düzeyinde catch-all + SSG/ISR | Kök catch-all yok; yalnızca proxy yeniden yazmasıyla erişilen iç içe `t/[tenant]/[slug]/[...rest]` var | Koşul tam karşılanmıyor; yine de yamalandı |
| GHSA-4jqv-mc3x-m676 (next) | Self-hosted Pages Router'da SSG/ISR önbellek zehirlenmesi | Yalnızca App Router | Uygulanmıyor |
| GHSA-3w37-wq28-93x7 (next) | `use cache` dolumunda Draft Mode içeriği sızıyor | `draftMode` var, ama `use cache` / Cache Components kullanılmıyor | Uygulanmıyor |
| GHSA-f87g-xv8r-7p7x (next) | Metadata görüntü rotalarında `dynamicParams` atlatması (webpack) | Turbopack; `opengraph-image` / `icon` dosya rotası yok (OG ayrı route handler) | Uygulanmıyor |
| GHSA-39w2-rjm5-chcv (next) | `next dev` MCP uç noktasında bilgi sızması | Yalnızca geliştirme sunucusu | Production'da yok |
| GHSA-68fv-2mgg-jv7q (source-map-js) | Saldırganın verdiği source map ile olay döngüsü DoS | Yalnızca derleme zamanında, projenin kendi CSS'i için çalışır (§2.3) | Uygulanmıyor; yine de 1.2.2 |

### 2.3 `source-map-js` hangi bağımlılıktan, hangi aşamada?

`npm ls source-map-js --all`:
- `next@16.3.8 → postcss@8.5.23 → source-map-js` (production ağacı; CSS derlemesi, yani **build zamanı**);
- `@tailwindcss/postcss → @tailwindcss/node / postcss@8.5.28 → source-map-js` (geliştirme bağımlılığı, build zamanı).

Çalışma zamanında (`next start` / Vercel fonksiyonları) dışarıdan gelen bir source map ayrıştırılmıyor. Düzeltme için `overrides` gerekmedi: iki yol da 1.2.2'yi zaten kabul eden aralıklarla bağlı; kilit dosyasında tek kopya 1.2.2.

### 2.4 sharp ve SVG işleme yolları — kod değişikliği

`src/modules/media/processing.ts › inspectImage` dosyayı biçim kontrolünden **önce** sharp'a veriyordu. SVG, GIF ve TIFF çözüldükten sonra reddediliyordu; yani librsvg açığına ilan fotoğrafı yüklemesinden ulaşılabiliyordu (SEC-06, D-16).

**Değişiklik:** sharp çağrısından önce dosya imzası (ilk baytlar) denetleniyor. Çözücüye yalnızca JPEG, PNG, WebP ve HEIF/AVIF (`ftyp`) kapsayıcıları gidiyor (`DECODABLE` listesi).

| Girdi | Önce | Sonra |
| --- | --- | --- |
| JPEG / PNG / WebP / AVIF | kabul | **aynı** (aynı mime, aynı boyut) |
| Geçerli SVG | librsvg ayrıştırıyor → "desteklenmeyen format" | ayrıştırılmadan **aynı mesaj** |
| GIF / TIFF | libvips çözüyor → "desteklenmeyen format" | çözülmeden **aynı mesaj** |
| Tanınmayan içerik (metin, PDF, boş, kesik) | sharp hatası → "Dosya okunamadı" | sharp'a gitmeden **aynı mesaj** |
| İmzası doğru ama bozuk JPEG | sharp hatası → "Dosya okunamadı" | **aynı** |
| "<" ile başlayan ama geçerli SVG olmayan içerik (HTML, bozuk SVG, BOM + XML bildirimi) | librsvg ayrıştırmayı deniyor → "Dosya okunamadı" | ayrıştırılmadan "desteklenmeyen format" (**tek mesaj farkı**; dosya önceden de reddediliyordu) |

**Değişmeyenler:**
- Kabul edilen biçimler aynı. Yüklemesi başarılı olan hiçbir dosya artık reddedilmiyor.
- Marka/logo yolu (`src/modules/media/branding.ts`) bilerek değiştirilmedi: logo için SVG kabulü bir ürün kararı (D-15, bekliyor). Bu yolu librsvg 2.63.2 koruyor.
- `MediaValidationError` sınıfındaki `code` alanı, TypeScript parametre özelliği yerine açık alan olarak tanımlandı. Bu, birim testlerinin modülü Node'un tip silme kipinde yükleyebilmesi içindir; çalışma zamanı davranışı aynı.

Testler (§3.3): bozuk SVG örneği bunun davranış kanıtıdır. Bu dosyayı sharp doğrudan librsvg ile ayrıştırmaya çalışıp `XML parse error` veriyor; `inspectImage` ise sharp'a hiç gitmeden "desteklenmeyen" yanıtını veriyor.

### 2.5 Next.js yapılandırması ve görüntü optimizasyonu (bu fazda değiştirilmedi)

| Ayar | Durum | Değerlendirme |
| --- | --- | --- |
| `remotePatterns` | `https://*.supabase.co/storage/v1/object/public/**` (+ proje adresi `.supabase.co` dışındaysa o adres) | SSRF bildirimi 16.3.8 ile kapandı. Joker desen, başka Supabase projelerinin herkese açık görsellerinin KARAY'ın optimizasyon kotasıyla işlenmesine izin veriyor (maliyet ve kötüye kullanım riski). **Öneri (D-15 / SEC-06):** deseni kendi proje host'una daraltmak. Bunun için önce production verisinde başka bir proje adresine bağlı görsel olmadığı doğrulanmalı. Production verisine erişim olmadığı için uygulanmadı. |
| `localPatterns` | `/demo/**`, `/karay/**`, `/og-default.png`, `/placeholder-property.svg` | Değişmedi |
| `formats` / `qualities` / `deviceSizes` / `imageSizes` | avif, webp / 60, 75, 85 / 640…2880 / 160, 320, 480 | Değişmedi |
| `dangerouslyAllowLocalIP` | Yalnızca `NEXT_IMAGE_ALLOW_LOCAL_IP=1` ile (yerel geliştirme) | Değişmedi; production'da kapalı kalmalı |
| CSP `img-src` / `connect-src` | `*.supabase.co` içeriyor | Talimat gereği dokunulmadı (D-15, SEC-02) |

16.3.6 → 16.3.8 arasında `node_modules/next/dist/docs` içinde yalnızca `incrementalCacheHandlerPath.md` değişti (önbellek anahtarlarının kapsamı). KARAY özel `cacheHandler` kullanmadığı için etkilenmiyor.

### 2.6 Davranış, build çıktısı ve temalar bozulmadı mı?

**Build:** Rota tablosu üç build'de de aynı (134 satır): yükseltme öncesi (16.3.6), yükseltme sonrası ve son ağaç (16.3.8). `app-path-routes-manifest` ve `routes-manifest` de aynı; ön üretilen ve dinamik sayfalarla `revalidate` değerleri değişmedi.

**Görsel karşılaştırma:**
- İki build, aynı veritabanıyla, yan yana çalıştırıldı: eski 16.3.6 ayrı bir çalışma ağacında, yeni 16.3.8.
- 48 ekran görüntüsü alındı: 6 genel sayfa masaüstü ve telefonda (12); 9 tasarım ailesi × 3 yüzey masaüstünde ve 9 aile ana sayfası telefonda (36 önizleme). Böylece 9 tasarım ailesinin hepsi kapsandı.
- Çekim koşulları: dış ağ engellendi, tembel görseller kaydırılarak yüklendi, animasyonlar donduruldu. Her build iki kez çekildi.
- **44/48 sayfada eski ve yeni build'den piksel piksel aynı bir çift bulundu.** Kalan 4 sayfa sıkı koşulla (tüm görseller yüklenene kadar beklenerek) yeniden çekildi:

| Sayfa | Sonuç |
| --- | --- |
| Sinematik Vitrin ana sayfa | Aynı çift bulundu. Önceki fark tembel yükleme zamanlamasından |
| Map First ilan | Aynı build'in iki çekimi de birbirinden farklı (harita çizimi belirsiz) → yükseltmeyle ilgisiz gürültü |
| `/karay` masaüstü ve telefon | Her build kendi içinde kararlı, iki build birbirinden farklı. Neden: aşağıdaki **P3-F1**. Yükseltmeyle ilgili değil. |

**P3-F1 — `/karay` görselleri `next start` altında optimize edilemiyor (yükseltmeden önce de var).** KARAY sayfasındaki "Site Kontrol Merkezi" görseli `/_next/image?url=/karay/…png` ile istendiğinde:
- Next, görseli **Host başlığı olmayan** bir iç istekle okuyor (`fetchInternalImage`, `headers: {}`).
- `src/proxy.ts` eşleştiricisinde `/karay/:path*` var. Host olmadığı için yüzey "kiracı" sayılıyor ve `/karay` yolu 404 dönüyor.
- Optimizasyon sonucu: `400 The requested resource isn't a valid image`.

Kanıt:
- Önbellekte olmayan 5 varyant iki sürümde de birebir aynı 400'ü verdi.
- Yeni build'deki tek başarılı varyant (`w=640&q=75`) önbellekten geliyordu (`X-Nextjs-Cache: HIT`). Kayıt, yükseltmeden önceki bir çalıştırmada (11:53) `.next/cache/images` içine yazılmıştı; o kaydın o sırada nasıl üretilebildiği yeniden üretilemedi.
- Kayıt kenara alınınca yeni build de aynı 400'ü verdi. Kayıt sonra geri kondu.
- Host başlıksız doğrudan istek iki sürümde de `404 text/plain` döndü.

Vercel'in görüntü servisi farklı çalıştığı için production'daki durum doğrulanmadı (erişim yok). Düzeltme seçenekleri §7'de. Yüzey ayrımı mantığına dokunacağı için bu fazda düzeltilmedi.

**E2E:** Yükseltilmiş build'e karşı tam E2E: **201 geçti, 4 atlandı, 0 başarısız**. Fotoğraf yükleme ilan yolunda yeni imza denetiminden geçiyor (`processImage → inspectImage`). Bunu kullanan `admin.spec` ve `acceptance` 36–43 testleri geçti.

---

## 3. B — Test ve güvenlik kapısı

### 3.1 Sonuçlar

| Kontrol | Başlangıç (16.3.6) | Yükseltme sonrası | Son ağaç (commit edilen) |
| --- | --- | --- | --- |
| Birim (`npm run test:unit`) | 366/366 | 402/402 | **407/407** (366 eski + 41 yeni; 0 atlanan) |
| RLS (`npm run test:rls`, yerel veritabanı) | 105/105 | 105/105 | **105/105** (0 atlanan) |
| E2E (`playwright test`, 205 çalıştırma) | 198 geçti, 1 başarısız (OBR-A kararsız), 4 atlandı, 2 çalışmadı | **201 geçti, 0 başarısız, 4 atlandı** (18,5 dk) | Son build'e karşı medya ve marka yolları: `admin` + `acceptance` + `office-brand` **31/31** |
| Typecheck (`next typegen && tsc`) | 0 hata | 0 hata | **0 hata** |
| Lint (`eslint`) | 0 hata, 3 uyarı | 0 hata, 3 uyarı | **0 hata, aynı 3 uyarı** |
| Build (`next build`) | tamam | tamam | **tamam**; rota tablosu aynı |
| Demo SQL güncel mi (`demo:sql --check`) | güncel | güncel | **güncel** |
| `npm audit --omit=dev --audit-level=high` | 3 yüksek (çıkış 1) | **0** (çıkış 0) | **0** |
| gitleaks 8.24.2 | — | — | Değişen 14 dosya ve tatbikat logları: **sızıntı yok**; commit sonrası CI'daki git taraması: **sızıntı yok** (§8) |

Son ağaçta, tam E2E'den sonra uygulama koduna yalnızca bir **yorum** satırı eklendi (`processing.ts` belge yorumu). Ardından build yeniden alındı; rota tablosu aynı çıktı ve medya ile marka yollarının E2E'si yeniden koşuldu (31/31). Tam E2E sonucu yükseltilmiş uygulama kodu için geçerlidir.

### 3.2 Atlanan testler (hepsi tasarım gereği)

| Test | Proje | Neden |
| --- | --- | --- |
| `visitor.spec.ts:42` Oda filtresi… | mobile | Mobilde filtreler tam ekran panelde; masaüstünde doğrulanıyor |
| `visitor.spec.ts:121` Paylaşım menüsü… | mobile | Mobilde cihazın yerel paylaşım menüsü açılıyor |
| `responsive.spec.ts:8` hedef genişliklerde yatay taşma yok | mobile | Genişlikler masaüstü çalıştırmasında tek tek ayarlanıyor |
| `design-families.spec.ts:286` FAM-05 (ölçüm) | desktop | Yalnızca `SHOT_DIR` tanımlı ölçüm çalıştırmasında |

Birim ve RLS testlerinde atlanan test yok. Başlangıçtaki "2 çalışmadı", OBR-A başarısız olduğu için seri bloktaki OBR-B/C'nin koşulmamasıydı; sonraki tüm çalıştırmalarda koşuldu ve geçti.

### 3.3 Yeni testler ve mutasyon denetimi

`tests/unit/security-backup.test.mjs` 41 test içeriyor:

| Grup | Kapsam |
| --- | --- |
| SP-01 | package.json, kilit dosyası ve kurulu sürüm birlikte: next ≥ 16.3.8, sharp ≥ 0.35.5 ve librsvg ≥ 2.63.2, kilitteki her source-map-js ≥ 1.2.2 |
| SP-02 – SP-05 | Kabul edilen biçimler; SVG, GIF ve TIFF'in çözücüye gitmemesi; ret mesajları; imza denetiminin sharp'tan önce gelmesi; logo yolunun değişmemesi |
| BK-01 – BK-06 | Yedek betiği, iş akışı, tatbikat betiği ve Storage betikleri |

Davranış testleri:
- Hata mesajlarında bağlantı bilgisi gizleniyor.
- Postflight'ta `HATA: …` biçimli satırlar sayılıyor.
- Çıktı yolu doğrulanıyor.
- `restore-storage --verify` için 0, 1 ve 2 çıkış kodları doğru.

`launch-readiness.test.mjs › LR-03`: pg_dump satırı artık betikte olduğu için iddialar `scripts/backup-db.sh`'e taşındı (`--no-privileges` yok, `--format=custom`, parmak izi). Ayrıca iş akışının bu betiği çalıştırdığı denetleniyor. Hiçbir iddia gevşetilmedi.

**Mutasyon denetimi** (`$SP/p3/mutate-all.sh`): 30 bilinçli hata uygulandı, her birinden sonra dosya SHA-256 ile doğrulanarak geri yüklendi. **30/30'u en az bir testle yakalandı.** Örnekler: imza denetimini kaldırmak, SVG'yi çözücü listesine eklemek, denetimi sharp'tan sonraya almak, pg_dump'a `--no-privileges` eklemek, anlık görüntüyü kapatmak, loga kayıt sayısı veya dosya boyutu yazmak, SHA-256 dosyasını üretmemek, `row_security`'yi açmak, iş akışında sessiz atlama, kayıp dosya yüklemesi, `rclone check`'i kaldırmak, sır değerini yazdırmak, geri yüklemeyi tek işlemden çıkarmak, geçici veritabanını silmemek, mevcut veritabanına yüklemek, Storage özet denetimini atlamak, zaman damgasını metin yapmak, collation bağımlılığı, eski next/sharp sürümleri, postflight tam eşleşmesi, log gizlemeyi kaldırmak ve coproc'a dönmek.

İki not:
- `--no-privileges` mutasyonunun ilk denemesi kod yerine bir yorum satırına uygulanmıştı. Testler yorumları bilerek yok sayıyor; mutasyon kod satırına yeniden uygulandığında 2 test yakaladı.
- Çıktı yolu doğrulamasını silen mutasyon ilk turda **yaşadı**. Davranış testi eklendi ve artık yakalanıyor.
- Commit öncesi son birim çalıştırmasında bu yeni test bir kez başarısız oldu (406/407). Gerçek neden: mutasyon turunda bozulan betik `/tmp` altında bir klasör bırakmıştı, test de klasörün önceden var olmadığını varsayıyordu. Test, her çalıştırmada yeni ve benzersiz bir geçici klasör kullanacak şekilde yalıtıldı; iddialar gevşetilmedi. Artık klasör silindi, mutasyon hâlâ yakalanıyor, sonuç 407/407.

### 3.4 Bağımlılık taraması

| Tarama | Önce | Sonra |
| --- | --- | --- |
| `npm audit --omit=dev --audit-level=high` (CI kapısı) | 3 yüksek: next, sharp, source-map-js | **0** |
| `npm audit` (geliştirme dahil) | 8 yüksek | **5 yüksek, hepsi yalnızca geliştirme** |

Kalan 5 bulgunun hepsi tek bir zincirden geliyor: `eslint-config-next@16.3.6 → @next/eslint-plugin-next → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`. Bildirim [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): derin iç içe desenlerle yığın tükenmesi (DoS), etkilenen aralık ≤ 3.0.3. **Yamalı sürüm yok.** npm'in önerdiği "düzeltme" `eslint-config-next`'i 14.2.35'e indirmek; anlamsız olduğu için uygulanmadı.

Kullanım yolu: yalnızca lint sırasında, deponun kendi glob desenleriyle. Production paketinde yok, saldırgan girdisi almıyor. Gizlenmedi; kabul edilen risk olarak §6'da listelendi.

### 3.5 Gizli anahtar taraması

- gitleaks 8.24.2 (CI ile aynı sürüm), değişen 14 dosyanın kopyası ve tüm tatbikat logları üzerinde: **sızıntı yok**.
- Commit'ten sonra CI'daki komutun aynısı (`gitleaks git . --log-opts="-- elvankent-gayrimenkul"`) ve `.github` için ayrı tarama: §8.
- Birim testindeki `SUPABASE_SERVICE_ROLE_KEY: 'birim-test'` sabiti gerçek bir anahtar değildir; `--verify` kipi Supabase'e bağlanmaz.

### 3.6 CI veritabanı testleri neden atlanıyor?

`.github/workflows/elvankent-ci.yml` içindeki `database` işi `if: ${{ vars.ELVANKENT_CI_DB_TESTS == 'true' }}` koşuluna bağlı. Depoda bu değişken tanımlı değil, bu yüzden iş her çalışmada `skipped` oluyor (FAZ 0'dan beri; #74, #76–#79).

- İş hiçbir GitHub sırrı kullanmıyor: Supabase CLI'yi `version: latest` ile kurup yerel yığını iş içinde başlatıyor. Yani eksik olan bir sır ya da izin değil, **yalnızca değişken**.
- Değişkeni açmak bir depo ayarı değişikliği olduğu için yapılmadı (PF-11, D-14).
- İş hiç çalışmadığı için GitHub runner'ında yeşil olacağı **kanıtlanmış değil**. `version: latest` da zamanla kayma riski taşıyor.

### 3.7 Yerelde yeşil ≠ CI'da yeşil

Bu belgedeki tüm "geçti" sonuçları bu konteynerde alındı. Değişiklikler push edilmediği için GitHub CI bu commit'te **hiç çalışmadı**. CI'da yalnızca `ff2f7da`'nın kırmızı sonucu var. Push sonrasında `quality` işinin yeşile dönmesi beklenir (aynı komutlar yerelde temiz), ama bu bir **beklenti**, kanıt değil.

---

## 4. C — Yedekleme ve geri yükleme

### 4.1 14 atlanmış çalışmanın gerçek nedeni

`elvankent-backup` iş akışının 14 çalışmasının hepsi `schedule` olayıyla başladı ve hepsi `skipped` bitti:

| # | Tarih | Başlama (UTC) | Cron'a (01:23) göre gecikme |
| --- | --- | --- | --- |
| 1 | 28.09 | 07:03 | 5 sa 40 dk |
| 2 | 29.09 | 07:00 | 5 sa 37 dk |
| 3 | 30.09 | 06:50 | 5 sa 27 dk |
| 4 | 01.10 | 07:14 | 5 sa 51 dk |
| 5 | 02.10 | 07:04 | 5 sa 41 dk |
| 6 | 03.10 | 06:37 | 5 sa 14 dk |
| 7 | 04.10 | 07:01 | 5 sa 38 dk |
| 8 | 05.10 | 07:11 | 5 sa 48 dk |
| 9 | 06.10 | 07:38 | 6 sa 15 dk |
| 10 | 07.10 | 07:19 | 5 sa 56 dk |
| 11 | 08.10 | 07:30 | 6 sa 07 dk |
| 12 | 09.10 | 07:28 | 6 sa 05 dk |
| 13 | 10.10 | 07:16 | 5 sa 53 dk |
| 14 | 11.10 | 07:18 | 5 sa 55 dk |

**Neden:** İş akışındaki tek iş (`backup`) iş düzeyinde `if: ${{ vars.ELVANKENT_BACKUP_ENABLED == 'true' }}` koşuluna bağlıydı. Değişken tanımlı olmadığı için hiçbir runner başlamadı, log da oluşmadı.

Neden olmayanlar:
- **İzin değil:** iş hiç başlamadı.
- **Zamanlama değil:** 14 gecenin 14'ünde de tetiklendi. İş akışı varsayılan dalda olduğu için zamanlama çalışıyor.

Gözlenen gecikme 5–6 saat. GitHub belgesine göre zamanlanmış iş akışları yoğunlukta gecikebilir veya düşürülebilir. Herkese açık depoda 60 gün hiç etkinlik olmazsa zamanlanmış iş akışları otomatik kapatılır.

### 4.2 İş akışı incelemesi ve değişiklikler (`.github/workflows/elvankent-backup.yml`)

| Konu | Önce | Sonra |
| --- | --- | --- |
| Kapalıyken | İş sessizce "skipped" | Yeni `backup-disabled` işi her çalışmada **"Yedek alınmadı"** uyarısı (`::warning`) ve iş özeti yazar |
| Eksik ayar | Komutlar anlaşılmaz hatalarla düşerdi | İlk adım 10 değişkeni/sırrı denetler; eksiklerin yalnızca **adlarını** `::error` olarak yazıp durur |
| Veritabanı adımı | Satır içi `pg_dump` + ayrı anda parmak izi | `scripts/backup-db.sh` (§4.4). Yerel tatbikatla aynı kod |
| Depoya yüklenen | `.dump` + `.fingerprint.txt` | `.dump` + `.fingerprint.txt` + `.tables.txt` + `.sha256`, ardından `rclone check --one-way` ile depodakilerle karşılaştırma |
| Log | 17 tablonun **kayıt sayıları** ve dump boyutu yazılıyordu (SEC-03) | Kayıt sayısı, boyut, bağlantı adresi ve kullanıcı adı yok (§4.3) |
| Sparse checkout | `supabase/ops` | `supabase/ops` + `scripts` |
| Saklama | `.dump` + `.fingerprint.txt` | Dört dosya birlikte (`BACKUP_RETENTION_DAYS`, varsayılan 30 gün) |

Değişmeyenler:
- Zamanlama: `23 1 * * *` + elle tetikleme.
- İzin: `permissions: contents: read`, yalnızca okuma. Bu en düşük izin; değişiklik gerekmedi.
- Eşzamanlılık grubu.
- Storage eşitleme mantığı.
- Kullanılan action sürümleri: Node 20 uyarısı ve SHA ile sabitleme ayrı iş (§7).

### 4.3 Yedek loglarında kişisel veri, kayıt içeriği, sır veya hassas yol var mı?

| Kaynak | Ne yazılıyor | Denetim |
| --- | --- | --- |
| `backup-db.sh` başarılı çıktı | Dosya adları; anlık görüntünün paylaşılıp paylaşılmadığı | 7 tatbikat logunda (19 satır) URL, parola, kullanıcı, sunucu, JWT, e-posta, UUID, kayıt sayısı veya boyut **yok** |
| `backup-db.sh` hata çıktısı | Hata metni; bağlantı adresi `<bağlantı>`; sunucu, kullanıcı, rol ve veritabanı adı `<gizlendi>` | Yanlış parola ve erişilemeyen sunucu denemelerinde parola, kullanıcı adı ve sunucu adresi yazılmadı. Davranış testi var |
| Ayar denetimi | Yalnızca eksik değişken/sır **adları** | Testte: değer yazdıran mutasyon yakalandı |
| Storage adımı (rclone) | Varsayılan `NOTICE` düzeyinde aktarım istatistiği yazılmıyor ([rclone `--stats-log-level`](https://rclone.org/docs/#stats-log-level), varsayılan `INFO`) | Hata olursa nesne yolu yazılır. Yollar sistem üretimi: kimlik (UUID), rastgele ek, özet; dosya adı veya kişisel veri yok (yerel 2292 nesnenin yol kalıpları incelendi) |
| `rclone check -q` | Başarıda hiçbir şey (kova adı dahil); yalnızca hatalar | rclone kaynağında özet satırları `NOTICE` düzeyinde ve hedef adıyla yazılıyor; `-q` ile yalnızca hatalar kalıyor |

Parmak izi (`.fingerprint.txt`) ve tablo sayıları (`.tables.txt`) dosyaları geri yükleme doğrulaması için kayıt sayılarını bilerek içerir. Bu dosyalar loga değil, **özel** yedek kovasına yazılır. Tatbikat logları gitleaks'ten de geçti (sızıntı yok).

### 4.4 Betik düzeltmeleri

**`scripts/backup-db.sh` (yeni; gece iş akışı ve elle yedek aynı betiği kullanır):**
- `pg_dump --format=custom --no-owner`. GRANT/REVOKE yetkileri **korunur**, `--no-privileges` yok (FAZ 0 bulgusu).
- **Tek anlık görüntü:** Ayrı bir oturum `repeatable read read only` işlemi açıp `pg_export_snapshot()` çağırır. Parmak izi ve tablo sayıları aynı oturumda alınır, `pg_dump --snapshot` aynı görüntüyü kullanır. Yedek sırasında yazılan veri karşılaştırmayı bozmaz.
- Görüntü paylaşılamazsa (ör. işlem kipindeki bağlantı havuzu) yedek yine alınır, sayılar dump'tan hemen sonra okunur ve uyarı yazılır.
- `set row_security = off`: yetkisi olmayan rol RLS ile sessizce süzülmüş sayı üretmez, hata verir.
- Doğrulamalar: `pg_restore --list`, parmak izi ve tablo listesi biçimi, SHA-256 dosyası, çıktı yolu doğrulaması.
- Bash 3.2 (macOS) ile de çalışır.

**`scripts/restore-drill.sh` (yeni):** Yedeği yalnızca **yeni ve geçici** bir veritabanına yükler (`karay_restore_drill_<zaman>`, `template0`). Var olan hiçbir veritabanına yazmaz. Adımlar:
1. SHA-256 doğrulaması;
2. dump okunabilir mi;
3. geçici veritabanını oluştur;
4. `pg_restore --single-transaction --exit-on-error`;
5. parmak izi birebir aynı mı;
6. yedekteki her tablonun satır sayısı aynı mı;
7. postflight'ta HATA yok mu.

Başarılı ya da başarısız, her durumda geçici veritabanını siler (`trap … EXIT`). İnceleme için `KEEP_DB=1` kullanılabilir.

**Tatbikatın bulduğu ve commit'ten önce düzeltilen hatalar:**
1. **Anlık görüntü alınamayınca betik yedek almadan çıkıyordu.**
   - Neden: Oturum hata verip kapanınca bash, coproc değişkenlerini (`SNAP_PID`) siliyor; `set -u` altında `kill "$SNAP_PID"` betiği sonlandırıyordu.
   - Düzeltme: Oturum adlandırılmış boru (FIFO) ile ve süreç kimliği `$!` ile tutuluyor. Kapanmış oturuma yazma `SIGPIPE` ile betiği öldürmüyor.
   - Kanıt: F3 tatbikatı ve regresyon testi.
2. **Tatbikatın son kontrolü `HATA: …` biçimli satırları saymıyordu.**
   - Neden: Kontrol yalnızca tam olarak `HATA` yazan satırları sayıyordu; örneğin `HATA: RLS kapalı tablo var` satırı gözden kaçıyordu.
   - Düzeltme: Önek eşlemesi.
   - Kanıt: N1 tatbikatı ve davranış testi.
3. Hata gizlemesi `host name`, `role` ve `database` adlarını kapsamıyordu; genişletildi ve davranış testi eklendi.

**`supabase/ops/backup_fingerprint.sql`:** Metin sıralamaları `collate "C"`, zaman damgaları `extract(epoch …)` oldu. Önceki sürüm sunucu diline ve oturum saat dilimine bağlıydı; aynı veri farklı sunucuda **yanlış "farklı"** sonucu verebiliyordu (kanıt: §4.5 K ve Z).

**`supabase/ops/backup_table_counts.sql` (yeni):** `public`, `auth` ve `storage` şemalarındaki her tablonun kesin satır sayısını verir; okuma yetkisi olmayan tabloyu atlar. Yalnızca sayı içerir, kişisel veri yok.

**`scripts/restore-storage.mjs`:**
- Her dosya yüklenmeden önce `manifest.json`'daki SHA-256 ile karşılaştırılır; bozuk dosya **yüklenmez**.
- `--verify` kipi Supabase'e bağlanmadan yalnızca bütünlüğü denetler.
- Manifest'te olup klasörde olmayan dosya hata sayılır.
- Çıkış kodları: 0 sorunsuz, 1 ayar/manifest yok, 2 bozuk/eksik/yüklenemeyen.

**`scripts/backup-storage.mjs`:** Artımlı çalışmada atlanan dosyanın da SHA-256 özeti manifest'e yazılır. Önceden yalnızca yeni indirilen dosyaların özeti vardı.

### 4.5 Yerel yedek ve ayrı test veritabanına geri yükleme — kanıt

Ortam: bu konteynerdeki yerel PostgreSQL 16.13 (pg_dump 16.13) ve Supabase benzeri yerel yığın.
- Kaynak (ana yerel veritabanı) yalnızca **okundu**.
- Yazma gerektiren denemeler (eşzamanlı yazma, RLS kapatma, benzetim) D1 dump'ından kurulan geçici `karay_p3_src` veritabanında yapıldı.
- Production'a ve gerçek Supabase projesine bağlanılmadı.

| Deneme | Sonuç |
| --- | --- |
| **D1** `backup-db.sh` → `sha256sum -c` → `restore-drill.sh` | 3/3 dosya `OK`. Tek işlemde geri yükleme. Parmak izi **17/17**, tablo sayıları **71/71** (üç şemanın tüm tabloları), son kontrol 22 TAMAM + 4 karşılaştırma satırı, **0 HATA**. Geçici veritabanı silindi; kaynağın parmak izi ve sayıları yedekten önceki ile aynı |
| **C1** Yedek sürerken sürekli yazma (yedek başına ≈130–150 satır), ortak anlık görüntü | Tatbikat başarılı (17/17, 72/72) |
| **C2** Aynı koşul, `BACKUP_SHARED_SNAPSHOT=off` (eski yöntem) | 5. adımda durdu: `fark: organization_settings`. Tutarsız yedek yakalandı |
| **F3** Anlık görüntü dışa aktarılamıyor (benzetim) | `::warning` yazıldı, yedek alındı, tatbikat başarılı (ilk denemede hata 1 yüzünden çöküyordu) |
| **N1** Kaynakta RLS'si kapalı bir tablo | 7. adım `HATA: RLS kapalı tablo var` → başarısız, geçici veritabanı silindi |
| **I1** Dump bozuk, özet eski | 1. adımda durdu; veritabanı sayısı önce 11, sonra 11 (**oluşturulmadı**) |
| **I2** Parmak izinde bir karakter değişti, özet yenilendi | 5. adımda durdu: `fark: organizations` |
| **I3** Bir tablo sayısı değişti, özet yenilendi | 6. adımda durdu: `fark: auth.audit_log_entries` |
| **I4** Dump'ın veri bloğu bozuk, özet yenilendi | İçerik listesi okundu; 4. adım `could not uncompress data`. Tek işlem olduğu için yarım veri kalmadı, veritabanı silindi |
| **F1 / F2** Yanlış parola, erişilemeyen sunucu | `✗ Veritabanına bağlanılamadı`; sunucu ve kullanıcı `<gizlendi>` |
| **K** Aynı yedek C.UTF-8 ve ICU `en-US` veritabanlarında | **Eski** parmak izi `storage.objects` satırında farklı; **yeni** sürüm birebir. Mekanizma: C sıralaması `B a a-c ab`, ICU sıralaması `a a-c ab B` |
| **Z** Aynı veritabanı `PGTZ=UTC` ve `PGTZ=Europe/Istanbul` | **Eski** parmak izi 3 satırda farklı (organization_settings, properties, pages); **yeni** birebir |
| Temizlik | Kalan `karay_*` veritabanı: 0; ana veritabanında deneme tablosu: 0 |

D1 dosyalarının SHA-256 özetleri (yerel test verisi):

```
222433e8dc5c63a258e84e3559fdfe47948f1bd361fdf434361d11cae8091be9  db-d1.dump
00633ba68c8ffc887601ee787ad723add377cd3dc723bf4e530b8be1e2e1240e  db-d1.fingerprint.txt
30f2a90efcbccc72e136789dcfee3fbac0ba1c3d494ad21678088271696189d6  db-d1.tables.txt
```

### 4.6 Storage tatbikatı (yerel Storage API, gerçek kovalar yalnızca okundu)

| Deneme | Sonuç |
| --- | --- |
| `backup:storage` (4 kova) | 2292 dosya, 0 hata; her dosyanın SHA-256 özeti manifest'te |
| `restore:storage --verify` | 2292/2292 doğrulandı, 0 eksik, 0 bozuk |
| Artımlı ikinci çalıştırma | 2292 dosya atlandı. Hepsinin özeti manifest'te ve ilk manifestle 2292/2292 aynı; `--verify` geçti |
| Ayrı geçici kovaya geri yükleme (`p3-restore-drill`, özel, 238 dosya) | Kuru çalıştırma, sonra `--apply`: 238 yüklendi. Kovadan geri indirilenlerin 238/238'inin SHA-256'sı aynı |
| Bozuk dosya | Yüklenmedi (çıkış 2); kovada yok |
| Nesne kaydı var, dosya yok (tam geri yükleme sonrası durum) | `--apply`: "zaten var", dosya **hâlâ yok**. `--apply --overwrite`: 238/238 geri geldi, SHA-256 aynı → runbook düzeltildi (§4.7) |
| Temizlik | Geçici kova silindi; kalan: 0 |

### 4.7 Test geri yüklemesi başarısız olursa: temizleme ve geri alma

Ayrıntılı tablo [BACKUP_RESTORE.md](BACKUP_RESTORE.md) › "Tatbikat (veya test geri yüklemesi) başarısız olursa" bölümünde. Özet:

- **Kaynak hiç değişmez.** Yedek yalnızca okur; tatbikat yalnızca kendi oluşturduğu geçici veritabanına yazar. Bu yüzden kaynakta geri alınacak bir şey yoktur.
- 1–2. adımda hata: veritabanı oluşturulmaz. Yedek yeniden indirilir; yine bozuksa bir önceki gecenin yedeğine geçilir.
- 4. adımda hata: tek işlem olduğu için hedef boş kalır ve otomatik silinir. Hatanın ilk 20 satırı gizlenmiş olarak yazılır.
- 5–7. adımda fark veya HATA: geçici veritabanı silinir; yalnızca tablo adları yazılır. Canlıya geri yükleme **yapılmaz**.
- Betik yarıda kesilirse: `select datname from pg_database where datname like 'karay_restore_drill_%';` çalıştırılır, her biri için `drop database "<ad>" with (force);` uygulanır.
- Storage denemesi ayrı ve geçici bir kovada yapılır; sonunda kova boşaltılıp silinir.

**Runbook düzeltmeleri** ([BACKUP_RESTORE.md](BACKUP_RESTORE.md)):
- Tam geri yüklemeden sonra Storage için `--apply --overwrite` **zorunlu**. Veritabanıyla birlikte `storage.objects` kayıtları geldiği için `--apply` dosyaları "zaten var" deyip yüklemiyor. Bu tatbikatta doğrulandı; Supabase'in resmî taşıma betiği de `upsert: true` kullanıyor.
- Gece Storage yedeğinde (`rclone`) `manifest.json` yok. `--verify` 1 ile çıkar; bütünlük rclone'un aktarım denetimine dayanır.
- **Yeni bir Supabase projesine geri yükleme prova edilmedi.** Yeni proje boş değildir: `auth`, `storage` ve eklenti şemaları hazır gelir. Supabase'in resmî yöntemi farklıdır: rol, şema ve veri ayrı dökülür; `psql --single-transaction` ile `session_replication_role = replica` altında yüklenir ([Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), belge kaynağı supabase/supabase deposundan okundu).
- "Doğrulama kaydı (FAZ 3)" tablosu eklendi.

### 4.8 Bu fazda yapılmayanlar (bilerek)

- Production veritabanında yedek veya geri yükleme denemesi (yasak).
- Gerçek bir Supabase test projesinde geri yükleme provası (sağlayıcı erişimi yok; operatör adımı).
- Gece yedeğini açmak: `ELVANKENT_BACKUP_ENABLED`, `BACKUP_BUCKET` ve 9 sır. Bunlar depo ayarı ve gizli değer; uydurulmadı, değiştirilmedi.

---

## 5. Değişen dosyalar ve gerekçeleri

| Dosya | Değişiklik | Gerekçe |
| --- | --- | --- |
| `elvankent-gayrimenkul/package.json` | `next` 16.3.8, `sharp` ^0.35.5 | PF-01 / D-16: yüksek önemli bildirimler |
| `elvankent-gayrimenkul/package-lock.json` | 38 girdi (yalnızca §2.1'deki paketler) | Aynı; `source-map-js` 1.2.2 |
| `elvankent-gayrimenkul/src/modules/media/processing.ts` | `sharp`'tan önce dosya imzası denetimi; `MediaValidationError.code` açık alan | SEC-06: librsvg yüzeyini ilan yolundan çıkarmak |
| `elvankent-gayrimenkul/scripts/backup-db.sh` (yeni) | Tek anlık görüntüden dump + parmak izi + tablo sayıları + SHA-256; log gizleme | Tutarlı ve doğrulanabilir yedek; gece ve elle yedek için tek kod; SEC-03 |
| `elvankent-gayrimenkul/scripts/restore-drill.sh` (yeni) | Geçici veritabanına 7 adımlı tatbikat ve temizlik | Geri yükleme kanıtı; tekrarlanabilir prosedür |
| `elvankent-gayrimenkul/supabase/ops/backup_table_counts.sql` (yeni) | Tablo başına kesin satır sayısı | Geri yüklemede tablo sayısı karşılaştırması |
| `elvankent-gayrimenkul/supabase/ops/backup_fingerprint.sql` | `collate "C"`, epoch | Sunucu dili ve saat diliminden bağımsız karşılaştırma |
| `elvankent-gayrimenkul/scripts/restore-storage.mjs` | SHA-256 doğrulaması, `--verify`, eksik dosya, çıkış kodları | Bozuk dosyanın yüklenmemesi |
| `elvankent-gayrimenkul/scripts/backup-storage.mjs` | Atlanan dosyanın özeti | Artımlı yedekte de tam doğrulama |
| `.github/workflows/elvankent-backup.yml` | Görünür "Yedek alınmadı" uyarısı, ayar denetimi, betik, 4 dosya + `rclone check -q`, logdan sayı/boyut kaldırıldı | 14/14 sessiz atlama; SEC-03 |
| `elvankent-gayrimenkul/tests/unit/security-backup.test.mjs` (yeni) | 41 test | Yamalar ve yedek güvencesi için regresyon kapısı |
| `elvankent-gayrimenkul/tests/unit/launch-readiness.test.mjs` | LR-03 iddiaları betiğe taşındı (gevşetilmeden) | pg_dump satırı artık betikte |
| `elvankent-gayrimenkul/docs/BACKUP_RESTORE.md` | Faz 3 durumu, betikler, log güvenliği, tatbikat, başarısızlık tablosu, `--overwrite`, yeni proje uyarısı, doğrulama kaydı | Runbook gerçeğe uygun |
| `elvankent-gayrimenkul/docs/PHASE3_SECURITY_BACKUP.md` (yeni) | Bu rapor | Tamamlanma koşulu 8 |

---

## 6. Güvenlik taraması sonuçları ve çözülmemiş açıklar

**Taramalar:**
- `npm audit --omit=dev --audit-level=high`: **0**.
- Tam `npm audit`: 5 yüksek, hepsi geliştirme (§3.4).
- gitleaks: sızıntı yok.

**Çözülmemiş / kalan (gizlenmedi):**

| # | Konu | Durum | Neden bu fazda değil |
| --- | --- | --- | --- |
| U1 | `braces` ≤ 3.0.3 (GHSA-vfj7-8cjw-p6xm), geliştirme zinciri | Yamalı sürüm yok. Yalnızca lint, deponun kendi desenleriyle; production paketinde yok | Düzeltme yayımlanmamış; kabul edilen risk, izlenmeli |
| U2 | `remotePatterns: *.supabase.co` joker deseni | SSRF bildirimi kapandı; kötüye kullanım ve maliyet riski duruyor | Production verisi doğrulanmadan daraltmak görselleri kırabilir. Karar D-15 / SEC-06 |
| U3 | Logo yolunda SVG (librsvg) | Yamalı librsvg 2.63.2 ile korunuyor | Ürün kararı D-15 |
| U4 | CSP `'unsafe-inline'`, JavaScript'in okuyabildiği oturum çerezleri (SEC-02), müşteri alan adlarında HSTS `includeSubDomains; preload` (PF-10) | Değişmedi | Talimat: ayrı güvenlik işi |
| U5 | Action'lar SHA ile sabitlenmemiş; Node 20 uyarısı (SEC-05) | Değişmedi | Sabitlenecek SHA'lar bu oturumdan doğrulanamadı (dış depolara API erişimi yok); toplu güncelleme yapılmadı |
| U6 | Public profil deposu (SEC-01 / D-12) | Değişmedi | Görünürlük değişikliği yasak; karar D-12 |

---

## 7. CI ve production hazırlığı için kalan engeller

**CI**

| # | Engel | Kim / ne |
| --- | --- | --- |
| C-1 | Bu değişiklikler GitHub CI'da hiç koşmadı; `ff2f7da` hâlâ kırmızı | Push kararı (§8, D-14). Push sonrası `quality` işinin yeşil olduğu görülmeli |
| C-2 | `database` işi (RLS + E2E) hiç çalışmadı: `ELVANKENT_CI_DB_TESTS` tanımlı değil | Operatör: değişkeni `true` yapmak (PF-11); ilk çalışmada Supabase CLI `latest` sürümüyle uyumu doğrulamak |
| C-3 | Node 20 kullanımdan kalkıyor (`checkout@v4`, `setup-node@v4`); action'lar SHA ile sabitlenmemiş | Ayrı küçük iş (SEC-05) |
| C-4 | OBR-A E2E testi `networkidle` beklediği için ara sıra zaman aşımına düşüyor | Ayrı test işi: `networkidle` yerine görünür öğe beklemek (web-first assertion) |

**Production**

| # | Engel | Kim / ne |
| --- | --- | --- |
| P-1 | Bu dala push = Vercel **Production** dağıtımı (`mustafakara-0-7hh3`) | D-14: yayın dalı ve önizleme akışı; ya da açık dağıtım onayı |
| P-2 | KARAY yedeği production'da kapalı | Operatör: yedek kovası, `ELVANKENT_BACKUP_ENABLED=true`, `BACKUP_BUCKET` ve 9 sır (adları [BACKUP_RESTORE.md](BACKUP_RESTORE.md)'de); elle ilk çalıştırma; Storage S3 erişimi; `SUPABASE_DB_URL` oturum (session) kipinde olmalı |
| P-3 | Yeni bir Supabase projesine geri yükleme prova edilmedi; resmî yöntem farklı | Bir test projesinde prova; sonuç runbook'a yazılmalı (PF-02) |
| P-4 | Gece Storage yedeğinde SHA-256 manifest'i yok | İyileştirme: iş akışında manifest üretmek veya elle `backup:storage` ile ek doğrulama |
| P-5 | Zamanlama 5–6 saat gecikiyor; 60 gün etkinlik olmazsa kapanıyor | Dış izleme: "yedek geldi mi" denetimi (PF-07) |
| P-6 | P3-F1: `/karay` görselleri `next start` altında optimize edilemiyor; Vercel'deki durum doğrulanmadı | Ayrı iş. Seçenekler: (a) `/karay/` altındaki statik uzantıları proxy eşleştiricisinden çıkarmak (yüzey ayrımı testleriyle); (b) KARAY görsellerini `/karay/` dışına taşımak; (c) bu görsellerde `unoptimized` |
| P-7 | D-15 kararları: `remotePatterns`, logo SVG, CSP/çerez/HSTS aşamaları | Karar sizde |

---

## 8. Commit ve push kararı

- **Uzak dal:** `git fetch` ile doğrulandı; `origin/claude/elvankent-real-estate-platform-vxq9dj` = `ff2f7da`, yerel taban da `ff2f7da`. Çakışma yok.
- **CI politikası:** `elvankent-ci` push'ta ve PR #2'de çalışır. Dal koruması ve zorunlu kontrol yok; bu dal deponun varsayılan dalı.
- **Vercel:** GitHub Deployments API'ye göre bu dala gelen her commit için `vercel[bot]`, **"Production – mustafakara-0-7hh3"** ortamında bir dağıtım oluşturuyor (37 kayıt, 27.09–11.10; en sonuncusu `ff2f7da`, durum `success`). Yani bu dala push etmek production'a dağıtım demek.
- **Karar:** "Production Vercel'e dokunma" kuralı gereği push **güvenli değil**. Değişiklikler tek bir açıklayıcı commit olarak yerelde kaydedildi; push yapılmadı. Konteyner geçici olduğu için commit ayrıca `git format-patch` dosyası olarak teslim edildi.
- **Push için gerekenler (sizin kararınız):** ya D-14'e göre production'a bağlı olmayan bir dal ya da PR akışı, ya da bu commit'in production'a çıkmasına açık onay. Push sonrası CI'nın `quality` işi izlenmeli.

---

## 9. Ek: yeniden üretme

```bash
cd elvankent-gayrimenkul
npm ci && npm run test:unit && npm run typecheck && npm run lint && npm run demo:sql -- --check
npm audit --omit=dev --audit-level=high            # beklenen: found 0 vulnerabilities
npm run test:rls                                   # yerel Supabase yığını gerekir
# Yerel/test sunucusunda yedek + ayrı geçici veritabanına tatbikat
SUPABASE_DB_URL="postgresql://…YEREL…/postgres" OUT_DIR=./yedek STAMP=tatbikat bash scripts/backup-db.sh
(cd yedek && sha256sum -c db-tatbikat.sha256)
ADMIN_DB_URL="postgresql://…YEREL…/postgres" bash scripts/restore-drill.sh ./yedek tatbikat
# Storage
npm run backup:storage -- --out=./yedek/storage && npm run restore:storage -- --from=./yedek/storage --verify
```

Tatbikatta kullanılan yardımcı betikler (mutasyon, eşzamanlı yazma, bütünlük, sıralama ve saat dilimi denemeleri) depoya eklenmedi; yalnızca bu oturumun çalışma alanındaydı.
