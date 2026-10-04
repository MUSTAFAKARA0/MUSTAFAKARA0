# KARAY mimari katmanları ve yüzey ayrımı

KARAY tek bir kod tabanıyla çok sayıda emlak ofisine (kiracıya) hizmet verir. **Yeni müşteri kodla değil veriyle açılır:**

```
yeni müşteri → organizations → organization_domains → subscriptions → site_configs (tema + ayarlar) → modüller → yayın
```

Yapılmaz: müşteri başına klasör/repo (`customerA/`), müşteri başına tema kopyası (`theme-elvankent`), kod içinde kiracı dallanması (`if (tenant === 'elvankent')`), kod içine gömülü kiracı adı/slug'ı.

## Katmanlar

```
app (rotalar; beş ayrı kök layout)
 ↓
site-preview                                  (KARAY gerçek önizlemesi; hiçbir katman içe aktaramaz)
 ↓
tenant-panel · karay-platform (site oluşturucu dahil) · site-engine · karay-public
 ↓
site-factory                                  (karay-platform + ofis paneli sunucusu; site çalışma zamanına girmez)
 ↓
site-config · theme-engine · modules          (site-config → theme-engine; tersi yasak)
 ↓
ui · core                                     (site-config ve theme-engine'i bilmez)
```

| Katman | Klasörler | Sorumluluk |
| --- | --- | --- |
| **tenant-panel** (ofis paneli) | `src/app/admin`, `src/components/admin`, `src/app/api/admin`, `src/app/actions/admin-*.ts` | ilan, CRM, içerik, medya, marka, alan adı, kullanıcılar |
| **karay-platform** (KARAY konsolu + Site Builder) | `src/app/platform`, `src/components/platform` (`site/` = Site Builder formları, `site-wizard/` = Yeni Site Oluştur), `src/app/api/platform`, `src/app/actions/{platform,site-builder,karay-admin,site-create}.ts` | kiracılar, planlar, yeni site oluşturma, site yapılandırması **üretimi** (taslak, yayın, sürümler), tasarım ailesi yetkileri |
| **site-engine** (kiracı siteleri) | `src/app/t`, `src/components/{layout,home,property,search,content,gallery,forms,site}` | yapılandırmayı **çizer**: ilan, arama, detay, menü, footer, iletişim, galeri, içerik, SEO çıktısı. `components/site` = **Site Renderer sözleşmesi** (`SiteFrame`, `SiteHome`): kiracı sitesi ve önizleme aynı bileşenleri kullanır |
| **site-preview** (KARAY gerçek önizlemesi) | `src/app/site-onizleme`, `src/site-preview` | manifest + örnek veri → Site Renderer bileşenleri. Ayrı giriş noktası ve kök layout; yalnızca KARAY/paylaşılan alan adı + süper admin; hiçbir katman içe aktaramaz (kiracı paketine ve sihirbaz paketine girmez) |
| **karay-public** (KARAY tanıtım sayfası) | `src/app/karay`, `src/components/karay`, `src/modules/karay`, `src/app/actions/karay.ts` | KARAY ürün/şirket sayfası |
| **site-factory** | `src/site-factory` | KARAY'ın iç tasarım kataloğu (`catalog/<aile>/`), site tipleri (`site-types.ts`), site manifesti ve derleyicisi (`manifest.ts › compileManifest`, `compile.ts › compileDesign`), yeni site bilgileri ve ilk yapılandırma (`site-info.ts › initialSiteSections`) |
| **site-config** | `src/site-config` | yapılandırma belgesinin şeması (zod), varsayılanlar, yayın/önizleme okuması (`getSiteView`, `requireSiteTenant`), menü/sayfa çözümleme, önizleme belirteci, marka taslağı |
| **theme-engine** | `src/theme-engine` | görsel sistem (aşağıda) |
| **modules** (alan servisleri) | `src/modules/*` | properties, crm, content, media, seo… (veri erişimi) |
| **ui** | `src/components/{ui,panel,brand,common}` | ortak arayüz: temel bileşenler, panel parçaları, logolar, görsel/harita/sayı girişi |
| **core** | `src/lib`, `src/platform/{auth,tenant,branding}`, `src/platform/{audit,actions}.ts`, `src/types`, `src/hooks` | oturum/yetki, kiracı çözümleme (`site-state.ts`: yayın durumu ve özellik bayrakları), yüzey ayrımı |

