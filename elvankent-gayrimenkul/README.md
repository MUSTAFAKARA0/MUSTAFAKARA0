# Elvankent Gayrimenkul — Emlak Platformu (V2)

`elvankentgayrimenkul.com` için geliştirilmiş; mobil öncelikli, SEO uyumlu ve **çok kiracılı (SaaS'a hazır)** gayrimenkul platformu. Elvankent Gayrimenkul varsayılan kiracıdır; aynı altyapıda başka emlak ofisleri kendi alan adı, markası, kullanıcıları ve yalıtılmış verileriyle çalışabilir.

- **Ziyaretçi:** gelişmiş arama ve filtreler, SEO dostu kategori ve bölge sayfaları, 4K fotoğraflardan üretilen hızlı galeri (tam ekran, yakınlaştırma, klavye/kaydırma), gizlilik korumalı harita, WhatsApp/telefon, bilgi-randevu-değerleme formları, favoriler ve karşılaştırma (üyeliksiz), paylaşım, müşteriye özel ilan seçkileri, blog, dinamik paylaşım görselleri.
- **Ofis paneli (`/admin`):** özet panel, otomatik kaydeden ilan sihirbazı, 4K fotoğraf yükleme (devam ettirilebilir), sıralama/kapak/döndürme, QR kod ve PDF broşür, CRM (talepler, müşteriler, randevular, koleksiyonlar), analitik, medya kütüphanesi, blog ve sayfalar, bölge sayfaları, SEO ve yönlendirmeler, şirket ayarları (white-label), kullanıcılar ve roller, güvenlik kayıtları, veri dışa aktarma.
- **Süper admin (`/platform`):** organizasyonlar, planlar ve abonelikler, alan adları, kullanıcılar, sistem kayıtları.

## Belgeler

| Belge | İçerik |
| --- | --- |
| [SETUP.md](./SETUP.md) | Kurulum, V1 → V2 yükseltme, ortam değişkenleri, canlıya alma kontrol listesi |
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) | Yönetim paneli kullanım kılavuzu |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Mimari, çok kiracılı yapı, güvenlik katmanları, medya hattı, SEO |
| [docs/DEMO_SETUP.md](./docs/DEMO_SETUP.md) | Ayrı demo/önizleme ortamı (Supabase demo projesi + Vercel Preview) ve telefon kabul testi |
| [docs/PLATFORM_VE_KIRACI.md](./docs/PLATFORM_VE_KIRACI.md) | Platform sahibi (KARAY) ↔ kiracı (emlak ofisi) ayrımı: marka, yetki, tema, veritabanı |
| [docs/TELEFON_KABUL_TESTI.md](./docs/TELEFON_KABUL_TESTI.md) | Gerçek telefonda yapılacak kısa kabul testi ve MFA (iki adımlı doğrulama) kurulumu |
| [docs/PRODUCTION_MIGRATION.md](./docs/PRODUCTION_MIGRATION.md) | Canlı veritabanı yükseltmesi: yedek, sıra, kontroller, geri dönüş |
| [docs/DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md) | 15 adımlık canlıya çıkış sırası |
| [docs/OPERATIONS.md](./docs/OPERATIONS.md) | Bildirimler, hata izleme/uptime, MFA, harita sağlayıcısı, alan adları |
| [docs/BACKUP_RESTORE.md](./docs/BACKUP_RESTORE.md) | Veritabanı + Storage yedekleme ve geri yükleme |
| [docs/LOCATION_DATA.md](./docs/LOCATION_DATA.md) | Türkiye il/ilçe/mahalle verisi: kaynak, CSV biçimi, içe aktarma |
| [docs/LEGAL_DATA_MAP.md](./docs/LEGAL_DATA_MAP.md) | Kişisel veri haritası (hukukçu incelemesi için; hukuki görüş değildir) |
| [docs/GO_LIVE_CONTENT_CHECKLIST.md](./docs/GO_LIVE_CONTENT_CHECKLIST.md) | Gerçek içerik ve SEO geçiş listesi |
| [TESLIM_RAPORU.md](./TESLIM_RAPORU.md) | V1 teknik teslim raporu (tarihsel) |

## Hızlı başlangıç

```bash
cp .env.example .env.local        # değerleri doldurun
npm install
npm run dev                       # http://localhost:3000
```

Veritabanı: `supabase/migrations/*.sql` dosyaları sırayla uygulanır (ayrıntılar ve V1'den yükseltme için **SETUP.md**). İsteğe bağlı olarak `supabase/seed.sql` DEMO olarak işaretli örnek ilanları ekler.

Yönetici / süper admin hesabı:

```bash
npm run create-admin -- eposta@ornek.com                                   # güçlü şifre üretir, bir kez gösterir
npm run create-admin -- eposta@ornek.com 'Guclu-Sifre-123'                 # varsayılan ofiste owner
npm run create-admin -- eposta@ornek.com 'Guclu-Sifre-123' --super-admin   # + platform yöneticisi
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Production build / sunucu |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run check` | typecheck + lint + build |
| `npm test` | Birim testleri + güvenlik testleri (`test:unit`, `test:rls`: kiracı izolasyonu, roller, depolama, yetki yükseltme, MFA) |
| `npm run prelaunch [-- --production]` | Canlıya çıkış kontrolü (ortam değişkenleri, demo veri, hukuk onayı, MFA…) |
| `npm run backup:storage` / `npm run restore:storage` | Storage yedeği / geri yükleme (bkz. docs/BACKUP_RESTORE.md) |
| `npm run import:locations -- --file=… [--apply]` | İl/ilçe/mahalle CSV içe aktarma (bkz. docs/LOCATION_DATA.md) |
| `npm run test:e2e` | Playwright uçtan uca testler (ziyaretçi, yönetici, responsive) |
| `npm run create-admin -- e-posta şifre [--org=] [--role=] [--super-admin]` | Hesap oluşturur, ofise üye yapar |
| `npm run db:types` | Veritabanından TypeScript tipleri üretir (`DATABASE_URL`) |
| `npm run assets` | Favicon, varsayılan OG görseli ve DEMO görselleri yeniden üretir |

## Teknoloji

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix UI · Supabase (PostgreSQL + RLS, Auth, Storage) · Zod · sharp · tus-js-client · Leaflet · Playwright
