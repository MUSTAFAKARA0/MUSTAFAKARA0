# KARAY Web Sitesi Yönetimi (Site Kontrol Merkezi)

KARAY süper admin panelinin iki görevi vardır: **platform yönetimi** (organizasyonlar, planlar, kullanıcılar, kayıtlar) ve her kiracı için **web sitesi / tema oluşturucu**. İlan, müşteri, talep gibi operasyonel işler ofisin kendi panelindedir (`/admin`); KARAY bunları yönetmez.

## Ekranlar

`/platform/siteler` — tüm kiracı siteleri: durum, alan adı, tema, son yayın. Her satırda **Önizle**, **Yönet** ve ⋯ menüsü (Siteyi görüntüle, Site ayarları, Tema, Sayfalar, SEO, Alan adı, Gelişmiş, Yayından kaldır / bakım modu). Telefonda tablo yerine kart listesi.

`/platform/siteler/{id}` — Site Kontrol Merkezi. Başlıkta ad, durum, alan adı, sürüm ve **[Siteyi gör] [Önizle] [Değişiklikleri yayınla]**. Sekmeler:

| Sekme | İçerik | Kayıt |
| --- | --- | --- |
| Genel | Taslak özeti, yayın bilgisi, site durumu (Yayında / Bakım / Yayında değil) | Durum anında |
| Marka | Logo, mobil logo, site simgesi, paylaşım ve ana sayfa görseli; ad, kısa ad, unvan, slogan, açıklama, iletişim, harita bağlantısı, sosyal hesaplar | Anında (ofisin kendi ayar kaydı) |
| Tema | Klasik / Marble / Atlas (canlı önizlemeli) | Taslak |
| Renkler | Ofis marka renkleri / hazır palet / özel renkler (11 tasarım belirteci), koyu palet (bayrakla) | Taslak |
| Tipografi | Sınırlı yazı tipi listesi, başlık kalınlığı, ölçek | Taslak |
| Header | Masaüstü (görünüm, yükseklik, yapışkan, telefon/WhatsApp/favori, çağrı düğmesi) ve mobil ayrı | Taslak |
| Ana Sayfa | Bölümleri aç/kapa, sırala (↑/↓ düğmeleri — telefonda da çalışır), metin ve düğme; metin bölümü ekle | Taslak |
| Sayfalar | Hakkımızda, Hizmetler, İletişim, Değerleme, Blog, Bölgeler: yayında/gizli, başlık, SEO ve paylaşım (OG) alanları | Taslak |
| Menü | Öğe ekle/sil/gizle/sırala, site içi sayfa veya dış bağlantı, açılır alt öğeler | Taslak |
| Footer | Sütunlar ve bağlantılar, açıklama, telif, iletişim/saat/sosyal göster-gizle | Taslak |
| SEO | Site başlığı, açıklama, dizine ekleme, yapılandırılmış veri türü (RealEstateAgent), fiyat aralığı; arama sonucu önizlemesi | Taslak |
| Domain | Alan adı ekle/kaldır, DNS kayıtları, bağlama adımları | Anında |
| Özellikler | CRM, analitik, PDF, özel alan adı, blog, değerleme, WhatsApp, favoriler, gelişmiş SEO, koyu görünüm: plan varsayılanı / açık / kapalı | Anında |
| Geçmiş | Yayın sürümleri (geri yükleme) ve site işlem kaydı | — |

Sayfa adresleri (slug) sabittir: SEO ve paylaşılmış bağlantılar bozulmasın diye değiştirilemez. Yasal sayfalar (KVKK vb.) her zaman yayındadır.

## Taslak → Önizleme → Yayın

1. Görünüm sekmelerinde **Taslağa kaydet** yalnızca taslağı değiştirir; canlı site aynı kalır.
2. **Önizle** yeni sekmede kiracının kendi alan adında taslağı gösterir (üstte "ÖNİZLEME" şeridi, arama motorlarına kapalı). Bağlantı imzalıdır (HMAC), 1 saat geçerlidir ve yalnızca o siteye aittir; önizleme çerezi yalnızca açan tarayıcıdadır.
3. **Değişiklikleri yayınla** (isteğe bağlı sürüm notuyla) taslağı canlıya alır ve yeni sürüm oluşturur; önbellek etiketle anında yenilenir.
4. **Geçmiş › Geri yükle**, eski bir sürümü yeni sürüm olarak yayınlar (geçmiş silinmez). **Taslağı geri al**, yayınlanmamış değişiklikleri siler.

## Mimari