İki panelin ortak kullandığı arayüz `src/components/panel` altındadır (tablo/başlık, işlem düğmeleri, işlem kayıtları, giriş kartı ve formları, marka görseli alanı). Giriş kartı ikiye ayrıldı: `AuthCard` (ofis) ve `PlatformAuthCard` (KARAY); ortak kart hiçbir yüzeyin yazı tipini/temasını yüklemez. Paneller birbirinin arayüzünü içe aktaramaz.

### Kurallar (ESLint ile zorunlu — `eslint.config.mjs`)

- Bir dosya kendi katmanını ve **alt** katmanları içe aktarabilir; üst katmanları içe aktaramaz.
- Kesin yasaklar: `site-engine | karay-public | core | ui | site-config | theme-engine → site-factory` (SITE-FACTORY-ISOLATION; ofis paneli yalnızca sunucuda, izinli aileler için kullanır), `herhangi bir katman → site-preview` (önizleme ayrı giriş noktası), `site-preview → paneller | KARAY arayüzü`, `site-engine → tenant-panel | karay-platform | karay-public`, `tenant-panel ↔ karay-platform`, `tenant-panel | karay-platform | karay-public → site-engine`, `karay-public → tenant-panel | karay-platform`, `theme-engine → site-config | site-engine | paneller | KARAY`, `core | ui → site-config | theme-engine`.
- Üst klasöre göreli içe aktarım (`../`) kapalıdır; sınırlar `@/` yollarıyla denetlenir.
- Ortak panel bileşeni ofis/KARAY işlemlerini kendisi içe aktarmaz; gerekiyorsa işlem sayfadan prop olarak verilir (ör. `BrandingImageField removeAction`).
- Kuralın kendisi `tests/unit/boundaries.test.mjs` ile test edilir.

Kural ihlali CI'da (`npm run lint`) hata verir. İstisna eklemek yerine kodu doğru katmana taşıyın.

## Veri akışı: Site Builder → site_config → Site Engine → Theme Engine

```
KARAY konsolu (Site Builder: components/platform/site, actions/site-builder.ts)
   ↓ yazar: site_save_draft / site_publish / site_rollback (assert_super_admin)
site_configs.draft / published  +  site_config_revisions
   ↓ okur: site-config (public_site_config, aynı önbellekli kiracı çağrısı; önizlemede taslak)
Site Engine (app/t/[tenant]/layout.tsx → getSiteView)
   ↓ ThemeInput (theme, colors, typography, style, header.style)
Theme Engine: applyTheme(input, marka renkleri, karanlık mod izni)
   ↓ CSS değişkenleri (<style>) + data-site-* öznitelikleri
Site Engine bileşenleri (yalnızca token ve data-site-* kancalarını kullanır)
```

- **Site Builder ≠ Public Site.** Site Builder yapılandırma **üretir**; Site Engine'i içe aktaramaz (ESLint). Site Engine yapılandırmayı **okur**; Site Builder'ı içe aktaramaz. Ortak sözleşme `src/site-config/schema.ts`'tir.
- **Yeni müşteri = veri:** `organizations` + `organization_domains` + `site_configs` (tema kimliği dahil). Kod, klasör veya tema kopyası açılmaz.

## Site Factory, manifest ve seçilmiş tasarım paketi

```
KARAY süper admin › Site › Tema › Tasarım aileleri
   ↓ aile seçimi (kapalı katalog: src/site-factory/families.ts)
Site Compiler: compileDesign(aile, mevcut taslak)          — src/site-factory/compile.ts
   ↓ doğrulanmış bölümler: theme · colors · typography · style · home
site_configs.draft  →  Önizle  →  Yayınla  →  site_configs.published   (migration yok: mevcut jsonb bölümleri)
   ↓
Site Engine: getSiteView → view.style (çözülmüş manifest) → bileşen seçimi (sabit eşleme)
Theme Engine: applyTheme → tokenlar + designCss(tema, manifest) → YALNIZCA seçili parçaların CSS'i
```

