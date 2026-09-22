# Elvankent Gayrimenkul — Emlak İlan Platformu

`elvankentgayrimenkul.com` için geliştirilmiş, yönetim panelli, mobil öncelikli ve SEO uyumlu emlak ilan platformu.

- **Ziyaretçi:** gelişmiş arama ve filtreler, SEO dostu kategori/bölge sayfaları, fotoğraf galerisi (tam ekran, kaydırma, klavye), harita, telefon/WhatsApp ile tek dokunuşla iletişim, favoriler (üyeliksiz), paylaşım, benzer ilanlar, bilgi talep formu.
- **Yönetici (`/admin`):** panel ve istatistikler, ilan ekleme/düzenleme/silme, yayına alma/kaldırma, öne çıkarma, sürükle-bırak fotoğraf yükleme ve sıralama, kapak seçimi, mesajlar, işletme ayarları, logo, demo ilanları silme.

> Kurulum, yapı, güvenlik, testler ve yayına alma adımlarının tamamı için: **[TESLIM_RAPORU.md](./TESLIM_RAPORU.md)**

## Hızlı başlangıç

```bash
cp .env.example .env.local        # değerleri doldurun
npm install
npm run dev                       # http://localhost:3000
```

Veritabanı: `supabase/migrations/*.sql` dosyalarını sırasıyla, ardından isteğe bağlı olarak `supabase/seed.sql` (demo ilanlar) dosyasını Supabase SQL Editor'da çalıştırın.

Yönetici hesabı: `npm run create-admin -- eposta@ornek.com 'Guclu-Sifre-123'`

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Production build / sunucu |
| `npm run check` | TypeScript + ESLint + production build |
| `npm run test:rls` | Supabase RLS/yetki testleri |
| `npm run test:e2e` | Playwright uçtan uca testler |
| `npm run create-admin -- e-posta şifre` | Yönetici hesabı oluşturur / yetki verir |
| `npm run assets` | Favicon, OG görseli ve demo illüstrasyonlarını yeniden üretir |

## Teknoloji

Next.js 16 (App Router, TypeScript) · React 19 · Tailwind CSS 4 · shadcn/ui yaklaşımı (Radix UI) · Supabase (PostgreSQL, Auth, Storage, RLS) · Zod · Leaflet + OpenStreetMap · sharp · Playwright
