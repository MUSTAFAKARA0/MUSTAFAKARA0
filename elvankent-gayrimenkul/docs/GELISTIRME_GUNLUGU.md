# KARAYS — Geliştirme günlüğü

Projenin **tek ve sürekli** geliştirme günlüğü. Her çalışma oturumu "Girişler"in en üstüne bir giriş ekler ve "Güncel durum"u yeniler. Faz ve yayın belgeleri (`PHASE*`, `KARAY-FAZ*`, `K17_KARAYS_RELEASE.md`) yazıldıkları günün raporudur; bir maddenin bugünkü durumu burada izlenir.

> Depo herkese açıktır. Buraya proje veya dağıtım kimliği, ortam değişkeni değeri ya da varlığı, alan adı ayarı, kayıt sayısı veya sır yazılmaz.

## Güncel durum (24.10.2026)

| Konu | Durum |
| --- | --- |
| Production dalı | `ff2f7da`, değişmedi. KARAYS yayını kapıları bekliyor (aşağıda) |
| Çalışma dalı | `claude/karay-ci-dogrulama`. Vercel dağıtımı bu dalda kapalı (`a24fef8`); yayın zinciri bu commit hariç kurulur |
| Son kod commit'i | `4afd83f` (görünmez ve yön denetim karakterleri, şirket adı savunması) |
| GitHub | K-13…K-16 GitHub'da (`a24fef8..968e3ad`). Production dalının yerel kopyasındaki 15 commit kaybolmadı: zincir uzak dallardan birebir yeniden kurulabiliyor (aşağıda) |
| CI | [#85](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40121218238) yeşil (`6c93d67`, 24.10.2026): quality ve database işleri başarılı. ECC-2 commit'leri için yeni koşu push ile başlar |
| Güvenlik | Production'da next 16.3.6 ve sharp 0.35.4 var; yeni Next.js duyurularının etki alanında ([K17 §3](K17_KARAYS_RELEASE.md)). Düzeltme bu dalda; canlıya çıkması yayın onayına bağlı (O-4) |
| Açık kapılar | P0-1 doğrulanmış canlı yedek yok · P0-2 canlı veritabanının kimliği ve şema durumu doğrulanmadı · onaylar O-1…O-6 ([K17 §1–§2](K17_KARAYS_RELEASE.md)) |
| Bekleyen kararlar | D-01…D-18 ([PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md)). Özellikle D-05 (iptal ve veri saklama; OPS-02'nin kalıcı düzeltmesi buna bağlı), D-14 (dal ve yayın stratejisi), D-15 (güvenlik başlıkları, SVG) · PHASE4 §8 K-4…K-7 |

**Sıradaki adım:** Sahibin K-17 kapılarını açması: A1–A4 (panel teyidi, salt okunur ön kontrol, geri dönüş betiği, yedek). Ardından O-4 ile kod yayını, O-5 ile migration. Canlıdaki güvenlik açığı nedeniyle bu sıranın öne alınması önerilir. Güvenlik düzeltmesini migration'dan önce, yalnızca kod olarak yayınlamak teknik olarak mümkün (yeni kod eski veritabanıyla çalışır, [K17 §5](K17_KARAYS_RELEASE.md)). Yedek kapısının (P0-1) bu kod yayınını da bekletip bekletmeyeceği sahibin kararıdır.

## Girişler

### 24.10.2026 (3) · ECC v2.2.3 incelemesi ve düşük bulguların giderilmesi

**Başlangıç:** `6c93d67`. Çalışma ağacı temizdi.

**CI:** [#85](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40121218238) · `6c93d67` · yeşil.
- quality başarılı.
- database: yerel Supabase, birim + RLS/MFA/kiracı izolasyonu, Playwright E2E **205 geçti, 4 koşullu atlandı** (#84 ile aynı).

**ECC incelemesi (`5034a41..6c93d67`):**
- `ecc:code-reviewer` ve `ecc:security-reviewer` gerçek alt ajan olarak çalıştı, `ecc:security-review` skill'i doğrudan çağrıldı.
- Kritik, yüksek veya orta bulgu yok; altı düşük bulgu var.

**Commit'ler:**
- `b303df6` (davranış değişmez):
  - Şirket/site ayarları ve KARAYS profil şemaları `'use server'` dosyalarından `src/modules/content/settings-schema.ts` ve `src/modules/karay/profile-schema.ts` modüllerine taşındı. Böylece birim testleri kaynak metni değil, şemanın davranışını sınıyor.
  - `hoursSchema` takma adı kaldırıldı.
- `4afd83f` (düzeltme):
  - `singleLine` görünmez biçim karakterlerini siliyor: U+200B, U+2060–U+2064, U+FEFF.
  - Yön geçersiz kılma, gömme ve yalıtma karakterleri (U+202A–U+202E, U+2066–U+2069) sessizce silinmiyor; alan adıyla açık hata veriliyor.
  - ZWJ/ZWNJ ile LRM/RLM/ALM korunuyor. Türkçe, uluslararası, sağdan sola ve emoji içeren adlar bozulmuyor; testi var.
  - KARAYS `company_name` alanında `<` ve `>` açık hatayla reddediliyor. Kullanım noktaları doğrulandı ve hepsi kaçışlı: React metni, JSON-LD `\u003c`, geri dönüş betiğinde `quote_literal`. Ret, ileride ham HTML'de (ör. e-posta) kullanılırsa diye ek katman.
  - Ham `.max(160)` sınırı Türkçe mesaj veriyor.
- Regresyon testleri önce yazıldı ve eski kodda başarısız oldu. Her savunma tek tek kaldırılarak 6 mutasyon denendi; 6'sı da yakalandı.

**Ertelenen bulgu: CSP `img-src` / `connect-src` içindeki `https://*.supabase.co`.**
- Tarayıcıdaki büyük dosya yüklemeleri `PROJE.storage.supabase.co` adresine gidiyor. Bu adres `src/lib/env.ts` içinde türetiliyor; `next.config.ts` ise yalnızca açıkça tanımlanan Storage değişkenini görüyor.
- Joker kaldırılırsa production'da yüklemeler kırılır. CI yerel Supabase ile koştuğu için bu yolu sınayamaz.
- Önerilen yol:
  1. Türetme kuralı `next.config.ts` ile paylaşılır.
  2. Gerçek Supabase'e bağlı bir önizlemede Auth, Storage yükleme ve görseller denenir.
  3. Ardından joker kaldırılır.
- D-15 (güvenlik başlıkları) ile birlikte ele alınmalı.

**Testler (yerel):**
- birim 468/468
- typecheck temiz
- ESLint 0 hata (3 eski uyarı)
- build 73/73
- gitleaks temiz
- RLS ve E2E CI'da koşar. Migration yok, RLS değişmedi.

**Açık:** Önceki girişteki kapılar aynı: P0-1, P0-2, O-4, O-5, D-04, D-05, D-15, PR #2. Ek olarak `company_name` için veritabanı CHECK'i hâlâ öneri; migration ve O-5 gerektirir.

### 24.10.2026 (2) · K-18: SEC-06, P2 doğrulamaları, yalnız güvenlik yaması, OPS-02 tasarımı

**Başlangıç:** `5034a41` (CI #84 yeşil). Çalışma ağacı temizdi.

**Commit'ler** (`claude/karay-ci-dogrulama`):
- `ab8d15f`: CI #84 sonucu günlüğe işlendi.
- `08257da`: SEC-06. `next/image` uzak kaynakları yalnızca kendi Supabase adreslerimiz; joker `*.supabase.co` kaldırıldı. Next.js'in kendi eşleyicisiyle test edildi.
- `8d0f282`: `singleLine()`. Platform `company_name` ve ofis metin alanlarında kontrol karakteri ve satır sonu kalmıyor. Çalışma saatlerinde gün listesi en fazla 7 öğe ve tekil.
- Bu commit: [OPS02_ABONELIK_DURUMLARI.md](OPS02_ABONELIK_DURUMLARI.md) (durum makinesi ve karar tablosu); yayın kiti §8 (A seçeneği) ve §9 (kapı durumu).

**Yalnız güvenlik yaması (A seçeneği):**
- Yerel dal `claude/karays-guvenlik-yamasi`: `ff2f7da` üzerine `57fdbb7`. **Push edilmedi**; yeni dal Vercel Preview üretebilir, onay gerekiyor.
- Yerel sonuçlar:
  - audit 0
  - typecheck temiz
  - ESLint 0 hata
  - birim 388/388
  - build 73/73
- RLS ve E2E için CI gerekir.
- Konteyner yenilenirse yerel dal kaybolur. Yama, yayın kiti §8'deki adımlarla birebir yeniden üretilebilir.

**Testler (yerel):**
- birim 460/460
- typecheck temiz
- ESLint 0 hata (3 eski uyarı)
- build 73/73
- Yeni korumaların 3 mutasyonu da yakalandı.

**Atlanan 4 E2E testi:**
- 3'ü `mobile` projesinde tasarım gereği atlanıyor: responsive genişlik testi, filtre paneli ve paylaşım menüsü. Aynı testler masaüstünde koşuyor; telefon davranışı acceptance 10–14 ve 15–22 adımlarında.
- 1'i FAM-05, yalnızca `SHOT_DIR` tanımlıyken çalışan bir ölçüm testi.
- Kapsam boşluğu yok.

**OPS-02:** Boşluk güncel kodda sürüyor (plan satırı yokken üç limit kontrolü de sınırsız sayıyor). Kalıcı çözüm D-05 ve D-04 kararlarını bekliyor; tasarım bayraklı ve varsayılanı kapalı bir migration öneriyor.

**Açık:**
- Canlı güvenlik yayını: A ya da B, O-4 onayı
- P0-1 ve P0-2
- O-5
- D-04, D-05, D-15 (PF-10 HSTS, SEC-02 CSP)
- PR #2 (head production dalı, base `claude/photo-to-stl-app-rxbvev`): kapatma kararı sahipte

### 24.10.2026 · K-18: yayın kiti depoda, CI tedarik zinciri, güvenlik yükseltmesi

**Başlangıç durumu:** K-17 denetimi "henüz geçilemez" sonucuyla bitmişti (P0-1, P0-2). Yayın kiti ve runbook yalnızca oturum içindeydi; konteyner yenilenince kayboldu ve yeniden yazıldı. PHASE4'teki K-3 (CI sertleştirme) açık kalmıştı. CI #83, Node.js 20 kullanımdan kaldırma uyarısı veriyordu.

**Commit'ler** (`claude/karay-ci-dogrulama`):
- `f69d8e4`: K-17 yayın kiti ([K17_KARAYS_RELEASE.md](K17_KARAYS_RELEASE.md)) ve `supabase/ops/karays_brand/` runbook'u (01 ön kontrol · 02 geri dönüş betiği üretimi · 03 uygulama · 04 son kontrol · 05 genel geri dönüş). Birim testi LR-10.
- `99622c7`: CI tedarik zinciri (PHASE4 §5.3–§5.4, K-3).
  - action'lar node24 sürümlerinde ve tam commit SHA'sıyla sabit
  - Supabase CLI 2.121.0
  - gitleaks arşivi SHA-256 ile doğrulanıyor
  - `npx --yes wait-on` kaldırıldı
  - Birim testi LR-11.
- `b5ba5ba`: Runbook inceleme düzeltmeleri.
  - boş tabloda ve boş veritabanında okuyan betikler artık hata vermiyor
  - değerler XML kaçışı olmadan okunuyor
  - 03 daha yeni bir şema sürümünde duruyor
  - 02 varsayılan veya eksik yetkileri birebir geri alıyor
  - 05 başlığı betiğin davranışıyla uyumlu
  - LR-11 adım ayırma hatası düzeltildi
- `1c0dbfd`: next 16.3.8 → 16.4.3, zod 4.6.5 → 4.6.7 (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r, GHSA-mrhx-c7xc-m3w5). CI'daki `npm audit` adımı bu duyurular yüzünden kırmızıya dönmüştü.
- `11410e9`: Bu günlük ve yayın kiti güncellemesi: K-17/K-18 commit'leri, CI kanıtı kuralı, güvenlik notu.
- `92ad985`: 02'nin ürettiği yorum satırları artık tek satır. Güvenlik incelemesinin bulgusu: satır sonu içeren bir `company_name`, üretilen geri dönüş betiğinde yorumdan taşıp veritabanı sahibi yetkisiyle komut olarak çalışabiliyordu. Yerel veritabanında kanıtlandı ve kapatıldı.
- Bu commit: OPS-02 geçici kuralı ([operations/README.md](operations/README.md)) ve günlük güncellemesi.

**Testler (yerel):**
- birim 447/447
- typecheck temiz
- ESLint 0 hata. 3 uyarı önceden vardı: `tests/e2e/karay-site.spec.ts:104`
- demo SQL güncel
- build 73/73 sayfa (Next.js 16.4.3)
- `npm audit --omit=dev` 0 açık
- gitleaks temiz

**Kanıt:**
- **Mutasyon:** LR-11'in 6 mutasyonu ve inceleme testlerinin 5 mutasyonu yakalandı. Dosyalar sha256 ile aynen geri yüklendi.
- **Runbook provası (yerel PostgreSQL 16): 18/18 senaryo geçti.**
  - uygulama, tekrar uygulama ve iki geri dönüş yolu
  - kilit zaman aşımı (5 sn)
  - eski ve yeni şema korumaları
  - elle girilmiş ad ve özel karakterler
  - boş tablo ve boş veritabanı
  - NULL ve eksik yetkiler
  - satır sonu içeren ad: yorumdan taşmıyor, komut çalışmıyor
- **Yerelde çalıştırılamayanlar:** RLS ve Playwright E2E (Docker yok). Bunlar CI database işinde koşar.

**İnceleme:**
- Yerleşik `code-review` 7 bulgu verdi; 7'si de doğrulandı ve düzeltildi.
- Provada bir sorun daha bulundu: boş veritabanında 01, `'…'::regprocedure` yüzünden hata veriyordu. Bu da düzeltildi.
- Yerleşik `security-review` bir aday bulgu verdi: 02'de ikinci derece SQL enjeksiyonu. Yanlış pozitif süzgeci onu raporlama eşiğinin altında buldu (3/10): süper admin hesabı, A3 anında yerleştirilmiş bir değer ve elle çalıştırılan bir geri dönüş gerekiyor. Mekanizma yerelde kanıtlandığı ve düzeltmesi tek satır olduğu için yine de kapatıldı (`92ad985`).
- **ECC (v2.2.3) bu oturumda yok.** Doğrulanan durum:
  - eklenti eşitleme klasörü boş
  - depoda ve kullanıcı ayarlarında eklenti tanımı yok
  - hesapta etkin eklenti listesi boş
  - Belgelere göre bulut oturumu, yerelde `/plugin` ile kurulan, kullanıcı ayarlarında ya da deponun `.claude/settings.json` dosyasında açılan eklentileri yüklemez; `/plugin` komutu bulutta yoktur. Yalnızca depoya commit'lenmiş `.claude/agents|skills|commands`, kuruluşun yönetilen ayarları ve claude.ai'da açılmış skill'ler taşınır.
  - Eşdeğer olarak yerleşik Plan/Explore ajanları ile `code-review` ve `security-review` kullanıldı. ECC'nin güvenlik kancalarının yerine her commit'ten önce gitleaks çalıştı ve push öncesi inceleme kapısı uygulandı.

**GitHub doğrulaması (24.10):**
- `968e3ad` yalnızca `claude/karay-ci-dogrulama` dalında; CI #83 bu commit'te yeşil.
- Production dalının yerel kopyasındaki 15 commit hiç push edilmemişti; konteyner yenilenince yerel kopya gitti. İçerikleri kaybolmadı: `82dcd06`'ya `a24fef8..968e3ad` cherry-pick edilerek ayrı bir klonda yeniden kuruldu.
  - 15 commit temiz uygulandı ve konuları birebir aynı.
  - `968e3ad` ile tek fark iki Vercel koruma dosyası.
  - `ff2f7da` zincirin atası (fast-forward).
- Açık PR'lar: #2 (head production dalı, base `claude/photo-to-stl-app-rxbvev`) ve #1 (BREAKLINE). İkisine de dokunulmadı.

**CI:** [#84](https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/runs/40100992371) · `5034a41` · 24.10.2026 · yeşil.
- quality: typecheck, ESLint, birim testleri, demo SQL, build, `npm audit --omit=dev` (yüksek/kritik yok), gitleaks
- database: yerel Supabase (CLI 2.121.0, sabit SHA'lı setup-cli v3), birim + RLS/MFA/kiracı izolasyonu adımı başarılı (sayı bu kayıtta okunmadı), Playwright E2E **205 geçti, 4 koşullu atlandı** (CI #83 ile aynı)
- Vercel'de bu commit için dağıtım yok; Production `ff2f7da`.

**Açık kalanlar:**
- K-17 yayın kapıları (P0-1, P0-2, O-1…O-6).
- Canlıdaki güvenlik açığı. Yayın kararı sahipte.
- Yedek işinin action sürümü (checkout v7.0.1) hiç çalışmadı. CI bu işi koşmaz; ilk elle çalıştırma (A4) doğrular.
- **OPS-02:** Geçici kural artık [operations/README.md](operations/README.md)'de: abonelik iptal edilmez, organizasyon askıya alınır. Kalıcı düzeltme (aboneliği olmayan ofiste yeni ilan, üye ve yükleme reddi, RLS testiyle) D-05 ve D-04 kararlarını bekliyor; karar verilmeden uygulanmayacak.
- Öneri (P2): `admin-settings` içindeki `days` dizisine `.max(7)` eklenmesi. zod düzeltmesine ek bir savunma olur.
- Öneri (P2): `platform_settings.company_name` için kontrol karakterlerini reddeden bir CHECK ve zod kuralı. 02'deki sertleştirmeye ek bir savunma olur, ancak migration gerektirir.
