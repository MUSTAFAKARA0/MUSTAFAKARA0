# İşletim: bildirimler, izleme, güvenlik, harita, alan adları

## 1. Talep bildirimleri (e-posta)

**Akış:** web formu → `submit_lead` (veritabanı: müşteri + talep [+ randevu]) → CRM (Talepler) → panel menüsünde "yeni" rozeti → yanıt gönderildikten sonra e-posta → `notification_deliveries` kaydı (Ayarlar › Bildirimler › Son bildirimler).

**Kurulum (Resend):**
1. resend.com › Domains › alan adınızı ekleyin (ör. `elvankentgayrimenkul.com`; ayrı alt alan `bildirim.` da olur).
2. Resend'in verdiği kayıtları DNS sağlayıcınıza girin:
   - **SPF** (TXT, `send` alt alanı) — Resend'in gönderim sunucularına izin.
   - **DKIM** (TXT `resend._domainkey`) — e-postaların imzalanması.
   - **DMARC** (önerilir, TXT `_dmarc`): başlangıç için `v=DMARC1; p=none; rua=mailto:dmarc@alanadiniz.com`; birkaç hafta rapor izledikten sonra `p=quarantine`.
3. Alan adı "Verified" olduktan sonra API anahtarı oluşturun (yalnızca "Sending access").
4. Vercel ortam değişkenleri: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM="Elvankent Gayrimenkul <bildirim@alanadiniz.com>"`, isteğe bağlı `EMAIL_REPLY_TO`.
5. Panel › Ayarlar › Bildirimler: alıcı adresleri (en fazla 5; boşsa şirket e-postası) → **Test e-postası gönder**.
6. Supabase Auth e-postaları (şifre sıfırlama) için de aynı hesabın SMTP bilgilerini girin: Supabase › Authentication › Emails › SMTP Settings (host `smtp.resend.com`, port 465, kullanıcı `resend`, şifre = API anahtarı). Supabase'in varsayılan e-posta servisi saatte birkaç e-postayla sınırlıdır ve canlı kullanım için değildir.

**Gizlilik:** Varsayılan (`NOTIFY_EMAIL_DETAILS=minimal`) e-postada kişisel veri yoktur; ofis kişiyi panelde görür. `full` yalnızca hukukçu onayıyla açılmalıdır (yurt dışına aktarım — docs/LEGAL_DATA_MAP.md).

**WhatsApp (ileride):** WhatsApp Business Cloud API için yeni bir kanal fonksiyonu yazılır ve `notification_deliveries.channel = 'whatsapp'` ile kaydedilir; talep akışı değişmez (`src/modules/notifications/lead.ts`).

## 2. Hata izleme ve uptime

| Katman | Nasıl |
| --- | --- |
| Sunucu hataları (500, server action, route) | `src/instrumentation.ts` → `onRequestError` |
| Tarayıcı hataları | `src/instrumentation-client.ts` + hata sınırları → `/api/monitoring/client-error` |
| Log | her hata tek satır JSON (`"level":"error"`) → Vercel › Logs (veya Log Drains) |
| İletim (isteğe bağlı) | `SENTRY_DSN` (Sentry, SDK'sız HTTP) ve/veya `ERROR_WEBHOOK_URL` (Slack/Discord) |
| Uptime | `GET /api/health` → 200 `{"status":"ok","db":"ok"}`, veritabanı yoksa 503 |
| Performans | Vercel Speed Insights (LCP/INP/CLS gerçek kullanıcı) + Web Analytics (yalnızca analitik çerez onayıyla) |

Kurulum: Vercel › Project › Analytics ve Speed Insights'ı etkinleştirin; UptimeRobot/Better Stack'e `https://ALANADI/api/health` (5 dk) ekleyin; isteğe bağlı Sentry'de proje açıp DSN'i girin. Kişisel veri gönderilmez: sorgu parametreleri atılır, e-posta/telefon/anahtar benzeri değerler maskelenir, istek başlıkları ve çerezler hiç gönderilmez. Aynı hata 60 sn içinde tekrarlanırsa dışarı yalnızca bir kez iletilir.