**Manifest** (`style` bölümü + `theme`, `typography`, `colors`, `home`):

| Alan | Değerler | Uygulandığı yer |
| --- | --- | --- |
| `hero` | overlay · centered · split · cinematic · editorial · showcase | `components/home/hero.tsx`, `hero-variants.tsx` |
| `headerLayout` | classic · centered · floating | `components/layout/site-header.tsx` (+ floating CSS parçası) |
| `card` (yüzey) | elevated · outline · flat · bezel | CSS parçası |
| `cardLayout` | standard · overlay · editorial · horizontal | CSS parçası (`property-card.tsx` pc-* kancaları) |
| `footer` (zemin) / `footerLayout` | dark · light · brand / classic · contact · minimal | `site-footer.tsx` |
| `motion` | none · subtle · expressive | CSS parçası (yalnızca transform/opacity, `prefers-reduced-motion`, JS yok) |
| `home.sections` | 12 bölüm tipi (yeni: `stats`, `spotlight`) | `app/t/[tenant]/page.tsx` |

**Neden müşteri sayısıyla karmaşıklık artmaz:** bütün siteler aynı Site Engine ve Theme Engine kodunu paylaşır; müşteriye özgü olan yalnızca manifest verisidir. Yeni bir tasarım ailesi = katalogda veri (hiçbir sitenin çalışma zamanına girmez). Yeni bir parça (ör. yeni hero) = Site Engine'de bir bileşen + Theme Engine'de kimlik/CSS parçası; parça yalnızca onu seçen sitenin sayfasına yazılır (sunucu bileşeni: seçilmeyen düzenin işaretlemesi ve kodu tarayıcıya gitmez).

**Güvenlik:** manifest değerleri kapalı listelerdir (zod enum). Bilinmeyen değer şemada reddedilir; veritabanına elle yazılmış olsa bile okuma sırasında varsayılana düşer. Bileşen ve CSS seçimi sabit eşleme tablolarıyla yapılır; kullanıcı verisinden dosya yolu, bileşen adı, dinamik import veya CSS metni üretilmez (`tests/unit/site-factory.test.mjs`, `tests/e2e/site-factory.spec.ts › SF-07`).

