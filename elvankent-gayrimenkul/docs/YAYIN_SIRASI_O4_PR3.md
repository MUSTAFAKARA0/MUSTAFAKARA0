# Yayın sırası önerisi · O-4 güvenlik yaması (A) + PR #3 gece yedeği iş akışı

> 01.11.2026 · **Öneri.** Yalnız 1. adım (production'a dokunmayan hazırlık dalı) yapıldı; production dalı `ff2f7da`, PR #3 taslak, merge ve production push yok.
> Her adım sahibin ayrı yazılı onayıyla yapılır. `npm audit` bastırılmaz (sahip kararı, 01.11).

## 1. Kanıtlar (bu oturum, yalnız yerel ve geçici çalışma ağacında; push yok)

| # | Kontrol | Sonuç |
| --- | --- | --- |
| E1 | Yama dosyası bütünlüğü (`release/security-only/*.sha256`) | OK |
| E2 | Yama `ff2f7da` üstüne → ağaç | `29f81af…` (README'deki beklenen ağaçla aynı) |
| E3 | Dosya kesişimi | Yok. Yama: `package.json`, `package-lock.json`, `src/modules/media/processing.ts`, `tests/unit/security-patch.test.mjs`. PR #3: `.github/workflows/elvankent-backup.yml`, `scripts/backup-db.sh`, `scripts/rclone-log-summary.sh`, `supabase/ops/backup_*.sql`, iki birim testi. PR #3'te uygulama kodu yok |
| E4 | Uygulama sırası | A → PR #3 ve PR #3 → A: ikisi de çakışmasız |
| E5 | `npm audit --omit=dev --audit-level=high` | **PR #3 tek başına: başarısız** (production'daki eski next/sharp; PR #3 CI'ının kırmızı nedeni). **A + PR #3: 0 açık** |
| E6 | A'nın gerileme kanıtı (önceki tur) | Güvenlik adayı #3: taban ve aday birebir aynı sonuç (K19 §3, günlük K-19) |

Sonuç: PR #3'ün CI'ı **bastırma olmadan** ancak A'nın üstünde yeşile döner. Bu yüzden A önce gelir.

## 2. Önerilen sıra

| Adım | Ne | Production'a etkisi | Ön koşul | Geri dönüş | Onay |
| --- | --- | --- | --- | --- | --- |
| 0 | Yedek kapısı: Backup #45 (01.11, çalışma dalından elle) yeşil; yayından hemen önce bir elle yedek daha (`elvankent-backup` › Run workflow, dal: çalışma dalı) | Yok (yalnız okuma) | — | — | Sahip başlatır |
| 1 | **A hazırlık dalı — YAPILDI (01.11, K-26):** `claude/karays-guvenlik-yamasi` = `ff2f7da` → **yayın commit'i `650fd4e`** (yalnız yama, ağaç `29f81af`) → hazırlık commit'i `913b7c0` (asla yayınlanmaz: bu dal için Vercel dağıtımı kapalı, production'ın eski CI'ı bu dalda atlanır, `elvankent-o4-hazirlik` doğrulaması). Bkz. §4 | Yok: production `ff2f7da`; push'ta dağıtım açılmadı | — | Dalı silmek | Sahip (01.11 talimatı) |
| 2 | **PR #3'ü A'nın üstüne taşı:** PR #3 dalı (`claude/backup-workflow-default-branch`) **yayın commit'i `650fd4e`'nin** (hazırlık commit'inin değil) üstüne yeniden kurulur (yeni commit, zorla push yok: yeni dal adı ya da PR'ın tabanı A dalı). PR taslak kalır; CI'ın `npm audit` dahil yeşil olması beklenir | Yok | Adım 1 yeşil | — | Sahip |
| 3 | **A yayını:** production dalı `ff2f7da` → **`650fd4e`** (fast-forward: `git push origin 650fd4e:claude/elvankent-real-estate-platform-vxq9dj`; hazırlık commit'i gitmez). Vercel production dağıtımı | Kod: next 16.4.3, sharp 0.35.5, zod 4.6.7. **Veritabanı değişmez** (migration yok; yeni kod eski şemayla çalışır, K17 §5) | Adım 1–2 yeşil, adım 0 yedeği | Vercel › Deployments › önceki (`ff2f7da`) dağıtım › **Instant Rollback** | **O-4** |
| 4 | Yayın sonrası kontrol (30–60 dk): `/api/health` 200, giriş, ilan listesi/ayrıntı, görsel yükleme; Vercel hata günlüğü | — | Adım 3 | Adım 3'teki geri dönüş | Sahip + Claude |
| 5 | **PR #3 merge** (A'nın üstünde, fast-forward). Gece yedeği artık varsayılan daldaki **doğrulanmış** iş akışıyla çalışır | Vercel yeniden dağıtır; **uygulama kodu A ile aynı** (yalnız iş akışı/betik/test) | Adım 4 temiz, PR #3 CI yeşil | Merge commit'ini geri alan yeni commit (uygulamaya etkisi yok) | Sahip |
| 6 | İlk zamanlanmış gece yedeği (01:23 UTC) varsayılan daldan yeşil mi; günlükte kayıt sayısı/yol yok mu | Yok | Adım 5 | Çalışma dalından elle yedek (Backup #45 yöntemi) | Claude izler, sahibe raporlar |

**Neden iki ayrı production dağıtımı (3 ve 5):** A'dan sonra bir sorun çıkarsa nedeni tek değişikliktir; PR #3'ün uygulama koduna etkisi olmadığı için ikinci dağıtımın riski çok düşüktür.
**Alternatif (tek dağıtım):** production → A + PR #3 tek fast-forward. Daha az dağıtım; ancak gece yedeği iş akışı da aynı anda değişir. Önerilmez ama kabul edilebilir.

## 4. O-4 hazırlık dalı ve testleri (01.11, K-26)

| Öğe | Değer |
| --- | --- |
| Dal | `claude/karays-guvenlik-yamasi` (production'a ve PR #3'e dokunmaz) |
| Yayın commit'i | `650fd4e` — tek ebeveyn `ff2f7da`, ağaç `29f81af` (README'deki beklenen), yalnız 4 yama dosyası |
| Hazırlık commit'i | `913b7c0` — yalnız `vercel.json` ×2 (bu dal için `deploymentEnabled: false`), production CI'ına bu dal için `branches-ignore`, `elvankent-o4-hazirlik.yml` + `elvankent-o4-dogrula.yml`. Production'a **gitmez** |
| `kimlik` işi | Yukarıdaki her özelliği denetler; hazırlık commit'i başka dosyaya dokunursa ya da yayın commit'ine dağıtım kapatma ayarı sızarsa kırmızı (yerelde iki bozuk varyantla denendi) |
| `baseline` / `candidate` | Aynı tam test kümesi: typecheck, ESLint, birim, build, yerel Supabase'de RLS/MFA/kiracı izolasyonu, Playwright E2E. Adayda `npm audit --omit=dev --audit-level=high` (bastırma yok). Artifact yok, sır yok |
| `compare` | Adayın E2E dışındaki tüm adımları yeşil olmalı; adayın E2E başarısızlıkları tabanınkilerin alt kümesi olmalı (tabandaki bilinen işlev hataları B ile kapanır) |

## 3. Bu sıranın DIŞINDA kalanlar

- **O-5 migration'ları** (KARAYS `20261018000001`, bekleyen 8 dosya): A ve PR #3 veritabanına dokunmaz. Migration'lardan önce KI-24 gerçek geri yükleme provası ve P0-2 gerekir.
- **B (tam KARAYS kodu):** P0-1/P0-2 ve A1–A3 kapıları sonrası (K19 §4).
- **OPS-02 bayrağı:** kapalı kalır.
- **KI-24 gerçek veri provası:** sahip onayı yok; `elvankent-restore-drill` iş akışı kapalı (bkz. [KI24_GERI_YUKLEME_PLANI.md](KI24_GERI_YUKLEME_PLANI.md)).
