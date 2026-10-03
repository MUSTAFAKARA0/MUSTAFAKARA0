# KARAY mimari katmanları ve yüzey ayrımı

KARAY tek bir kod tabanıyla çok sayıda emlak ofisine (kiracıya) hizmet verir. **Yeni müşteri kodla değil veriyle açılır:**

```
yeni müşteri → organizations → organization_domains → subscriptions → site_configs (tema + ayarlar) → modüller → yayın
```

Yapılmaz: müşteri başına klasör/repo (`customerA/`), müşteri başına tema kopyası (`theme-elvankent`), kod içinde kiracı dallanması (`if (tenant === 'elvankent')`), kod içine gömülü kiracı adı/slug'ı.

## Katmanlar

```
app (rotalar)
 ↓
tenant-panel · karay-platform · site-engine · karay-public
 ↓
site-config · theme-engine · modules
 ↓
ui · core
```

| Katman | Klasörler |
| --- | --- |
| **tenant-panel** (ofis paneli) | `src/app/admin`, `src/components/admin`, `src/app/api/admin`, `src/app/actions/admin-*.ts` |
| **karay-platform** (KARAY konsolu, site oluşturucu) | `src/app/platform`, `src/components/platform`, `src/app/api/platform`, `src/app/actions/{platform,site-builder,karay-admin}.ts` |
| **site-engine** (kiracı siteleri) | `src/app/t`, `src/components/{layout,home,property,search,content,gallery,maps,forms}` |
| **karay-public** (KARAY tanıtım sayfası) | `src/app/karay`, `src/components/karay`, `src/modules/karay`, `src/app/actions/karay.ts` |
| **site-config / theme-engine** | `src/platform/site` (şema, yükleme, önizleme, temalar, tokenlar, paletler, yazı tipleri, menü) |
| **modules** (alan servisleri) | `src/modules/*` (properties, crm, content, media, seo…) |
| **ui** | `src/components/{ui,panel,brand,common,site-preview}` |
| **core** | `src/lib`, `src/platform/{auth,tenant,branding}`, `src/platform/{audit,actions}.ts`, `src/types`, `src/hooks` |

Ortak (her iki panelin kullandığı) arayüz `src/components/panel` altındadır: panel tablo/başlık bileşenleri, işlem düğmeleri, işlem kayıtları listesi, giriş kartı ve formları, marka görseli alanı. KARAY ve kiracı logoları `src/components/brand`, tema önizleme çizicisi `src/components/site-preview` altındadır.

### Kurallar (ESLint ile zorunlu — `eslint.config.mjs`)

- Bir dosya kendi katmanını ve **alt** katmanları içe aktarabilir; üst katmanları içe aktaramaz.
- Kesin yasaklar: `site-engine → tenant-panel | karay-platform | karay-public`, `tenant-panel ↔ karay-platform`, `karay-public → tenant-panel | karay-platform`.
- Üst klasöre göreli içe aktarım (`../`) kapalıdır; sınırlar `@/` yollarıyla denetlenir.
- Ortak panel bileşeni ofis/KARAY işlemlerini kendisi içe aktarmaz; gerekiyorsa işlem sayfadan prop olarak verilir (ör. `BrandingImageField removeAction`).
- Kuralın kendisi `tests/unit/boundaries.test.mjs` ile test edilir (14 yasak, 4 izinli durum).

Kural ihlali CI'da (`npm run lint`) hata verir. İstisna eklemek yerine kodu doğru katmana taşıyın.

## Yüzey ayrımı (alan adına göre)

Tek karar noktası: `src/platform/tenant/host.ts › resolveRequestSurface()` — `src/proxy.ts` bunu oturum çerezlerine dokunmadan önce çağırır.

| Alan adı türü | Örnek | `/` | `/admin` | `/platform`, `/api/platform` | `/karay` |
| --- | --- | --- | --- | --- | --- |
| **tenant** — müşteri alan adı / alt alan adı | `ornekemlak.com`, `ofis1.{PLATFORM_ROOT_DOMAIN}` | kiracı sitesi | ofis paneli | **404** | **404** |
| **karay** — `KARAY_HOSTS` | `karay.com.tr` | KARAY sayfası | ofis girişi (müşteri girişi bağlantısı) | KARAY konsolu | KARAY sayfası |
| **shared** — platform kökü, geliştirme, önizleme | `PLATFORM_ROOT_DOMAIN`, `localhost`, `*.vercel.app` | varsayılan kiracı | ofis paneli | KARAY konsolu | KARAY sayfası (`KARAY_HOSTS` tanımlı değilse) |

Savunma katmanları:

1. **Proxy:** kiracı alan adında `/platform`, `/api/platform`, `/karay` sade 404 döner; oturum yenilenmez, çerez yazılmaz. Uygulama rotaları (`/platform`, `/admin`, `/api`, `/karay`, `/t`) dosya uzantısıyla bitse bile (ör. `/platform/x.png`) proxy'den geçer.
2. **Sunucu:** yüzey, proxy ile aynı fonksiyonla doğrudan `Host` başlığından hesaplanır (aktarılan başlıklara güvenilmez). Next.js sunucu işlemleri sayfadan bağımsız çağrılabildiği için platform kapsamlı işlemler (`signIn` ve şifre sıfırlama, `scope=platform`) kiracı alan adında reddedilir; oturum açılmaz, e-posta gönderilmez. `getSessionScope()` kiracı alan adında platform çerezini yok sayar (tüm `requireSuperAdmin` işlemleri orada kapalıdır); `requireSuperAdminPage()` 404 verir.
3. **Veritabanı:** RLS ve `is_super_admin()` kontrolleri aynen geçerlidir.

Testler: `tests/unit/surface.test.mjs` (karar tablosu), `tests/e2e/surface-isolation.spec.ts` (SURF-01…10: ham HTTP ile sahte başlık ve dosya uzantısı denemeleri, platform giriş işleminin müşteri alan adına gönderilmesi, KARAY çerezlerinin müşteri alan adına taşınması, white-label).

> **Barındırma varsayımı:** yüzey `Host` başlığından belirlenir. Vercel bunu korur. Kendi sunucunuzda bir ters vekil (nginx vb.) arkasında çalıştırırsanız vekil gerçek `Host`'u iletmelidir; `localhost`/IP olarak iletirse her alan adı "shared" sayılır.
>
> **Canlıya alırken:** KARAY konsolu müşteri alan adlarında (ör. `elvankentgayrimenkul.com/platform`) artık açılmaz. Konsola `KARAY_HOSTS` alan adından, `PLATFORM_ROOT_DOMAIN`'den veya `*.vercel.app` adresinden girilir.
