# KARAYS — Geliştirme günlüğü

Projenin **tek ve sürekli** geliştirme günlüğü. Her çalışma oturumu "Girişler"in en üstüne bir giriş ekler ve "Güncel durum"u yeniler. Faz ve yayın belgeleri (`PHASE*`, `KARAY-FAZ*`, `K17_KARAYS_RELEASE.md`) yazıldıkları günün raporudur; bir maddenin bugünkü durumu burada izlenir.

> Depo herkese açıktır. Buraya proje veya dağıtım kimliği, ortam değişkeni değeri ya da varlığı, alan adı ayarı, kayıt sayısı veya sır yazılmaz.

## Güncel durum (24.10.2026)

| Konu | Durum |
| --- | --- |
| Production dalı | `ff2f7da`, değişmedi. KARAYS yayını kapıları bekliyor (aşağıda) |
| Çalışma dalı | `claude/karay-ci-dogrulama`. Vercel dağıtımı bu dalda kapalı (`a24fef8`); yayın zinciri bu commit hariç kurulur |
| Son kod commit'i | `1c0dbfd` (next 16.4.3, zod 4.6.7) |
| CI | Bekleniyor: bu girişin commit'leri için `elvankent-ci` (quality + database) |
| Güvenlik | Production'da next 16.3.6 ve sharp 0.35.4 var; yeni Next.js duyurularının etki alanında ([K17 §3](K17_KARAYS_RELEASE.md)). Düzeltme bu dalda; canlıya çıkması yayın onayına bağlı (O-4) |
| Açık kapılar | P0-1 doğrulanmış canlı yedek yok · P0-2 canlı veritabanının kimliği ve şema durumu doğrulanmadı · onaylar O-1…O-6 ([K17 §1–§2](K17_KARAYS_RELEASE.md)) |
| Bekleyen kararlar | D-01…D-18 ([PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md)); özellikle D-14 (dal ve yayın stratejisi) ve D-15 (güvenlik başlıkları, SVG) · PHASE4 §8 K-4…K-7 |

**Sıradaki adım:** Sahibin K-17 kapılarını açması: A1–A4 (panel teyidi, salt okunur ön kontrol, geri dönüş betiği, yedek). Ardından O-4 ile kod yayını, O-5 ile migration. Canlıdaki güvenlik açığı nedeniyle bu sıranın öne alınması önerilir. Güvenlik düzeltmesini migration'dan önce, yalnızca kod olarak yayınlamak teknik olarak mümkün (yeni kod eski veritabanıyla çalışır, [K17 §5](K17_KARAYS_RELEASE.md)). Yedek kapısının (P0-1) bu kod yayınını da bekletip bekletmeyeceği sahibin kararıdır.

## Girişler

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
- Bu günlük ve yayın kiti güncellemesi: K-17/K-18 commit'leri, CI kanıtı kuralı, güvenlik notu.

**Testler (yerel):**
- birim 446/446
- typecheck temiz
- ESLint 0 hata. 3 uyarı önceden vardı: `tests/e2e/karay-site.spec.ts:104`
- demo SQL güncel
- build 73/73 sayfa (Next.js 16.4.3)
- `npm audit --omit=dev` 0 açık
- gitleaks temiz

**Kanıt:**
- **Mutasyon:** LR-11'in 6 mutasyonu ve inceleme testlerinin 4 mutasyonu yakalandı. Dosyalar sha256 ile aynen geri yüklendi.
- **Runbook provası (yerel PostgreSQL 16): 17/17 senaryo geçti.**
  - uygulama, tekrar uygulama ve iki geri dönüş yolu
  - kilit zaman aşımı (5 sn)
  - eski ve yeni şema korumaları
  - elle girilmiş ad ve özel karakterler
  - boş tablo ve boş veritabanı
  - NULL ve eksik yetkiler
- **Yerelde çalıştırılamayanlar:** RLS ve Playwright E2E (Docker yok). Bunlar CI database işinde koşar.

**İnceleme:**
- Yerleşik `code-review` 7 bulgu verdi; 7'si de doğrulandı ve düzeltildi.
- Provada bir sorun daha bulundu: boş veritabanında 01, `'…'::regprocedure` yüzünden hata veriyordu. Bu da düzeltildi.
- ECC bu ortamda kurulu değil; eşdeğer olarak yerleşik inceleme becerileri kullanıldı.

**CI:** Bekleniyor (bkz. Güncel durum).

**Açık kalanlar:**
- K-17 yayın kapıları (P0-1, P0-2, O-1…O-6).
- Canlıdaki güvenlik açığı. Yayın kararı sahipte.
- Yedek işinin action sürümü (checkout v7.0.1) hiç çalışmadı. CI bu işi koşmaz; ilk elle çalıştırma (A4) doğrular.
- Öneri (P2): `admin-settings` içindeki `days` dizisine `.max(7)` eklenmesi. zod düzeltmesine ek bir savunma olur.
