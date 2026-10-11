# KARAY — Faz 4: Güvenli yayın akışı ve CI doğrulaması

> **Tarih:** 11.10.2026
> **Kapsam:** Faz 3 commit'ini (`4aa0ae3`) production'a dağıtmadan GitHub'da doğrulamanın yolunu belirlemek ve CI engellerini çıkarmak. Kod, workflow, Vercel, DNS, Supabase ve depo ayarları **değiştirilmedi**; bu fazın tek çıktısı bu belgedir.
> **Push:** **Yapılmadı.** Vercel proje ayarları bu oturumdan okunamadı (§2.3), yani güvenli doğrulama yolu **kesin olarak kanıtlanamadı**. Talimat gereği burada durup seçenekleri raporluyorum; sonraki adım sizin onayınızı bekliyor (§8).
> **Gizli değerler:** Belgede yok. Değişken ve sır yalnızca **adlarıyla** geçer.

## 0. Özet

| Konu | Durum |
| --- | --- |
| Dal / commit | `4aa0ae3` yerel geçmişte. Uzak dal `ff2f7da`; `ff2f7da` → `4aa0ae3` hızlı ileri sarma (14 dosya, +1516/−217) |
| Mevcut yayın akışı | Bu dala yapılan her push Vercel'de **Production** dağıtımı başlatıyor. Vercel projesi kurulduktan sonraki **36 push'un 36'sı** için `Production – mustafakara-0-7hh3` kaydı var. Önceki rapordaki bilgi yeniden ve bağımsız olarak doğrulandı. |
| Önerilen güvenli yöntem | **Aynı depoda ayrı doğrulama dalı** (seçenek 1). Tercihen Vercel'in o dalı hiç dağıtmamasını sağlayan `git.deploymentEnabled` korumasıyla (seçenek 1b). Ön koşul: Vercel panelinde 5 ayarın kontrolü ya da Vercel bağlayıcısının bu projenin kapsamına yetkilendirilmesi |
| Faz 3 commit'i (yerel, temiz kopya) | Geçenler: `npm ci`, sürümler, audit (0), typecheck, lint, birim 407/407, build, gitleaks, RLS 105/105, yedek + geri yükleme tatbikatı, Storage SHA-256 2377/2377 (negatif kontrol dahil). **E2E temiz kopyada kırmızı:** yerel ortamda 3, CI ortamı provasında 7 başarısız (§4.1, §4.2). **Bunlar GitHub CI sonucu değildir.** |
| Faz 3 raporuna düzeltme | Faz 3'teki "E2E 0 başarısız" sonucu ana çalışma ağacındaki iki yerel kalıntıya dayanıyordu; temiz checkout'ta tekrarlanmıyor (§4.1) |
| GitHub CI | `4aa0ae3` GitHub'da hiç çalışmadı. Son gerçek sonuç `ff2f7da`: `quality` başarısız (npm audit), `database` atlandı |
| CI engelleri | E2E temiz checkout'ta kırmızı: test sırası bağımlılığı ve P3-F1. CI'nin `SITE_ENV=development` değeri demo ortamı bekleyen testlerle uyuşmuyor. Veritabanı işi kapalı ve hiç denenmedi; action'lar Node 20'de ve SHA ile sabitlenmemiş; Supabase CLI `latest`; dal koruması yok (§6) |

---

## 1. Doğrulanmış dal ve commit durumu

| Kontrol | Sonuç |
| --- | --- |
| Aktif dal | `claude/elvankent-real-estate-platform-vxq9dj` (deponun **varsayılan dalı**) |
| HEAD | `4aa0ae35168d51484d99b5eef7fdf3e3d2563013` — "fix(security): patch next/sharp/source-map-js; verifiable backups and restore drill (FAZ 3)" |
| Uzak dal (`git fetch` sonrası) | `origin/claude/elvankent-real-estate-platform-vxq9dj` = `ff2f7da5444b…`; yerel dal **1 commit önde** |
| Ata ilişkisi | `ff2f7da`, `4aa0ae3`'ün atası (`git merge-base --is-ancestor`) |
| `4aa0ae3`'ü içeren dal | Yalnızca yerel `claude/elvankent-real-estate-platform-vxq9dj`; uzakta yok |
| Çalışma ağacı | Temiz (bu belge dışında) |
| `4aa0ae3`'ün getirdiği değişiklik | 14 dosya. Bağımlılık yamaları (`next` 16.3.8, `sharp` 0.35.5, `source-map-js` 1.2.2), görsel imza denetimi, `scripts/backup-db.sh`, `scripts/restore-drill.sh`, Storage betikleri, yedek iş akışı, 41 yeni test, belgeler. Ayrıntı: [PHASE3_SECURITY_BACKUP.md](PHASE3_SECURITY_BACKUP.md) §5 |

Faz 3 raporu yeniden okundu ve Vercel davranışı aşağıda bağımsız olarak yeniden doğrulandı. Faz 3'ün E2E sonucu temiz kopyada tekrarlanmadı (§4.1); diğer bulgular değişmedi.

---

## 2. Yayın akışının gerçek davranışı

### 2.1 GitHub Actions (workflow dosyaları `4aa0ae3` içinden okundu)

Depoda yalnızca iki workflow var: `.github/workflows/elvankent-ci.yml` ve `elvankent-backup.yml`. Diğer iki dalda (`claude/photo-to-stl-app-rxbvev`, `claude/breakline-android-game-5d5qgz`) `.github` klasörü yok.

