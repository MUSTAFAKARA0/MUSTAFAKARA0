# Sahibin yapacakları · pilot ofise kadar (22.11.2026)

> Değerleri (anahtar, şifre, bağlantı adresi) **kimseye yazmayın**, Claude'a da göndermeyin; "tamam", koşu numarası ya da değer
> görünmeyen ekran görüntüsü yeter. Ayrıntı: [PILOT_YAYIN_GO_NOGO.md](PILOT_YAYIN_GO_NOGO.md). Önceki sürümler git geçmişinde.
> Ücretli bir adım (plan yükseltme vb.) sahip ayrıca karar vermeden yapılmaz.

## Tamamlananlar

| İş | Kanıt |
| --- | --- |
| Pilot kodu ve hukuk düzeltmeleri canlıda | PR #8 birleştirildi (22.11), production `567a0dd` READY; sağlık 200, ilan sayfası ve KARAYS sayfası açılıyor, çalışma zamanı hatası 0 |
| KI-41 Aşama 2: production'a PR zorunluluğu | `uretim-pr` kural seti etkin (14.11); `koruma` geliştirme dalını da kapsıyor |
| KI-41 Adım 0 envanteri | 11 hassas sır depo düzeyinde, ortamlar boş (14.11) |
| Hukuk araştırması ve metin düzeltmeleri | `docs/legal/HUKUK_UYUM_2026-11-22.md`; pilot sözleşmesi taslağı `docs/legal/PILOT_SOZLESMESI_TASLAK.md` |
| Gece yedekleri | her gün yeşil (#54–#73) |
| KARAYS alan adı, e-posta (Resend), Sentry bağlantısı | 02.11 |

### 1. Veritabanı güncellemeleri F → E → G → H → I (Supabase SQL Editor)
Adım adım: [operations/pilot-migrations-sql-editor.md](operations/pilot-migrations-sql-editor.md). Önce taze yedek, her dosyadan sonra
ekran görüntüsünü Claude'a gönderin; Claude her adımda GO/NO-GO der. Bitmeden pilot ofis açılmaz (kurulum ekranı ve tasarım kilidi I ile gelir).

### 2. Avukat görüşmesi
Pilot sözleşmesi taslağı ve 10 soru: [legal/PILOT_SOZLESMESI_TASLAK.md](legal/PILOT_SOZLESMESI_TASLAK.md). En kritik üç soru: EİDS'nin
ofisin kendi sitesine uygulanıp uygulanmadığı; sağlayıcılarla KVKK standart sözleşmesi yokken gerçek müşteri verisi girilip
girilemeyeceği; şahıs olarak imzalamanın vergi ve sorumluluk sonucu (mali müşavirle).

### 3. Sizden istenen bilgiler (yasal metinlere işlenecek)
Ad soyad veya şirket unvanı, vergi dairesi ve numarası, adres, (varsa) KEP, telefon; pilot ofisin unvanı, yetki belgesi no, alan adı.
Tam liste: pilot sözleşmesi taslağının Ek A bölümü. Claude bunları tek dosyaya (`legal.ts`) işler.

### 4. Barındırma kararı (Vercel ücretsiz plan)
Vercel'in ücretsiz planı ticari kullanıma kapalı; ücretsiz pilot da ticari sayılır ve hesap askıya alınabilir. Seçenekler: riski
yazılı kabul etmek (ücretsiz kalır) ya da ileride Pro'ya geçmek (ücretli). Claude ücretli bir şey başlatmaz.

### 5. KI-41 Aşama 3–4: sırların ortamlara taşınması (ayrı bir gün)
Plan: [KI41_ASAMA_3_4_UYGULAMA.md](KI41_ASAMA_3_4_UYGULAMA.md). Önce Adım 0b (yönetici bypass'ını kapatma, iki ortamı production dalıyla
sınırlama; 10 dk, risksiz), sonra anahtar yenileme. Aynı gün migration yapılmaz.

### 6. Sentry deneme olayı (isteğe bağlı, 1 dk)
Claude'un oturumu karays.com'a istek gönderemiyor. Bilgisayarda karays.com açıkken tarayıcı konsolundan tek bir deneme hatası
gönderilir; Sentry'de görünür ve e-posta gelir. Komutu Claude verir.

### 7. Pilot günü
Sözleşme imzalı ve 1–3 tamamsa: [operations/customer-onboarding.md](operations/customer-onboarding.md) §0 (konsoldan ofis aç → davet →
kurulum → ilan → alan adı → yayın → telefon kontrolü).
