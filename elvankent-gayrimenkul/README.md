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
| `npm test` (`npm run test:rls`) | Güvenlik testleri: kiracı izolasyonu, roller, depolama, yetki yükseltme |
| `npm run test:e2e` | Playwright uçtan uca testler (ziyaretçi, yönetici, responsive) |
| `npm run create-admin -- e-posta şifre [--org=] [--role=] [--super-admin]` | Hesap oluşturur, ofise üye yapar |
| `npm run db:types` | Veritabanından TypeScript tipleri üretir (`DATABASE_URL`) |
| `npm run assets` | Favicon, varsayılan OG görseli ve DEMO görselleri yeniden üretir |

## Teknoloji

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix UI · Supabase (PostgreSQL + RLS, Auth, Storage) · Zod · sharp · tus-js-client · Leaflet · Playwright
