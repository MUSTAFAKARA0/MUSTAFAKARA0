# Mimari (V2)

Elvankent Gayrimenkul V2; tek bir kod tabanı ve tek bir Supabase veritabanı üzerinde **birden fazla emlak ofisini (kiracı / tenant)** barındırabilen, SaaS'a hazır bir gayrimenkul platformudur. Elvankent Gayrimenkul **varsayılan kiracıdır**.

```
Ziyaretçi ──► Vercel (Next.js 16) ──► proxy.ts: alan adı → kiracı anahtarı
                 │                         │
                 │                         └─► /t/{kiracı}/… (herkese açık site, ISR önbellek)
                 │                         └─► /admin/…  (ofis yönetim paneli, oturum zorunlu)
                 │                         └─► /platform/… (süper admin, oturum + is_super_admin)
                 ▼
          Supabase: PostgreSQL (RLS) · Auth · Storage (media-originals / media / branding)
```

## 1. Teknoloji

| Katman | Teknoloji |
| --- | --- |
| Uygulama | Next.js 16 (App Router, Turbopack, Server Actions, `proxy.ts`), React 19, TypeScript (strict) |
| Arayüz | Tailwind CSS 4, Radix UI primitive'leri, lucide-react, sonner |
| Veri | Supabase PostgreSQL + Row Level Security, Supabase Auth (`@supabase/ssr`), Supabase Storage |
| Doğrulama | Zod 4 (sunucu tarafında her işlemde) |
| Görsel işleme | sharp (sunucu), tus-js-client (devam ettirilebilir yükleme) |
| Harita | Leaflet + sunucu üzerinden döşeme proxy'si (OSM / MapTiler / Mapbox / özel) |
| OG görselleri | `next/og` (Satori) — DM Serif Display + Manrope (OFL lisanslı, `assets/fonts`) |
| Test | node:test (güvenlik/RLS), Playwright (E2E) |

## 2. Çok kiracılı (multi-tenant) yapı

**Kiracı çözümleme** (`src/platform/tenant/host.ts`, `src/proxy.ts`):

1. `localhost`, IP adresleri, `*.vercel.app` ve `NEXT_PUBLIC_SITE_URL` alan adı → `DEFAULT_TENANT_SLUG` (elvankent).
2. `{kısa-ad}.{PLATFORM_ROOT_DOMAIN}` → o kısa ad (SaaS alt alan adı).
3. Diğer alan adları → `organization_domains` tablosunda aranır (özel alan adı).

Proxy, istemcinin gönderdiği `x-tenant-key` başlığını **her zaman ezer** ve isteği `/t/{anahtar}/…` rotasına yeniden yazar. Böylece her kiracının sayfaları ISR önbelleğinde ayrı tutulur. Askıya alınmış veya bilinmeyen kiracı için site 404 döner.

**Veri izolasyonu** üç katmanlıdır:

1. **Veritabanı (asıl güvence):** Kiracıya ait her tabloda `organization_id` vardır ve RLS politikaları `user_org_ids('izin')` fonksiyonuyla kullanıcının **gerçek ve aktif üyeliğini** doğrular. İstemciden gelen `organization_id` değerine güvenilmez; başka bir kiracı adına kayıt eklemek RLS tarafından reddedilir.
2. **Tetikleyiciler:** kiracılar arası referansları (`cross_tenant_reference`), `organization_id` değiştirilmesini (`organization_immutable`), sahip/rol kurallarını, plan limitlerini ve yayın kontrol listesini veritabanında uygular.
3. **Sunucu katmanı:** Her server action ve route handler `requirePermission()` ile oturumu ve yetkiyi doğrular, organizasyonu kullanıcının doğrulanmış aktif üyeliğinden alır ve sorguları ayrıca `organization_id` ile sınırlar. (Buton gizlemek güvenlik değildir; yalnızca kullanıcı deneyimi içindir.)

Bu davranışlar `tests/security/rls.test.mjs` ile gerçek veritabanına karşı test edilir (Tenant A ↔ Tenant B, 5 rol, anonim ziyaretçi, depolama, yetki yükseltme, IDOR).

## 3. Roller ve yetkiler

Merkezi yetki listesi `src/platform/auth/permissions.ts` ile veritabanındaki `role_permissions` tablosu **birebir aynıdır** (test ile doğrulanır).