- **Tek yapılandırma belgesi:** `site_configs.draft` / `published` (jsonb). Şema `src/platform/site/schema.ts` (zod); bozuk veya eski bir bölüm yalnızca o bölümün varsayılanına düşer, site asla kırılmaz. Kayıt yoksa bugünkü görünüm kullanılır.
- **Tema kaydı (registry):** `src/platform/site/themes.ts`. Tema yalnızca sunumdur (yazı tipi, köşe, kart, hero ve header biçimi); veri, URL ve SEO değişmez. Yeni tema: `THEME_IDS`'e kimlik + `THEMES`'e tanım + gerekirse `globals.css`'te `[data-site-theme='…']` kuralları. 10+ tema için tasarlandı.
- **Tasarım belirteçleri:** `src/platform/site/tokens.ts` yapılandırmayı CSS değişkenlerine çevirir (`html:root`'a tek `<style>`); bileşenlerde sabit renk yoktur. Okunabilirlik için kontrast otomatik düzeltilir. Hazır paletler `palettes.ts`.
- **Yazı tipleri:** `fonts.ts` — next/font ile kendi sunucumuzdan; yalnızca varsayılan çift önceden yüklenir, diğerleri kullanılırsa iner (`display: optional`, düzen kayması yok).
- **Okuma yolu (performans):** yayındaki yapılandırma, kiracı yüklemesiyle **aynı önbellekli çağrıda** (`public_site_config`) gelir; ziyaretçi başına ek sorgu yoktur. Taslak yalnızca önizleme açıkken okunur.
- **Yazma yolu:** sunucu eylemleri (`src/app/actions/site-builder.ts`) → `requireSuperAdmin()` → veritabanı fonksiyonu (`site_*`, içeride `assert_super_admin()`) → denetim kaydı → önbellek etiketi yenileme.

## Güvenlik ve kiracı yalıtımı

- `site_configs`: okuma yalnızca kendi ofisinin üyelerine ve süper admine (RLS); **hiçbir rol doğrudan yazamaz** — yazma yalnızca süper admin fonksiyonlarıyla. `site_config_revisions` yalnızca süper admine açık.
- Anonim ziyaretçi yalnızca `public_site_config` ile **yayındaki** sürümü, **aktif** ofis için okuyabilir; taslak hiçbir zaman herkese açık değildir.
- Hedef kiracı kimliği süper admin tarafından seçilir; kiracı kullanıcıları `/platform/siteler/*` adreslerinde 404 alır, `site_*` fonksiyonları ve `/api/platform/branding` onlara kapalıdır (403).
- `site_save_draft` yalnızca bilinen bölümleri kabul eder; değerler uygulamada zod ile doğrulanır. Bağlantılar yalnızca site içi yol (`/…`) veya `https://`.
- Logo yükleme: PNG/JPG/WEBP ve **güvenli SVG** (betik, olay özniteliği, dış kaynak, `foreignObject` vb. reddedilir; SVG sunucuda PNG'ye çevrilir). Dosya yolu kullanıcı girdisi içermez.
- Özellik bayrakları `org_plan` üzerinden sunucu tarafında uygulanır (ör. CRM kapalıysa ofis panelinde CRM sayfaları kapanır); site bayrakları sayfaları 404'e çevirir, menü/site haritasından çıkarır.

## Bakım modu

Site durumu **Bakım** veya **Yayında değil** iken ziyaretçi kısa bir bilgi sayfası görür (iletişim bilgileriyle; `noindex`), site haritası boş döner. Ofis paneli (`/admin`) ve KARAY paneli çalışmaya devam eder. Önizleme bakımdayken de çalışır.

## Denetim kaydı

`site.draft_saved`, `site.published`, `site.rolled_back`, `site.draft_discarded`, `site.status_changed`, `site.features_changed`, `site.brand_updated`, `site.branding_uploaded` ve alan adı işlemleri. KARAY'da Geçmiş sekmesinde; ofisin kendi panelinde Güvenlik › "Web sitesi" filtresinde (şeffaflık: ofis, sitesinde kimin neyi değiştirdiğini görür) görünür.

## Veritabanı

`supabase/migrations/20260930000002_site_builder.sql` (tekrar çalıştırılabilir, veri silmez, geri dönüş SQL'i dosya sonunda). Canlıya uygulama: docs/PRODUCTION_MIGRATION.md. Son kontrol `postflight_v2.sql` #16.

## Testler

- `tests/e2e/site-builder.spec.ts` › TEST-SITE-01…12 (geçici kiracı ve test alan adı; Elvankent'e dokunmaz).
- `tests/security/rls.test.mjs` › "Web sitesi yapılandırması (site_configs) ve oturum bağlamı".
