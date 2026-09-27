# Production dağıtım sırası (runbook)

Önkoşul: demo ortamında telefon kabul testi tamamlandı ve bulunan hatalar düzeltildi. Her adımı işaretleyerek ilerleyin; bir adım başarısızsa **durun** ve geri dönüş planına bakın.

## V1 / V2 uyumsuzluğunu önleme

- V2 kodu V1 şemasıyla **çalışmaz**; V1 kodu V2 şemasıyla **çalışmaz**. Bu yüzden sıra: yedek → migration → kontrol → **hemen** V2 dağıtımı.
- V2 build'i önceden hazırlanır (Vercel'de production dağıtımı "Promote" beklemeye alınır), migration biter bitmez tek tıkla yayına alınır. Aradaki süre birkaç dakikadır; bu sürede site hata verebilir → düşük trafik saati seçin.
- Vercel › Settings › Git: production dalı olarak V2'nin birleştirileceği dal (ör. `main`) seçilir; bu dala birleştirme yapılana kadar production değişmez. Otomatik production dağıtımını istemiyorsanız "Auto-assign custom domains" yerine elle **Promote** kullanın.
- CI: GitHub › Settings › Branches › production dalı için `quality` işi **required status check** yapılır (başarısız build birleşemez).

## Sıra

| # | Adım | Nasıl | Kontrol |
| --- | --- | --- | --- |
| 1 | Yedek | Supabase Backups/PITR + `pg_dump -Fc` + `npm run backup:storage` | dosyalar oluştu |
| 2 | Yedek doğrulama | `pg_restore --list`, `manifest.json` dosya sayısı | hata yok, sayılar mantıklı |
| 3 | Veritabanı migration | docs/PRODUCTION_MIGRATION.md (13 dosya, sırayla) | `postflight_v2.sql` 13/13 TAMAM |
| 4 | Ortam değişkenleri | Vercel › Production: tablo aşağıda | `npm run prelaunch -- --production` (yerelde canlı değerlerle) kritik yok |
| 5 | Depolama | Supabase › Storage: 4 kova; `media-originals` özel | postflight #12 TAMAM |
| 6 | Auth | Site URL, Redirect URL `/admin/auth/callback`, sign-up kapalı, TOTP açık, özel SMTP (Resend) | test hesabıyla şifre sıfırlama e-postası geliyor |
| 7 | RLS | postflight #2–#4 | TAMAM |
| 8 | Build | Vercel production build (CI `quality` yeşil) | build başarılı |
| 9 | Deploy | Vercel › Promote to Production | dağıtım "Ready" |
| 10 | Smoke test | `/api/health` → 200 `db: ok`; `/`, `/satilik`, bir ilan, `/iletisim` | 200, hata yok |
| 11 | Public site | mobil + masaüstü: arama, filtre, galeri, WhatsApp, telefon | çalışıyor |
| 12 | Admin | giriş (+MFA), ilan oluştur/düzenle/fotoğraf/yayınla, kullanıcılar | çalışıyor |
| 13 | Form / CRM | test talebi gönder → Talepler'de + menü rozeti + bildirim e-postası | geldi |
| 14 | SEO | `/robots.txt` Sitemap satırı var; `/sitemap.xml`; sayfa kaynağında noindex YOK; Search Console'a site haritası | tamam |
| 15 | Rollback planı hazır | docs/PRODUCTION_MIGRATION.md › Geri dönüş | sorumlu kişi ve yedek dosyası belli |

## Production ortam değişkenleri (Vercel › Production)

| Değişken | Zorunlu | Not |
| --- | --- | --- |
| `SITE_ENV` | evet | `production` (değilse site noindex kalır; build sırasında okunur, değişince yeniden dağıtın) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | evet | canlı proje |
| `NEXT_PUBLIC_SITE_URL` | evet | `https://elvankentgayrimenkul.com` |
| `DEFAULT_TENANT_SLUG` | evet | `elvankent` |
| `IP_HASH_SALT`, `CRON_SECRET` | evet | 32+ karakter rastgele (gizli) |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | evet | talep bildirimleri (docs/OPERATIONS.md) |
| `SENTRY_DSN` veya `ERROR_WEBHOOK_URL` | önerilir | hata iletimi |
| `MAP_PROVIDER`, `MAP_API_KEY` | önerilir | MapTiler/Stadia |
| `PLATFORM_ADMIN_MFA_REQUIRED` | önerilir | `true` |
| `NEXT_IMAGE_ALLOW_LOCAL_IP` | **TANIMLAMAYIN** | yalnızca yerel |

`NEXT_PUBLIC_` önekiyle hiçbir gizli değer tanımlanmaz (`npm run prelaunch` bunu denetler).

## Yayın sonrası ilk 24 saat

- Vercel › Logs'ta `"level":"error"` araması; Sentry/webhook bildirimleri.
- Uptime izleme `/api/health` (5 dk aralık).
- Speed Insights'ta mobil LCP/INP/CLS (gerçek kullanıcı verisi birkaç gün içinde oluşur).
