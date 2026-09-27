# Demo / Preview ortamı ve telefon kabul testi

Amaç: canlı veriye dokunmadan, telefondan açılabilen bir demo adresi. Demo; ayrı bir Supabase projesi + Vercel Preview dağıtımıdır.

> Bu ortam geliştirme ortamından kurulamadı: bulut geliştirme ortamının ağ politikası Supabase, Vercel ve tünel servislerine erişimi engelliyor ve hesap kimlik bilgileri yok. Aşağıdaki adımlar sizin (hesap sahibi olarak) yapmanız gerekenlerdir; kod tarafı hazırdır.

## 1. Supabase DEMO projesi (≈10 dk)

1. [supabase.com](https://supabase.com) › **New project** → ad: `elvankent-demo`, bölge: **Frankfurt (eu-central-1)**, güçlü bir veritabanı şifresi (parola yöneticinizde saklayın).
2. **Migration'lar** (bilgisayarınızda, proje klasöründe):
   ```bash
   npx supabase login
   npx supabase link --project-ref DEMO_PROJE_KODU
   npx supabase db push          # supabase/migrations altındaki TÜM dosyalar sırayla
   ```
   (Alternatif: SQL Editor'de dosyaları ad sırasıyla tek tek çalıştırın.)
3. **Demo verisi (12 DEMO ilan)** — SQL Editor'de, aynı sorgu penceresinde önce onay satırı, sonra `supabase/seed.sql` içeriği:
   ```sql
   select set_config('app.allow_demo_seed', 'on', false);
   -- ardından seed.sql dosyasının tamamını yapıştırın
   ```
   Koruma: onay satırı olmadan veya veritabanında gerçek ilan varsa seed hata verip durur (canlıya yanlışlıkla yüklenemez).
4. **Auth › URL Configuration:** Site URL = demo adresi; Redirect URLs = `https://DEMO-ADRESI/admin/auth/callback`. **Auth › Providers › Email:** "Allow new users to sign up" KAPALI.
5. **Auth › Multi-Factor:** TOTP etkin olmalı (varsayılan).

Demo içeriği: 12 ilan, başlıkları "DEMO –" ile başlar, açıklamalarında "Bu bir DEMO ilandır" yazar, adresleri "Demo adres – gerçek adres değildir", görseller çizim illüstrasyonudur; gerçek kişi bilgisi içermez.

## 2. Vercel Preview (≈10 dk)

1. Vercel › **Add New Project** → GitHub deposu `MUSTAFAKARA0/MUSTAFAKARA0`, **Root Directory: `elvankent-gayrimenkul`**, Framework: Next.js.
2. **Environment Variables → Preview** ortamına (Production'a DEĞİL):

   | Değişken | Değer |
   | --- | --- |
   | `SITE_ENV` | `demo` (tüm sayfalar noindex + "DEMO ORTAMI" şeridi) |
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | demo projesinin değerleri |
   | `SUPABASE_SERVICE_ROLE_KEY` | demo projesinin service role anahtarı (gizli) |
   | `NEXT_PUBLIC_SITE_URL` | Vercel'in verdiği önizleme adresi (ör. `https://elvankent-demo.vercel.app`) |
   | `DEFAULT_TENANT_SLUG` | `elvankent` |
   | `IP_HASH_SALT`, `CRON_SECRET` | `openssl rand -hex 32` ile üretin |
   | `EMAIL_PROVIDER` | `none` (veya bildirim testi için Resend bilgileri) |

3. **Deployments** → dalı (`claude/elvankent-real-estate-platform-vxq9dj`) seçip **Redeploy**. İsterseniz Settings › Domains ile sabit bir önizleme alan adı (ör. `demo.elvankentgayrimenkul.com`) verin.
4. Kontrol: `https://DEMO-ADRESI/api/health` → `{"status":"ok","db":"ok"}`.

## 3. Demo yönetici hesabı (güvenli şifre)

Bilgisayarınızda `.env.local` içine **demo** projesinin URL + service role anahtarını yazın, sonra:
```bash
npm run create-admin -- demo-yonetici@SIZIN-ALANINIZ.com --super-admin
```
Şifre verilmezse betik güçlü bir geçici şifre üretir ve **yalnızca bir kez** ekrana yazar (kabuk geçmişine girmez). İlk girişte şifre değişikliği istenir. Şifreyi kimseyle yazılı paylaşmayın; iki adımlı doğrulamayı ilk girişte **Hesabım › İki adımlı doğrulama** ile kurun.

Kontrol: `npm run prelaunch` (demo kuralları) kritik hata göstermemeli.

## 4. Telefon kabul testi (Android Chrome — iPhone Safari varsa o da)

Demo URL: `https://DEMO-ADRESI` · Panel: `https://DEMO-ADRESI/admin`

**Ziyaretçi**
- [ ] Üstte "DEMO ORTAMI" şeridi görünüyor; yatay kaydırma yok.
- [ ] Ana sayfa arama kutusu (Satılık/Kiralık, konum, tip, oda, bütçe) → sonuçlar.
- [ ] Menü açılıp kapanıyor; tüm bağlantılar çalışıyor.
- [ ] İlan listesi: Filtreler paneli açılıyor, filtre uygulanıyor, "Temizle" çalışıyor, sıralama değişiyor.
- [ ] İlan detay: galeri kaydırma, dokununca tam ekran, iki parmakla yakınlaştırma, kapatma.
- [ ] WhatsApp butonu uygulamayı hazır mesajla açıyor; Ara butonu telefon uygulamasını açıyor.
- [ ] Favoriye ekle → Favorilerim; Karşılaştır (2 ilan) → karşılaştırma tablosu.
- [ ] Bilgi/randevu formu: klavye açıkken alanlar görünür kalıyor; gönderim "Teşekkürler" veriyor.
- [ ] Blog, Bölgeler, İletişim, KVKK sayfaları açılıyor.

**Panel**
- [ ] Giriş → (MFA kurduysanız kod) → Dashboard.
- [ ] Yeni ilan: sihirbaz, konum seçimi, **telefondan fotoğraf yükleme** (kamera/galeri), sıralama (sürükle veya Öne al/Arkaya al), kapak seçimi, fiyat, açıklama, **Yayınla** → sitede görünüyor.
- [ ] İlan düzenleme ve durum değişikliği (Satıldı/Arşiv).
- [ ] Talepler: az önce gönderdiğiniz form talebi listede, menüde "yeni" rozeti; durum/not ekleme.
- [ ] Müşteriler, Randevular, Koleksiyon (bağlantı paylaşma).
- [ ] İçerik (blog yazısı taslağı), SEO, Şirket ayarları, Ayarlar › Bildirimler, Kullanıcılar, Güvenlik kayıtları.
- [ ] Süper admin: `/platform` (organizasyonlar, planlar).

Bulduğunuz her sorunu **sayfa adresi + telefon modeli + ekran görüntüsü** ile iletin; önce bunlar düzeltilir, yeni özelliğe geçilmez.

## 5. Bilinen sınırlamalar (demo)

- İlanlar ve görseller örnektir; demo arama motorlarına kapalıdır.
- E-posta bildirimi yalnızca Resend anahtarı tanımlanırsa gider; aksi halde talepler panelde görünür.
- Harita OpenStreetMap döşemeleriyle çalışır (demo için yeterli).
- Supabase Free planında proje 7 gün hareketsiz kalırsa duraklatılır; panelden yeniden başlatılır.
- Otomatik testlerde iPhone Safari yalnızca Chromium emülasyonuyla denendi; gerçek iPhone'da kontrol önerilir.
