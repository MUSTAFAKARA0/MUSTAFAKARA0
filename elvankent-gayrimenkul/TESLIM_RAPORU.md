# Elvankent Gayrimenkul — Teknik Teslim Raporu

Tarih: 22 Eylül 2026 · Sürüm: 1.0

Bu rapor; kullanılan teknolojileri, proje yapısını, veritabanını, kurulum ve yayına alma adımlarını, yapılan güvenlik kontrollerini ve testleri eksiksiz açıklar. Teknik olmayan bir kullanıcının da takip edebileceği şekilde adım adım yazılmıştır.

---

## 1. Teknoloji Stack'i

| Katman | Teknoloji | Neden |
| --- | --- | --- |
| Uygulama çatısı | **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** (strict) | Sunucu tarafı render (SEO), ISR önbellek, görsel optimizasyonu |
| Arayüz | **Tailwind CSS 4**, shadcn/ui yaklaşımı (**Radix UI** primitive'leri), **lucide-react** ikonları, **sonner** bildirimler | Hızlı, erişilebilir, tutarlı tasarım sistemi |
| Veritabanı | **Supabase PostgreSQL** + **Row Level Security (RLS)** | İlişkisel yapı, veritabanı seviyesinde yetkilendirme |
| Kimlik doğrulama | **Supabase Auth** (`@supabase/ssr`, çerez tabanlı oturum) | Güvenli yönetici girişi |
| Dosya depolama | **Supabase Storage** (`property-images`, `branding` kovaları) | İlan fotoğrafları ve logo |
| Doğrulama | **Zod 4** | Sunucu ve form doğrulaması |
| Görsel işleme | **sharp** (sunucu), canvas (tarayıcıda ön küçültme) | WebP dönüştürme, EXIF/GPS temizleme, boyutlandırma |
| Harita | **Leaflet** + OpenStreetMap (sunucu proxy'si üzerinden) | Anahtarsız çalışır; ücretli sağlayıcıya geçişte anahtar sunucuda kalır |
| Sürükle-bırak | **@dnd-kit** | Fotoğraf sıralama (fare, dokunmatik, klavye) |
| Test | **Playwright** (E2E), **node:test** (RLS) | Gerçek tarayıcı ve gerçek veritabanı testleri |

Gereksiz bağımlılık eklenmemiştir: durum yönetimi kütüphanesi, CSS-in-JS, grafik kütüphanesi vb. kullanılmadı (panel grafiği saf SVG).

---

## 2. Proje Klasör Yapısı

```
elvankent-gayrimenkul/
├── supabase/
│   ├── migrations/
│   │   ├── 20260922000001_schema.sql          # tablolar, enum'lar, indeksler, tetikleyiciler
│   │   ├── 20260922000002_security.sql        # RLS politikaları, yetkiler, RPC fonksiyonları
│   │   ├── 20260922000003_storage.sql         # Storage kovaları ve politikaları
│   │   └── 20260922000004_reference_data.sql  # il/ilçe/mahalle, emlak tipleri, özellikler, ayarlar
│   └── seed.sql                               # 8 adet DEMO ilan (isteğe bağlı)
├── scripts/
│   ├── create-admin.mjs                       # yönetici hesabı oluşturma
│   └── generate-assets.mjs                    # favicon, OG görseli, demo illüstrasyonları
├── tests/
│   ├── security/rls.test.mjs                  # 10 RLS/yetki testi
│   └── e2e/                                   # visitor / admin / responsive Playwright testleri
├── public/                                    # demo görseller, og-default.png
└── src/
    ├── proxy.ts                               # /admin oturum kontrolü (Next 16 "proxy" = eski middleware)
    ├── app/
    │   ├── (site)/                            # ziyaretçi sayfaları (Header/Footer layout)
    │   │   ├── page.tsx                       # ana sayfa
    │   │   ├── [slug]/page.tsx                # /satilik, /kiralik-daire, /arsa, /ankara-etimesgut-elvankent …
    │   │   ├── [slug]/[...rest]/page.tsx      # eski URL'ler için 301 yönlendirme
    │   │   ├── ilan/[slug]/page.tsx           # ilan detayı
    │   │   ├── favoriler, iletisim, hakkimizda, hizmetlerimiz,
    │   │   ├── kvkk, gizlilik-politikasi, cerez-politikasi, kullanim-kosullari, 500
    │   │   ├── not-found.tsx, error.tsx
    │   ├── admin/
    │   │   ├── giris/                         # giriş ekranı
    │   │   └── (panel)/                       # korumalı panel: panel, ilanlar, ilan-ekle, ilan/[id], mesajlar, ayarlar
    │   ├── actions/                           # server action'lar (iletişim, favoriler, admin işlemleri, auth)
    │   ├── api/                               # track (istatistik), tiles (harita), admin görsel/logo yükleme
    │   ├── sitemap.ts, robots.ts, manifest.ts, icon.svg, apple-icon.png, favicon.ico
    │   └── layout.tsx, global-error.tsx, not-found.tsx, globals.css (tasarım token'ları)
    ├── components/
    │   ├── ui/          # Button, Input, Select, Field, Checkbox, Badge, Dialog, Sheet, Skeleton
    │   ├── layout/      # Header, Footer, Logo, mobil menü, çerez bildirimi, WhatsApp butonu
    │   ├── property/    # PropertyCard, PropertyGrid, PropertyFilters, PropertyGallery, PropertyFeatures,
    │   │                # ContactButtons, MobileContactBar, ShareButton, FavoriteButton, skeleton'lar
    │   ├── home/        # HeroSearch, bölüm bileşenleri
    │   ├── admin/       # AdminSidebar, PropertyForm, ImageManager, tablo işlemleri, grafik, ayarlar
    │   ├── map/         # LazyMap + Leaflet haritası
    │   ├── forms/       # ContactForm, NumberInput
    │   └── common/      # Breadcrumbs, Pagination, EmptyState, JsonLd, LegalPage …
    ├── content/site-content.ts   # hizmetler, "Neden Biz", popüler aramalar (kolay düzenlenir)
    ├── hooks/use-favorites.ts
    ├── lib/              # veri katmanı, doğrulama, SEO, slug, format, auth, env
    └── types/database.ts
```

---

## 3. Supabase Veritabanı Yapısı

| Tablo | Amaç | Ziyaretçi erişimi |
| --- | --- | --- |
| `profiles` | Kullanıcı profili ve **rol** (`admin`, `agent`, `member`) | Yok (kullanıcı sadece kendi profilini görür, rolünü değiştiremez) |
| `site_settings` | İşletme adı, telefon, WhatsApp, e-posta, adres, çalışma saatleri, logo, sosyal medya, hakkımızda | Okuma |
| `cities`, `districts`, `neighborhoods` | İl › ilçe › mahalle hiyerarşisi (slug'lı) | Okuma |
| `property_types` | Emlak tipleri (konut / iş yeri / arsa kategorili) | Okuma |
| `features` | Özellik kataloğu (iç, dış, muhit, ulaşım) | Okuma |
| `properties` | İlanlar — 50'ye yakın alan: fiyat, döviz, aidat, depozito, m², oda+salon, kat, bina yaşı, ısıtma, asansör, otopark, eşya, site, klima, kredi, tapu, kullanım, cephe, manzara, takas, arsa için imar/ada/parsel/KAKS/gabari, durum, öne çıkan, demo, SEO açıklaması… | Sadece `status = 'active'` olanlar |
| `property_locations` | **Açık adres ve kesin koordinat** + gösterim hassasiyeti | **Yok** (sadece admin) |
| `property_features` | İlan ↔ özellik (çoka-çok) | Yayındaki ilanlar için |
| `property_images` | Fotoğraflar: yol, boyut, bulanık önizleme, sıra, kapak | Yayındaki ilanlar için |
| `property_events` | Görüntülenme, telefon/WhatsApp tıklaması, form, favori, paylaşım olayları | Yok |
| `property_stats` | İlan başına sayaçlar | Yok |
| `contact_requests` | İletişim talepleri (KVKK onayı, IP özeti) | Yok |
| `favorites` | Üye favorileri (gelecekteki üyelik sistemi için hazır) | Sadece kendi kayıtları |
| `redirects` | 301/302 yönlendirme tablosu | Okuma |

**Öne çıkan veritabanı mekanizmaları**

- **İlan numarası** (`listing_no`, 100001'den başlar) ve **slug**: slug her zaman ilan numarasıyla biter (`satilik-3-plus-1-daire-elvankent-100001`) → çakışma imkânsızdır. Başlık değişirse eski adresler otomatik 308 ile yeni adrese yönlenir.
- **Konum gizliliği:** `property_locations` tetikleyicisi, herkese açık koordinatı hassasiyete göre hesaplar: *tam konum*, *yaklaşık* (ilana özgü ±200 m kaydırma) veya *sadece mahalle merkezi*. Yönetici “tam konum” seçmedikçe kesin koordinat ve açık adres ziyaretçiye hiçbir zaman gönderilmez.
- **Silinen ilan:** tetikleyici, eski adresi `redirects` tablosuna ekler; `/ilan/eski-adres` kalıcı yönlendirme (HTTP 308 — Google için 301 ile eşdeğer) ile ilgili kategoriye yönlenir (SEO değeri korunur).
- **RPC fonksiyonları:** `is_admin()`, `submit_contact_request()` (hız sınırlı), `track_property_event()` (tekrar sayımı önler), `admin_dashboard_stats()`, `region_listing_counts()`.

---

## 4. Environment Variable Listesi

| Değişken | Zorunlu | Gizli mi? | Açıklama |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Evet | Hayır | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Evet | Hayır (tasarım gereği açık; güvenliği RLS sağlar) | Anon anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | **EVET** | Yalnızca sunucuda; iletişim formu ve istatistik için. Asla `NEXT_PUBLIC_` önekiyle tanımlamayın |
| `NEXT_PUBLIC_SITE_URL` | Evet | Hayır | `https://elvankentgayrimenkul.com` (sonunda `/` yok) |
| `IP_HASH_SALT` | Evet | **EVET** | Rastgele uzun metin (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Hayır | Hayır | Search Console doğrulama kodu |
| `MAP_TILE_URL` | Hayır | **EVET** (anahtar içerebilir) | Harita sağlayıcı adresi; boşsa OpenStreetMap |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Hayır | Hayır | Harita sağlayıcısı değişirse atıf metni |

Tümü `.env.example` dosyasında açıklamalı olarak listelenmiştir.

---

## 5. Kurulum Talimatları

**Gereksinimler:** Node.js 20.9+ (önerilen 22), bir Supabase hesabı (ücretsiz plan yeterlidir).

1. **Supabase projesi oluşturun:** supabase.com → *New project* → bölge olarak **Frankfurt (eu-central-1)** önerilir (Türkiye'ye yakın).
2. **Veritabanını kurun:** Supabase panelinde *SQL Editor*'ı açın ve şu dosyaların içeriğini **sırasıyla** yapıştırıp çalıştırın:
   1. `supabase/migrations/20260922000001_schema.sql`
   2. `supabase/migrations/20260922000002_security.sql`
   3. `supabase/migrations/20260922000003_storage.sql`
   4. `supabase/migrations/20260922000004_reference_data.sql`
   5. (İsteğe bağlı, demo içerik için) `supabase/seed.sql`

   *Alternatif (Supabase CLI):* `npx supabase init` → `npx supabase link --project-ref <ref>` → `npx supabase db push`.
3. **Üyelik kaydını kapatın:** *Authentication → Sign In / Providers → Email* altında **"Allow new users to sign up"** seçeneğini kapatın (site yalnızca yöneticiler için giriş kullanır).
4. **Projeyi hazırlayın:**
   ```bash
   cd elvankent-gayrimenkul
   cp .env.example .env.local   # Supabase → Project Settings → API'den değerleri girin
   npm install
   npm run dev                  # http://localhost:3000
   ```

---

## 6. Admin Hesabı Oluşturma

**Yöntem A — betik (önerilen):**
```bash
npm run create-admin -- ofis@elvankentgayrimenkul.com 'En-Az-10-Karakterli-Sifre'
```
Hesap yoksa oluşturur, varsa şifresini günceller ve **admin** rolünü verir.

**Yöntem B — Supabase paneli:**
1. *Authentication → Users → Add user* ile e-posta/şifre girin (*Auto confirm* işaretli).
2. *SQL Editor*'da çalıştırın:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'ofis@elvankentgayrimenkul.com');
   ```

Giriş: `https://elvankentgayrimenkul.com/admin` → otomatik olarak `/admin/giris` sayfasına yönlenir.

**İlk yapılacaklar:** *Ayarlar* sayfasından telefon, WhatsApp, e-posta, adres, çalışma saatleri ve logoyu girin. Telefon girilmeden "Ara" ve "WhatsApp" butonları görünmez (panelde uyarı gösterilir). Kendi ilanlarınızı ekledikten sonra *Ayarlar → Demo ilanlar → Tüm demo ilanları sil*.

---

## 7. Deployment (Yayına Alma) Talimatları — Vercel

1. Kodu GitHub'a gönderin (bu depo hazır).
2. vercel.com → *Add New Project* → depoyu seçin → **Root Directory: `elvankent-gayrimenkul`** (Framework: Next.js otomatik algılanır).
3. *Environment Variables* bölümüne 4. maddedeki değişkenleri girin (Production + Preview).
4. *Deploy*. Build yaklaşık 1-2 dakika sürer.
5. Supabase → *Authentication → URL Configuration* → **Site URL**: `https://elvankentgayrimenkul.com`.

Diğer platformlar (kendi sunucunuz): `npm run build && npm start` (Node 20.9+). Görsel optimizasyonu için `sharp` otomatik kurulur.

> Not: Vercel'de istek gövdesi sınırı 4.5 MB'tır. Fotoğraflar yüklenmeden önce tarayıcıda otomatik olarak küçültüldüğü için telefon fotoğrafları sorunsuz yüklenir.

---

## 8. Domain Bağlantısı

1. Vercel → Proje → *Settings → Domains* → `elvankentgayrimenkul.com` ve `www.elvankentgayrimenkul.com` ekleyin.
2. Domain sağlayıcınızın DNS panelinde Vercel'in gösterdiği kayıtları girin (genellikle):
   - `A` kaydı: `@` → `76.76.21.21`
   - `CNAME` kaydı: `www` → `cname.vercel-dns.com`
3. `www` adresini ana domaine yönlendirin (Vercel'de "Redirect to elvankentgayrimenkul.com").
4. SSL sertifikası Vercel tarafından otomatik verilir (birkaç dakika–birkaç saat).
5. `NEXT_PUBLIC_SITE_URL` değerinin `https://elvankentgayrimenkul.com` olduğundan emin olun ve yeniden deploy edin.

**Eski site URL'leri:** Eski sitenin önemli adresleri biliniyorsa Supabase'de `redirects` tablosuna ekleyin (`from_path`: `/eski/adres`, `to_path`: `/yeni-adres`, `status_code`: 301). Sabit yönlendirmeler için `next.config.ts` → `redirects()` da kullanılabilir.

---

## 9. SEO Kurulumu

Hazır olanlar:
- Her ilan için benzersiz **SEO URL'si** (`/ilan/satilik-3-plus-1-daire-elvankent-100001`), Türkçe karaktersiz slug, yanlış/eski slug'da **308 kalıcı yönlendirme**.
- Her sayfada **title, meta description, canonical, Open Graph, Twitter Card**.
- **Schema.org:** `RealEstateAgent` (işletme), `RealEstateListing` + `Offer` (ilan), `BreadcrumbList`.
- **Kategori sayfaları:** `/satilik`, `/kiralik`, `/konut`, `/arsa`, `/isyeri`, `/satilik-daire`, `/kiralik-daire`, `/satilik-konut`, `/kiralik-isyeri`, `/satilik-villa` … (her emlak tipi için otomatik).
- **Bölge sayfaları:** `/ankara`, `/ankara-etimesgut`, `/ankara-etimesgut-elvankent` — yalnızca aktif ilanı olan bölgeler yayınlanır (boş/ince sayfa üretilmez).
- Filtreli/sıralı liste varyasyonları `noindex, follow` (yinelenen içerik önlenir); sayfalama canonical'ı doğru.
- **Demo ilanlar `noindex`** ve site haritasına dahil edilmez.
- `sitemap.xml` (dinamik, 5 dk'da bir güncellenir), `robots.txt` (`/admin`, `/api` kapalı), `manifest.webmanifest`, favicon seti, 404/500 sayfaları.

---

## 10. Google Search Console Kurulumu

1. search.google.com/search-console → *Mülk ekle* → **URL öneki**: `https://elvankentgayrimenkul.com`.
2. Doğrulama yöntemi olarak **HTML etiketi**'ni seçin; `content="..."` içindeki kodu Vercel'de `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` değişkenine girip yeniden deploy edin → *Doğrula*.
   (Alternatif: DNS TXT kaydı ile *Alan adı* mülkü.)
3. *Site Haritaları* → `sitemap.xml` gönderin.
4. *URL Denetimi* ile ana sayfa ve birkaç ilanı "Dizine eklenmesini iste".
5. Google İşletme Profili (Google Maps) oluşturup web sitesi olarak domaini eklemeniz yerel aramalarda önemli katkı sağlar.

---

## 11. Yapılan Güvenlik Kontrolleri

| Alan | Uygulama |
| --- | --- |
| Yetkilendirme | Admin kontrolü **3 katmanlı**: (1) `proxy.ts` oturumu olmayanı girişe yönlendirir, (2) her admin sayfası/server action/API `requireAdmin()` ile Auth sunucusunda doğrulanan kullanıcıyı ve `is_admin()` rolünü kontrol eder, (3) **RLS** her sorguyu veritabanında korur. Sadece istemci kontrolüne güvenilmez. |
| RLS | 16 tablonun tamamında RLS açık; 37 politika. Ziyaretçi yalnızca yayındaki ilanları okur; açık adres, iletişim talepleri ve istatistikler ziyaretçiye/üyeye kapalı. Üye kendi rolünü değiştiremez (kolon yetkisi). |
| Gizli anahtarlar | `service_role` ve IP tuzu yalnızca `server-only` modülünde. Production paketinde tarandı: **istemci dosyalarında 0 eşleşme**. |
| Form güvenliği | Zod doğrulama + kontrol karakteri temizleme, gizli bot tuzağı (honeypot), minimum doldurma süresi, **veritabanı seviyesinde hız sınırı** (aynı IP'den 10 dk'da 3, 24 saatte 10 mesaj — testte doğrulandı), KVKK onayı zorunlu. |
| Giriş | Supabase Auth hız sınırları, açık yönlendirme koruması (`next` parametresi yalnızca `/admin…`), yetkisiz hesap otomatik çıkış. |
| Dosya yükleme | Admin + aynı kaynak (CSRF) kontrolü, içerikten format tespiti (uzantıya güvenilmez), boyut/çözünürlük sınırı, **EXIF/GPS konum verisi silinir**, WebP'ye yeniden kodlanır, SVG kabul edilmez. Storage yazma yetkisi yalnızca admin (RLS). |
| Enjeksiyon | Arama sorguları PostgREST filtre sözdizimine karşı temizlenir; JSON-LD `<` kaçışlı; kullanıcı metni React ile kaçışlanarak basılır. |
| HTTP başlıkları | CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; `X-Powered-By` kapalı; admin sayfaları `noindex` ve `no-store`. |
| KVKK | Ham IP saklanmaz (tuzlu SHA-256 özet); ziyaretçi takibi çerezsiz; favoriler sadece tarayıcıda; hukuki metinler taslak olarak işaretli. |
| Harita | Sağlayıcı adresi/anahtarı sunucuda; tarayıcı sadece `/api/tiles` ile konuşur. |

---

## 12. Yapılan Testler

Tüm testler, gerçek bir PostgreSQL 16 + Supabase Auth (GoTrue) + PostgREST + Supabase Storage yığınına karşı ve **production build** üzerinde çalıştırıldı.

**RLS / güvenlik testleri** (`npm run test:rls`) — **10/10 başarılı**
admin taslak oluşturur · ziyaretçi taslağı göremez · üye ilan ekleyemez · ziyaretçi güncelleyemez/silemez · açık adres sadece admin · iletişim talepleri kapalı (tablo + RPC) · istatistikler kapalı · üye kendini admin yapamaz · ayarları sadece admin günceller · Storage'a ziyaretçi/üye yükleyemez.

**Ziyaretçi senaryoları** (masaüstü + mobil Pixel 7) — **15/15 başarılı** (mobilde paylaşım testi, cihazın yerel paylaşım menüsü açıldığı için atlanır)
1-2 ana sayfa ve arama · 3 filtre + boş sonuç + sıfırlama · 4-8 ilan detayı, galeri (klavye ile gezinme, Esc), harita, WhatsApp (`wa.me/90…?text=…İlan No`) ve `tel:+90…` bağlantıları · 9 favori ekleme/çıkarma · 10 paylaşım menüsü ve bağlantı kopyalama · çerez bildirimi · iletişim formu doğrulama ve gönderim · SEO etiketleri, JSON-LD, robots, sitemap, 404.

**Yönetici senaryoları** — **8/8 başarılı** (12 maddenin tamamını kapsar)
yetkisiz erişim → giriş · hatalı şifre · giriş ve ayarlar · yeni ilan + doğrulama hataları + 3 fotoğraf yükleme + sıralama + yayınlama · kapak değiştirme ve sıralamanın kalıcılığı · fiyat düzenleme ve sitede görünme · pasife alma (sitede 404) ve tekrar aktif etme · iletişim talebinin panelde görünmesi ve "yanıtlandı" · silme ve eski adresin **308 kalıcı yönlendirme** ile kategoriye yönlenmesi.

**Responsive** — 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920 px genişliklerinde ana sayfa, liste, detay, iletişim, hakkımızda ve favoriler sayfalarında **yatay taşma yok**.

**Lighthouse (mobil, yavaş 4G simülasyonu, son build):**

| Sayfa | Performans | Erişilebilirlik | En İyi Uyg. | SEO | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| Ana sayfa | 91 | 100 | 100 | 100 | 3.4 s | 0.008 |
| /satilik | 91 | 100 | 100 | 100 | 3.5 s | 0.008 |
| İlan detayı | 89 | 100 | 100 | 69* | 3.7 s | 0 |
| /iletisim | 93 | 100 | 100 | 100 | 3.2 s | 0.008 |

\* Ölçülen ilan bir DEMO ilan olduğu için bilinçli olarak `noindex`; gerçek ilanlarda bu uyarı oluşmaz. İlk ölçümde erişilebilirlik 91-97 idi; bulunan sorunlar (13. bölüm #11-12) düzeltilerek 100'e çıkarıldı.

**Kod kalitesi:** `tsc --noEmit` 0 hata · ESLint 0 hata/uyarı · `next build` uyarısız · kullanılmayan dosya/export taraması (knip) sonrası temizlik · `console.log` yok · migration'lar boş veritabanında baştan sona hatasız · seed tekrar çalıştırmaya dayanıklı.

Testleri kendiniz çalıştırmak için: `.env.local` içine `TEST_*` / `E2E_*` değişkenlerini girin, `npm run test:rls` ve `npm run build && npm start` ardından `npm run test:e2e`.

---

## 13. Bulunan ve Düzeltilen Hatalar

| # | Bulgu | Çözüm |
| --- | --- | --- |
| 1 | Galeride mobil ve masaüstü görselleri birlikte önceden yükleniyordu (gereksiz veri) ve masaüstü LCP görseli tembel yükleniyordu | `sizes` ile gizli varyantın en küçük boyutu seçildi; masaüstü kapak `eager + fetchPriority=high` |
| 2 | Mozaikte 4 fotoğrafta ızgara taşıyordu | 1/2/3/5 karoluk dengeli yerleşim |
| 3 | Mobil detayda telefon tanımlı değilken alt iletişim çubuğu hiç görünmüyordu | "Bilgi Talep Et" butonu ile forma yönlendirme |
| 4 | Demo uyarı kutusunda metin satır kırılması bozuktu; özellik kartlarında metin kesiliyordu | Yapı düzeltildi, metin kaydırma |
| 5 | Çerez bildirimi mobilde ekranın ~%20'sini kaplıyor, ilan kartını örtüyordu | Tek satırlık kompakt tasarım; WhatsApp butonu çakışmayacak şekilde konumlandırıldı |
| 6 | Favoriler sayfasında ilk açılışta boş durum mesajı anlık görünüyordu; favoriden çıkarmada gereksiz yeniden yükleme | Hidrasyon farkındalığı ve alt küme önbelleği |
| 7 | İletişim formunda doldurma süresi alanı gönderime yansımıyordu (spam korumasını bozuyordu) | Değer gönderim anında doğrudan yazılıyor |
| 8 | Aynı sayfadaki iki iletişim formunda yinelenen alan kimlikleri (erişilebilirlik) | `useId` ile benzersiz kimlikler |
| 9 | "Tümü" seçilen aramada site "Satılık"a zorluyordu | Tüm ilanlar için `/ilanlar` sayfası |
| 10 | Yeni ilanlar ızgarasında tek kalan kart | 4'ün katlarına göre gösterim |
| 11 | Kontrast: gri metin (4.4:1) ve WhatsApp yeşili (3.5:1) WCAG AA altındaydı | Token'lar 5.4:1 ve 5.0:1'e yükseltildi |
| 12 | Logo bağlantısının erişilebilir adı görünen metinle uyuşmuyordu; liste sayfasında başlık sırası atlanıyordu; mobilde sıralama kutusunun etiketi yoktu | Düzeltildi (Lighthouse erişilebilirlik bulguları) |
| 13 | Yönetici ilan tablosu orta genişlikte başlıkları sıkıştırıyor; mobilde satırlar çok uzundu | İkonlu kompakt işlemler, mobilde tek satır fiyat/durum/işlem |
| 14 | 320 px'te ana sayfa arama sekmeleri taşıyordu | 4 eşit sütun |
| 15 | Demo seed'de anlamsız "0000" ada/parsel değerleri | Boş bırakıldı |
| 16 | Site haritasında `noindex` demo ilanlar yer alıyordu | Demo ilanlar hariç tutuldu |
| 17 | Kullanılmayan tarayıcı istemcisi ve yardımcılar | Kaldırıldı |

Doğrulanan beklenen davranış: aynı IP'den kısa sürede fazla mesaj gönderildiğinde form hız sınırı mesajı gösteriyor.

**Test ortamı kısıtı (canlıyı etkilemez):** Geliştirme ortamının internet erişimi harita döşeme sunucularına kapalı olduğundan harita görüntüsü (sokak çizimleri) bu ortamda görsel olarak doğrulanamadı; harita bileşeninin yüklenmesi, işaret/alan çizimi, konum seçimi ve döşeme hatasında kullanıcıya gösterilen mesaj test edildi. Canlıda OpenStreetMap döşemeleri normal şekilde yüklenir. Safari/iOS gerçek cihazda test edilemedi; kod Safari 16.4+ uyumlu API'lerle yazıldı (iOS'ta HEIC fotoğraflar seçim sırasında otomatik JPEG'e çevrilir, 16px form alanlarıyla otomatik yakınlaştırma engellenir, güvenli alan boşlukları uygulanır). Yayın sonrası gerçek iPhone'da kısa bir kontrol önerilir.

---

## 14. Gelecekte Eklenebilecek Özellikler

Mimari bunlara hazır tasarlandı (roller, `favorites` tablosu, olay tablosu, bölge yapısı):

- **Danışman profilleri ve çoklu emlakçı** (`profiles.role = 'agent'`, ilanlarda `created_by` mevcut)
- **Müşteri üyeliği:** favorilerin hesaba senkronizasyonu (`favorites` tablosu ve RLS hazır), **kayıtlı aramalar**, **fiyat düşüş bildirimleri**
- **E-posta bildirimleri:** yeni iletişim talebinde yöneticiye e-posta (Supabase Database Webhook + Resend)
- **Blog ve bölge rehberleri** (Elvankent, Eryaman yaşam rehberi — yerel SEO için güçlü)
- **İlan karşılaştırma**, **sanal tur / video** alanı
- **Gelişmiş CRM:** müşteri kartları, randevu takvimi, talep–ilan eşleştirme
- **Çoklu dil** (İngilizce/Arapça), **çoklu şube**
- **Cloudflare Turnstile** (yoğun spam durumunda form koruması), **Sentry** hata izleme, **Vercel Analytics** (çerez politikası güncellenerek)
- Ücretli harita sağlayıcısı (MapTiler vb.) — `MAP_TILE_URL` ile kod değişmeden

---

### Kısa kullanım kılavuzu (yönetici)

1. `/admin` → giriş yapın.
2. **Yeni İlan Ekle** → başlık, ilan tipi, emlak tipi, açıklama → il/ilçe/mahalle ve haritada konum → fiyat → m²/oda/kat → özellik kutuları → fotoğrafları sürükleyip bırakın (ilk fotoğraf kapak olur) → **Yayınla**.
3. **İlanlar** sayfasından ilanı düzenleyin, yayından kaldırın, öne çıkarın, fiyatını hızlıca değiştirin veya "Satıldı / Kiralandı" olarak işaretleyin.
4. **Mesajlar** sayfasında gelen talepleri görün; tek dokunuşla arayın/WhatsApp'tan yazın, "Yanıtlandı" olarak işaretleyin.
5. **Ayarlar** sayfasından iletişim bilgileri, logo, hakkımızda metni ve sosyal medya hesaplarını güncelleyin.