**Yazı tipleri (FONT-ISOLATION, Aşama D1):** kiracı sitesi yalnızca kendi başlık/gövde yazı tipinin `@font-face` bildirimlerini satır içi alır ve yalnızca o dosyaları önceden yükler (`theme-engine/typography/font-css.ts`; dosyalar `scripts/fonts/build-site-fonts.mjs` ile next/font'un kendi fonksiyonlarından üretilir, birebir aynı). Önceki "katalog genelinde @font-face" sınırı kaldırıldı (157 → 17 bildirim).

## Yeni Site Oluştur (Aşama D)

```
KARAY › Web Siteleri › Yeni site oluştur (/platform/siteler/yeni)
  1 Site bilgileri  (ad, firma, alan adı/alt alan adı, logo, iletişim, sosyal medya, temel SEO, sahip hesabı)
  2 Site tipi       (İÇERİK ve ÖZELLİK mimarisi: site-types.ts — 5 tip)
  3 Tasarım ailesi  (GÖRSEL dil: catalog/<aile>/ — 6 aile; global kapalı aile seçilemez)
  4 Tasarım seçenekleri (hero, header, kart, footer, hareket, tipografi, renk, ana sayfa kompozisyonu)
  5 Önizleme        (/site-onizleme: manifest + Site Renderer bileşenleri + örnek içerik, çerçevede)
  6 Onay ve oluşturma → createSite → (logo) → publishNewSite
```

**Site manifesti:** `{ siteType, designFamily, palette?, variants: { hero, header, card, cardLayout, footer, motion, headingFont, bodyFont, homepage, navigation, grid, search, listingDetail, gallery, mapList, agents, testimonials } }` (kapalı şema, `manifest.ts`). Derlenmiş hâli sitenin mevcut `site_configs` bölümleridir; kaynağı `style.origin` içinde saklanır (migration gerekmedi). **Önizleme = kiracı:** önizleme ve `createSite` aynı fonksiyonu (`initialSiteSections`) kullanır; E2E testi önizleme ile oluşturulan sitenin tema öznitelikleri, hero/footer yapısı ve yazı tipi paketinin aynı olduğunu doğrular.

**Katalog klasör sözleşmesi:** `src/site-factory/catalog/<aile-kimliği>/index.ts` → `export default defineFamily({ id: '<aile-kimliği>', … })` + `catalog/index.ts` kaydı. Yalnızca veri; React/CSS/bileşen içe aktaramaz. `tests/unit/site-catalog.test.mjs`: klasör = kayıt, kimlik = klasör adı, kiracı runtime içe aktarma grafiğinde Site Factory yok (yeni aile hiçbir kiracıyı etkileyemez), mevcut ailelerin derlenmiş çıktısı değişmez.

**Yetkiler (Aşama D5, migration `20261004000001_design_family_access` — EK, yalnızca yerelde uygulandı):**

| Kim | Ne yapar | Nerede |
| --- | --- | --- |
| KARAY admini | bütün aileleri görür, global açar/kapatır | `/platform/siteler/tasarim-katalogu` (`platform_set_design_family`) |
| KARAY admini | kiracıya aile izni verir | Site › Tema › Ofisin seçebileceği tasarımlar (`platform_set_org_design_families`) |
| Ofis yöneticisi (`settings.manage`) | yalnızca izinli ve açık aileleri görür, kendi sitesine uygular (yayınlanır) | `/admin/tasarim` (`site_apply_design`; yetki veritabanında) |
| Kiracı sitesi | yalnızca kendi manifestini okur; izin tablolarını ve katalogu bilmez | — |

## Theme Engine (`src/theme-engine`)

| Dosya | İçerik |
| --- | --- |
| `ids.ts` | `THEME_IDS`, `FONT_IDS` |
| `themes.ts` | tema kaydı: her tema yalnızca veri (yazı tipleri, köşe, yoğunluk, kart/düğme/hero/header/footer varsayılanları); `resolveStyle()` |
| `tokens.ts` | yapılandırma → CSS değişkenleri (renk, kontrast düzeltme, köşe, aralık, yazı tipi) |
| `palettes.ts` | hazır paletler |
| `typography/` | yazı tipi kataloğu (`catalog.ts`) ve next/font tanımları (`fonts.ts`) |
| `settings.ts` | tema ayarlarının zod şemaları (site-config bunları belgesine katar) |
| `runtime.ts` | `applyTheme()` → `{ css, attributes, style, theme }` |
| `design-css.ts` | seçilmiş tasarım paketi: tema karakteri ve varyant sunum kuralları; `applyTheme` yalnızca sitenin seçtiği parçaları satır içi yazar |
| `preview/live-preview.tsx` | Site Builder ve KARAY sayfası için canlı tema önizlemesi |

Tema kodu tema adına göre dallanmaz; `applyTheme()` tema kaydından ve ayarlardan değişken üretir, tema farkları `themes.css`'te `[data-site-theme]` / `[data-site-card]` gibi veri kancalarıyla ifade edilir. Theme Engine site yapılandırmasının geri kalanını (menü, sayfalar, SEO) bilmez; girdisi yalnızca `ThemeInput`'tur.

**Site Engine ↔ Theme Engine sınırı:** Site Engine *neyi* çizeceğine karar verir (ilan, arama, detay, menü, footer, iletişim, galeri, içerik). Theme Engine *nasıl görüneceğini* belirler (renk, yazı tipi, aralık, köşe, kart/düğme biçimi, tipografi, tema varyasyonları). Tema değişikliği Site Engine'in iş mantığını, URL'leri veya veriyi değiştirmez.

## Kök layout'lar (yüzey başına)

`src/app/layout.tsx` yoktur; her yüzey kendi `<html>`/`<body>` kökünü (`components/common/root-document.tsx`) çizer:

| Kök | Yükler | Yüklemez |
| --- | --- | --- |
| `app/t/layout.tsx` — kiracı sitesi | `globals.css`, tema yazı tipi kataloğu; tema sunum CSS'i satır içi ve yalnızca seçili parçalar | diğer temaların/varyantların CSS'i |
| `app/admin/layout.tsx` — ofis paneli | `globals.css`, temel yazı tipleri (Manrope, Fraunces) | tema CSS'i, tema kataloğu |
| `app/platform/layout.tsx` — KARAY konsolu | `globals.css`, Poppins, KARAY teması | kiracı yazı tipleri, tema CSS'i (yalnızca tema önizlemesi olan sayfalar önizleme için yükler) |
| `app/karay/layout.tsx` — KARAY sayfası | `globals.css`, Poppins, KARAY teması | kiracı yazı tipleri (yalnızca tema vitrini önizlemesi) |
| `app/global-not-found.tsx` | `globals.css`, sistem yazı tipi | next/font (paketleyici yazı tiplerini tüm rotalara ekliyordu) |

Her kökün kendi `not-found.tsx`'i vardır. `tests/e2e/surface-isolation.spec.ts › SURF-11` platform/ofis sayfalarında tema CSS'i ve tema yazı tipi olmadığını doğrular.

## Bu özellik nereye ait?

| Özellik | Katman |
| --- | --- |
| Kiracı oluşturma, abonelik, planlar | KARAY Platform (`app/platform`, `modules/platform`) |
| İlan oluşturma, CRM, içerik, medya | Tenant Panel + `modules/*` |
| Alan adı bağlama | bugün KARAY Platform (site → Alan adı sekmesi) + `modules/domains`; hedef: Tenant Platform (Aşama 3 kararı) |
| Tema seçme, renk/yazı tipi ayarı | Site Builder (`components/platform/site`) → `site_configs` → Theme Engine |
| Yeni tema | Theme Engine (`themes.ts`, `ids.ts`, gerekirse `design-css.ts` parçası) — veri; müşteri kodu yok |
| Yeni tasarım ailesi (tema + parçalar + kompozisyon) | Site Factory (`catalog/<aile>/index.ts` + `catalog/index.ts`) — veri |
| Yeni site tipi (içerik/özellik mimarisi) | Site Factory (`site-types.ts`) — veri |
| Yeni müşteri sitesi | KARAY › Yeni site oluştur (veri; kod veya müşteri klasörü yok) |
| Yeni yapısal parça (hero, header, kart, footer, bölüm) | Site Engine bileşeni + Theme Engine kimliği/CSS parçası; yalnızca seçen siteye gider |
| Public ilan sayfası, arama, menü, footer | Site Engine |
| Public site SEO çıktısı | Site Engine + Site Config (`seo` bölümü) + `modules/seo` |
| Kullanıcı yetkisi, oturum | Core (`platform/auth`) |
| Yüzey (alan adı) ayrımı | Core (`platform/tenant/host.ts`) |
| Ortak düğme, tablo, görsel, harita | UI (`components/{ui,panel,common}`) |

## Teknik borç

- **Tema galerisindeki LivePreview temsilîdir** (KARAY sayfası ve Site Builder tema kartları). Yeni site akışı artık gerçek önizleme (`/site-onizleme`, Site Renderer sözleşmesi) kullanır; galeri kartlarının da gerçek önizlemeye geçirilmesi sonraki aşamadır.
- Paket slotlarından navigation, grid, search, listingDetail, gallery, mapList bugün tek uygulamalıdır ('standard'); agents ve testimonials için bileşen yoktur ('none' — müşteri yorumu gerçek veri gerektirir, uydurma içerik gösterilmez).
- `experimental.globalNotFound` deneysel bir Next.js bayrağıdır (çok kök layout için gerekli).
- `src/platform/` adı tarihseldir; içinde yalnızca core (auth, tenant, branding, audit) kalmıştır.

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