| Rol | Özet |
| --- | --- |
| **Süper admin** (`profiles.is_super_admin`) | Platform paneli: organizasyonlar, planlar, abonelikler, alan adları, tüm kayıtlar. Yalnızca sunucuda `create-admin --super-admin` ile verilir. |
| **owner** (Sahip) | Tüm yetkiler, sahiplik işlemleri |
| **admin** (Yönetici) | Abonelik hariç tüm yetkiler; sahip atayamaz |
| **agent** (Danışman) | İlan ekler/yayınlar, müşteri/talep/randevu/koleksiyon yönetir |
| **editor** (Editör) | İlan ve içerik hazırlar, yayın için onaya gönderir, SEO |
| **viewer** (İzleyici) | Salt okuma |

İzinler: `properties.read/create/update/publish/delete`, `media.manage`, `leads.read/create/update/delete`, `appointments.read/manage`, `collections.manage`, `content.manage`, `seo.manage`, `settings.manage`, `users.manage`, `analytics.read`, `audit.read`, `data.export`, `billing.manage`.

Üyelik kuralları (`organization_members_guard`): yalnızca sahip, sahip rolü atayabilir/değiştirebilir; son aktif sahip düşürülemez; kimse kendi üyeliğini değiştiremez; plan kullanıcı limiti aşılamaz.

## 4. Veritabanı

Migration dosyaları `supabase/migrations/` altında **sırayla** uygulanır:

| Dosya | İçerik |
| --- | --- |
| `20260922000001…04` | V1: şema, güvenlik, depolama, referans veriler |
| `20260926000001_v2_enums` | İlan durumları (`draft/pending/published/archived/sold/rented`), kategoriler |
| `…02_v2_tenancy` | Organizasyonlar, alan adları, planlar, abonelikler, üyelikler, rol-yetki tablosu, organizasyon ayarları; V1 verisinin varsayılan kiracıya taşınması |
| `…03_v2_properties` | İlanların kiracıya bağlanması, referans no, slug ve yönlendirmeler, fiyat geçmişi, medya varlıkları, konum gizliliği |
| `…04_v2_crm` | Müşteriler, talepler (lead), aktiviteler, randevular, koleksiyonlar (paylaşım bağlantısı) |
| `…05_v2_content` | Blog yazıları, düzenlenebilir sayfalar (hukuki metin inceleme onayı), bölge sayfaları |
| `…06_v2_audit` | Denetim kaydı (kim / ne / ne zaman / hedef), tetikleyiciler |
| `…07_v2_security` | RLS politikaları, yetkiler, RPC fonksiyonları (panel özeti, kullanım, platform) |
| `…08_v2_storage` | Kiracı klasörlü depolama kovaları ve politikaları |
| `…09_v2_reference_data` | Referans veri güncellemeleri |
| `20260927000001_v2_platform_fixes` | Süper admin'in organizasyon oluşturabilmesi, organizasyonun silinebilmesi (zincirleme silmede tetikleyici düzeltmeleri), anonim role medya tablosunda yalnızca görüntüleme sütunları |

Öne çıkan mekanizmalar:

- **İlan no** kiracıya özel öneklidir (`EKG-2026-0001`). Slug veritabanında benzersiz üretilir; yayındaki ilanın adresi değişirse eski adres **308** ile yeni adrese, kalıcı silinen ilanın adresi ilgili kategoriye yönlenir.
- **Konum gizliliği:** açık adres ve kesin koordinat `property_locations` tablosundadır ve ziyaretçiye hiç gönderilmez. Herkese açık koordinat; *tam*, *yaklaşık (~200 m, ilana özgü sabit kaydırma)* veya *yalnızca mahalle* olarak tetikleyiciyle hesaplanır.
- **Plan limitleri** (ilan, kullanıcı, depolama) ve özellikleri (CRM, analitik, PDF, özel alan adı) veritabanında uygulanır.
- **Denetim kaydı** tetikleyicilerle yazılır; değiştirilemez ve silinemez (yalnızca okuma yetkisi). Şifre, token, oturum bilgisi kaydedilmez; değişen alanların yalnızca adları tutulur. Saklama süresi 730 gün (günlük görevle temizlenir).

## 5. Medya hattı (4K)

```
Tarayıcı ──(1) createMediaUpload: yetki + ilan sahipliği + kota + limit kontrolü, "pending" kayıt, imzalı yükleme adresi
        ──(2) Dosya DOĞRUDAN Supabase Storage'a (≤6 MB standart, >6 MB TUS ile devam ettirilebilir, 6 MB parçalar)
        ──(3) finalizeMediaUpload: sunucu dosyayı indirir → sharp ile GERÇEK türü doğrular → döndürür (EXIF)
              → sRGB → WebP boyutları 320 · 640 · 960 · 1440 · 2048 · 2880 px (büyütme yapılmaz) → bulanık önizleme
```

