# KI-23 · Canlı veritabanı şema ön kontrolü (01.11.2026, K-33)

Bu belge, canlı Supabase veritabanında (proje `elvankent-demo`) **hangi migration'ların eksik olduğunu** ve bunun bugünkü
production kodu (`a0f0a67`) ile uyumunu toplar. Hiçbir canlı sorgu bu çalışmada çalıştırılmadı: geliştirme ortamının canlı
veritabanına erişimi yoktur (Supabase bağlantısı yalnız ilgisiz bir projeyi görüyor; o projeye sorgu atılmadı).

## 1. Bilinen kanıtlar (sahipten tekrar istenmeyecek)

| Kaynak | Bulgu | Sonuç |
| --- | --- | --- |
| Sahibin SQL Editor çıktısı (01.11) | `karay_schema_version()` fonksiyonu **yok**; birden fazla migration eksik | `karays_brand/01_preflight.sql` bugünkü haliyle **DUR** verir (sürüm fonksiyonu `20261011000001` ile gelir) |
| Elle yedek #48 (varsayılan daldan, 01.11) | Uyarı: "Parmak izinde bulunamayan tablo var" | Parmak izindeki tablolardan canlıda olmayabilecekler yalnız `site_configs`, `site_config_revisions` (`20260930000002`) ve `organization_invitations` (`20261008000001`). Demek ki **en geç `20261008000001`'den itibaren** eksik |
| Production kodu `a0f0a67` | Davet, alan adı, müşteri listesi, ofis notu, şifre sıfırlama sınırı yeni nesneleri çağırıyor | §4 uyumluluk tablosu |

**Alt sınır (kesin):** `20261008000001` → `20261018000001` arası **5 dosya** eksik.
**Üst sınır (olası):** parmak izindeki uyarı `site_configs` kaynaklıysa `20260930000002`'den itibaren **12 dosya** eksik.
İkisinin ayrımı tek bir salt okunur sorguyla yapılır (§2). Bu sorgudan önce hiçbir migration uygulanmaz.

## 2. Tek seferlik salt okunur tespit: `supabase/ops/canli_sema_tespiti.sql`

- **Ne yapar:** 31 migration ve 8 bekleyen dosyanın her biri için, yalnız o dosyanın oluşturduğu bir nesneye bakar (tablo,
  fonksiyon, sütun varsayılanı, kova, kısıt). Sonuç her dosya için `VAR`/`YOK`; ardından `karay_schema_version()`,
  `schema_migrations` özeti, **İLK EKSİK migration** ve **TUTARLILIK** satırı.
- **Ne yapmaz:** tek bir `SELECT`; tabloya/ayara yazmaz, DDL/DML yok, kayıt içeriği/e-posta/ad yazdırmaz. Çıktı paylaşılabilir.
  Birim testi (`tests/unit/canli-sema-tespiti.test.mjs`) dosyada yazma/DDL komutu olmadığını ve tek ifade olduğunu denetler.
- **Sahibin yapacağı (bir kez):** Supabase › canlı proje (adı kontrol edin) › SQL Editor › New query › dosyanın tamamını
  yapıştırın › Run. Çıktı tablosunun ekran görüntüsü ya da metni yeterli. Bağlantı adresi/şifre paylaşmayın.
- **Okuma:** `TUTARLILIK = TAMAM` ise eksikler listenin son kısmıdır ve §3 sırasıyla uygulanabilir. `DİKKAT` ise arada elle
  uygulanmış/kısmi bir dosya var: hiçbir şey uygulanmaz, sıra elle incelenir.

Yerel doğrulama (salt okunur oturumda, `default_transaction_read_only=on`):

| Veritabanı | İlk eksik | Eksik | TUTARLILIK |
| --- | --- | --- | --- |
| Tüm migration'lar + 8 bekleyen | yok | 0 | TAMAM (39/39 VAR) |
| Canlı benzeri, kesim `20261010000000` | `20261010000001` | 3 | TAMAM |
| Canlı benzeri, kesim `20261008000000` | `20261008000001` | 5 | TAMAM |
| Canlı benzeri, kesim `20260930000002` | `20260930000002` | 12 | TAMAM |
| Ortada bir fonksiyon yeniden adlandırılmış (kısmi şema) | — | — | **DİKKAT** (yakalandı) |

## 3. Eksik migration listesi (tam sıra)

Her dosya **ayrı bir sorgu**, dosyanın tamamı, tek seferde (SQL Editor her sorguyu tek işlemde çalıştırır; hata verirse
dosya kendiliğinden geri alınır ve sonrakine geçilmez).

