# K-19 · Yayın hazırlığı, Go/No-Go ve karar paketi

> 24.10.2026. Doğrulama dalı `claude/karay-ci-dogrulama`. Production `ff2f7da` değişmedi; bu belgedeki hiçbir adım canlıya uygulanmadı. Kanıt sınıfları: **DOĞRULANDI** (çalıştırılıp görüldü), **ÇIKARIM**, **ERİŞİM YOK**.

## 1. Bu turda yapılanlar

| Commit | Ne | Kanıt |
| --- | --- | --- |
| `9b07f3e` | Storage geri yüklemede `--apply` için hedef ana makine `--target` ile açıkça yazılmalı (yanlış proje koruması) | Regresyon testi önce kaldı, sonra geçti; mutasyonla doğrulandı |
| `1d16cc6`, `aa5d72e` | Yalnız güvenlik yaması (A seçeneği) patch olarak doğrulama dalında; ayrı iş akışı `ff2f7da`'yı yamasız ve yamalı sınar | Patch özeti ve ağaç (`29f81af`) birebir; §3 |
| `be80a97`, `9431889` | OPS-02: eşzamanlı limit kilidi + bayraklı abonelik limiti (`supabase/pending/`) | Yerel Supabase 10/10; ECC security-reviewer bulguları kapatıldı; [OPS02](OPS02_ABONELIK_DURUMLARI.md) |
| `993e79c` | Rol düşürme, üyelik kapatma ve silme açık oturuma hemen yansır (3 test) | Yerel 3/3, açık bulunmadı |
| `e5067fc` | CSP üretimi test edilebilir modülde; kendi depolama adresimiz açıkça listelenir; joker tek anahtarda | Ayrı build'de üretilen başlık doğrulandı |
| `823bb9e` | E2E KARAY-23: platform yüzeylerinde eski "KARAY" adı yok | Gerçek sayfalarda 0 eski ad |
| `3a044f7` | Erişilebilirlik: KARAYS sayfası küçük metin kontrastı; favori düğmesi adı | Lighthouse a11y 100, iki denetim geçti |
| `7997852` | Yeni güvenlik testlerinde benzersiz kurum öneki (CI #88'deki test hatası) | Yerel 118/118, arka arkaya 3 kez |

**Doğrulanan hata (production'da da var):** Plan limiti eşzamanlı isteklerle aşılabiliyor. İlan limiti 3 olan planda 8 eşzamanlı istekle 4–7 ilan oluştu. Düzeltmesi `supabase/pending/20261025000001_quota_lock.sql`; canlıya çıkması O-5 onayına bağlı.

## 2. Kalite kapısı

| Test | Ortam | Commit | Sonuç |
| --- | --- | --- | --- |
| Birim | Yerel | `3a044f7` | 486/486 |
| TypeScript, ESLint | Yerel | `3a044f7` | Temiz; 0 hata (3 eski uyarı) |
| Production build | Yerel | `3a044f7` | 73/73 |
| RLS + MFA + kiracı izolasyonu + OPS-02 + üyelik | Yerel Supabase (bekleyen migration'lar uygulanmış) | `7997852` | 118/118, arka arkaya 3 kez |
| Playwright E2E (209) | Yerel Supabase (bekleyen migration'lar uygulanmış) | `993e79c` | 205 geçti, 4 koşullu atlandı |
| E2E visitor + karay-site (masaüstü) | Yerel | `3a044f7` | 33/33 |
| CI quality + database | GitHub Actions | `1d16cc6` (#87) | Yeşil; E2E 205 / 4 atlandı |
| CI | GitHub Actions | `823bb9e` (#88) | **Kırmızı**: SL-05 kurulumu, test hatası (`7997852` ile düzeltildi) |
| CI | GitHub Actions | `7997852` (#89) | Yeşil; E2E 208 / 4 atlandı |
| npm audit (production) | CI quality | her koşu | Yüksek/kritik yok |
| gitleaks | Yerel her commit + CI | — | Temiz |
| Migration provası (KARAYS) | Yerel PostgreSQL 16 (K-18) | — | 18/18 |
| Geri yükleme provası | Gerçek Supabase projesi | — | **Yapılmadı** (ERİŞİM YOK) |

Atlanan 4 E2E: 3'ü `mobile` projesinde tasarım gereği, 1'i FAM-05 (yalnızca `SHOT_DIR` ile çalışan ölçüm testi).

**Lighthouse** (yerel production build, mobil profil; laboratuvar ölçümü, canlı değer değil):

| Sayfa | Perf | A11y | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- |
| Kiracı ana sayfa (mobil) | 91 | 100 | 3,3 s | 0 | 150 ms |
| İlan detayı (mobil) | 89 | 100 | 3,3 s | 0 | 200 ms |
| /karay (mobil) | 86 | 100 (düzeltmeden sonra) | 3,9 s | 0 | 110 ms |
| Kiracı ana sayfa (masaüstü) | 99 | 100 | 0,9 s | 0 | 0 ms |
| Panel girişi (mobil) | 97 | 100 | 2,6 s | 0 | 50 ms |

SEO puanı kiracı sayfalarında 69: ölçüm demo ortamında yapıldı (`SITE_ENV=demo` → noindex). /karay'da 100.

## 3. Yalnız güvenlik yaması (A) kanıtı

- Patch: `release/security-only/` (kaynak `57fdbb7`). İçerik: next 16.4.3, sharp 0.35.5, zod 4.6.7, source-map-js 1.2.2 ve görüntü imza denetimi. Migration yok.
- CI koşusu 1 (`ff2f7da`'nın kendi eski CI ayarıyla): taban ve aday **birebir aynı** 25 E2E başarısızlığı; 61 geçti, 3 atlandı, 116 çalışmadı. Yama, koşabilen bölümde gerileme getirmiyor. Başarısızlıkların nedeni `ff2f7da` döneminin CI ayarı (süper adminsiz yönetici, `SITE_ENV=development`; K-10/K-11'de düzeltildi) ve o tarihten sonra düzeltilen gerçek hatalar (ör. P3-F1 `/karay` görselleri).
- CI koşusu 2 ([40129140853](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40129140853), düzeltilmiş test ortamı: `SITE_ENV=demo`, süper admin): taban ve aday yine **birebir aynı** 8 E2E başarısızlığı; 142 geçti, 4 atlandı, 51 çalışmadı. İki kolda da birim ve RLS/MFA/kiracı izolasyonu adımları geçti. **Sonuç: yama gerileme getirmiyor (DOĞRULANDI).**
- Kalan 8 başarısızlık **bugün canlıdaki kodda da var** ve doğrulama dalında (K-8…K-16) düzeltildi: önizlemede taslak marka (TEST-KARAY-09), KARAYS sayfası (KARAY-01; P3-F1 `/karay` görselleri), özel alan adında panel önizlemesi (LC-4), marka/SEO/site taslak→önizleme→yayın akışları (OBR-A, SEO-A, OFS-01, TEST-SITE-02, SF-02). A seçeneği yalnızca güvenliği kapatır, bu hataları canlıda bırakır; B onları da düzeltir.
- Adayda `npm audit` (production, yüksek/kritik) temiz. Taban bu adımda kalıyor (CI #78).

## 4. Go/No-Go

| Madde | Durum | Kanıt / eksik |
| --- | --- | --- |
| Production veritabanı kimliği (P0-2) | **BLOCKED** | Supabase projesi bu oturumdan görünmüyor (MCP: 0 proje). A2 ön kontrolü sahipte |
| Production yedeği (P0-1) | **BLOCKED** | Yedek iş akışı hiç çalışmadı (`ELVANKENT_BACKUP_ENABLED` kapalı); panel yedeği görülmedi |
| Yedekten geri yükleme provası | **BLOCKED** | Betik ve yerel prova var (`restore-drill.sh`); gerçek yedekle prova yok |
| Migration uyumluluğu (KARAYS `20261018000001`) | **PASS (yerel)** | 18/18 prova; uygulama migration'lı ve migration'sız çalışır |
| Bekleyen migration'lar (kilit, OPS-02) | **PASS (yerel + CI)** | RLS ve E2E bu şemada geçti; canlıya alınmaları ayrı karar |
| Yalnız güvenlik yayını (A) | **APPROVAL REQUIRED** | Kod hazır; iki CI koşusunda tabanla birebir aynı sonuç, gerileme yok (§3); O-4 |
| Tam sürüm (B) | **APPROVAL REQUIRED** | Kod ve testler hazır; P0-1, P0-2, O-1…O-6 bekliyor |
| RLS ve kiracı izolasyonu | **PASS** | 105 RLS + 3 üyelik testi; yeni P0/P1 bulgu yok |
| Auth / MFA | **PASS** | RLS kümesindeki MFA testleri; E2E giriş ve oturum akışları |
| Abonelik yetkileri (OPS-02) | **APPROVAL REQUIRED** | Teknik çözüm hazır, bayrak kapalı; D-04/D-05 ve O-5 |
| KARAYS marka tutarlılığı | **PASS (kod)** / **APPROVAL REQUIRED (veri)** | Kodda eski ad yok (KARAY-23); canlı `company_name` güncellemesi migration'la (O-5) |
| Vercel ortamı | **ERİŞİM YOK** | Vercel API 403; GitHub dağıtım kayıtlarına göre production `ff2f7da` |
| Domain / SEO | **NOT APPLICABLE** | Alan adı değişikliği yok; KARAYS sayfası SEO 100 (yerel) |
| CSP | **PASS (bugünkü politika)** / **APPROVAL REQUIRED (daraltma)** | Kendi adresler açıkça listelenir; joker kaldırma D-15 ve gerçek ortam doğrulaması bekliyor |
| Rollback prosedürü | **PASS (belge + yerel prova)** | K17 §6; Vercel Instant Rollback paneli A1'de gözle teyit edilmeli |
| CI | **PASS** | #89 yeşil (`7997852`, §6) |
| E2E | **PASS** | Yerel ve CI #87: 205 / 4 atlandı |
| Gerçek müşteri senaryoları | **PASS (yerel)** | Kabul E2E: kayıt/davet, ilan, medya, marka, site yayını, ekip, telefon; abonelik senaryosu SL testlerinde |
| Operasyonel izleme | **ÇIKARIM** | `/api/health` ve istemci hata ucu var; canlı izleme paneli bu oturumdan görülmedi |
| Yayın sonrası kontrol planı | **PASS (belge)** | K17 §5 son kontrol (04) ve C1 |

**Karar: NO-GO (tam sürüm), KOŞULLU GO (yalnız güvenlik yaması).** Tam sürüm P0-1 ve P0-2 kanıtlanmadan yayınlanmamalı. Yalnız güvenlik yaması veritabanına dokunmaz; O-4 onayı ve yedek kapısının bu yayına uygulanıp uygulanmayacağı kararı ile çıkabilir.

### Yayın seçenekleri

| | A · önce güvenlik | B · tam KARAYS | C · aşamalı |
| --- | --- | --- | --- |
| Kapsam | Bağımlılıklar + imza denetimi | K-8…K-19 kodu + `20261018000001` | A → B kodu → migration'lar (KARAYS, sonra kilit, sonra OPS-02 bayrağı) |
| Veritabanı | Dokunulmaz | Migration | Her adım ayrı onay |
| Ön koşul | O-4 | P0-1, P0-2, O-1…O-6 | Adım başına |
| Risk | En düşük; canlı açık hemen kapanır | En geniş değişiklik tek seferde | Her adım küçük ve geri alınabilir |

**Öneri: C.** Önce A: canlıdaki Next.js açıkları migration ve yedek beklemeden kapanır, kod eski veritabanıyla çalışır (iki CI koşusunda gerileme yok). A, canlıdaki 8 işlev hatasını (§3) düzeltmez; bunlar B ile kapanır. Ardından P0-1/P0-2 kapanınca B kodu ve KARAYS migration'ı. Kilit migration'ı (gerçek hata düzeltmesi) onunla ya da hemen sonra. OPS-02 bayrağı en son, D-04/D-05 kararından sonra.

## 5. Toplu karar paketi

| # | Konu | Önerilen | Alternatif | Risk | Uygulanacak işlem | Onay |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Production yedeği (P0-1)** | Supabase panelinde son yedeği/PITR'i görmek ve A4 ile `pg_dump` + parmak izi almak | Yalnızca panel yedeği | Yedeksiz migration geri alınamaz | Sahip: panel › Database › Backups ekran görüntüsü; A4 komutları (K17 §4) | Sahip |
| 2 | **Production DB kimliği (P0-2)** | A2 ön kontrolünü (`01_preflight.sql`) SQL Editor'de salt okunur çalıştırmak | — | Yanlış projeye migration | Çıktıda DUR yok ve şema `20261011000001` ise devam | Sahip |
| 3 | **O-4 kod yayını** | Önce A (yalnız güvenlik) | Doğrudan B | A'nın riski düşük; B, P0 kapıları olmadan önerilmez | `release/security-only/README.md` adımlarıyla dal → production'a fast-forward | Sahip onaylar, Claude çalıştırır |
| 4 | **O-5 migration** | KARAYS `20261018000001` → kilit `20261025000001` → OPS-02 `20261025000002` (bayrak kapalı) | Yalnızca KARAYS | Her biri tek işlem, geri dönüşü var | K17 runbook; bekleyen dosyalar migrations/'a taşınıp runbook'ları yazılır | Sahip / operatör |
| 5 | **D-04 ödeme gecikmesi** | `past_due` için 7 gün ek süre, sonra `expired` | Ek süre yok | Gecikmede müşteri hemen kesilmez | Bayrak açılmadan önce süreç/otomasyon | Sahip |
| 6 | **D-05 iptal ve sona erme** | Görüşe sunulan seçenek: dönem sonunda iptal; 14 gün salt okunur, sonra askı; saklama süresi sözleşmede yazılı (örnek: 90 gün) | Süresiz saklama; farklı süre | Veri silme **geri alınamaz**; KVKK ve sözleşme metni hukuki görüş gerektirir | **Hiçbir silme otomatik uygulanmaz.** Kodda silme işi yok; açık yazılı karar, sözleşme metni ve ayrı bir uygulama onayı olmadan eklenmez | Sahip (hukuki görüşle) |
| 7 | **D-15 CSP/HSTS** | Joker `*.supabase.co`'yu, gerçek Supabase'e bağlı bir önizlemede Auth/yükleme/görsel doğrulandıktan sonra kaldırmak | Jokeri tutmak | Doğrulamasız kaldırma yüklemeyi kırabilir | `next.config.ts` › `supabaseWildcard: false` + önizleme testi | Sahip |
| 8 | **PR #2** | Kapatmak (head production dalı, base yanlış: `claude/photo-to-stl-app-rxbvev`) | Base'i değiştirmek | Yanlış projeye merge riski | `MUSTAFAKARA0/MUSTAFAKARA0#2` kapatılır, açıklama yazılır | Sahip |
| 9 | **Domain / SEO** | Değişiklik yok | — | — | — | Gerekmez |

Yalnızca sahibin yapabileceği işler (panel, sır, onay) bu tabloda. Kalan teknik işler kararlarla birlikte yürütülür.

## 6. CI sonuçları (bu tur)

| Koşu | Commit | Sonuç |
| --- | --- | --- |
| [#87](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40127270788) | `1d16cc6` | Yeşil; E2E 205 / 4 atlandı |
| [#88](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40129140850) | `823bb9e` | Kırmızı: SL-05 kurulumunda kurum öneki çakışması (test hatası, `7997852`) |
| [#89](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40130502489) | `7997852` | **Yeşil**: quality; database (birim, RLS/MFA/izolasyon, OPS-02, üyelik); E2E 208 geçti / 4 atlandı |
| [Aday #1](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40127270801) | `1d16cc6` | Taban = aday (25 aynı başarısızlık, eski CI ayarı) |
| [Aday #2](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40129140853) | `823bb9e` | Taban = aday (8 aynı başarısızlık, canlıdaki bilinen hatalar); gerileme yok |
| [#90](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40169223430) | `fc0434f` | İptal (yerine #91) |
| [#91](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40169352877) | `a6169bc` | **Yeşil** (26.10.2026'da doğrulandı): quality; database; E2E 208 geçti / 4 atlandı |
| [Aday #3](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40169223417) | `fc0434f` | Taban (next 16.3.6) = aday (next 16.4.3): ikisinde de 142 geçti, 8 aynı başarısızlık, 4 atlandı, 51 çalışmadı; gerileme yok (üçüncü kez) |

## 7. Kalan riskler ve bilinçli ertelemeler

- Depolama kotası: denetim (`media_upload_allowed()`) medya kaydı eklenmeden önce ayrı bir istekte yapılıyordu; eşzamanlı ya da RPC'siz doğrudan eklenen kayıtlar kotayı aşabiliyordu. Düzeltme bekleyen `supabase/pending/20261026000001_media_quota_lock.sql` (K-20, SL-06; canlıya çıkması ayrı onay). Kalan: `byte_size` istemcinin bildirdiği boyuttur, kayıtsız yüklenen dosya sayılmaz.
- Bayrak açıkken sıfır limit destek akışlarını da engeller. Önce abonelik etkinleştirilir; muafiyet D-04/D-05 kararı.
- Aday iş akışında `persist-credentials: false` (ECC code-reviewer, LOW) bu belgeyle aynı commit'te eklendi.
- Yeni güvenlik test dosyaları CI dışında da yalnızca yerel Supabase'e bağlanır (global bayrak). `rls.test.mjs` uzak projeye izin veriyor; fark bilinçli.
- Lighthouse değerleri yerel ölçüm; canlı LCP/INP ölçülmedi (ERİŞİM YOK).

## 8. Ayrı onay birimleri

Her satır kendi başına onaylanır. Bir satırın onayı diğerini kapsamaz.

| Birim | İçerik | Veritabanı | Ön koşul | Geri dönüş | Onay |
| --- | --- | --- | --- | --- | --- |
| **1. Yalnız güvenlik yaması** | `release/security-only/` (next 16.4.3, sharp 0.35.5, zod 4.6.7, source-map-js 1.2.2, imza denetimi) | Dokunulmaz | §9 adım 3 kanıtları | Vercel'de önceki dağıtıma Instant Rollback | O-4 (A) |
| **2. Tam KARAYS kodu** | K-8…K-19 uygulama kodu (canlıdaki 8 işlev hatasının düzeltmesi dahil) | Şema bekler mi: hayır, migration'lı ve migration'sız çalışır | P0-1, P0-2, A1–A3 | Instant Rollback | O-4 (B) |
| **3. KARAYS marka migration'ı** | `20261018000001`: varsayılan ad ve `company_name` KARAY → KARAYS (elle girilmiş ad korunur) | Tek işlem, 1 satır | P0-1, P0-2; K17 runbook 01–05 | Üretilen geri dönüş betiği (A3) veya `05_rollback.sql` | O-5a |
| **4. Eşzamanlı limit kilidi** | `pending/20261025000001_quota_lock.sql`: ilan/üyelik eklemesinde kurum başına işlem kilidi | Fonksiyon + 2 tetikleyici; veri değişmez | Birim 3 sonrası; runbook hazır: `supabase/ops/quota_lock/` (K-20; yerelde 01→05→01 provası) | Dosyadaki 3 satırlık geri dönüş | O-5b |
| **4b. Depolama kotası kilidi** | `pending/20261026000001_media_quota_lock.sql`: medya kaydında kurum başına işlem kilidi + kota denetimi veritabanında (K-20) | Fonksiyon + 1 tetikleyici; veri değişmez; mevcut kayıtlar denetlenmez | Birim 4 ile ya da sonrasında; `migrations/`'a taşınması ve kendi ön/son kontrolü | Dosyadaki 2 satırlık geri dönüş | O-5b' (ayrı) |
| **4c. Şirket adı düz metin** | `pending/20261026000002_company_name_check.sql`: `platform_settings.company_name` için kontrol/görünmez/yön karakterlerini reddeden CHECK, `NOT VALID` (K-20) | Kısıt; veri değişmez; doğrulama ayrı adım | Ön kontrol sayımı 0 (geçersiz satırda başka ayar kaydı da reddedilir); runbook yazılmadı | Dosyadaki geri dönüş | O-5 (ayrı) |
| **4d. Medya sonlandırma RPC'si (A)** | `pending/20261027000001_media_finalize_rpc.sql`: gerçek boyut, güvenli sonlandırma, silme kuyruğu (K-22) | Fonksiyonlar + kuyruk tablosu + tetikleyici; veri değişmez | Birim 4b sonrası; runbook `supabase/ops/media_finalize_rpc/` | 05 (kuyruk boşsa ve B yoksa) | O-5 (ayrı) |
| **4e. Medya sütun yetkileri (B)** | `pending/20261027000002_media_column_privileges.sql`: authenticated UPDATE/INSERT daraltma + şekil koruması (K-22) | Yetki + tetikleyici; **eski kodu bozar** | ÖNCE WP-A2 kodu canlıda + yükleme/döndürme denemesi; A uygulanmış; yabancı yollu satır 0; runbook `supabase/ops/media_privileges/` | 05 (B, A'dan önce geri alınır; kod geri alınacaksa önce B'nin 05'i) | O-5 (ayrı) |
| **5. OPS-02 abonelik limiti** | `pending/20261025000002_ops02_subscription_limits.sql`: bayrak sütunu (varsayılan **kapalı**) + `org_plan()` | Sütun + fonksiyon; veri değişmez; bayrak kapalıyken davranış aynı | Birim 4 sonrası; runbook hazır: `supabase/ops/ops02_limits/` (kilit yoksa 03 DUR) | Dosyadaki geri dönüş | O-5c (dosya) |
| **5b. OPS-02 bayrağını açmak** | Aboneliği olmayan ofislerde yeni ilan/üye/yükleme reddi | Tek alan güncellemesi | D-04, D-05 kararları; aboneliksiz aktif ofis listesinin incelenmesi | Bayrağı kapatmak | Ayrı karar |
| **6. CSP joker kaldırma (D-15)** | `next.config.ts` › `supabaseWildcard: false` | Dokunulmaz | Gerçek Supabase'e bağlı önizlemede giriş, büyük dosya yükleme ve görsel doğrulaması | Değeri geri almak + yeniden dağıtım | D-15 |
| **— Veri saklama / silme (D-05)** | İptal sonrası verinin ne zaman silineceği | Geri alınamaz | Hukuki görüş, sözleşme metni | Yok (silinen veri dönmez) | Ayrı yazılı karar; otomatik uygulanmaz |

## 9. Sahip kontrol planı (production'da değişiklik yapmadan)

Bağlantı adresi, şifre ya da service role anahtarı paylaşmayın; aşağıdaki adımlar yalnızca sizin panelinizde veya bilgisayarınızda yapılır, bana yalnızca sonuçlar (ekran görüntüsü / çıktı metni) gelir.

**1. Canlı yedeği doğrulama (P0-1)**
- Supabase › canlı proje › Database › Backups: plan adı, **son yedek tarihi/saati** ve PITR açık mı; ekran görüntüsü.
- Ek kopya (önerilir): K17 §4 A4-b "Elle" komutları kendi bilgisayarınızda; sonunda `sha256sum -c` ve `restore:storage --verify` **TAMAM** satırları. Bağlantı adresini yalnızca kendi terminalinize yazın.
- Geri yükleme provası ayrı kanıttır: `scripts/restore-drill.sh` ile yerel/test sunucusuna (asla canlıya değil). Yapılamıyorsa "yalnızca yedek var, prova yok" olarak kaydedilir.

**2. Veritabanı kimliği (P0-2)**
- Vercel › production projesi › Settings › Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`'in gösterdiği **proje adı** (değeri paylaşmanız gerekmez; panelde eşleştirin).
- O Supabase projesinin SQL Editor'ünde `supabase/ops/karays_brand/01_preflight.sql` dosyasının tamamını yapıştırıp çalıştırın. Betik yalnızca okur.
- Gönderilecek: çıktı tablosu. Ölçüt: **DUR** yok; şema sürümü `20261011000001` (veya zaten `20261018000001`); `company_name` satırı.

**3. Yalnız güvenlik yayınından önce gereken kanıtlar**
- Vercel production dağıtımının `ff2f7da` olduğu ve önceki dağıtımın menüsünde **Instant Rollback** bulunduğu (A1, ekran görüntüsü).
- Production `SITE_ENV` değeri ve Root Directory = `elvankent-gayrimenkul` (A1).
- Kararınız: yedek kapısı (adım 1) bu yayına da uygulanacak mı? (Teknik olarak gerekmez: veritabanına dokunmaz.)
- Elimizde olanlar: aday iki CI koşusunda tabanla birebir aynı sonuç (§3), `npm audit` temiz, patch özeti ve ağaç sabit.

**4. Ayrı onay vermeniz gereken migration'lar**
- O-5a KARAYS marka (`20261018000001`)
- O-5b eşzamanlı limit kilidi (`20261025000001`)
- O-5c OPS-02 dosyası, bayrak kapalı (`20261025000002`)
- Bayrağı açmak ve D-05 veri silme politikası: migration onayından **bağımsız**, ayrı karar.