| Workflow | Tetikleyici | Kullandığı sırlar | Yeni bir dala push'ta |
| --- | --- | --- | --- |
| `elvankent-ci` › `quality` | `push` (her dal) ve `pull_request`; yalnızca `elvankent-gayrimenkul/**` veya workflow dosyası değişince; `workflow_dispatch` | **Yok.** Build yer tutucu değerlerle yapılır (`https://ci-placeholder.supabase.co` vb.) | **Çalışır:** npm ci, typecheck, lint, birim, demo SQL, build, `npm audit`, gitleaks |
| `elvankent-ci` › `database` | Aynı + `if: vars.ELVANKENT_CI_DB_TESTS == 'true'` | **Yok.** Runner içinde geçici yerel Supabase (Docker) kurulur; anahtarlar o anda üretilir | **Atlanır** (değişken tanımlı değil) |
| `elvankent-backup` | `schedule` (yalnızca varsayılan dalda) + `workflow_dispatch` | Production veritabanı ve S3 sırları (tanımlı değil) | **Çalışmaz** (push tetikleyicisi yok) |

İzinler: iki workflow da `permissions: contents: read` kullanıyor; en düşük seviye bu.

### 2.2 GitHub depo ayarları (okunabilenler)

| Ayar | Bulunan | Nasıl |
| --- | --- | --- |
| Varsayılan dal | `claude/elvankent-real-estate-platform-vxq9dj` | REST API |
| Görünürlük | **public**; fork'a açık | REST API |
| Dal koruması | 3 dalın hiçbiri korumalı değil (`protected: false`) | `branches` listesi |
| Kural setleri (rulesets) | Yok; bu dala uygulanan kural yok | `rulesets`, `rules/branches` |
| Actions izinleri, değişkenler, sırlar, ortamlar (environments), webhook'lar | **Okunamadı** (bu oturumun GitHub erişimi bu yollara izin vermiyor, 403) | Operatör kontrol etmeli. Değişken/sır adları workflow dosyalarından çıkarıldı (§5.1, §7) |
| Commit'e bağlı uygulamalar | `github-actions`, `vercel`, `claude` (GitHub uygulaması; kontrol çalıştırması görülmedi) | `ff2f7da` check-suite kayıtları |

### 2.3 Vercel Git bağlantısı

**Ayarlar doğrudan okunamadı.** Vercel bağlayıcısı iki projeyi listeleyebiliyor, ama proje ayrıntıları ve dağıtım listesi için `403 forbidden — Trying to access resource under scope "kara-6892"` dönüyor. Vercel CLI de kurulu değil. Production dalı, Ignored Build Step, ortam değişkeni kapsamları ve kök klasör bu oturumdan **görülemedi**.

Bu yüzden davranış, Vercel'in GitHub'a yazdığı kayıtlardan (Deployments API, commit durumları, push olayları) çıkarıldı:

| Kanıt | Bulgu |
| --- | --- |
| Vercel projeleri | `mustafakara-0` (oluşturulma 27.09 13:47 UTC) ve `mustafakara-0-7hh3` (27.09 14:17 UTC); ikisi de aynı depoya bağlı |
| GitHub Deployments (toplam 75, hepsi `vercel[bot]`) | `Production – mustafakara-0-7hh3`: **37** · `Preview – mustafakara-0`: 36 · `Production`: 1 · `Preview`: 1 |
| `Production – mustafakara-0-7hh3` kayıtlarının commit'leri | **37/37 bu dalda**. İlk kayıt (625b465, 14:18) proje kurulumundaki ilk dağıtım; son kayıt `ff2f7da`, durumu `success` |
| Push olayları (Events API; deponun ilk günü olan 18.09'dan bu yana 57 olayın tamamı) | Vercel 7hh3 kurulduktan sonra bu dala **36 push** yapılmış; **36'sının da** son commit'i için Production kaydı var. Kaydı olmayan push yok |
| `mustafakara-0` | Bu dalın commit'leri bu projede **Preview** olarak dağıtılıyor ve **başarısız** oluyor (son 6/6 `failure`). Projenin tek Production kaydı, kurulum anında dağıtılan `63d014c` |
| Diğer dallar | `claude/breakline-android-game-5d5qgz` dalına 8 push var, ama hepsi Vercel projelerinden önce (21–22.09) → **yeni bir dala push'ta Vercel'in ne yaptığına dair geçmiş kayıt yok** |
| `elvankent-gayrimenkul/vercel.json` | `regions: fra1`, bir cron (`/api/cron/media-cleanup`). `git.deploymentEnabled` veya `ignoreCommand` **yok** |

**Çıkarım:**
- `mustafakara-0-7hh3` projesinin production dalı bu dal. Push = Production dağıtımı (bu doğrulandı).
- `mustafakara-0`, bu dalı production saymıyor.
- Vercel'in belgelenen modelinde yalnızca production dalı production'a dağıtılır; diğer her dal için **Preview** oluşturulur. Bu, `git.deploymentEnabled` ile dal bazında kapatılabilir ([Vercel: Git configuration](https://vercel.com/docs/project-configuration/git-configuration)).
- Yeni ve benzersiz adlı bir dala push'un **Production** dağıtımı yapmaması beklenir. Ancak ayarlar okunamadığı için bu **kanıtlanmış değil**.
- Yeni dala push iki projede de **Preview** dağıtımı başlatır:
  - Preview, Vercel'deki "Preview" kapsamlı ortam değişkenlerini kullanır. Production Supabase adresi veya service-role anahtarı Preview kapsamında tanımlıysa, Faz 3 kodu production verisine erişebilen bir önizleme olarak derlenip çalışır. Bu kapsamlar görülemedi.
  - `next.config.ts › checkDeploymentEnv` Vercel'de 6 değişken ister. Preview'da bunlar yoksa derleme başta düşer, bu zararsızdır.
  - Cron işleri yalnızca production dağıtımında çalışır ([Vercel: Cron Jobs](https://vercel.com/docs/cron-jobs/quickstart): "Vercel invokes cron jobs only for production deployments").

### 2.4 Pull request oluşturulursa

PR, branch push'una göre ek güvenlik sağlamıyor; yalnızca daha fazla otomasyon tetikliyor:
- `elvankent-ci` `pull_request` olayıyla bir kez daha çalışır.
- Vercel aynı dal için Preview oluşturur ve PR'a yorum yazar. `vercel[bot]`, 27.09'da PR #2'ye yorum yazmış; PR yorumları açık.
- `claude` GitHub uygulaması da kontrol takımı açabilir.

Mevcut [PR #2](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/pull/2) başka bir projenin dalına (`claude/photo-to-stl-app-rxbvev`) açık; bu fazda dokunulmadı.

---

## 3. Güvenli doğrulama yöntemi

### 3.1 Seçenekler

| # | Yöntem | Production riski | Diğer etkiler | Ön koşul |
| --- | --- | --- | --- | --- |
| 1 | Aynı depoda ayrı doğrulama dalı (ör. `claude/karay-faz3-dogrulama`); yalnızca push, PR yok | Beklenen: **yok** (production dalı değil). Kanıt: dolaylı | CI `quality` çalışır. İki projede Preview dağıtımı: 7hh3 için Preview kapsamlı değişkenlerle derleme, `mustafakara-0` muhtemelen başarısız | Vercel panelinde §3.3'teki kontroller; dala push için açık onayınız |
| **1b** | **1 + `git.deploymentEnabled` koruması:** doğrulama dalı adıyla eşleşen desen `vercel.json`'da `false` | **Yok** ve Preview de oluşmaz (Vercel dağıtımı commit'teki `vercel.json`'a göre atlar) | Yalnızca CI çalışır | Kodda küçük bir yapılandırma değişikliği (bu fazda yasak, onay gerekir). 7hh3'ün kök klasörü `elvankent-gayrimenkul` olmalı (başarılı build'ler bunu gösteriyor, panelden teyit). `mustafakara-0`'ın kök klasörü bilinmiyor; kökteyse aynı desen depo köküne de konmalı |
| 2 | Preview / PR akışı | Seçenek 1 ile aynı | Ek CI çalışması, Vercel ve uygulama yorumları | 1 ile aynı; doğrulama için gerekli değil |
| 3 | KARAY için ayrı depo (Vercel'e bağlı değil) | **Yok** (bağlı Vercel projesi yoksa dağıtım olmaz) | Tam yalıtım. Depo görünürlüğü (D-12) ve private depoda Actions dakikaları ayrıca düşünülmeli | Depoyu sizin oluşturmanız / onaylamanız. Production'ı ileride bu depoya taşımak ayrı bir karar |

### 3.2 Seçilen yöntem ve neden durduruldu

- **Öneri: 1b.** Mevcut altyapıyla uyumlu ve en az riskli yol: CI doğrulanır, Vercel'de hiçbir dağıtım oluşmaz. Ayar okunamasa bile koruma commit'in içinde durduğu için Vercel tarafındaki belirsizliği kapatır.
- Kod değişikliği istemiyorsanız: **1**, ama yalnızca §3.3'teki panel kontrolünden sonra.
- Seçenek 3, depo görünürlüğü (D-12) kararıyla birlikte ele alınmalı.

Production dalı, Ignored Build Step ve ortam değişkeni kapsamları bu oturumdan **okunamadığı** için hiçbir seçenek "kesin kanıtlanmış" değil. Talimat gereği **push yapılmadı**; onayınız bekleniyor.

### 3.3 Push'tan önce Vercel panelinde kontrol edilecekler (iki proje için)

| Ayar (Project › Settings) | Beklenen / güvenli değer |
| --- | --- |
| Git › Production Branch | 7hh3: `claude/elvankent-real-estate-platform-vxq9dj`. `mustafakara-0`: doğrulama dalı **olmamalı** |
| Git › Ignored Build Step | Var mı, ne yapıyor (doğrulama dalını atlıyorsa 1b gerekmez) |
| General › Root Directory | 7hh3: `elvankent-gayrimenkul` (1b için önemli); `mustafakara-0`: ? |
| Environment Variables | Production sırları (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `CRON_SECRET`, `IP_HASH_SALT`, e-posta anahtarı vb.) **Preview** kapsamında mı? Öyleyse seçenek 1 yerine 1b |
| Deployment Protection | Preview'lar için Vercel Authentication açık mı |

Bunun yerine Vercel bağlayıcısını `kara-6892` kapsamına **salt okuma** amacıyla yeniden yetkilendirirseniz bu kontrolleri ben yapabilirim.

### 3.4 Onaydan sonra uygulanacak adımlar (henüz uygulanmadı)

Seçenek 1b:
1. Doğrulama dalı yerelde oluşturulur.
2. Tek bir yapılandırma commit'i eklenir: `elvankent-gayrimenkul/vercel.json` dosyasına
   ```json
   "git": { "deploymentEnabled": { "claude/karay-*-dogrulama": false } }
   ```
   `mustafakara-0`'ın kök klasörü depo köküyse aynı desen depo köküne de eklenir. Mevcut `regions` ve `crons` korunur. Production dalının dağıtımını etkilemez; yalnızca bu desene uyan dalları kapatır.
3. Push: `git push origin HEAD:refs/heads/claude/karay-faz3-dogrulama`.

Tetiklenecekler:
- `elvankent-ci` › `quality` (push). `database` atlanır. Değişken açılırsa o da çalışır, ama bugünkü kodla E2E adımı kırmızı olur (§4.2).
- Vercel'de dağıtım oluşmaması beklenir; bu ilk push'ta GitHub'daki dağıtım ve commit durumu kayıtlarından teyit edilir.

Seçenek 1: 1b'nin 2. adımı olmadan aynı push. Ek olarak iki projede Preview oluşur.

Geri alma:
- `git push origin --delete claude/karay-faz3-dogrulama` dalı ve sonraki CI çalışmalarını kaldırır.
- Oluşmuş Preview dağıtımları Vercel panelinden silinmeli; production'ı etkilemez.

Production dalına (`claude/elvankent-real-estate-platform-vxq9dj`) push bu planın parçası **değildir**.

---

## 4. Çalıştırılan kontroller ve gerçek sonuçlar

**Hepsi bu konteynerde, `4aa0ae3`'ün temiz bir kopyasında** (ayrı `git worktree`, boş `node_modules`) çalıştırıldı. `quality` adımları CI'daki ortam değişkenleriyle ve aynı sırayla koşuldu. **Bunlar GitHub CI sonucu değildir;** GitHub'da `4aa0ae3` için hiç çalışma yok.

| Kontrol | Komut | Sonuç |
| --- | --- | --- |
| Lockfile tutarlılığı | `npm ci` (Node 22.22.2, npm 10.9.7) | Çıkış 0, 518 paket; lockfile değişmedi |
| Bağımlılık ağacı | `npm ls --all` | Çıkış 0 |
| Sürümler | `npm ls`, `sharp.versions` | `next` 16.3.8 (3 başvuru), `sharp` 0.35.5, `source-map-js` 1.2.2 (3 başvuru), libvips 8.18.7, librsvg 2.63.2 |
| Bağımlılık taraması | `npm audit --omit=dev --audit-level=high` | **0 açık** (çıkış 0) |
| Typecheck | `npm run typecheck` | Çıkış 0 |
| Lint | `npm run lint` | 0 hata, 3 eski uyarı |
| Birim | `npm run test:unit` | **407/407**, 0 atlanan |
| Demo SQL | `npm run demo:sql -- --check` | Güncel |
| Build (CI yer tutucularıyla) | `npm run build` | Çıkış 0 (73 sayfa) |
| Gizli anahtar | `gitleaks git . --log-opts="-- elvankent-gayrimenkul"` (8.24.2, CI komutu) | Sızıntı yok |
| RLS | `npm run test:rls` (yerel yığın) | **105/105** |
| E2E (yerel çalıştırma ortamı, `SITE_ENV=demo`) | `playwright test` (bu kopyanın build'ine karşı) | **Kırmızı.** 179 geçti · **3 başarısız** (KARAY-01, OBR-A, SEO-E) · 4 atlandı · 19 çalışmadı (14,3 dk). Nedenler: §4.1 |
| E2E tanı çalıştırması | Aynı kopya, yalnızca `karay-site`, `office-brand`, `office-seo`; `--grep-invert "KARAY-01"`; fixture ilk çalıştırmanın ürettiği dosya | 25/25 geçti (1,5 dk). **Yalnızca tanı amaçlı**; düzeltilmiş bir tam çalıştırmanın yerine geçmez |
| E2E, CI ortamı provası | CI `database` işinin `.env.local` değerleriyle temiz build + tam `playwright test` | **Kırmızı.** 155 geçti · **7 başarısız** · 4 atlandı · 39 çalışmadı (13,4 dk). Yukarıdaki 3 hataya ek 4 hata CI ortamına özgü. Ayrıntı: §4.2 |
| Yedek + geri yükleme | `scripts/backup-db.sh` → `sha256sum -c` → `scripts/restore-drill.sh` | 3/3 OK; parmak izi 17/17, tablo sayıları 71/71, son kontrol 0 HATA; geçici veritabanı silindi |
| Storage yedeği | `scripts/backup-storage.mjs` (yerel yığın) | 2377 dosya (38,1 MB) indirildi; atlanan 0, hatalı 0 |
| Storage SHA-256 doğrulaması | `scripts/restore-storage.mjs --verify` | 2377/2377 eşleşti; eksik 0, bozuk 0 (çıkış 0) |
| Storage negatif kontrol | Yedeğin kopyasında 1 dosyada 1 bayt değiştirildi, 1 dosya silindi → `--verify` | Çıkış **2**; "bozuk 1, eksik 1", iki dosya adıyla raporlandı. Doğrulama gerçekten çalışıyor |
| Storage kuru geri yükleme | `scripts/restore-storage.mjs` (`--apply` yok) | Çıkış 0; yalnızca plan yazdı, yerel yığında değişiklik yapmadı |

### 4.1 E2E sonucunun gerçek nedenleri

| Test(ler) | Gerçek neden | Kanıt | Ne zamandan beri |
| --- | --- | --- | --- |
| OBR-A, SEO-E (masaüstü) | **Test sırası bağımlılığı.** İki test `tests/e2e/.fixtures/kabul-logo.png` dosyasını okuyor. Bu dosyayı yalnızca `acceptance.spec.ts` › `beforeAll` üretiyor. O dosya yalnızca `mobile` ve `iphone` projelerinde koşuyor ve bu projeler `desktop`'tan **sonra** çalışıyor. `.fixtures/` `.gitignore`'da | `ENOENT: no such file or directory … kabul-logo.png` (OBR-A 150. satır, logo yükleme adımı). Ana çalışma ağacında dosya önceki çalıştırmalardan kalmıştı (11.10 14:00), testler bu yüzden geçiyordu | `a77ceb8` (P0.2) ve `44c48e1` (P0.3), 04.10.2026. Faz 3 `tests/e2e`'ye dokunmadı |
| KARAY-01 | **Ürün hatası P3-F1.** "Kırık görsel yok" adımında `KARAY Site Kontrol Merkezi…` görseli kırık | Temiz build'de `/_next/image?url=/karay/ekran-kontrol-merkezi.png&w=640&q=75` → **400**. Sunucu logunda 4 kez "isn't a valid image for /karay…". Ana ağaçta bu varyant `.next/cache/images`'taki eski bir kayıttan geliyordu (Faz 3 raporu, P3-F1) | `ed95f50`, 03.10.2026: proxy eşleştiricisine `/karay/:path*` eklendi. Faz 3'ten önce de var |
| 19 test çalışmadı | Dosyalar `serial` modda: bir test düşünce aynı dosyanın kalan testleri koşmaz | KARAY-02…18 (17 test) ve OBR-B, OBR-C (2 test) | — |
| 4 atlandı | Koşullu `test.skip`, tek tek doğrulandı (`--reporter=list`) | FAM-05: yalnızca `SHOT_DIR` verilen ölçüm çalıştırmasında koşar. `mobile` projesinde Responsive, visitor "Oda filtresi" ve "Paylaşım menüsü": bu üçü masaüstü projesinde koşup geçiyor. Devre dışı bırakılmış test yok | — |

**Tanı çalıştırması:** Logo fixture'ı, tam çalıştırma sırasında aynı kopyanın `mobile` projesi tarafından üretilmişti. Dosya yerindeyken üç dosya KARAY-01 dışlanarak yeniden koşuldu ve **25/25 geçti**. Bu üç dosyada bu iki neden dışında bir hata görülmedi. Bu çalıştırma düzeltmenin yerine geçmez.

**Faz 3 raporundaki E2E sonucuna düzeltme:** "201 geçti, 4 atlandı, 0 başarısız" sonucu ana çalışma ağacında alındı ve yukarıdaki iki yerel kalıntıya dayanıyordu: kalmış fixture dosyası ve önbellekteki `/karay` görseli. Temiz bir checkout'ta bu sonuç **tekrarlanmıyor**. GitHub CI'nin `database` işi de temiz checkout'la çalışır.

### 4.2 CI ortamı provası

Yerel çalıştırmalar (bu ve önceki fazlarda) sunucuyu ve testleri `SITE_ENV=demo` ile koşuyor. CI'nin `database` işi ise `.env.local`'a `SITE_ENV=development` yazıyor:
- Build ve `npm start` bu değeri kullanıyor. Playwright yapılandırması da `.env.local`'ı kendisi yüklüyor.
- `development`'ta `showsDemoNotice()` `false` döner ve "DEMO ORTAMI" şeridi çıkmaz (`src/lib/site-env.ts`).
- Bazı testler bu şeridi bekliyor. `acceptance.spec.ts` başlığı da açıkça "SITE_ENV=demo bekler" diyor.

CI'daki `SITE_ENV=development`, şerit kuralı ve şeridi bekleyen testler aynı commit'le geldi (`fc3f704`, 27.09.2026). `database` işi hiç çalışmadığı için bu uyuşmazlık bugüne kadar görülmedi.

Etkisini ölçmek için CI işinin değerleriyle yerel bir prova yapıldı:
- Temiz checkout'taki gibi `.next` (görsel önbelleği dahil) ve `tests/e2e/.fixtures` silindi.
- Build, sunucu ve testler CI'nin `.env.local` değerleriyle koşuldu: `SITE_ENV=development`, `NEXT_IMAGE_ALLOW_LOCAL_IP=1`, rastgele `IP_HASH_SALT` ve `CRON_SECRET`, CI'nin e-posta ve DNS test değerleri. Supabase adresi ve anahtarları yerel yığından alındı.
- Ardından tam `npx playwright test` çalıştırıldı.

Kalan farklar:
- `supabase start` yerine bu konteynerdeki yerel yığın kullanıldı.
- Veritabanı sıfırdan kurulmadı; birikmiş yerel veritabanı kullanıldı.
- CI'nin `e2e-admin@example.test` hesabı yerine yerel yönetici hesabı kullanıldı.
- Runner'ın işletim sistemi ve fontları farklı.

Aşağıdaki 7 hatanın nedenleri CI'da da aynen var. Kalan farklar yüzünden CI'da ek hatalar da çıkabilir.

**Sonuç:** 155 geçti · **7 başarısız** · 4 atlandı · 39 çalışmadı (13,4 dk; build 34 sn). Her hatanın nedeni test kayıtlarından (`error-context.md`) teyit edildi:

| Test | Proje | Neden | Arkasından koşmayan |
| --- | --- | --- | --- |
| Ziyaretçi › SEO (`visitor.spec.ts:168`) | desktop, mobile | `getByText('DEMO ORTAMI')` bulunamadı. Test, site dizine kapalıysa şeridi bekliyor; `development`'ta site dizine kapalı ama şerit yok | — |
| Ziyaretçi (telefon) › 1–6 (`acceptance.spec.ts:71`) | mobile, iphone | `getByText('DEMO ORTAMI').first()` bulunamadı | Dosya `serial`: her projede kalan 10 test (toplam 20) |
| KARAY-01 | desktop | P3-F1 (§4.1). Aynı görsel kırık; sunucu logunda `/karay/ekran-kontrol-merkezi.png` ve `/karay/ekran-renkler.png` için "isn't a valid image" | KARAY-02…18 (17) |
| OBR-A, SEO-E | desktop | Fixture yok (`ENOENT`, §4.1) | OBR-B, OBR-C (2) |

Atlanan 4 test, §4.1'deki koşullu atlamalarla aynı.

**Anlamı:** `database` işi bugünkü kodla açılırsa E2E adımı **en az 7 hatayla** kırmızı olur. Bunların 4'ü CI yapılandırması ile testlerin beklentisi arasındaki uyuşmazlıktan (K-10), 3'ü §4.1'deki hatalardan (K-8, K-9) kaynaklanıyor. Kod, test ve workflow bu fazda değiştirilmedi.

### 4.3 GitHub Actions'taki veritabanı testleri

**Neden devre dışı?** `database` işi `vars.ELVANKENT_CI_DB_TESTS == 'true'` koşuluna bağlı ve depoda bu değişken yok. Bu yüzden iş FAZ 0'dan bu yana her çalışmada `skipped`, ve **hiç çalışmadı**. Eksik olan bir sır ya da izin değil; yalnızca bu değişken (§5.1).

---

## 5. CI güvenilirliği

### 5.1 `ELVANKENT_CI_DB_TESTS`'i güvenli biçimde açmak

- **Neden güvenli:** `database` işi hiçbir GitHub sırrı kullanmıyor. Supabase'i runner içinde Docker ile sıfırdan kuruyor (30 migration + demo verisi), anahtarları o anda `supabase status` ile üretiyor ve iş bitince her şey yok oluyor. Production'a veya kalıcı bir veritabanına bağlanmıyor.
- **Nasıl açılır** (depo yöneticisi, GitHub › Settings › Secrets and variables › Actions › **Variables**): `ELVANKENT_CI_DB_TESTS` = `true`. **Repository variable** olarak açılmalı; secret değil.
- **Ne zaman:** önce `quality` işi doğrulama dalında yeşil görülsün. Bugünkü kodla `database` işinin E2E adımı **kesin kırmızı** olur (§4.1, §4.2). Bu yüzden önce K-8, K-9 ve K-10 düzeltmeleri yapılmalı ve temiz bir kopyada, CI değerleriyle yerelde yeşil görülmeli. Ardından değişken açılıp aynı dalda `workflow_dispatch` ile bir kez elle çalıştırılsın. Sorunlar düzeltilmeden zorunlu kontrol yapılmasın.
- **İlk çalıştırmada beklenen riskler** (iş hiç denenmedi):
  - `supabase/setup-cli@v1` bir **dal** (değişebilir; Node 20).
  - `version: latest` her çalışmada farklı CLI sürümü getirebilir.
  - Depoda `supabase/config.toml` yok. İş `supabase init` ile o anki şablonu üretip MFA ayarını `sed` ile açıyor; şablon değişirse MFA testleri düşebilir.
  - `supabase status -o env` anahtar adları yeni sürümlerde değişebilir.
  - `npx --yes wait-on` sabitlenmemiş bir paketi çalışma anında indiriyor.
  - Playwright `retries: 0` ve OBR-A testi zaman zaman `networkidle` zaman aşımına düşüyor (Faz 3).

### 5.2 Ayrı test veritabanı ve en az yetki

| İlke | Bugün | Öneri |
| --- | --- | --- |
| CI testleri hangi veritabanında? | Her işte sıfırdan kurulan geçici yerel Supabase | **Böyle kalsın.** Barındırılan bir test veritabanı gerekirse ayrı bir Supabase projesi, ayrı ve kısıtlı bir rol, production verisinin kopyası değil |
| Production kimlik bilgileri | `elvankent-ci`'de yok | **Hiçbir zaman eklenmesin.** PR workflow'larında `pull_request_target` kullanılmasın (fork koduna sır açar) |
| Yedek sırları (`SUPABASE_DB_URL`, 4× `SUPABASE_S3_*`, 4× `BACKUP_S3_*`) | Henüz tanımlı değil. Tanımlanırsa **repository secret** olurlar | **GitHub Environment** (ör. `production-backup`) içinde tutulsunlar. Ortam yalnızca varsayılan/korumalı dala izin versin, istenirse onaylayıcı istesin; yedek işine `environment: production-backup` eklensin. Böylece doğrulama dalları ve PR'lar bu sırlara erişemez. Repository secret, yazma yetkisi olan herkesin herhangi bir dalda değiştirdiği workflow'a açık olur |
| Workflow izinleri | `contents: read` | Korunmalı |
| Fork PR'ları | Public depo. Fork'tan açılan PR'ların `pull_request` işlerine sır gitmez; aynı depodaki dallardan açılan PR'lar ise repository secret'larına erişebilir | Varsayılan "ilk katkıcılar için onay" ayarı korunmalı (panelden teyit); production sırları yalnızca kısıtlı Environment'ta tutulmalı |

### 5.3 Action'ların SHA ile sabitlenmesi

Etiketler (`@v4`) ve dallar (`@v1`) taşınabilir; ele geçirilen bir etiket, depodaki her workflow'a kod çalıştırır. Tam commit SHA'sı ile sabitlemek bunu önler. Bedeli: güncellemeler elle ya da Dependabot ile yapılır.

SHA'lar bugün (11.10.2026) `git ls-remote` ile doğrulandı; çalışma zamanı her sürümün `action.yml` dosyasından okundu.

| Action (bugünkü başvuru) | Bugün çözülen | Çalışma zamanı | Önerilen sabitleme | Uyumluluk notu |
| --- | --- | --- | --- | --- |
| `actions/checkout@v4` | v4.4.0 `11d5960a326750d5838078e36cf38b85af677262` | node20 | v6.1.0 `d23441a48e516b6c34aea4fa41551a30e30af803` veya v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1` | v5: node24 (runner ≥ 2.327.1). v6: kimlik bilgisi `.git/config` yerine `$RUNNER_TEMP`'te, workflow değişikliği gerekmez. v7: `pull_request_target`/`workflow_run`'da fork kodunu varsayılan olarak çekmez (KARAY kullanmıyor), ESM |
| `actions/setup-node@v4` | v4.4.0 `49933ea5288caeca8642d1e84afbd3f7d6820020` | node20 | v6.5.0 `249970729cb0ef3589644e2896645e5dc5ba9c38` veya v7.1.0 `949feb2413d6458794dcd2491c4babbbce0c15c1` | v5: node24, otomatik önbellek (KARAY zaten `cache: npm` veriyor). v6: `always-auth` kaldırıldı (kullanılmıyor). v7: `NODE_AUTH_TOKEN` yer tutucusu kaldırıldı (`registry-url` kullanılmıyor). KARAY'ın kullanımı için kırıcı değişiklik görülmedi |
| `actions/upload-artifact@v4` | v4.6.2 `ea165f8d65b6e75b540449e92b4886f43607fa02` | node20 (v5 de node20) | v6.0.0 `b7c566a772e6b6bfb58ed0dc250532a479d7789f` veya v7.0.2 `cf430e030ddbb5b0abf93d22962f4752f3646cd9` (node24) | Yalnızca hata durumunda çalışıyor. Sürüm notları bu oturumda okunamadı; geçişten önce incelenmeli. O zamana kadar v4.6.2 SHA'sı ile sabitlenebilir |
| `supabase/setup-cli@v1` | **Dal** `v1` = v1.7.3 `1dedf2c611547ede7232d26866dd3c56ab903bbb` | node20 | v3.0.1 `45a513f8c64c0bc8e0e3dfe572b5c95be85f6359` (composite) **ve** `version:` alanına sabit bir CLI sürümü | v3, Node 20+ ister (iş önce `setup-node` çalıştırıyor). CLI sürümü ilk başarılı çalışmadan sonra sabitlenmeli |
| gitleaks (curl ile indiriliyor) | v8.24.2 tarball | — | Sürüm sabit ama **sağlama toplamı denetlenmiyor** | İndirilen arşivin SHA-256'sı resmi `checksums.txt` ile karşılaştırılmalı |

### 5.4 Node.js sürüm uyarısı

- **Gerçek uyarı** (`ff2f7da` CI logu): "Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4."
- **Anlamı:** Runner bu action'ları zaten Node 24'te zorla çalıştırıyor; bugün kırmızıya düşürmüyor, ama Node 20 desteği kaldırıldığında sorun çıkarabilir.
- **Uygulamanın Node sürümü ayrı bir konu:** CI'da `node-version: 22`, `engines.node >= 20.9.0`, yerel 22.22.2. Vercel projesinin Node sürümü okunamadı; 22.x olması ve CI ile aynı tutulması önerilir.
- **Geçiş yolu:**
  1. Doğrulama dalında `checkout` ve `setup-node`'u node24 sürümlerine geçirip SHA ile sabitlemek (§5.3); `upload-artifact` ve `setup-cli` için de node24/composite sürümlere geçmek.
  2. `quality` ve `database` işlerinin yeşil olduğunu görmek.
  3. Ardından yayın dalına almak.

  Bu tek, küçük bir workflow değişikliğidir; bu fazda yapılmadı.

---

## 6. CI'da kalan engeller

1. `4aa0ae3` GitHub CI'da hiç koşmadı. `ff2f7da` hâlâ kırmızı (`npm audit`); `4aa0ae3` ile düzelmesi bekleniyor, ama bu henüz GitHub'da kanıtlanmadı.
2. `database` işi (RLS + E2E) kapalı ve **hiç denenmedi**; ilk çalıştırma riskleri §5.1'de.
3. **E2E temiz checkout'ta kırmızı** (§4.1). OBR-A ve SEO-E test sırası bağımlılığı yüzünden, KARAY-01 ise ürün hatası P3-F1 yüzünden düşüyor; arkalarından 19 test hiç koşmuyor. `database` işi bugünkü kodla açılırsa **ilk çalışmada kırmızı** olur. Bunlar CI altyapısının değil, test düzeninin ve ürünün gerçek hataları; düzeltmeleri bu fazın kapsamı dışında (K-8, K-9).
4. **CI ortamı testlerin beklediği ortamla uyuşmuyor** (§4.2). CI `.env.local`'a `SITE_ENV=development` yazıyor; acceptance ve ziyaretçi SEO testleri demo ortamını ("DEMO ORTAMI" şeridi) bekliyor. CI ortamı provasında bu yüzden 4 test daha düştü ve 20 test koşmadı (K-10).
5. Action'lar etiket/dal ile çağrılıyor ve node20. `supabase/setup-cli@v1` değişebilir bir dal; Supabase CLI `latest`; gitleaks indirmesi sağlama toplamsız; `npx --yes wait-on` sabitlenmemiş.
6. Dal koruması ve zorunlu kontrol yok. Production dalı ile çalışma dalı aynı.
7. `mustafakara-0` Vercel projesi her push'ta başarısız bir Preview üretiyor. Gürültü yaratıyor ve commit durumunu kırmızı gösteriyor.
8. Playwright `retries: 0`, OBR-A testinde zamanlamaya bağlı kararsızlık var (Faz 3 §1.2). CI'da E2E açılınca ara sıra kırmızı görülebilir.
9. Actions izinleri, değişkenler, sırlar, ortamlar ve Vercel ayarları bu oturumdan okunamadı; operatör teyidi gerekiyor.

## 7. Üretime çıkmadan önce yapılması gerekenler

- [ ] Doğrulama dalında `quality` yeşil (GitHub'da, gerçek çalışma bağlantısıyla).
- [ ] E2E logo fixture'ı test sırasından bağımsız üretiliyor (K-8); test kapsamı düşürülmeden.
- [ ] P3-F1 düzeltilmiş; KARAY-01 temiz build'de geçiyor (K-9).
- [ ] CI'nin `SITE_ENV` değeri testlerin beklediği ortamla uyumlu (K-10).
- [ ] Bu düzeltmelerden sonra temiz bir kopyada tam E2E yeşil (yerel), ardından GitHub'da `database` işi yeşil.
- [ ] `ELVANKENT_CI_DB_TESTS=true` ile `database` işi yeşil; CLI sürümü ve action'lar sabitlenmiş, node24 geçişi yapılmış.
- [ ] Yayın akışı kararı (D-14): production dalı (ör. `main`) ayrı olmalı. Vercel'de bu dal production yapılmalı, GitHub'da korunmalı, `quality` (ve `database`) zorunlu kontrol olmalı. Çalışma dalları yalnızca Preview üretmeli.
- [ ] Vercel: Preview kapsamında production sırrı olmamalı, Preview'lar korumalı olmalı, `mustafakara-0` düzeltilmeli ya da bağlantısı kaldırılmalı, Node sürümü 22.x.
- [ ] Faz 3'ün açık maddeleri:
  - Yedeğin açılması (`ELVANKENT_BACKUP_ENABLED` değişkeni, `BACKUP_BUCKET`, 9 sır; tercihen bir GitHub Environment içinde);
  - ilk elle yedek;
  - Supabase test projesine geri yükleme provası;
  - D-15 kararları (`remotePatterns`, logo SVG, CSP/çerez/HSTS);
  - `/karay` görsel bulgusu (P3-F1): yukarıda K-9. Vercel'deki durumu ayrıca doğrulanmalı.
- [ ] Production'a çıkış yalnızca yukarıdakilerden sonra ve açık onayınızla.

## 8. Gerekli kullanıcı kararları

| # | Karar | Seçenekler | Öneri |
| --- | --- | --- | --- |
| K-1 | Faz 3'ü GitHub'da doğrulama yolu | 1b (dal + `vercel.json` koruması) · 1 (panel kontrolünden sonra yalnızca dal) · 3 (ayrı depo) · önce Vercel bağlayıcısını `kara-6892`'ye yetkilendirmek | **1b**. Kod değişikliği istemezseniz panel kontrolü + 1 |
| K-2 | Doğrulama dalı adı ve push onayı | `claude/karay-faz3-dogrulama` (önerilen) veya sizin seçeceğiniz ad | Push yalnızca bu dala, açık onayla |
| K-3 | CI sertleştirme commit'i (node24 sürümleri, SHA sabitleme, CLI sürümü, gitleaks sağlama toplamı, `wait-on`) | Şimdi doğrulama dalında · sonra | Doğrulama dalında, `quality` yeşil olduktan sonra |
| K-4 | `ELVANKENT_CI_DB_TESTS` | Aç · kapalı tut | K-3, K-8, K-9 ve K-10'dan sonra aç; önce elle bir kez çalıştır. Bugünkü kodla açılırsa E2E kesin kırmızı (§4.2) |
| K-5 | Yayın akışı (D-14) | Ayrı korumalı production dalı · mevcut dal | Ayrı ve korumalı production dalı |
| K-6 | `mustafakara-0` Vercel projesi | Düzelt · bağlantıyı kaldır | Kullanılmıyorsa bağlantıyı kaldırın (sizin panel işleminiz) |
| K-7 | Yedek sırlarının yeri | Repository secret · Environment | Environment (varsayılan dala kısıtlı) |
| K-8 | E2E logo fixture'ı (test altyapısı değişikliği) | (a) `office-brand` ve `office-seo` kendi `beforeAll`'ında üretir (acceptance'taki `sharp` kodu ortak bir yardımcıya taşınır) · (b) Playwright `globalSetup` · (c) dosya depoya eklenir | **(a)** veya (b). Testler aynı adımları doğrulamaya devam eder; kapsam düşmez |
| K-9 | P3-F1 düzeltmesi (ürün kodu, yüzey ayrımına dokunur) | (a) `/karay/` altındaki statik dosya uzantılarını proxy eşleştiricisinden çıkarmak · (b) görselleri `/karay/` dışına taşımak · (c) bu görsellerde `unoptimized` | (a) veya (b); yüzey ayrımı testleri (`surface-isolation`, KARAY-16) ve KARAY-01 ile birlikte. (c) yalnızca geçici çözüm |
| K-10 | CI'da `SITE_ENV` | (a) CI `.env.local`'da `SITE_ENV=demo` (tek satırlık workflow değişikliği) · (b) testleri ortama göre koşullu yapmak | **(a)**. Testlerin belgelenmiş ön koşulu ve yerel çalıştırmalardaki ortam bu; CI zaten demo verisi yüklüyor. `SITE_ENV` başka bir davranışı yalnızca `production` değerinde değiştiriyor (alan adı politikası); bunun dışında yalnızca izleme kayıtlarındaki ortam etiketinde görünüyor. (b) kapsamı daraltır |
| K-11 | `4aa0ae3` commit mesajındaki "E2E 201 passed / 4 skipped / 0 failed" ifadesi | Olduğu gibi bırakmak (düzeltme bu belgede kayıtlı, hash değişmez) · push'tan önce mesajı düzeltmek (hash değişir, gönderilen yama dosyası da yenilenir) | Olduğu gibi bırakmak |
