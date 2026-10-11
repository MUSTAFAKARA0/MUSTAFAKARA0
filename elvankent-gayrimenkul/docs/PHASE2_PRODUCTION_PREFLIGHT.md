# KARAY — Faz 2: Production ön koşulları ve preflight denetimi

> **Tarih:** 11.10.2026
> **Denetlenen commit:** `6055693`. Dal `claude/elvankent-real-estate-platform-vxq9dj`, origin ile aynı; çalışma ağacı temiz.
> **Tür:** Denetim ve plan. Uygulama kodu, veritabanı, Vercel, DNS ve canlı servisler **değiştirilmedi**.
> **Production erişimi:** **Kullanılmadı.** Production'a ait her madde "operatör doğrular" olarak işaretlidir.
> **Gizli değerler:** Belgede gizli değer yoktur; yalnızca değişken **adları** geçer.
> **Eş belge:** [PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md). Senin vermen gereken ticari ve yönetsel kararlar orada `D-xx` olarak yer alır. Bu belgedeki bulgular (`PF`, `SEC`, `OPS`) gerektiğinde o kararlara bağlanır.

## 0. Sonuç

| Alan | Sonuç | Gerekçe |
| --- | --- | --- |
| Technical readiness | **PARTIAL** | **Yerelde her şey yeşil:** birim 366/366, RLS 105/105, E2E 201 geçti / 4 atlandı / 0 başarısız. Typecheck ve lint temiz. 30 dosyalık migration zinciri belgeyle birebir. **GitHub CI ise `6055693`'te kırmızı** (npm audit, PF-01). CI veritabanı testleri kapalı ve hiçbir dal korumalı değil. Yani "yeşil" yalnızca yerelde kanıtlı. |
| Security readiness | **FAIL** | **Uygulama katmanı güçlü:** RLS, kiracı yalıtımı, MFA, hız sınırları; service-role yalnız sunucuda. **Ama** yaması çıkmış iki yüksek önemli açık KARAY'ın gerçek kod yoluna uygulanıyor: sharp/librsvg (ilan fotoğrafı ve logo yükleme) ve Next.js görüntü optimizasyonu SSRF. Bu yüzden CI'daki gizli anahtar taraması da çalışmıyor. Ayrıca depo herkese açık ve dal koruması yok. |
| Commercial readiness | **FAIL** | **Eksikler:** fiyat yok (`plans.price_monthly` boş); tahsilat yöntemi ve fatura (e-Arşiv/e-Fatura) süreci yok; KARAY'ın kendi yasal metinleri, müşteri sözleşmesi ve veri işleme sözleşmesi yok. İptal veya süre bitiminde limitlerin kalktığı bir kod boşluğu var. Elle yönetim araçları (plan atama, müşteri durumu, notlar) hazır. |
| Production readiness | **FAIL** | Production ortamı doğrulanamadı (erişim yok). KARAY yedeği hiç çalışmadı (14/14 "skipped") ve gerçek Supabase'e geri yükleme provası yok. Barındırma planları, alan adı/DNS, e-posta alan adı ve izleme kanıtlanmadı. Varsayılan dal, AI çalışma dalı. |

**Öncelik ölçeği**

| Öncelik | Ne zaman |
| --- | --- |
| **P0** | İlk ücretli müşteriden veya production açılışından önce zorunlu (engelleyici). |
| **P1** | İlk müşteriyle birlikte veya ilk 30 gün içinde. |
| **P2** | Müşteri sayısı artmadan veya otomatik tahsilata geçmeden önce. |
| **P3** | İyileştirme. |

**Durum etiketleri**

| Etiket | Anlamı |
| --- | --- |
| **Doğrulandı** | Kod, komut veya API ile görüldü. |
| **Sapma** | Önceki rapor veya belgeyle çelişiyor ya da eksik. |
| **Doğrulanamadı** | Production erişimi gerekiyor → operatör. |

---

## 1. Doğrulama: raporlar ↔ kod ↔ ortam

### 1.1 Git ve depo

| Kontrol | Bulunan | Durum |
| --- | --- | --- |
| HEAD / origin | `6055693` = origin; çalışma ağacı temiz | Doğrulandı |
| Varsayılan dal | `claude/elvankent-real-estate-platform-vxq9dj` (GitHub API `default_branch`) | Doğrulandı — risk: PF-04 |
| Dallar ve koruma | 3 dal, hepsi `claude/…`, hiçbiri korumalı değil; ruleset yok; **`main` dalı yok** | Doğrulandı — PF-04 |
| Açık PR | [PR #2](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/pull/2): head bu dal, **base `claude/photo-to-stl-app-rxbvev` (başka bir proje)**. 49 commit, 827 dosya, durum `unstable` | Doğrulandı — PF-04 |
| Görünürlük | Public. Sahibi kullanıcı hesabı. Depo adı kullanıcı adıyla aynı (**GitHub profil deposu**). Aynı depoda başka iki projenin dalları ve ortak geçmişi var. 0 fork, 0 yıldız, issues kapalı | Doğrulandı — SEC-01 |

### 1.2 Test temel değeri (bu oturumda yeniden ölçüldü, yerel)

| Kontrol | Sonuç |
| --- | --- |
| `npm run test:unit` | 366/366 |
| `npm run test:rls` | 105/105 |
| `npm run typecheck` | 0 hata |
| `npm run lint` | 0 hata; 3 uyarı, önceden vardı |
| `npm run demo:sql -- --check` | Demo SQL güncel |
| `supabase/ops/postflight_v2.sql` (yerel) | 22 TAMAM + 4 KARŞILAŞTIR, 0 HATA |
| Tam E2E (`playwright test`, 205 çalıştırma, 18 dk) | **201 geçti, 4 atlandı, 0 başarısız**; FAZ 1 temel değeriyle aynı. Derleme kaynaklardan yeni: `.next/BUILD_ID`'den yeni kaynak dosyası yok. |
| `npm run prelaunch -- --production` (yerel değerlerle) | 10 kritik / 8 uyarı. **Beklenen sonuç:** yerel değerler production değil; kapı doğru hata veriyor. |

### 1.3 Migration zinciri

**Durum: Doğrulandı.**

- `supabase/migrations/` içinde **30** dosya var: V1'in 4 dosyası (`20260922000001…04`) ve 26 dosya (V2 → FAZ 1).
- Son dosya `20261011000001_customer_operations.sql`. `karay_schema_version()` aynı değeri döndürür.
- `npm run prelaunch` bu değeri depodaki son dosya adıyla karşılaştırır (`scripts/prelaunch-check.mjs:84-90`).
- [PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md) listesi (26 dosya) ve sırası dosyalarla birebir.

### 1.4 Önceki raporların iddiaları (koddan doğrulandı)

| İddia (FAZ 0 / FAZ 1) | Kanıt | Durum |
| --- | --- | --- |
| Şifre sıfırlama KARAY sağlayıcısıyla gider (`generateLink`, güvenilir kök adres). Sınır: e-posta başına saatte 3, IP başına saatte 10 | `src/app/actions/auth.ts:208-224`; `20261010000001_password_reset_requests.sql:43,49` | Doğrulandı |
| E-posta tarafında `EmailProvider` arayüzü, geçici hatada sınırlı yeniden deneme ve `Idempotency-Key` var | `src/modules/notifications/email.ts:42,61,76,115-127` | Doğrulandı |
| Yedek GRANT/REVOKE yetkilerini koruyor (`--no-privileges` yok) ve parmak izi alınıyor | `.github/workflows/elvankent-backup.yml:73,76,80` | Kod: Doğrulandı. Çalışma: **Sapma** (1.5) |
| Şema sürümü kontrolü yapılıyor | `scripts/prelaunch-check.mjs:84-90` | Doğrulandı |
| Kendi adresi olmayan ofis başka müşterinin sitesine bağlanmıyor | `src/platform/tenant/host.ts:175-189` (`ownAddress`) | Doğrulandı |
| Yeni müşteri sitesi taslak başlıyor | `src/modules/platform/provisioning.ts:64` | Doğrulandı |
| Ekip daveti tek kullanımlık bağlantı ve yalnızca service role ile | `20261011000001_customer_operations.sql`; RLS 105/105 | Doğrulandı |
| Postflight 26. satır `to_regclass` kullanıyor | `supabase/ops/postflight_v2.sql` | Doğrulandı |

### 1.5 Sapmalar

**1. CI kırmızı.**
- FAZ 1 raporu yerel test sonuçlarını raporladı. GitHub'da `elvankent-ci` [#76 (push)](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/38055247287) ve [#77 (PR)](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/38055250723) **başarısız**.
- FAZ 0 commit'inde (`a5a2cfa`, #74/#75) CI yeşildi.
- `git diff a5a2cfa 6055693 -- package.json package-lock.json` boş, yani FAZ 1 bağımlılık değiştirmedi. Kırmızının nedeni sonradan yayımlanan güvenlik bildirimleri (PF-01).

**2. Yedek hiç çalışmadı.**
- `elvankent-backup` 28.09–11.10 arasında 14 kez zamanlandı; **14'ü de `skipped`** ([son çalışma](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/38120942101)).
- [BACKUP_RESTORE.md](BACKUP_RESTORE.md) "Canlıda çalışmıyor" diyor; bu doğru, ama "Açılış kapısı" maddelerinin hiçbiri tamamlanmamış (PF-02).

**3. `prelaunch` kapsamı.**
- Yalnızca varsayılan ofisle sınırlı değil: `--org=slug` ile herhangi bir ofis denetlenebiliyor (`scripts/prelaunch-check.mjs:8,29`).
- Denetlemedikleri:
  - KARAY'ın kendi yasal metinleri
  - Supabase Auth ayarları
  - yedeklerin varlığı
  - DNS
  - e-posta alan adı doğrulaması
  - harici izleme
  - `PLATFORM_ADMIN_MFA_REQUIRED`

**4. Yedek logları.**
- Loga parmak izinin md5 özeti yazılmıyor. Yazılanlar: `sıra`, `tablo`, `kayıt sayısı` sütunları ve dump boyutu (`elvankent-backup.yml:77-78`).
- Depo public olduğu için yedek açılınca bu sayılar herkese açık olur (SEC-03).

**5. Belge tutarsızlığı (P3).**
- [OPERATIONS.md](OPERATIONS.md):16, Supabase SMTP ayarını zorunluymuş gibi anlatıyor.
- FAZ 0'dan sonra davet ve şifre sıfırlama KARAY'ın sağlayıcısıyla gidiyor. Supabase'in kendi e-postasına yalnızca e-posta yapılandırılmamışsa düşülüyor (`auth.ts:208,228-233`). [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md):24 bunu doğru anlatıyor.

### 1.6 Production'da doğrulanamayanlar (operatör)

Production erişimi bu fazda bilinçli olarak kullanılmadı. Bu oturumda GitHub değişken/sır API'si de 403 döndü. Aşağıdakiler operatör tarafından doğrulanmalıdır:

| Sağlayıcı | Doğrulanacaklar |
| --- | --- |
| Vercel | plan; production dalı; ortam değişkenlerinin değerleri; alan adları; cron |
| Supabase | plan; bölge; yedek/PITR; Auth ayarları; Storage S3 erişimi |
| DNS | kayıtlar ve nameserver |
| Resend | alan adı doğrulaması |
| Uptime izleyici | kurulum |
| GitHub Actions | değişkenler (`ELVANKENT_CI_DB_TESTS`, `ELVANKENT_BACKUP_ENABLED`) ve sırlar |

---

## 2. Production ön koşul bulguları

### PF-01 · CI kırmızı: KARAY'a uygulanan yüksek önemli güvenlik bildirimleri

**Öncelik:** P0

**Mevcut durum**
- `quality` işi `npm audit --omit=dev --audit-level=high` adımında başarısız.
- Bu yüzden sonraki adım olan **gitleaks hiç çalışmadı** (`.github/workflows/elvankent-ci.yml:65-71`).
- FAZ 1 bağımlılık değiştirmedi; neden, sonradan yayımlanan bildirimler.

**Kanıt** (`npm audit --omit=dev`: üç paket yüksek önemde)

| Paket (kurulu) | Bildirim | Yamalı sürüm | KARAY'a etkisi |
| --- | --- | --- | --- |
| `sharp` 0.35.4 (librsvg 2.62.91) | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w): librsvg'de use-after-free. Bildirimdeki ifade: "possible remote code execution (RCE) on glibc-based Linux"; CVSS 4.0: 8.9 | 0.35.5 (librsvg 2.63.2) | **Kapsamda ve erişilebilir** — ayrıntı aşağıda |
| `next` 16.3.6 | [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4): görüntü optimizasyonunda SSRF (yüksek) | 16.3.8 | **Kapsamda**: `images.remotePatterns` tanımlı (`next.config.ts:57`, joker `*.supabase.co`). Bildirime göre `remotePatterns` yoksa uygulama etkilenmez. Tetikleyici, DNS kaydına güvenilemeyecek izinli bir uzak adres; `*.supabase.co` DNS'i Supabase'te olduğu için pratik risk sınırlı görünüyor. Yine de yama gerekli. |
| `next` 16.3.6 | GHSA-mcj8-r9mp-w47p, GHSA-4jqv-mc3x-m676, GHSA-3w37-wq28-93x7, GHSA-f87g-xv8r-7p7x (orta); GHSA-39w2-rjm5-chcv (düşük) | 16.3.8 | Kod incelemesine göre düşük (ayrıntı aşağıda); kesinlik için yama |
| `source-map-js` 1.2.1 (postcss üzerinden) | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q): olay döngüsünde DoS (7.5) | 1.2.2 | Çoğunlukla derleme zamanında; kilit dosyası güncellemesiyle kapanır |

