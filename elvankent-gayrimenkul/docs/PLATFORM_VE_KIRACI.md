# Platform sahibi (KARAY) ↔ kiracı (emlak ofisi)

```
KARAY  — platform sahibi, SaaS altyapı sağlayıcısı (süper admin: /platform)
  └─ Gayrimenkul Platformu
       ├─ Kiracı 1: Elvankent Gayrimenkul  (ilk müşteri; kendi sitesi + /admin)
       ├─ Kiracı 2: …                        (gelecekte)
       └─ Kiracı N: …
```

Elvankent Gayrimenkul platformun sahibi değildir; platformun ilk müşterisidir. KARAY ile Elvankent hiçbir ekranda aynı şirket gibi görünmez.

## Nerede tanımlı?

| Kavram | Yer |
| --- | --- |
| Platform sahibi (KARAY) markası | `src/platform/branding/platform-brand.ts` (ad, ürün adı, renkler, logo/simge yeri). Kodla gelir; veritabanında değildir, hiçbir kiracı değiştiremez. |
| Platform yöneticisi (süper admin) | `profiles.is_super_admin` (yalnızca veritabanı/servis anahtarıyla atanır; kullanıcılar bu sütunu değiştiremez) |
| Platform alanı | `/platform` (`src/app/platform`): dış katman KARAY teması ve simgesi, `(konsol)` katmanı süper admin kontrolü, `/platform/giris` ayrı giriş |
| Kiracı (emlak ofisi) | `organizations` (+ `subscriptions`, `organization_domains`) |
| Kiracı markası | `organization_settings` (logo, renkler, iletişim, SEO) — yalnızca o kiracının sitesinde ve ofis panelinde kullanılır |
| Kiracı kullanıcıları ve rolleri | `organization_members` (owner, admin, agent, editor, viewer) + `role_permissions` |
| Elvankent | `organizations` satırı `slug = 'elvankent'`, `is_default = true` ("varsayılan kiracı" = ana alan adında açılan site; sahiplik anlamı yoktur) |

## Yetki farkı

| | Süper admin (KARAY) | Kiracı yöneticisi (ör. Elvankent sahibi) |
| --- | --- | --- |
| Kapsam | Platform geneli | Yalnızca kendi `organization_id`'si |
| Alan | `/platform` | `/admin` |
| Kiracı listesi, oluşturma, askıya alma | Evet (`platform_*` fonksiyonları, içeride `is_super_admin()`) | Hayır |
| Plan/abonelik, plan limitleri, alan adları | Evet | Hayır (yalnızca kendi planını görür) |
| Tüm kullanıcılar, sistem kayıtları | Evet | Yalnızca kendi ofisinin kullanıcıları ve kayıtları |
| Kiracının CRM/ilan verisi | Üye değilse doğrudan okuyamaz (platform yalnızca özet/kullanım görür) | Kendi ofisinin verisi (rolüne göre) |
| Kendi markası | Kodla (platform-brand.ts) | Panel › Şirket Ayarları |

Kontrol katmanları:
1. **Sunucu:** `/platform` sayfaları `requireSuperAdminPage()` — süper admin değilse **404** (alanın varlığı bile gösterilmez) ve güvenlik kaydı. Platform işlemleri `requireSuperAdmin()`. Ofis paneli `requirePageContext()` / `requirePermission()`; aktif ofis, istemciden gelen değere göre değil kullanıcının veritabanındaki üyeliklerine göre seçilir (çerez yalnızca tercihtir).
2. **Proxy:** oturumsuz `/platform` → `/platform/giris`, oturumsuz `/admin` → `/admin/giris`.
3. **Veritabanı (RLS):** tüm tablolar kiracıya göre süzülür; platform fonksiyonları `is_super_admin()` ister; `is_super_admin` sütunu kullanıcılara kapalıdır.
4. **Giriş:** `/platform/giris` yalnızca süper admini kabul eder; ofis hesabıyla giriş reddedilir.

## Marka ve tema yalıtımı