- **Kovalar:** `media-originals` (özel, 50 MB, orijinaller; EXIF/GPS burada kalır), `media` (herkese açık, üretilen WebP'ler; meta veri temizlenmiş), `branding` (logo, simge, ana sayfa ve paylaşım görseli).
- **Yol düzeni** kullanıcı girdisi içermez: `organizations/{org}/properties/{ilan}/images/{medya}/original` ve `…/{sürüm}/w{genişlik}.webp`. İlk iki klasör Storage RLS ile doğrulanır; Tenant A, Tenant B'nin klasörüne yazamaz/okuyamaz.
- **Neden Supabase görsel dönüşümü değil?** Dönüşüm servisi en fazla 2500 px genişlik ve 25 MB kaynakla sınırlıdır ve ücretlidir. Önceden üretilen boyutlar 2880 px'e kadar her planda çalışır; 4K orijinal ziyaretçiye hiç gönderilmez.
- Sınırlar: dosya başına 50 MB, en az 600×400 px, en fazla 100 MP, ilan başına 50 fotoğraf. HEIC tarayıcıda JPEG'e çevrilmeye çalışılır; çevrilemezse kullanıcıya açıklayıcı mesaj gösterilir.
- **Temizlik:** 24 saatten eski tamamlanmamış/başarısız yüklemeler günlük görevle (`/api/cron/media-cleanup`, `CRON_SECRET`) silinir.

## 6. Önbellek

Herkese açık veriler Next.js veri önbelleğinde kiracıya özel etiketlerle tutulur (`org:{id}`, `org:{id}:properties`, `org:{id}:content`, `org:{id}:redirects`). Yönetim işlemleri `updateTag` (server action) veya `revalidateTag(…, { expire: 0 })` (route handler) ile yalnızca ilgili kiracının önbelleğini anında geçersiz kılar.

İlan, bölge ve blog detay sayfaları ISR ile üretilir (ilk istekte oluşturulur, sonra önbellekten sunulur). Bu sayfaların ağacındaki bileşenler — Next.js her sayfada önceden render ettiği için `not-found.tsx` dosyaları dahil — `headers()` / `cookies()` **kullanmamalıdır**; aksi halde sayfa çalışma anında dinamiğe döner ve 500 hatası verir (yalnızca production'da görülür, `next dev`'de görülmez).

## 7. SEO

- Her sayfada başlık/açıklama, kanonik adres, Open Graph ve Twitter etiketleri.
- **Dinamik OG görselleri:** site (`/og`) ve ilan (`/ilan/{slug}/og`: kapak fotoğrafı + başlık + fiyat), 1200×630.
- **Yapılandırılmış veri:** `RealEstateAgent`/`Organization`, `WebSite`, `BreadcrumbList`, `BlogPosting`, ilanlarda `RealEstateListing` + `Offer` + yer bilgisi. Sahte puan/yorum (`aggregateRating`, `review`) **eklenmez**; Google'ın emlak ilanı için bir zengin sonuç türü olmadığı kod içinde belgelenmiştir.
- Kiracıya özel `sitemap.xml` (demo ilanlar hariç), `robots.txt` (panel, önizleme, özel bağlantılar kapalı), `manifest.webmanifest`.
- Yönlendirme tablosu (panelden yönetilir; kalıcı → 308, geçici → 307), ince içerikli bölge sayfalarında `noindex`.

## 8. Harita

Döşemeler tarayıcıya `/api/tiles/{z}/{x}/{y}` üzerinden sunulur; sağlayıcı API anahtarı yalnızca sunucudadır (`MAP_PROVIDER`, `MAP_API_KEY`, `MAP_STYLE`, `MAP_TILE_URL`). Google Maps, kullanım koşulları döşemelerin proxy/önbellekle sunulmasına izin vermediği için bu mimaride desteklenmez.

## 9. Güvenlik özeti

- `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucuda (`server-only` modülleri); dar kapsamlı işlemler için kullanılır: herkese açık form kaydı (`submit_lead`, hız sınırlı), olay sayaçları, denetim kaydı, kullanıcı hesabı oluşturma/şifre belirleme (yetki önce sunucuda doğrulanır), zamanlanmış temizlik, platform okuma işlemleri.
- Form güvenliği: Zod doğrulama, HTML temizleme, gizli tuzak alanı ve en kısa doldurma süresi (bot koruması), IP özeti başına hız sınırı (10 dakikada 3, 24 saatte 10 talep).
- IP adresleri ve oturumlar geri döndürülemez şekilde özetlenir (`sha256(tuz:ip:tarayıcı:gün)`); analitik kişisel veri toplamaz.
- Güvenlik başlıkları ve CSP `next.config.ts` içinde; panel ve platform sayfaları `noindex` + `no-store`.
- Dışa aktarma (CSV/JSON) `data.export` yetkisi ister, siteler arası isteği reddeder ve denetim kaydına yazılır; CSV formül enjeksiyonuna karşı korunur.
- Marka görselleri sunucuda yeniden kodlanır (SVG kabul edilmez), dosya adı depolama yolunda kullanılmaz.
- İki adımlı doğrulama (TOTP): `user_org_ids()` oturumun doğrulama düzeyini (`aal`) kontrol eder; MFA kurmuş kullanıcının kod girilmemiş oturumu ve MFA zorunlu ofisin sahip/yöneticisi hiçbir ofis verisine erişemez (veritabanında zorlanır, sunucu katmanı `/admin/dogrulama`'ya yönlendirir).
- Ortam ayrımı: `SITE_ENV` (`production` / `demo` / `preview` / `development`, yoksa `VERCEL_ENV`). Canlı dışındaki her ortam `noindex` başlığı, site haritasız robots.txt ve "DEMO ORTAMI" bandı ile sunulur (`src/lib/site-env.ts`). `supabase/seed.sql` yalnızca açık onayla ve gerçek ilan bulunmayan veritabanında çalışır.

## 9a. Bildirimler ve izleme (Stage 3)

- Yeni talep → `submit_lead` → yanıt sonrası (`after()`) e-posta (`src/modules/notifications`; Resend HTTP API veya kapalı). Varsayılan e-posta içeriği kişisel veri içermez. Alıcılar `organization_notification_settings` (herkese kapalı tablo), gönderimler `notification_deliveries` tablosuna yazılır; kanal alanı WhatsApp/webhook eklenmesine hazırdır.
- Hatalar: `src/instrumentation.ts` (`onRequestError`) ve tarayıcı hataları (`/api/monitoring/client-error`) → tek satır JSON log + isteğe bağlı Sentry (SDK'sız) / webhook; kişisel veri maskelenir. `GET /api/health` uptime içindir.
- Vercel Speed Insights her zaman, Web Analytics yalnızca analitik çerez onayıyla yüklenir.
- Özel alan adları `src/modules/domains` üzerinden (`DOMAIN_PROVIDER=manual|vercel`).

## 10. Klasör yapısı (özet)

```
src/
├── proxy.ts                     # kiracı çözümleme, oturum yenileme, yeniden yazma
├── app/
│   ├── t/[tenant]/…             # herkese açık site (her kiracı için)
│   ├── admin/(panel)/…          # ofis yönetim paneli
│   ├── admin/(print)/…          # yazdırılabilir PDF broşür
│   ├── platform/…               # süper admin paneli
│   ├── actions/…                # server action'lar (yetki + doğrulama + RLS)
│   └── api/…                    # tiles, track, cron, admin (QR, branding, export)
├── components/                  # ui, layout, property, gallery, admin, platform…
├── modules/                     # properties, media, content, crm, seo, maps, audit, export, platform
├── platform/                    # auth (oturum, yetkiler), tenant, branding (tema), audit, actions
└── lib/                         # supabase istemcileri, env, format, slug, utils
supabase/migrations/             # veritabanı şeması (sırayla uygulanır)
tests/security/rls.test.mjs      # güvenlik testleri (MFA dahil)
tests/unit/*.test.mjs            # birim testleri
docs/                            # işletim, yedekleme, canlıya çıkış belgeleri
scripts/                         # create-admin, prelaunch, yedek/geri yükleme, konum içe aktarma
tests/e2e/*.spec.ts              # Playwright uçtan uca testler
```

## 11. Bilinen sınırlamalar

- Ödeme altyapısı bağlı değildir; abonelikler süper admin panelinden elle yönetilir (veritabanı yapısı hazırdır).
- Referans konum verisi şu an Ankara'nın bir bölümünü kapsar (1 il, 5 ilçe, 15 mahalle); Türkiye geneli veri `npm run import:locations` ile resmî kaynaktan yüklenir (docs/LOCATION_DATA.md).
- Özel alan adı için DNS kaydı platform dışında yapılır; Vercel'e ekleme `DOMAIN_PROVIDER=vercel` ile otomatikleşir, aksi halde elle yapılır.
- Yeni talep e-posta bildirimi e-posta sağlayıcısı (Resend) yapılandırılınca çalışır; WhatsApp bildirimi henüz yoktur.
- Oturum açmış bir kullanıcı, başka bir kiracının **yayındaki** ilan görselinin iç meta verilerini (ör. orijinal dosya adı) API üzerinden okuyabilir; anonim ziyaretçi için bu sütunlar kapalıdır. Özel dosyalar ve yayında olmayan içerik her durumda kapalıdır.
