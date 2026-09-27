# Gerçek içerik ve SEO geçişi (canlı)

## Demo verisinin canlıya taşınmaması

- `supabase/seed.sql` açık onay (`app.allow_demo_seed=on`) olmadan ve gerçek ilan bulunan veritabanında **çalışmaz**.
- Demo ilanlar her yerde "DEMO" etiketli, `noindex` ve site haritası dışıdır.
- `npm run prelaunch -- --production`: canlıda demo ilan varsa **kritik** hata verir.
- Kaldırma: Panel › Ayarlar › Demo ilanlar › "Demo ilanları kaldır" (çöp kutusuna) → İlanlar › Çöp kutusu › kalıcı sil.

## Kontrol listesi

**İşletme bilgileri** (Panel › Şirket Ayarları)
- [ ] Logo, site simgesi, renkler
- [ ] Telefon, WhatsApp, e-posta, adres, harita konumu, çalışma saatleri
- [ ] Sosyal medya bağlantıları
- [ ] Ayarlar › Bildirimler: alıcı adresler + test e-postası

**İlanlar**
- [ ] Gerçek ilanlar girildi (en az: başlık, açıklama, fiyat, il/ilçe/mahalle, konum gösterimi)
- [ ] Gerçek fotoğraflar (yatay, en az 1600 px; ilk fotoğraf kapak)
- [ ] Demo ilanlar kaldırıldı

**İçerik**
- [ ] Hakkımızda, Hizmetler
- [ ] KVKK, Gizlilik, Çerez, Kullanım koşulları — hukukçu incelemesi + "incelendi" onayı
- [ ] Bölge sayfaları (yalnızca doğrulanabilir bilgilerle)

**SEO**
- [ ] `SITE_ENV=production` (aksi halde site noindex kalır) — sayfa kaynağında `noindex` OLMAMALI
- [ ] `https://ALANADI/robots.txt` → `Sitemap:` satırı var
- [ ] `https://ALANADI/sitemap.xml` → gerçek ilanlar ve kategori sayfaları; demo ilan yok
- [ ] Rastgele bir ilanda: `<link rel="canonical">`, Open Graph görseli (`/ilan/…/og`), yapılandırılmış veri (Google Rich Results Test)
- [ ] Panel › SEO: ana sayfa başlığı/açıklaması, paylaşım görseli
- [ ] Google Search Console: alan adı mülkü → doğrulama (DNS TXT veya Panel › SEO doğrulama kodu) → site haritası gönder
- [ ] Eski site adresleri için yönlendirmeler (Panel › SEO › Yönlendirmeler)