- **Platform:** `PLATFORM_SCOPE` kapsayıcısına bağlı tema (renkler + sans-serif başlık). Kapsayıcı sayfada yoksa hiçbir yeri etkilemez. Platform simgesi `public/platform/placeholder-icon.svg` (yer tutucu). Kiracı logosu/simgesi platformda kullanılmaz.
- **Kiracı sitesi:** yalnızca o kiracının `organization_settings` renkleri, logosu ve simgesi. Yüklenmiş site simgesi yoksa ofis adının baş harfinden ve renginden **otomatik simge** üretilir (`/site-icon`). Önceden tüm sitelerde kullanılan Elvankent "E" simgesi kaldırıldı. KARAY adı kiracı sitesinde **görünmez** ("Powered by KARAY" ileride platform ayarı olarak düşünülebilir).
- **Ofis paneli:** tema ve logo, **giriş yapan kullanıcının aktif ofisinden** gelir (önceden alan adının ofisinden geliyordu; aynı adresten giren başka bir ofis, Elvankent'in renklerini görürdü — düzeltildi).
- Bir kiracının tema değişikliği yalnızca kendi `organization_settings` satırını değiştirir (RLS); platform teması kodla gelir, kiracıyı etkilemez.

## Veritabanı değişikliği

`supabase/migrations/20260929000001_platform_owner_isolation.sql`:
- `organizations`, `organization_settings`, `organization_domains` tablolarındaki **herkese açık okuma** politikaları kaldırıldı. Önceden herkese açık anahtarla (veya herhangi bir ofis kullanıcısıyla) tüm aktif ofislerin listesi, ayarları ve alan adları toplu olarak çekilebiliyordu.
- Site, ofisini yalnızca adresiyle/alan adıyla **tek tek** bulur: `public_tenant(p_slug | p_hostname)`, `public_tenant_settings(p_org)` (son değiştiren kullanıcı bilgisi boş döner), `public_tenant_domains(p_org)`. Askıdaki ofis bulunamaz.
- Süper admin için `settings_platform_read`, `domains_platform_read` politikaları.
- Tekrar çalıştırılabilir, veri değiştirmez; kod migration öncesi ve sonrası çalışır; geri dönüş SQL'i dosyanın sonunda.
- Not: bir ofisin **kamuya açık sitesindeki** bilgileri (logo, telefon, adres) doğası gereği herkese açıktır — ama yalnızca ofisin adresi bilinerek, tek tek okunabilir; liste çekilemez.

## KARAY logosu geldiğinde

1. Dosyaları `public/platform/` klasörüne koyun (ör. `karay-logo.svg`, `karay-icon.svg`).
2. `src/platform/branding/platform-brand.ts` › `logoUrl` ve `iconUrl` alanlarını doldurun; gerekirse `primaryColor`/`accentColor` değerlerini logoya göre güncelleyin.
3. Platform başlığı, platform girişi, doğrulama (MFA) ekranı ve platform simgesi otomatik olarak logoyu kullanır.

## Hesapları ayırma (demo için öneri)

Demo kurulumu tek hesapla başladığı için sizin hesabınız hem süper admin hem Elvankent sahibidir. Ayrım için:
1. Elvankent paneli › **Kullanıcılar** › **Yeni kullanıcı** › rol **Sahip** ile Elvankent'e ayrı bir hesap açın.
2. O hesapla giriş yapıp Kullanıcılar listesinde **kendi (KARAY) hesabınızı** ofisten kaldırın.
3. Bundan sonra siz `/platform/giris` ile KARAY konsoluna girersiniz; Elvankent'i Organizasyonlar › Elvankent Gayrimenkul sayfasından (plan, durum, alan adı) yönetirsiniz.

## Testler

- `tests/security/rls.test.mjs` › "Platform sahibi ↔ kiracı ayrımı" (veritabanı).
- `tests/e2e/owner-separation.spec.ts` › TEST-OWNER-01…08 (uygulama + veritabanı).