`sharp` açığı neden erişilebilir:
- **Logo yükleme:** SVG'yi bilerek çözüyor (`src/modules/media/branding.ts:82-107`).
- **İlan ve medya yükleme:** `inspectImage`, dosya biçimini kontrol etmeden **önce** `sharp(input).metadata()` çağırıyor (`src/modules/media/processing.ts:53`). libvips biçimi dosya içeriğinden algılar. Bu yüzden adı `.jpg` olan bir SVG içeriği de librsvg'ye gider.
- **Yerelde doğrulandı:** Zararsız bir SVG, aynı seçeneklerle `metadata()` → `format: svg` döndürdü. İstismar denenmedi.
- Bu yolu yükleme yetkisi olan her ofis kullanıcısı tetikleyebilir. Sunucu sürecinde `SUPABASE_SERVICE_ROLE_KEY` bulunur.

`next`'in orta ve düşük önemli bildirimleri neden düşük görünüyor:
- Pages Router yok.
- `use cache` yok.
- Metadata görüntü rotası dosyası yok.
- MCP uç noktası yalnızca geliştirme sunucusunda.
- Tek catch-all rota `t/[tenant]/[slug]/[...rest]`; kök catch-all değil.

**Risk**
- sharp yolu sunucuda kod çalıştırmaya, oradan service-role anahtarıyla **tüm kiracıların verisine** erişime kadar gidebilir.
- CI kırmızıyken gerçek regresyonlar ve sızan gizli anahtarlar görünmez.

**Benim vermem gereken karar:** Sonraki fazın ilk işi olarak yalnızca güvenlik güncellemesi içeren küçük bir değişikliğe onay (D-16).

**Önerilen seçenek**
1. `next` 16.3.6 → 16.3.8, `sharp` → 0.35.5; kilit dosyasında `source-map-js` ≥ 1.2.2.
2. Ardından tam regresyon: birim, RLS, E2E, build.
3. Derinlemesine savunma (SEC-06): medya yolunda biçim imzasını sharp'tan önce denetlemek.
4. Güncelleme gecikirse geçici önlem: bildirimde önerilen `sharp.block({ operation: ['VipsForeignLoadSvg'] })`. Bu süreç genelindedir; SVG logo yüklemesini de kapatır.
5. `6055693` bu yapılmadan production'a alınmamalı.

**Bağımlılıklar:** Yok; diğer işlerin önünde. CI'da gitleaks'in yeniden çalışması bu işe bağlı (SEC-05).

**Tamamlanma ölçütü**
- `npm audit --omit=dev --audit-level=high` 0 bulgu.
- CI `quality` işi gitleaks dahil yeşil.
- Tam E2E yeşil.
- `sharp.versions.rsvg` ≥ 2.63.2.

---

### PF-02 · KARAY'ın kendi yedeği hiç çalışmadı; gerçek Supabase'e geri yükleme provası yok

**Öncelik:** P0

