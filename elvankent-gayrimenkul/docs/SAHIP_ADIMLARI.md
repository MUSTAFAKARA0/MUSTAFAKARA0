# Sahibin yapacakları · pilot ofise kadar (24.11.2026)

> Değerleri (anahtar, şifre, bağlantı adresi) **kimseye yazmayın**, Claude'a da göndermeyin; "tamam", koşu numarası ya da değer
> görünmeyen ekran görüntüsü yeter. Ayrıntı: [PILOT_YAYIN_GO_NOGO.md](PILOT_YAYIN_GO_NOGO.md). Önceki sürümler git geçmişinde.
> Ücretli bir adım (plan yükseltme vb.) sahip ayrıca karar vermeden yapılmaz.

## Tamamlananlar

| İş | Kanıt |
| --- | --- |
| PR #9 ve veritabanı güncellemesi J | 24.11: canlıda; J son kontrol TAMAM, site ve sağlık kontrolü sorunsuz; bekleyen migration yok |
| Veritabanı güncellemeleri F, E, G, H, I | 23.11: SQL Editor, son kontroller TAMAM, `canli_sema_tespiti` 1–44 VAR; kabul testleri geçti (ekip daveti, büyük/küçük fotoğraf, yetki no alt bilgide, kurulum kartı, panel açılıyor) |
| Mission Control panosu güncel dalı okuyor | 23.11: PR #6 birleştirildi, eşitleme #86 yeşil |
| Pilot kodu ve hukuk düzeltmeleri canlıda | PR #8 birleştirildi (22.11), production `567a0dd` READY; sağlık 200, ilan sayfası ve KARAYS sayfası açılıyor, çalışma zamanı hatası 0 |
| KI-41 Aşama 2: production'a PR zorunluluğu | `uretim-pr` kural seti etkin (14.11); `koruma` geliştirme dalını da kapsıyor |
| KI-41 Adım 0 envanteri | 11 hassas sır depo düzeyinde, ortamlar boş (14.11) |
| Hukuk araştırması ve metin düzeltmeleri | `docs/legal/HUKUK_UYUM_2026-11-22.md`; pilot sözleşmesi taslağı `docs/legal/PILOT_SOZLESMESI_TASLAK.md` |
| Gece yedekleri | her gün yeşil (#54–#75) |
| KARAYS alan adı, e-posta (Resend), Sentry bağlantısı | 02.11 |

> **23.11 kararı:** avukat yok; şirket, mali müşavir, ücretli plan ve gerçek ofisle sözleşme **terhise kadar bekler**. Terhise kadar
> yalnız 1–3 numaralı adımlar; 4–6 terhis sonrası ([legal/TERHIS_SONRASI_EVRAK_PAKETI.md](legal/TERHIS_SONRASI_EVRAK_PAKETI.md)).

### 1. Karar sayfası (terhise kadar, ~15 dk)
[KARAR_SAYFASI.md](KARAR_SAYFASI.md) — A1…A10 için "evet/hayır" yazmanız yeterli. Ücret ya da ticari işlem içeren kararlar B bölümünde, terhis sonrasına.

### 2. KI-41 Aşama 3–4: sırların ortamlara taşınması (terhise kadar, ayrı bir gün)
Plan: [KI41_ASAMA_3_4_UYGULAMA.md](KI41_ASAMA_3_4_UYGULAMA.md). Önce Adım 0b (yönetici bypass'ını kapatma, iki ortamı production dalıyla
sınırlama; 10 dk, risksiz), sonra anahtar yenileme.

### 3. Sentry deneme olayı (isteğe bağlı, 1 dk)
Claude'un oturumu karays.com'a istek gönderemiyor. Bilgisayarda karays.com açıkken tarayıcı konsolundan tek bir deneme hatası
gönderilir; Sentry'de görünür ve e-posta gelir. Komutu Claude verir.

### 4. Terhis sonrası: mali müşavir, şirket ve resmî evrak
Sıra ve hazır metinler: [legal/TERHIS_SONRASI_EVRAK_PAKETI.md](legal/TERHIS_SONRASI_EVRAK_PAKETI.md) (müşavir soruları, sağlayıcılara KVKK
standart sözleşme yazısı, Kurul bildirimi, VUK 595 özelgesi, 5651). Görev süresince ücret alınmaz, fatura kesilmez, ticari sözleşme imzalanmaz.

### 5. Terhis sonrası: bilgiler ve barındırma
Şirket/şahıs bilgileri (unvan, vergi dairesi ve no, adres, KEP, telefon) → Claude `legal.ts`'e işler. Vercel Pro (~20 $/ay, harcama sınırı
20 $): ücretsiz plan ticari kullanıma kapalı. Claude ücretli bir şey başlatmaz.

### 6. Terhis sonrası: pilot günü
Pilot sözleşmesi ([legal/PILOT_SOZLESMESI_TASLAK.md](legal/PILOT_SOZLESMESI_TASLAK.md)) imzalı ve 4–5 tamamsa:
[operations/customer-onboarding.md](operations/customer-onboarding.md) §0 (konsoldan ofis aç → davet → kurulum → ilan → alan adı → yayın → telefon kontrolü).