**A. Olası (yalnız tespit `20260930000002`'yi YOK derse) — 7 dosya:**

1. `20260930000002_site_builder.sql`
2. `20261001000001_site_brand_publish.sql`
3. `20261002000001_karay_platform.sql`
4. `20261004000001_design_family_access.sql`
5. `20261005000001_office_site_management.sql`
6. `20261006000001_brand_content_draft.sql`
7. `20261007000001_seo_draft.sql`

**B. Kesin eksik — 5 dosya:**

8. `20261008000001_owner_invitations.sql`
9. `20261009000001_custom_domains.sql`
10. `20261010000001_password_reset_requests.sql`
11. `20261011000001_customer_operations.sql` — `karay_schema_version()` bununla gelir
12. `20261018000001_karays_brand.sql` — **dosya olarak değil**, `supabase/ops/karays_brand/` runbook'u (01 → 02 → 03 → 04)

**C. Bekleyen (supabase/pending, canlıda olmaması beklenir) — 8 dosya, her biri kendi runbook'uyla:**

13. `20261025000001_quota_lock.sql` (`ops/quota_lock`)
14. `20261025000002_ops02_subscription_limits.sql` (`ops/ops02_limits`; **bayrak kapalı kalır**)
15. `20261026000001_media_quota_lock.sql` (`ops/media_quota_lock`)
16. `20261026000002_company_name_check.sql` (`ops/company_name`)
17. `20261027000001_media_finalize_rpc.sql` (`ops/media_finalize_rpc`)
18. `20261027000002_media_column_privileges.sql` (`ops/media_privileges`; eski medya kodunu bozar — kod önkoşulu K19 §8)
19. `20261027000003_media_storage_slots.sql` (`ops/media_storage_slots`)
20. `20261031000001_media_stray_sweep.sql` (`ops/media_stray_sweep`)

## 4. Kod ↔ şema uyumu (production `a0f0a67` bugün)

| Eksik dosya | Kodda kullanan yer | Dosya yokken canlıda | Dosya uygulanınca |
| --- | --- | --- | --- |
| `20260930000002`…`20261007000001` (olası) | Site yapılandırması, marka/SEO taslağı, KARAYS sayfası, tasarım kataloğu | Kiracı sitesi varsayılan görünüme döner (`public_site_config` hatası yutulur); KARAY konsolunun site/tasarım sayfaları hata verebilir | Siteler bugünkü görünümle açılır (kayıtlar boş başlar) |
| `20261008000001` davet | Yeni müşteri açma (`platform_create_organization(..., p_invite_token_hash)`), davet gönderme/kabul | Yeni müşteri açma ve davet **hata verir** | Çalışır; mevcut kullanıcılar/şifreler değişmez |
| `20261009000001` alan adı | `domain_add` (KARAY › alan adları) | Alan adı ekleme **hata verir** | Çalışır |
| `20261010000001` şifre sıfırlama sınırı | `auth_password_reset_allowed` | Sınır olmadan devam eder (kod geri düşer) — kötüye kullanım sınırı **yok** | Sınır devrede |
| `20261011000001` müşteri işlemleri | `platform_customer_overview`, `platform_org_notes` | KARAY konsolu müşteri listesi ve notlar **hata verir**; panel kurulum listesi gizlenir | Çalışır; `karay_schema_version()` gelir |
| `20261018000001` KARAYS | `company_name` varsayılanı | Ad "KARAY" kalır (görsel) | "KARAYS" (elle girilmiş ad korunur) |

Sonuç: bu dosyalar **yeni kod gerektirmez**; production kodu onları zaten bekliyor. Eksiklikleri bugün yalnız KARAY konsolunun
bazı ekranlarını ve şifre sıfırlama sınırını etkiler; kiracı sitelerinin ve ofis panelinin temel işlevleri (ilan, müşteri, RLS)
eski şemada da çalışır. Bu, uygulamayı aceleye getirmek için değil, sıranın güvenli olduğunu göstermek için yazılmıştır.

## 5. Yerel prova (canlıya dokunmadan)

`scripts/o5-upgrade-rehearsal.sh` canlı benzeri yığında (`scripts/live-like-stack.sh`, portlar 553xx, demo verisi) canlıda
izlenecek sırayı uçtan uca dener: tespit → eksik dosyalar tek işlemde, her biri sonrası tespit `VAR` → KARAYS runbook'u 01–04 →
`postflight_v2` → bekleyen 8 runbook (01→05 geri dönüş→yeniden uygulama) → son tespit 39/39. Ardından aynı veritabanında
tüm güvenlik testleri (`npm run test:rls`: kiracı yalıtımı, RLS, MFA, kotalar, abonelik sınırları).

| Başlangıç | Prova | Güvenlik testleri |
| --- | --- | --- |
| Kesim `20260930000002` (en kötü: 12 eksik) | 11 dosya + KARAYS + 8 runbook; postflight 22 TAMAM / 0 HATA; 39/39 VAR | **201/201** |
| Kesim `20261008000000` (kesin: 5 eksik) | 4 dosya + KARAYS + 8 runbook; postflight 22 TAMAM / 0 HATA; 39/39 VAR | **201/201** |

Bulgu (düzeltildi): canlı benzeri yığın `supabase init` varsayılanıyla TOTP'yi kapalı açıyordu; ilk koşuda 4 MFA testi
"MFA enroll is disabled for TOTP" ile düştü (şema değil, ortam). Canlı Supabase'de TOTP açık olduğundan betik artık CI ile aynı
ayarı yapar; ikinci koşuda 201/201.

## 6. Sahipten istenen tek şey

`canli_sema_tespiti.sql` çıktısı (bir kez, salt okunur). Bu çıktı gelince §3'teki liste kesinleşir ve O-5 planındaki
(`docs/O5_YAYIN_PLANI.md`) 1. aşamanın kapsamı netleşir. Migration uygulamak ayrı ve açık onay gerektirir.