**Mevcut durum**
- 14 zamanlanmış çalışmanın 14'ü de `skipped`, çünkü `ELVANKENT_BACKUP_ENABLED` ≠ `true`.
- Yedek kovasında hiçbir `.dump`, parmak izi veya Storage kopyası yok.
- Geri yükleme provası yalnızca yerel PostgreSQL yığınında boş veritabanına yapıldı. [BACKUP_RESTORE.md](BACKUP_RESTORE.md) "Doğrulama kaydı" bunu açıkça söylüyor.
- Workflow tüm veritabanını tek bir `pg_dump` ile alıyor. Bunun gerçek bir Supabase projesine (`auth`/`storage` şemaları ve Supabase'in yönettiği roller) geri yüklenebildiği **hiç denenmedi**.
- Supabase planının sağladığı yedek/PITR bilinmiyor.

**Kanıt**
- GitHub Actions çalışma listesi: #1–#14, sonuç `skipped`.
- `.github/workflows/elvankent-backup.yml:32`.
- BACKUP_RESTORE.md "Açılış kapısı": maddeler işaretsiz.
- Supabase belgesi ([backups](https://supabase.com/docs/guides/platform/backups)):
  - Free planda otomatik yedek yok.
  - Pro'da 7 günlük günlük yedek var.
  - PITR ücretli eklenti.
  - **Storage nesneleri veritabanı yedeğine dahil değil.**

**Risk:** Veri kaybında geri dönüş yolu yok. RPO ≤ 24 saat / RTO ≤ 4 saat hedefleri yalnızca kâğıt üzerinde.

**Benim vermem gereken karar**
- Supabase planı ve PITR (D-11).
- Yedek kovasının sağlayıcısı ve bölgesi (D-11; yurt dışı aktarım D-10).
- Saklama süresi.

**Önerilen seçenek**
1. İki bağımsız kopya: Supabase ücretli planın günlük yedeği ve KARAY iş akışı. İş akışının hedefi ayrı hesapta, sürümleme açık, S3 uyumlu bir kova.
2. BACKUP_RESTORE.md "Açılış kapısı" adımlarını sırayla uygula.
3. İlk çalışmayı elle tetikle.
4. Dump'ı **gerçek bir Supabase test projesine** geri yükle ve parmak izini karşılaştır.

**Bağımlılıklar:** D-11, D-10, SEC-03 (log görünürlüğü), PF-03.

**Tamamlanma ölçütü**
1. İş akışı en az bir kez yeşil bitti; kovada `.dump` + `.fingerprint.txt` + `storage/current/…` var.
2. Aynı dump gerçek bir Supabase test projesine geri yüklendi; parmak izi farkı boş, postflight HATA yok. Hata veren Supabase nesneleri listelendi ve çözümü belgelendi.
3. Sağlayıcının yedek/PITR durumu BACKUP_RESTORE.md tablosuna yazıldı.
4. RPO/RTO hedefleri onaylandı (D-18).

---

### PF-03 · Barındırma planları ticari kullanıma uygun mu?

**Öncelik:** P0

**Mevcut durum**
- Vercel ve Supabase planları bu ortamdan görülemiyor.
- `vercel.json`: bölge `fra1`; günlük cron `/api/cron/media-cleanup` (03:17 UTC).

**Kanıt**
- Vercel Hobby, ticari olmayan kişisel kullanımla sınırlı ([Hobby](https://vercel.com/docs/plans/hobby), [Fair use](https://vercel.com/docs/limits/fair-use-guidelines)).
- Supabase Free'de otomatik yedek yok.
- Free projeler 7 günlük pencerede düşük etkinlik gösterirse duraklatılır; ücretli projeler duraklatılmaz ([pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).

**Risk:** Vercel koşullarının ihlali; projenin duraklaması; yedeksiz çalışma.

**Benim vermem gereken karar:** Vercel Pro ve Supabase ücretli plan bütçesi (D-11). Fiyat yazılmadı; güncel fiyat sağlayıcıdan alınmalı.

**Önerilen seçenek**
- Vercel Pro ve Supabase Pro; PITR daha sonra.
- Supabase bölgesi Vercel `fra1`'e yakın olsun ve KVKK aktarım kayıtlarına yazılsın ([LEGAL_DATA_MAP.md](LEGAL_DATA_MAP.md) satır 11 Frankfurt öneriyor).

**Bağımlılıklar:** D-11, D-10.

**Tamamlanma ölçütü**
- Vercel hesabı/ekibi Pro'da.
- Supabase projesi ücretli planda.
- Plan ve bölge bilgileri [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)'ye yazıldı.

---

### PF-04 · Dal ve yayın akışı: varsayılan dal AI çalışma dalı, koruma yok

**Öncelik:** P0

**Mevcut durum**
- Varsayılan dal `claude/…-vxq9dj`. Hiçbir dal korumalı değil; ruleset yok.
- Zamanlanmış iş akışları varsayılan dalda çalışır.
- [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md):9 production dalı olarak `main` öneriyor, ama `main` **yok**.
- Açık tek PR ([#2](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/pull/2)) başka bir projenin dalını (`claude/photo-to-stl-app-rxbvev`) hedefliyor. Birleştirilmesi KARAY'ı o projeye karıştırır; KARAY için inceleme kapısı değil.
- Vercel'in production'a hangi dalı aldığı görülemedi.

**Kanıt:** GitHub API (`default_branch`, `protected: false`, PR #2 `base`).

**Risk**
- Vercel production dalı bu dala bağlıysa her push doğrudan canlıya gider. CI kırmızıyken bile: Vercel'in GitHub Actions sonucunu bekleyip beklemediği bu ortamdan görülemedi, ayarından kontrol edilmeli.
- Birleştirmeden önce inceleme kapısı yok.

**Benim vermem gereken karar:** Dal stratejisi (D-14). Depo görünürlüğüyle birlikte düşünülmeli (D-12).

**Önerilen seçenek**
1. KARAY için `main` dalını oluştur; varsayılan dal ve production dalı `main` olsun.
2. Koruma kuralları: PR zorunlu; `quality` kontrolü zorunlu (`database` açılırsa o da); force-push yasak.
3. Vercel Production Branch = `main`; ilk aylarda production'a elle **Promote** (DEPLOYMENT_RUNBOOK:8-9).
4. AI oturumları yalnızca kendi dallarına push eder; PR #2 birleştirilmez.
5. Not: depo private yapılırsa GitHub Free'de dal koruması yoktur; Pro/Team gerekir ([kaynak](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)).

**Bağımlılıklar:** D-12, D-14, PF-01 (CI yeşillenmeden zorunlu kontrol birleştirmeyi kilitler).

**Tamamlanma ölçütü**
- `main` varsayılan ve korumalı.
- Vercel › Settings › Environments › Production › Branch Tracking = `main` (operatör notu).
- Kırmızı CI ile birleştirme engelleniyor.

---

### PF-05 · Alan adı ve DNS: `KARAY_HOSTS`, `PLATFORM_ROOT_DOMAIN`, joker alt alan adı

**Öncelik:** P0

**Mevcut durum**
- Production'da kod, `KARAY_HOSTS` ve `PLATFORM_ROOT_DOMAIN` olmadan kapıdan geçmez (prelaunch hatası). Bu değerler yoksa:
  - kendi alan adı olmayan ofisin sitesi ve önizlemesi hiçbir adreste açılmaz;
  - davet bağlantıları KARAY alan adına gider.
- Özel alan adı akışı (bekliyor → doğrulandı → aktif) hazır.
- Varsayılan `DOMAIN_PROVIDER=manual`: alan adı Vercel'e elle eklenir.
- Production değerleri görülemedi.

**Kanıt**
- `scripts/prelaunch-check.mjs:63-74`; `src/platform/tenant/host.ts:94,175-189`; [operations/domain-connection.md](operations/domain-connection.md).
- Vercel'de joker alan adı (`*.kök`) için alan adının Vercel nameserver'larını kullanması gerekir. Belge alternatif olarak `_acme-challenge` yetkilendirmesini anlatır ([working with domains](https://vercel.com/docs/domains/working-with-domains), [multi-tenant domains](https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains#using-wildcard-domains)).

**Risk**
- Alt alan adlı müşteri siteleri açılmaz.
- Yanlış DNS yüzünden sertifika alınamaz.

**Benim vermem gereken karar:** Alan adı stratejisi (D-13):
- KARAY'ın alan adı hangisi?
- Müşteri alt alan adları için kök aynı alan adı mı, ayrı bir alan adı mı?
- DNS Vercel'e taşınacak mı?

**Önerilen seçenek**
- KARAY site ve paneli kendi alan adında (`KARAY_HOSTS`).
- Müşteri alt alan adları ayrı, kayıtlı bir kökte (`PLATFORM_ROOT_DOMAIN`). Bu kökün DNS'i Vercel'de; `*.kök` Vercel projesine bağlı.
- İlk müşterilerde özel alan adı mevcut elle akışla bağlanır.

**Bağımlılıklar:** D-13; PF-03 (Vercel Pro); PF-08 (Auth Redirect URL listesi).

**Tamamlanma ölçütü**
- `npm run prelaunch -- --production` alan adı satırlarında hata vermiyor.
- `https://<test-slug>.<kök>` geçerli sertifikayla açılıyor.
- KARAY alan adında `/api/health` 200 dönüyor.

---

### PF-06 · E-posta teslimi

**Öncelik:** P0

**Mevcut durum**
- Sahip daveti, ekip daveti ve şifre sıfırlama KARAY'ın sağlayıcısıyla gider (Resend bağdaştırıcısı).
- **Sahip davetinin e-posta dışında yolu yok.** Bağlantı güvenlik gereği ekranda gösterilmez; e-posta yoksa müşteri hesabını etkinleştiremez (OPS-01).
- Production değerleri (`EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`) ve gönderici alan adının doğrulaması görülemedi.

**Kanıt**
- `src/modules/platform/invitations/service.ts:54-56`; `src/app/actions/auth.ts:208-224`.
- Prelaunch: e-posta tanımlı değilse veya `log` ise production'da hata (`scripts/prelaunch-check.mjs:54-59`).
- Resend ücretsiz plan: günde 100, ayda 3.000 e-posta ([quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits)). Alan adı için SPF ve DKIM kayıtları gerekir ([add a domain](https://resend.com/docs/add-a-domain)).

**Risk:** Müşteri devreye alınamaz, şifre sıfırlama çalışmaz, e-postalar spam klasörüne düşer.

**Benim vermem gereken karar:** Gönderici alan adı (D-13) ve sağlayıcı planı (D-11).

**Önerilen seçenek**
- KARAY alan adının bir alt alan adından gönderim.
- SPF + DKIM + DMARC kayıtları.
- Başlangıçta ücretsiz kota yetebilir; ama günlük 100 sınırı toplu davet günlerinde dar kalır, izlenmeli.

**Bağımlılıklar:** D-13, D-11.

**Tamamlanma ölçütü**
- Resend'de alan adı "verified".
- Test sahibine davet ve şifre sıfırlama e-postası gelen kutusuna düşüyor (spam değil).
- Prelaunch bildirim satırlarında hata yok.

---

### PF-07 · İzleme ve uyarı

**Öncelik:** P1 (ilk müşteriyle birlikte)

**Mevcut durum**
- `/api/health` var; yerelde `{"status":"ok","db":"ok",…}` döndü.
- Hata iletimi isteğe bağlı (`SENTRY_DSN` / `ERROR_WEBHOOK_URL`); yoksa prelaunch yalnızca uyarı verir.
- Harici uptime izleyici doğrulanamadı.
- Uyarıların kime gideceği yazılı değil.

**Kanıt:** `src/app/api/health/route.ts`; `scripts/prelaunch-check.mjs:76`; [operations/incident-response.md](operations/incident-response.md) (eşikler tanımlı, sorumlu yok).

**Risk:** Kesinti müşteriden öğrenilir.

**Benim vermem gereken karar:** Uyarıların hangi kişiye ve kanala gideceği (D-18).

**Önerilen seçenek**
- Ücretsiz katmanlı bir uptime servisiyle 5 dakikada bir kontrol:
  - KARAY alan adındaki `/api/health`;
  - yayındaki bir müşteri sitesinin ana sayfası.
- Hata iletimi için `ERROR_WEBHOOK_URL` veya Sentry.
- Yeni kod gerekmez.

**Bağımlılıklar:** PF-05, D-18.

**Tamamlanma ölçütü**
- İzleyici kurulu.
- Bilerek tetiklenen test uyarısı sorumluya ulaştı.
- Prelaunch "izleme" uyarısı yok.

---

### PF-08 · Supabase Auth ayarları ve süper admin MFA

**Öncelik:** P0

**Mevcut durum**
- Auth ayarları depoda tanımlı değil (`supabase/config.toml` yok); Supabase panelinde yapılıyor.
- Gerekenler ([DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) adım 6):
  - Site URL;
  - Redirect URL listesi (her özel alan adı dahil);
  - kayıt (sign-up) kapalı;
  - TOTP açık.
- Süper admin için MFA yalnızca `PLATFORM_ADMIN_MFA_REQUIRED=true` iken zorunlu.
- Prelaunch ne bunu ne de Auth ayarlarını denetliyor.

**Kanıt:** `src/platform/auth/session.ts:222`; `src/app/actions/mfa.ts:96`; prelaunch yalnızca ofisin `require_admin_mfa` alanına bakıyor (`scripts/prelaunch-check.mjs:120-121`).

**Risk**
- Açık kayıt istenmeyen hesaplara yol açar.
- Eksik Redirect URL davet ve şifre sıfırlama bağlantılarını kırar.
- MFA'sız süper admin hesabında tek parola tüm kiracılara erişim verir.

**Benim vermem gereken karar:** Karar yok; teknik zorunluluk. Yalnızca işi kimin yapacağı belirlenmeli.

**Önerilen seçenek**
- Runbook adım 6'yı uygula.
- `PLATFORM_ADMIN_MFA_REQUIRED=true` yap; süper admin hesabında TOTP kaydet.
- Ayarları operatör kontrol listesine kaydet.
- Bu kontrolleri prelaunch'a eklemek sonraki fazda küçük bir iş; zorunlu değil.

**Bağımlılıklar:** PF-05.

**Tamamlanma ölçütü**
- Kayıt denemesi reddediliyor.
- Hem KARAY alan adında hem bir özel alan adında şifre sıfırlama uçtan uca çalışıyor.
- Süper admin girişi TOTP istiyor.

---

### PF-09 · Hukuki metinler

**Öncelik:** P0

**Mevcut durum**
- KARAY'ın kendi metinleri (KVKK aydınlatma, gizlilik, kullanım koşulları):
  - kodda sabit ve **TASLAK** (`src/modules/karay/legal.ts`);
  - "[Şirket bilgileri girilecek]" yer tutucusu var;
  - sayfalar `noindex`.
- Eksikler: KARAY'ın çerez metni, müşteriyle **hizmet/abonelik sözleşmesi** ve **veri işleme sözleşmesi**.
- Ofis sitelerinin metinleri `pages.legal_reviewed` ile işaretleniyor. Prelaunch bunu yalnızca denetlenen ofis için kontrol ediyor; KARAY metinlerini denetlemiyor.

**Kanıt:** `src/modules/karay/legal.ts:15-48`; `src/app/karay/yasal/[slug]/page.tsx:12-30`; `scripts/prelaunch-check.mjs:102-106`; [LEGAL_DATA_MAP.md](LEGAL_DATA_MAP.md) ("Hukukçu kararı" maddeleri açık).

**Risk**
- KVKK aydınlatma yükümlülüğü karşılanmıyor.
- Hizmet sözleşmesiz veriliyor; ödeme veya veri uyuşmazlığında dayanak yok.

**Benim vermem gereken karar:** D-10.

**Önerilen seçenek**
- Hukukçu onaylı metinler.
- KARAY metinleri kodda olduğu için onaylı metin küçük bir kod değişikliğiyle yayına alınır. Panelden düzenlenebilir yapmak gerekli değil.

**Bağımlılıklar:** D-10; şirket bilgileri (unvan, adres, vergi/MERSİS bilgileri).

**Tamamlanma ölçütü**
- Metinlerde "TASLAK" ve yer tutucu kalmadı.
- Hizmet sözleşmesi ve veri işleme sözleşmesi şablonları imzaya hazır.
- İlk müşterinin site metinleri `legal_reviewed`.

---

### PF-10 · HSTS `includeSubDomains; preload` müşteri alan adlarında da gönderiliyor

**Öncelik:** P1 (özel alan adlı ilk müşteriden önce)

**Mevcut durum:** Tüm yanıtlarda `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 yıl) var. Müşterinin bağladığı özel alan adları da dahil.

**Kanıt:** `next.config.ts:98`.

**Risk**
- Müşteri kök alan adını (ör. `ofis.com`) bağlarsa tarayıcılar 2 yıl boyunca `*.ofis.com` altındaki tüm alt alan adlarını HTTPS'e zorlar.
- Müşterinin HTTPS'siz başka hizmetleri (eski web posta, cihaz arayüzü gibi) kırılabilir. Bu, tarayıcı tarafında hemen geri alınamaz.
- Başlık `preload` da içerdiği için alan adı, sahibinin girişimi olmadan da ön yükleme listesi başvuru koşullarını sağlayabilir.

**Benim vermem gereken karar:** Müşteri alan adları için HSTS politikası (D-15).

**Önerilen seçenek**
- KARAY'ın kendi alan adlarında mevcut değer kalsın.
- Müşteri alan adlarında `includeSubDomains` ve `preload` olmasın.
- Sonraki fazda küçük bir kod değişikliği: başlık host'a göre seçilir.

**Bağımlılıklar:** PF-05.

**Tamamlanma ölçütü:** Özel alan adı yanıtında `includeSubDomains`/`preload` yok, KARAY alan adında var. Bu bir E2E başlık testiyle doğrulanır.

---

### PF-11 · CI veritabanı testleri kapalı

**Öncelik:** P1

**Mevcut durum**
- `database` işi `vars.ELVANKENT_CI_DB_TESTS == 'true'` koşuluna bağlı ve `6055693`'te atlandı.
- Yani RLS ve E2E yalnızca yerelde koşuyor.

**Kanıt:** `.github/workflows/elvankent-ci.yml:74`; #76/#77'de `database` işi `skipped`.

**Risk:** Kiracı yalıtımını bozan bir değişiklik CI'dan geçebilir.

**Benim vermem gereken karar:** Değişkeni açmak (D-14). Depo private olursa Actions dakika kotası devreye girer: Free'de ayda 2.000 dakika ([kaynak](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)).

**Önerilen seçenek:** Açmak ve `main` korumasında zorunlu kontrol yapmak.

**Bağımlılıklar:** PF-01, PF-04, D-12.

**Tamamlanma ölçütü:** `database` işi yeşil ve dal korumasında zorunlu.

---

### PF-12 · Geri dönüş planındaki boşluklar

**Öncelik:** P0 (ilk production migration'ından önce)

**Mevcut durum**
- [PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md) "Geri dönüş planı" üç durumu ele alıyor: dosya hatası, son kontrol hatası, yayın sonrası kritik sorun.
- [BACKUP_RESTORE.md](BACKUP_RESTORE.md) "yeni projeye tam geri yükleme"yi anlatıyor.
- Eksik olanlar:
  - (a) geri yüklemenin kendisi başarısız olursa ne yapılacağı;
  - (b) geri dönüşün mümkün olmadığı ya da kabul edilemez olduğu durum (ör. geçişten sonra müşteri verisi girildi);
  - (c) yeni Supabase projesine geçişte değişecek ayarların listesi.

**Kanıt:** PRODUCTION_MIGRATION.md "Geri dönüş planı"; BACKUP_RESTORE.md "Migration geri dönüş stratejisi".

**Risk:** Kriz anında doğaçlama.

**Benim vermem gereken karar:** Kabul edilebilir veri kaybı ve bakım penceresi (D-18).

**Önerilen seçenek:** Bu belgenin §3.4–3.5 akışları runbook'a taşınır; sonraki fazda yalnızca belge işi.

**Bağımlılıklar:** PF-02.

**Tamamlanma ölçütü:** Akış bir test projesinde bir kez prova edildi (geri yükleme + ortam değişkeni değişimi + smoke test) ve süresi ölçüldü.

---

## 3. Production preflight akışı

### 3.1 Otomatik ↔ operatör kontrol matrisi

| # | Kontrol | Nasıl | Kim | Sonuç |
| --- | --- | --- | --- | --- |
| 1 | Derleme anında ortam değişkenleri: eksik değer, değer kutusuna değişken adı yazılması, anon/service anahtarlarının karışması, `sb_secret_` anahtarın yanlış alanda olması | `next.config.ts` `checkDeploymentEnv()` (yalnızca Vercel'de) | Otomatik | **Kesin engel:** derleme durur |
| 2 | Typecheck, lint, birim test, demo SQL, build | CI `quality` | Otomatik | Bugün **engel değil**: dal koruması yok (PF-04) |
| 3 | Yüksek önemli bağımlılık açıkları | CI `npm audit` | Otomatik | Aynı; şu an kırmızı (PF-01) |
| 4 | Gizli anahtar taraması | CI gitleaks (yalnız uygulama klasörü) + commit öncesi yerel | Otomatik | Şu an CI'da çalışmıyor (PF-01, SEC-05) |
| 5 | RLS + E2E | CI `database` (kapalı) / yerel | Otomatik | Kapalı (PF-11) |
| 6 | Ortam + veritabanı ön kontrolü | `npm run prelaunch -- --production [--org=slug]` | Operatör çalıştırır (production service-role anahtarı gerekir) | Kritik → çıkış kodu 1 (**engel**); uyarı → geçer |
| 7 | Migration son kontrolü | `supabase/ops/postflight_v2.sql` (26 satır) | Operatör çalıştırır | HATA → yayına alma (**engel**); KARŞILAŞTIR → önceki sayılarla elle karşılaştır |
| 8 | Yedek bütünlüğü | İş akışında `pg_restore --list` + parmak izi; geri yükleme sonrası parmak izi `diff` | Otomatik + operatör | `diff` boş değilse **engel** |
| 9 | Sağlık | `/api/health` | Otomatik (izleyici kurulursa) | Uyarı |
| 10 | Vercel: plan, production dalı, ortam değerleri, alan adları, cron | Vercel paneli | Operatör | **Engel** (P0) |
| 11 | Supabase: plan, bölge, yedek/PITR, Auth ayarları, S3 erişimi | Supabase paneli | Operatör | **Engel** (P0) |
| 12 | DNS (KARAY, joker, müşteri alan adları) ve sertifika | Kayıt firması / Vercel | Operatör | **Engel** |
| 13 | E-posta alan adı doğrulaması ve test e-postası | Resend paneli + deneme | Operatör | **Engel** |
| 14 | GitHub: değişkenler/sırlar, dal koruması, görünürlük | GitHub ayarları | Operatör | **Engel** (P0/P1) |
| 15 | Hukuki onaylar, sözleşmeler, KVKK bildirimleri | Hukukçu | Operatör | **Engel** (ticari açılış) |
| 16 | Fatura ve tahsilat hazırlığı | Mali müşavir | Operatör | **Engel** (ilk faturadan önce) |

### 3.2 Neyin kesin engel, neyin uyarı olduğu

**`npm run prelaunch -- --production` HATA verir (çıkış kodu 1) — `scripts/prelaunch-check.mjs`:**
- **Ortam değişkenleri:**
  - zorunlu değişken eksik: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `IP_HASH_SALT`, `CRON_SECRET`;
  - gizli bir değişkenin `NEXT_PUBLIC_` önekiyle tanımlı olması;
  - `SITE_ENV` ≠ `production`;
  - site adresinin `https://` ile başlamaması;
  - `NEXT_IMAGE_ALLOW_LOCAL_IP=1`.
- **E-posta:**
  - e-posta sağlayıcısı yok veya `log`;
  - `resend` seçili ama anahtar yok;
  - `EMAIL_FROM` yok.
- **Alan adı:**
  - `KARAY_HOSTS`/`PLATFORM_ROOT_DOMAIN` eksik;
  - `PLATFORM_ROOT_DOMAIN` eksik.
- **Harita:** anahtarı gerektiren sağlayıcıda anahtar yok.
- **Veritabanı ve içerik:**
  - şema sürümü uyuşmuyor;
  - organizasyon bulunamadı veya aktif değil;
  - **demo ilan** var;
  - **hukukçu onayı** bekleyen metin var;
  - talep bildirimi için e-posta adresi yok;
  - aktif sahip (owner) yok.

**Uyarı verir (geçer):**
- `DOMAIN_TARGET_*` yok;
- hata izleme hedefi yok;
- OSM harita döşemeleri kullanılıyor;
- yayında gerçek ilan yok;
- şirket telefon, e-posta veya adres bilgisi boş;
- talep bildirimi kapalı;
- süper admin hesabı yok;
- ofis MFA politikası kapalı;
- tuz veya cron sırrı kısa.

**Önemli:** Bugün **hiçbir otomatik kontrol production'a çıkışı fiilen durdurmuyor**, tek istisna derleme anındaki ortam kontrolü (#1). Nedenleri:
- CI sonucu dal korumasıyla zorunlu kılınmamış.
- Prelaunch ve postflight elle çalıştırılıyor.

Engelleyici olmaları için:
1. Dal koruması + zorunlu kontroller (PF-04).
2. Runbook'ta açık bir insan kapısı: "prelaunch kritik = 0 ve postflight HATA = 0 değilse **Promote yok**".

Bunun ötesinde otomasyon (ör. prelaunch'ı CI'da production anahtarıyla çalıştırmak) **önerilmez**: production sırrını CI'a taşır, kazancı küçüktür.

### 3.3 Migration öncesi yedeğin doğrulanması

Aşağıdaki adımlardan biri başarısızsa migration **yapılmaz**.

1. **Sağlayıcı yedeği:** Supabase › Database › Backups'ta son günlük yedeğin zamanını not et. PITR açıksa geri dönülebilecek en eski anı da not et.
2. **KARAY yedeği:** `elvankent-backup` iş akışını elle çalıştır (*Run workflow*). Şunlar sağlanmalı:
   - iş yeşil bitti ve `pg_restore --list` adımı geçti;
   - kovada `db-TARIH.dump` ve `db-TARIH.fingerprint.txt` var;
   - `storage/current` senkronu hatasız.
3. **Geri yüklenebilirlik:**
   - Dump'ı **gerçek bir Supabase test projesine** yükle (ilk seferde zorunlu; sonra 3 ayda bir tatbikat). Bu mümkün değilse yerel kopyaya yükle.
   - `backup_fingerprint.sql` çıktısı dump'la gelen parmak iziyle **birebir** aynı olmalı (`diff` boş).
   - `postflight_v2.sql` HATA vermemeli.
4. **Kayıt:** Migration günlüğüne şunları yaz:
   - dump adı ve boyutu, parmak izi dosyası;
   - sağlayıcı yedeğinin zamanı;
   - işi yapan kişi ve saat.
5. Ancak bundan sonra [PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md) sırasıyla migration'a geç.

### 3.4 Geri yükleme başarısız olursa

| Durum | Yapılacak |
| --- | --- |
| **A. Prova sırasında** (migration öncesi) | 1. Migration ertelenir. 2. Neden ayrıştırılır: `pg_dump`/`pg_restore` sürüm uyumu (iş akışı pg_dump 17 kullanıyor); Supabase'in yönettiği şema ve roller (`auth`, `storage`, eklentiler) için hata veren nesneler; eksik yetkiler (postflight 18, 23–25). 3. Gerekirse Supabase'in kendi "yeni projeye geri yükleme" yolu denenir; PRODUCTION_MIGRATION.md bunu önerir, plan kapsamı sağlayıcıdan teyit edilmeli. 4. Prova yeşil olmadan production'a dokunulmaz. |
| **B. Gerçek olayda KARAY dump'ı yüklenmiyor** | Sırasıyla: (1) sağlayıcı yedeği veya PITR, plan kapsamına göre, Supabase panelinden; (2) bir önceki günün KARAY dump'ı. Her adımda RPO büyür; etkilenen müşterilere süre ve kapsam bildirilir ([operations/incident-response.md](operations/incident-response.md)). |
| **C. Storage geri yüklenemiyor** | `npm run restore:storage` (yalnız eksik dosyaları yükler, SHA-256 karşılaştırır), kova bazında. Veritabanı kaydı olup dosyası eksik medya, parmak izinin `storage.objects` satırı ve medya kayıtlarıyla listelenir; müşteriden yeniden yükleme istenir. |
| **D. Hiçbir yedek kullanılamıyor** | Mevcut veritabanı üzerinde ileri düzeltme (§3.5). Veri kurtarma için Supabase desteğine başvurulur. Olay ve kişisel veri boyutu hukukçuyla değerlendirilir. Müşteri iletişimi yapılır. |

**Yeni Supabase projesine geçiş — değişecek ayarlar:**
1. **Vercel ortam değişkenleri:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (ve kullanılıyorsa `NEXT_PUBLIC_SUPABASE_STORAGE_URL`) → yeniden dağıtım.
2. **Auth ayarları yeniden girilir:** Site URL, Redirect URL'ler (her özel alan adı), kayıt kapalı, TOTP.
3. **Storage:** kovalar ve dosyalar `restore:storage` ile geri yüklenir; S3 erişimi yeniden açılır.
4. **GitHub sırları:** `SUPABASE_DB_URL`, `SUPABASE_S3_*`.
5. **Oturumlar:** Yeni projede imza anahtarları farklı olduğu için tüm kullanıcıların oturumu düşer ve yeniden giriş gerekir.
6. **Veri kaybı:** Yedek anından sonra girilen veri kaybolur → müşterilere bildirim.
7. **Kontrol:** `npm run prelaunch -- --production` ve postflight yeniden çalıştırılır.

### 3.5 Geri dönüş mümkün değilse: ileri düzeltme planı

**Geri dönüş şu durumlarda mümkün değildir ya da kabul edilemez:**
- Geçişten sonra müşteriler veri girdi ve bu verinin kaybı kabul edilemez.
- Yedek geri yüklenemiyor (§3.4-D).
- Eski uygulama sürümü yeni şemayla çalışmıyor. PRODUCTION_MIGRATION.md V1 için bunu açıkça söylüyor; FAZ 0/1 dosyaları ağırlıkla ekleme yapıyor ama "eski kod + yeni şema" uyumu **test edilmedi**.

**Plan:**
1. **Etkiyi sınırla:**
   - Etkilenen ofis sitelerini site durumundan **Bakım modu**na al; ofis paneli çalışmaya devam eder.
   - Platform genelinde tek bir bakım anahtarı **yok**. Gerekirse Vercel'de önceki dağıtım *Promote* edilir; ancak yalnızca o sürümün yeni şemayla çalıştığı biliniyorsa.
2. **İleri düzeltme:**
   - Hatayı gideren yeni migration veya kod yazılır.
   - Önce production'ın son dump'ından alınmış bir kopyada prova edilir; postflight çalıştırılır.
   - Sonra uygulanır.
3. **Veri onarımı:**
   - Etkilenen satırların kapsamı parmak izi ve denetim kayıtlarıyla (`audit_logs` ve `audit_*` tetikleyicileri) belirlenir.
   - Düzeltme elle, tek işlem içinde yapılır; önce/sonra kaydı tutulur.
4. **Seçmeli geri yükleme:** Tüm veritabanı yerine yalnızca etkilenen ofisin verisi kurtarılır. Yedek **ayrı bir veritabanına** yüklenir, ilgili satırlar taşınır. Ayrıntı: BACKUP_RESTORE.md, kiracı bazında geri yükleme.
5. **İletişim ve kapanış:**
   - Etkilenen müşterilere durum ve süre bildirilir.
   - KARAY notlarına kayıt düşülür.
   - Olay sonrası değerlendirme yapılır (incident-response.md).
6. **Önleme:** Her yeni migration'ın PRODUCTION_MIGRATION.md notuna "eski kod + yeni şema çalışır mı" satırı eklenir. Bir sonraki provada bu uyum smoke testle denenir.

### 3.6 Açılış sırası (Go / No-Go)

1. **Kararlar:** D-16, D-11, D-13, D-14; en azından alan adı, plan ve dal.
2. **Güvenlik güncellemesi:** PF-01 → CI yeşil.
3. **Dal ve CI:** `main` + dal koruması (PF-04); CI veritabanı testleri (PF-11).
4. **Planlar:** Vercel Pro + Supabase ücretli plan; bölgeler kayıtlı (PF-03).
5. **Yedek kapısı (PF-02):** ilk yeşil yedek + gerçek Supabase'e geri yükleme provası.
6. **Altyapı ayarları:**
   - Alan adı ve DNS (PF-05).
   - E-posta (PF-06).
   - Auth + süper admin MFA (PF-08).
   - HSTS ayrımı (PF-10), özel alan adlı müşteri varsa.
7. **Migration:** Production migration ([PRODUCTION_MIGRATION.md](PRODUCTION_MIGRATION.md)); önce §3.3 yedek doğrulaması.
8. **Son kontroller:** `npm run prelaunch -- --production` kritik = 0; postflight HATA = 0.
9. **İzleme ve olay sorumlusu:** PF-07, D-18.
10. **Hukuk ve ticaret:** hukuki metinler ve sözleşmeler (PF-09, D-10); fiyat, fatura ve tahsilat (D-01 … D-08).
11. **İlk müşteri:** §5 akışı.

**Go ölçütü:** 2–8 tamam, ve 10'un ilk müşteri için gereken kısmı tamam.

---

## 4. Güvenlik ve depo

### SEC-01 · Public profil deposu

**Öncelik:** P1 (ilk ücretli müşteriden önce karar)

**Mevcut durum**
- Depo herkese açık. Adı kullanıcı adıyla aynı olduğu için **GitHub profil deposu**: kökteki README profil sayfasında görünür.
- Aynı depoda başka iki projenin dalları ve ortak geçmişi var.
- Şunlar herkese açık:
  - tüm SaaS kaynak kodu;
  - güvenlik modeli (RLS, `SECURITY DEFINER` fonksiyonları);
  - operasyon belgeleri;
  - Actions logları.
- Depo **kendiliğinden private yapılmadı** (talimat gereği).

**Kanıt:** GitHub API: `visibility: public`, `forks_count: 0`, `has_issues: false`; dal listesi; kök `README.md`.

**Risk**
- Kod ve iş mantığı kopyalanabilir.
- Saldırgan güvenlik modelini incelemeye zaman harcamaz. Güvenlik gizliliğe dayanmamalı, ama açık kod saldırı maliyetini düşürür.
- Actions loglarında işletme bilgisi görünür (SEC-03).

**Benim vermem gereken karar:** D-12.

**Önerilen seçenek:** KARAY'ı **ayrı, private bir depoya** taşı; profil deposunu public bırak.

**Private'a geçişin etkileri** (resmi belgeler: [visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility), [profile README](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme)):
- Yıldız ve izleyiciler silinir.
- Var olan public fork'lar public kalır ve depodan ayrılır (şu an fork yok).
- **Profil README'si profil sayfasından kalkar.** Bu yüzden *bu* depoyu doğrudan private yapmak, profil sayfasını ve diğer iki projeyi de etkiler.
- GitHub Free'de private depoda dal koruması ve ruleset yok; Pro/Team gerekir.
- Actions ücretsiz kotası Free'de ayda 2.000 dakika.
- Kod tarama ve Dependabot özel kuralları ek lisans ister.
- **Daha önce public olan geçmiş geri alınamaz;** klonlanmış olabilir. Geçmişte gizli değer bulunmadığı tüm yollarda doğrulanmalı. CI'daki gitleaks yalnızca `elvankent-gayrimenkul/` yolunu tarıyor.

**Taşıma adımları** (onay sonrası, ayrı bir fazda):
1. Tüm geçmiş ve tüm yollar için gitleaks taraması.
2. Yeni private depoyu oluştur.
3. Yalnızca KARAY'ı taşı: uygulama klasörünün geçmişini ayır ya da temiz başlangıç yap (D-12). Bu dalın geçmişinde başka projenin commit'leri de var.
4. İş akışı yollarını (`elvankent-gayrimenkul/…`) yeni düzene göre güncelle.
5. Vercel Git bağlantısını ve Root Directory ayarını yeni depoya çevir.
6. Actions sır ve değişkenlerini yeni depoda yeniden tanımla.
7. Dal korumasını kur; gerekiyorsa plan kararı ver.
8. Eski depodaki KARAY dalını ve iş akışlarını kaldır; yedek iş akışı eski depoda kalmasın.
9. AI oturum talimatlarında depo ve dal adını güncelle.

**Bağımlılıklar:** D-12, D-14, PF-04, PF-11.

**Tamamlanma ölçütü**
- KARAY kodu yalnızca private depoda.
- Vercel yeni depodan deploy ediyor ve CI yeşil.
- Eski depoda KARAY dalı ve sırları yok.
- Tam geçmiş gitleaks taraması temiz.

---

### SEC-02 · CSP `'unsafe-inline'` ve JavaScript'in okuyabildiği oturum çerezleri

**Öncelik:** P1 (aşama 1 düşük riskli)

**Mevcut durum**
- CSP `script-src 'self' 'unsafe-inline'` ve `style-src 'self' 'unsafe-inline'` içeriyor.
- Diğer yönergeler sıkı: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- Supabase oturum çerezleri `@supabase/ssr` varsayılanında `httpOnly: false`, ömrü 400 gün.
- Tarayıcıda Supabase istemcisi **yok** (`createBrowserClient` kullanılmıyor). Yani çerezin JavaScript'ten okunmasına gerek yok.
- XSS yüzeyi küçük:
  - yalnızca iki `dangerouslySetInnerHTML` var: JSON-LD (`<` kaçışlı) ve QR SVG (kütüphane çıktısı);
  - Markdown HTML'e izin vermiyor;
  - uygulama kodundaki tek satır içi `<script>` JSON-LD (Next.js'in kendi satır içi betikleri bunun dışında).

**Kanıt:** `next.config.ts:82-83`; `node_modules/@supabase/ssr/dist/main/utils/constants.js` (`DEFAULT_COOKIE_OPTIONS`); `src/components/common/json-ld.tsx:9`; `src/modules/content/markdown.tsx:6`; KARAY'ın kendi kapsam çerezi zaten `httpOnly` (`src/platform/auth/scope-cookie.ts:9`).

**Risk:** Bir XSS bulunursa satır içi betik çalışır ve oturum çerezi okunup çalınabilir. Sonuç hesap ele geçirmedir; süper admin hesabında tüm kiracılar.

**Benim vermem gereken karar:** Aşamalı plana onay (D-15).

**Önerilen seçenek:** §4.1.

**Bağımlılıklar:** PF-01.

**Tamamlanma ölçütü**
- Çerezler `HttpOnly`.
- Report-Only ihlal raporu 2 hafta boyunca temiz.
- Panel yüzeylerinde nonce'lu CSP var.
- E2E yeşil; LCP regresyonu yok.

#### 4.1 CSP için güvenli geçiş planı (mevcut Next.js yapısına göre)

Next.js 16.3 belgesinin (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`) bağlayıcı noktaları:
- Nonce için sayfanın **dinamik render** edilmesi gerekir (satır 38, 181).
- Nonce kullanılınca statik optimizasyon ve **ISR devre dışı kalır** (satır 395).
- **PPR ile uyumsuzdur** (satır 397).
- Barındırma maliyeti artar (satır 406).
- Hash tabanlı **SRI** statik üretimi korur ama **deneyseldir** (satır 456-460).

KARAY'ın yapısında:
- Genel ofis siteleri ISR kullanıyor (`revalidate = 300`). Nonce bu sayfaları tamamen dinamik yapar: maliyet artar, LCP kötüleşir.
- Paneller (`/admin`, `/platform`) oturum çerezi okuduğu için zaten dinamik. Orada nonce'un ek maliyeti küçük.

| Aşama | Ne | Risk | Kırılırsa ne olur |
| --- | --- | --- | --- |
| 0 — Ölçüm | Mevcut CSP aynen kalır. Hedef politika (`'unsafe-inline'` olmadan) ek olarak `Content-Security-Policy-Report-Only` başlığıyla yayınlanır; ihlaller mevcut hata iletim altyapısına raporlanır | Yok: tarayıcı engellemez, yalnızca raporlar | Hiçbir şey |
| 1 — Çerez sertleştirme | Supabase sunucu istemcilerine ve proxy'deki oturum yenilemeye `cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax' }` | Düşük: tarayıcıda Supabase kodu yok (doğrulandı) | Giriş, MFA, şifre sıfırlama, davet E2E'si yakalar; geri alma tek satır |
| 2 — Panel nonce'u | `proxy.ts` istek başına nonce üretir; CSP yalnız `/admin`, `/platform` ve KARAY panel yollarında `'nonce-…'` + `'strict-dynamic'` kullanır. Genel siteler değişmez | Orta: üçüncü taraf betikler (Analytics, Speed Insights) nonce almazsa engellenir | Aşama 0 raporlarıyla önceden görülür; önizleme dağıtımında E2E |
| 3 — Genel siteler | `experimental.sri` bir önizleme dağıtımında denenir. Report-Only temizse açılır; değilse `'unsafe-inline'` kalır | Deneysel özellik | Bayrağı kaldırmak yeterli |
| 4 — `style-src` | Kalır: tema token'ları satır içi `<style>` ve `style=` kullanıyor | — | — |

Her aşama ayrı küçük bir değişikliktir. Sıra hep aynı: önizleme dağıtımı → E2E → Report-Only gözlemi → production. **CSP'yi kırabilecek hiçbir değişiklik bu fazda uygulanmadı.**

---

### SEC-03 · Herkese açık Actions logları (yedek kayıt sayıları)

**Öncelik:** P1 (yedek açılmadan önce)

**Mevcut durum**
- Yedek iş akışı her çalışmada loga şunları yazar:
  - 17 tablonun sıra, ad ve **kayıt sayısı** (organizasyonlar, üyeler, ilanlar, talepler, müşteriler, Auth kullanıcıları, Storage nesneleri…);
  - dump boyutu.
- Public depoda Actions logları herkese açıktır.
- Kişisel veri yok, ama müşteri ve kullanıcı sayısı gibi işletme bilgisi görünür.
- Yedek hiç çalışmadığı için bugüne kadar loga bir şey yazılmadı.

**Kanıt:** `.github/workflows/elvankent-backup.yml:77-78`; `supabase/ops/backup_fingerprint.sql` (satır biçimi).

**Risk:** Rakip istihbaratı (düşük).

**Benim vermem gereken karar:** D-12 ile birlikte. Depo private olursa sorun kalmaz.

**Önerilen seçenek:** Depo public kalacaksa yedek açılmadan önce bu iki log satırı kaldırılır (sonraki fazda küçük değişiklik). Parmak izi dosyası zaten kovaya yazılıyor.

**Bağımlılıklar:** D-12, PF-02.

**Tamamlanma ölçütü:** Public depoda yedek logunda sayı veya boyut yok, ya da depo private.

---

### SEC-04 · Gizli anahtar yönetimi ve hesap güvenliği

**Öncelik:** P0 (2FA), P1 (envanter ve rotasyon)

**Mevcut durum**
- Depoda gizli değer yok:
  - `.gitignore` kökte `.env`'yi, uygulamada `.env*`'yi dışarıda tutuyor;
  - `.env.example` yalnızca değişken adlarını içeriyor;
  - commit öncesi gitleaks temiz.
- Gerekli sırlar (yalnız adlar):
  - **Vercel:** `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, `CRON_SECRET`, `RESEND_API_KEY`; isteğe bağlı `SENTRY_DSN`, `ERROR_WEBHOOK_URL`, `MAP_API_KEY`; `VERCEL_API_TOKEN` yalnızca `DOMAIN_PROVIDER=vercel` ise.
  - **GitHub Actions:** `SUPABASE_DB_URL`, `SUPABASE_S3_*`, `BACKUP_S3_*`.
- Prelaunch, `NEXT_PUBLIC_` önekiyle tanımlı gizli değişkeni hata sayar.
- Belgelenmemiş olanlar: sır sahipliği, rotasyon takvimi, hesaplarda 2FA durumu.

**Kanıt:** `scripts/prelaunch-check.mjs:36-41`; `.env.example`; BACKUP_RESTORE.md "Açılış kapısı".

**Risk**
- `SUPABASE_DB_URL` ve service-role anahtarı tüm kiracı verisine tam erişim verir.
- Tek kişinin hesabı ele geçerse her şey açılır.

**Benim vermem gereken karar:** Hesap sahipliği ve kimlerin erişebileceği (D-18).

**Önerilen seçenek**
- 2FA şu hesapların hepsinde açık: GitHub, Vercel, Supabase, Resend, alan adı kayıt firması, (seçilince) ödeme sağlayıcısı.
- Yedek kovası için yalnız o kovaya yazabilen ayrı bir anahtar.
- Olay sonrasında ve erişimi olan kişi değişince rotasyon.
- Sır envanteri (ad, nerede durduğu, sahibi, son rotasyon) **değerler olmadan** belgede.

**Bağımlılıklar:** D-18.

**Tamamlanma ölçütü:** Tüm hesaplarda 2FA açık (operatör onayı); sır envanteri yazılı.

---

### SEC-05 · CI tedarik zinciri ve izinler

**Öncelik:** P2 (yedek iş akışı için P1)

**Mevcut durum**
- İzinler en az yetkili: iki iş akışında da `permissions: contents: read`.
- Eksikler:
  - Aksiyonlar sürüm etiketiyle (`@v4`, `@v1`) sabitlenmiş, SHA ile değil.
  - `supabase/setup-cli` `version: latest` kullanıyor.
  - gitleaks `curl` ile sağlama toplamı doğrulanmadan indiriliyor (sürüm sabit: 8.24.2).
  - gitleaks yalnızca `elvankent-gayrimenkul` yolunu tarıyor; `.github/` ve diğer yollar dışarıda.

**Kanıt:** `.github/workflows/elvankent-ci.yml:22-23,45,48,69,71,85-87`; `.github/workflows/elvankent-backup.yml:23-24,53`.

**Risk:** Ele geçirilmiş bir aksiyon etiketi veya indirme CI'da kod çalıştırabilir. Yedek iş akışında veritabanı bağlantı sırrı bulunduğu için etkisi yüksek.

**Benim vermem gereken karar:** Karar yok; teknik iş.

**Önerilen seçenek**
- Yedek iş akışında aksiyonları SHA ile sabitle.
- `latest` yerine sabit CLI sürümü kullan.
- gitleaks indirmesine sağlama toplamı doğrulaması ekle.
- Taramayı tüm depoya genişlet.

**Bağımlılıklar:** PF-01.

**Tamamlanma ölçütü:** SHA pin; sağlama toplamı doğrulaması; tüm-depo taraması yeşil.

---

### SEC-06 · Görüntü işleme yüzeyi (yamadan sonra derinlemesine savunma)

**Öncelik:** P1

**Mevcut durum**
- `inspectImage` dosyayı biçim kontrolünden **önce** sharp'a veriyor (PF-01).
- `images.remotePatterns` herhangi bir `*.supabase.co` projesinin public Storage yolunu kabul ediyor. Kendi proje adresi yalnızca `.supabase.co` dışındaysa ayrıca ekleniyor (`next.config.ts:59-66`), yani pratikte tek desen joker desen.
- OG görselleri yalnızca izinli adreslerden okunuyor (`allowedRemote`).

**Kanıt:** `src/modules/media/processing.ts:49-60`; `next.config.ts:56-67`; `src/modules/seo/og-image.tsx:77`.

**Risk**
- Gelecekteki görüntü kütüphanesi açıkları için geniş bir yüzey kalıyor.
- Başka birinin Supabase dosyaları KARAY'ın görüntü optimizasyonu kotasıyla işlenebilir (maliyet ve kötüye kullanım).

**Benim vermem gereken karar:** SVG logo desteği kalsın mı? (D-15; öneri: evet, yalnızca logo yolunda.)

**Önerilen seçenek**
- Medya yolunda sharp'tan önce dosya imzası (magic bytes) kontrolü: JPEG/PNG/WebP/AVIF dışındakiler reddedilir.
- SVG yalnızca logo yolunda kabul edilir.
- `remotePatterns` kendi proje host'una daraltılır.

**Bağımlılıklar:** PF-01.

**Tamamlanma ölçütü**
- SVG içerikli `.jpg` yüklemesi sharp'a ulaşmadan reddediliyor (birim test).
- Başka bir `*.supabase.co` projesindeki görsel `/_next/image` üzerinden reddediliyor.

---

## 5. Müşteri operasyonu: ilk müşteriden önce gerçekten gerekenler

**İlke:** İlk müşteriler elle yönetilir. Yalnızca güvenlik veya doğruluk gerektiren şeyler kodlanır; manuel yürüyen işler sırf otomasyon için geliştirilmez.

| Adım | Bugün (doğrulandı) | İlk müşteri için gereken | Kod? |
| --- | --- | --- | --- |
| Müşteri oluşturma | KARAY konsolu › yeni organizasyon; site taslak başlar | — | Hayır |
| Sahip etkinleştirme | Tek kullanımlık bağlantı yalnızca e-postayla gider, ekranda gösterilmez | E-posta (PF-06) + `KARAY_HOSTS` (PF-05) | Hayır |
| Ekip kullanıcıları | Ofis sahibi davet eder; e-posta varsa şifresiz bağlantıyla | E-posta | Hayır |
| Site kurulumu ve önizleme | Ofis panelinde "Sitenizi kurun" listesi; KARAY önizlemesi | — | Hayır |
| Alan adı | Alt alan adı (`PLATFORM_ROOT_DOMAIN`) veya özel alan adı (TXT/DNS doğrulaması + Vercel'e elle ekleme) | PF-05; özel alan adı için Supabase Redirect URL'si ve Vercel'e ekleme (elle) | Hayır (HSTS: PF-10) |
| Teslim (yayına alma) | [operations/customer-handoff.md](operations/customer-handoff.md) kontrol listesi; site durumu → Yayında | Ofis metinlerinin onayı (PF-09) | Hayır |
| Yedek ve geri yükleme | Mekanizma hazır, hiç çalışmadı | PF-02 | Hayır (yalnız ayar) |
| E-posta | Resend bağdaştırıcısı | PF-06 | Hayır |
| Sağlık ve izleme | `/api/health` | Harici izleyici (PF-07) | Hayır |
| Olay müdahalesi | [operations/incident-response.md](operations/incident-response.md): önem dereceleri ve eşikler | Sorumlu kişi ve kanal (D-18) | Hayır |
| Plan atama | KARAY konsolu › Plan ve abonelik; deneme 14 gün, kodda | Plan, fiyat ve deneme kararları (D-01 … D-03) | Hayır |
| Faturalama ve tahsilat | Sistemde yok | Elle: mali müşavir / e-belge (D-07); havale/EFT veya sağlayıcı (D-08); fatura no'su KARAY notlarına | Hayır (ilk müşteriler) |
| İptal / süre bitimi | `cancelled`/`expired` olunca limitler kalkıyor (kod boşluğu) | Geçici işletim kuralı (OPS-02); kalıcı çözüm D-05 | Evet (sonraki faz, küçük) |
| Veri dışa aktarma | Ofis panelinden ilan, müşteri ve talep dışa aktarımı (`/api/admin/export/[entity]`, `data.export` yetkisi); görseller dahil değil | Ayrılan müşteriye nasıl teslim edileceği (D-05) | Hayır |

---

### OPS-01 · Sahip etkinleştirmesi tamamen e-postaya bağlı

**Öncelik:** P0 (PF-06 ile kapanır)

**Mevcut durum**
- E-posta yapılandırılmamışsa `sendOwnerInvitation` hata verir. Bağlantı tasarım gereği ekranda gösterilmez.
- Ekip davetinde e-posta yoksa eski geçici şifre yoluna düşülür.

**Kanıt:** `src/modules/platform/invitations/service.ts:54-56`; `src/modules/platform/invitations/member.ts:20,33`.

**Risk:** E-posta kesintisinde yeni müşteri devreye alınamaz.

**Benim vermem gereken karar:** Elle bir geri yol gerekli mi? Önerilen: hayır. Güvenlik tercihi korunur; e-posta kesintisinde beklenir.

**Önerilen seçenek:** PF-06'yı tamamla; sahip davetinden önce bir test e-postası gönder.

**Bağımlılıklar:** PF-06, PF-05.

**Tamamlanma ölçütü:** Production'da bir test ofisinin sahibi davet → etkinleştirme → giriş akışını tamamladı.

---

### OPS-02 · İptal veya süre bitimi limitleri kaldırıyor (kod boşluğu): geçici işletim kuralı

**Öncelik:** P1 (ilk iptalden önce); geçici kural hemen geçerli.

**Mevcut durum**
- `org_plan()` yalnızca `trialing`/`active`/`past_due` aboneliği döndürür.
- `cancelled` veya `expired` olan ofiste satır dönmez. Sonuçları:
  - kullanıcı ve ilan limiti tetikleyicileri ile depolama kontrolü "limit yok" sayar → **sınırsız**;
  - CRM, analitik, PDF ve özel alan adı yönetimi kapanır;
  - organizasyon ve site açık kalır;
  - aktif özel alan adı çalışmaya devam eder.
- **Yerelde doğrulandı:** Değişiklik geri alınan (ROLLBACK) bir işlem içinde abonelik `cancelled` yapıldı. Sonuç: `org_plan` 0 satır döndürdü, ilan ve kullanıcı limitleri `NULL` oldu, organizasyon `active` kaldı.

**Kanıt**
- `supabase/migrations/20260930000002_site_builder.sql:140-168` (`status in ('trialing','active','past_due')`).
- `20260926000003_v2_properties.sql:337-343`.
- `20260927000001_v2_platform_fixes.sql:45-55`.
- `20260926000007_v2_security.sql:997-1019` (`if v_limit is null then return true`).
- `src/platform/tenant/tenant.ts:160-163` (`?? false`).
- Tekillik: aynı anda en fazla bir güncel abonelik (`subscriptions_one_current_idx`).

**Risk:** İptal edilen müşteri sınırsız ilan, kullanıcı ve depolama kullanabilir (maliyet). Beklenen "kapatma" gerçekleşmez.

**Benim vermem gereken karar:** İptal sonrası davranış ve veri saklama (D-05).

**Önerilen seçenek**
- **Geçici kural, hemen:** KARAY konsolunda abonelik "iptal" veya "sona erdi" yapılmaz. Müşteri ayrılıyorsa organizasyon **askıya alınır** (`suspended`: site 404, panel kapalı, veri korunur); plan aktif bırakılır.
- **Kalıcı çözüm, sonraki faz:** aboneliği olmayan ofiste "en kısıtlı" davranış: yeni ilan, üye ve yükleme reddedilir. D-05 kararına göre şekillenir.

**Bağımlılıklar:** D-05, D-04.

**Tamamlanma ölçütü**
- Geçici kural operasyon belgesine taşındı (sonraki faz belge işi).
- Kalıcı çözüm için RLS testi var: iptal edilen ofiste yeni ilan, üye ve yükleme reddediliyor.

---

### OPS-03 · Elle faturalama ve tahsilat izi

**Öncelik:** P0 (ilk faturadan önce süreç hazır olmalı)

**Mevcut durum**
- Sistemde fatura veya ödeme kaydı yok ([BILLING_ARCHITECTURE.md](BILLING_ARCHITECTURE.md) §1).
- Abonelik durumu elle değiştirilir.
- Müşteri listesinde "Dikkat" uyarıları var: deneme bitti, ödeme gecikti, aktif abonelik yok.

**Kanıt:** BILLING_ARCHITECTURE.md satır 16-17; FAZ 1 müşteri durumu.

**Risk:** Tahsilat takibi kişiye bağlı kalır.

**Benim vermem gereken karar:** D-07, D-08, D-17.

**Önerilen seçenek**
- Fatura mali müşavirin veya e-belge portalının üzerinden elle kesilir.
- Fatura no, tarih ve tutar KARAY notlarına yazılır (notlar yalnızca eklenebilir).
- Ayda bir mutabakat yapılır.
- Ödeme gecikirse durum `past_due` yapılır ve not düşülür.
- Kod yok.

**Bağımlılıklar:** D-07, D-08.

**Tamamlanma ölçütü:** İlk müşterinin faturası kesildi ve notta kayıtlı; mutabakat adımı operasyon belgesinde.

---

### OPS-04 · Olay sorumlusu ve destek kanalı

**Öncelik:** P1

**Mevcut durum:** incident-response.md önem derecelerini (S1–S3), hedef yanıt sürelerini ve eşikleri tanımlıyor. Sorumlu kişi, ulaşılabilirlik saatleri ve müşteriye verilecek destek kanalı yazılı değil.

**Kanıt:** [operations/incident-response.md](operations/incident-response.md) "İzleme" ve "Önem dereceleri" tabloları.

**Risk:** Kesintide gecikme yaşanır; müşteri nereye başvuracağını bilmez.

**Benim vermem gereken karar:** D-18.

**Önerilen seçenek**
- Bir sorumlu kişi (sen) ve varsa bir yedek.
- Destek e-postası/telefonu.
- İlk müşteriler için "en iyi çaba"; sayısal SLA taahhüdü yok.

**Bağımlılıklar:** PF-07.

**Tamamlanma ölçütü**
- incident-response.md'de ad, kanal ve saatler yazılı.
- Destek bilgisi teslimde müşteriye iletildi.