## 3. Yönetici güvenliği (MFA / TOTP)

- Her kullanıcı **Hesabım › İki adımlı doğrulama › Kur** ile açar (Google Authenticator, Microsoft Authenticator, 1Password vb.).
- Ofis sahibi **Kullanıcılar › Güvenlik politikası** ile sahip ve yöneticiler için zorunlu kılar (önce kendisi kurmuş olmalı; kilitlenme koruması). Zorunlulukta kurulum yapmayan sahip/yönetici panele giremez.
- Kural veritabanında da uygulanır: MFA'lı kullanıcının kod girilmemiş oturumu (aal1) ve zorunlu ofisin sahip/yöneticisinin aal1 oturumu hiçbir ofis verisine, dosyaya veya panel fonksiyonuna erişemez (tests/security › MFA testleri).
- Telefonunu kaybeden üye: sahip **Kullanıcılar › ⋯ › İki adımlı doğrulamayı sıfırla** (kimliği doğrulayarak). Süper admin veya birden fazla ofise üye kişiler: Supabase › Authentication › Users › kullanıcı › MFA factors › sil.
- Süper admin hesapları için `PLATFORM_ADMIN_MFA_REQUIRED=true` önerilir.

## 4. Harita sağlayıcısı

Döşemeler sunucudaki `/api/tiles` vekilinden gelir; API anahtarı tarayıcıya gitmez; yanıtlar CDN'de 7 gün önbelleğe alınır; vekil yalnızca Türkiye ve çevresini ve yalnızca kendi sitesinden gelen istekleri sunar.

**Değerlendirme:** OpenStreetMap'in ücretsiz döşeme sunucusu (tile.openstreetmap.org) gönüllülerce işletilir; kullanım politikası yoğun ve ticari kullanımı, kesintisiz erişim garantisini kapsamaz. Tek ofis ve önbellekli vekil ile düşük trafikte teknik olarak çalışır, ancak canlı ticari site için **MapTiler** (`MAP_PROVIDER=maptiler`) veya **Stadia Maps** (`MAP_PROVIDER=stadia`) önerilir; ikisinin de ücretsiz katmanı vardır. Sağlayıcı değiştirmek yalnızca ortam değişkenidir (`MAP_PROVIDER`, `MAP_API_KEY`, isteğe bağlı `MAP_STYLE`); kod değişmez. Anahtarı sağlayıcı panelinde alan adınızla kısıtlayın ve sağlayıcının önbellekleme/atıf koşullarını kontrol edin (atıf metni otomatik gösterilir).

## 5. Özel alan adları (ofisler için)

- Varsayılan `DOMAIN_PROVIDER=manual`: süper admin alan adını ekler; organizasyon sayfası gereken DNS kaydını gösterir (kök alan: `A @ 76.76.21.21`, alt alan: `CNAME www cname.vercel-dns.com`; Vercel panelinde projeye özel değer gösterilirse o kullanılır). Alan adı Vercel › Domains'e elle eklenir; Supabase Auth Redirect URL listesine `https://ALANADI/admin/auth/callback` eklenir.
- Otomasyon: `DOMAIN_PROVIDER=vercel` + `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, (`VERCEL_TEAM_ID`) tanımlanınca eklenen/kaldırılan alan adı Vercel projesine API ile eklenir/kaldırılır ve doğrulama TXT kaydı hesaplanır (`src/modules/domains`). Token'ı yalnızca bu proje kapsamıyla oluşturun.

## 6. Konum verisi

bkz. docs/LOCATION_DATA.md.

## 7. Canlıya çıkış kontrolü

`npm run prelaunch -- --production` (canlı değerlerle, yerel bilgisayarınızda): eksik ortam değişkenleri, `NEXT_PUBLIC_` ile sızan gizli değerler, demo ilanlar, hukukçu onayı, işletme bilgileri, bildirim alıcıları, sahip/süper admin, MFA politikası. Kritik bulgu varsa çıkış kodu 1'dir.
