import type { ThemeId } from '@/theme-engine/ids';
import type { ResolvedStyle } from '@/theme-engine/themes';

/**
 * Seçilmiş tasarım paketi (design bundle) CSS'i.
 *
 * Eskiden tüm temaların ve varyantların sunum kuralları tek bir global CSS dosyasındaydı
 * (her kiracı sitesine 10 temanın kuralları gidiyordu). Artık her kural parçası bir tema
 * veya varyant kimliğine bağlıdır ve sitenin manifestinde SEÇİLİ olanlar dışında hiçbiri
 * sayfaya yazılmaz: Elvankent'in sayfasında başka temanın/varyantın tek satırı bulunmaz.
 *
 * Güvenlik: bu modül kullanıcı verisinden CSS üretmez. Girdi yalnızca kapalı listelerdeki
 * kimliklerdir (zod enum ile doğrulanmış); her kimlik aşağıdaki sabit metinlerden birini seçer.
 * Bilinmeyen kimlik hiçbir şey üretmez.
 *
 * Seçiciler data-site-* özniteliklerine bağlıdır: öznitelikler yalnızca kiracı sitesi
 * kapsayıcısında ve tema önizlemesinde bulunur, KARAY ve yönetim panelleri etkilenmez.
 */

/** Katmanlı kurallar Tailwind'in katman sırasına uyar (stil etiketi hangi sırada yüklenirse yüklensin) */
const LAYER_ORDER = '@layer theme, base, components, utilities;';

type Fragment = { layered?: string; plain?: string };

// --------------------------------------------------------------------------- Kart yüzeyi
const CARD_SURFACE: Record<ResolvedStyle['card'], Fragment> = {
  elevated: {},
  outline: {
    layered: `[data-site-card='outline'] .card-lift{box-shadow:none;border-color:var(--border)}[data-site-card='outline'] .card-lift:hover{transform:none;box-shadow:none;border-color:var(--primary)}`,
  },
  flat: {
    layered: `[data-site-card='flat'] .card-lift{box-shadow:none;border-color:transparent;background:var(--surface-muted)}[data-site-card='flat'] .card-lift:hover{transform:none;box-shadow:none;border-color:var(--border-strong)}`,
  },
  // Çift çerçeve (dış kabuk + iç çekirdek): ince halka, yumuşak dağınık gölge, iç parlaklık
  bezel: {
    layered: `[data-site-card='bezel'] .card-lift{background:color-mix(in oklab,var(--foreground) 4%,var(--surface));border-color:color-mix(in oklab,var(--foreground) 8%,transparent);box-shadow:0 1px 0 rgb(255 255 255 / .5) inset,0 24px 48px -32px rgb(15 23 20 / .28)}[data-site-card='bezel'] .card-lift:hover{transform:translateY(-3px);box-shadow:0 1px 0 rgb(255 255 255 / .5) inset,0 32px 56px -30px rgb(15 23 20 / .34)}[data-site-card='bezel'] .card-lift .site-media{box-shadow:0 0 0 1px color-mix(in oklab,var(--foreground) 6%,transparent)}`,
  },
};

// --------------------------------------------------------------------------- Tema karakterleri
const THEME: Record<ThemeId, Fragment> = {
  klasik: {},
  marble: { layered: `[data-site-theme='marble'] .eyebrow{letter-spacing:.24em}` },
  atlas: { layered: `[data-site-theme='atlas'] .eyebrow-line::before{height:3px;background:var(--accent)}` },
  prestij: {
    plain: `[data-site-theme='prestij'] :is(h1,h2).font-display{letter-spacing:.005em}[data-site-theme='prestij'] .eyebrow{letter-spacing:.32em;font-weight:600}[data-site-theme='prestij'] .eyebrow-line::before{width:3rem;height:1px;background:var(--accent)}[data-site-theme='prestij'] .btn{letter-spacing:.06em;text-transform:uppercase;font-size:.8em}`,
  },
  kent: {
    plain: `[data-site-theme='kent'] :is(h1,h2,h3).font-display{letter-spacing:-.03em}[data-site-theme='kent'] .eyebrow{display:inline-flex;padding:.3em .6em;background:var(--accent);color:var(--accent-fg);letter-spacing:.08em}[data-site-theme='kent'] .eyebrow-line::before{display:none}`,
  },
  yalin: {
    plain: `[data-site-theme='yalin'] :is(h1,h2).font-display{letter-spacing:-.035em}[data-site-theme='yalin'] .eyebrow{letter-spacing:.02em;text-transform:none;font-weight:600;color:var(--muted-foreground)}[data-site-theme='yalin'] .eyebrow-line::before{display:none}[data-site-theme='yalin'] .card-lift{border-color:transparent}`,
  },
  rezidans: {
    plain: `[data-site-theme='rezidans'] :is(h1,h2).font-display{letter-spacing:-.015em}[data-site-theme='rezidans'] .card-lift{box-shadow:0 2px 4px rgb(20 26 24 / .05),0 18px 40px -18px rgb(20 26 24 / .35)}[data-site-theme='rezidans'] .eyebrow-line::before{width:2.25rem;background:var(--accent)}`,
  },
  doga: {
    plain: `[data-site-theme='doga'] .eyebrow{letter-spacing:.1em}[data-site-theme='doga'] .eyebrow-line::before{width:.5rem;height:.5rem;border-radius:999px;background:var(--accent)}`,
  },
  dergi: {
    plain: `[data-site-theme='dergi'] :is(h1,h2).font-display{letter-spacing:-.01em;font-style:italic}[data-site-theme='dergi'] .eyebrow{letter-spacing:.18em;border-bottom:1px solid currentColor;padding-bottom:.2em}[data-site-theme='dergi'] .eyebrow-line::before{display:none}[data-site-theme='dergi'] .card-lift{border-width:0 0 1px;border-radius:0;background:transparent}`,
  },
  grafit: {
    plain: `[data-site-theme='grafit'] :is(h1,h2).font-display{letter-spacing:-.025em}[data-site-theme='grafit'] .eyebrow-line::before{width:1.25rem;height:4px;border-radius:2px;background:var(--accent)}`,
  },
};

// --------------------------------------------------------------------------- Header / düğme / footer / görsel
const HEADER_TONE: Record<ResolvedStyle['header'], Fragment> = {
  light: {},
  // Koyu header: header içindeki tokenlar ikincil (koyu) renge göre tersine çevrilir
  dark: {
    layered: `[data-header-style='dark']{--surface:var(--surface-inverse);--foreground:var(--inverse-foreground);--surface-muted:color-mix(in oklab,var(--inverse-foreground) 12%,var(--surface-inverse));--border:color-mix(in oklab,var(--inverse-foreground) 16%,var(--surface-inverse))}`,
  },
};

const BUTTON: Record<ResolvedStyle['button'], Fragment> = {
  rounded: {},
  pill: { plain: `[data-site-button='pill'] .btn{border-radius:9999px}` },
  square: { plain: `[data-site-button='square'] .btn{border-radius:4px}` },
};

const FOOTER_TONE: Record<ResolvedStyle['footer'], Fragment> = {
  dark: {},
  light: { plain: `[data-site-footer='light'] .site-footer{--surface-inverse:var(--surface-muted);--inverse-foreground:var(--foreground);border-top:1px solid var(--border)}` },
  brand: { plain: `[data-site-footer='brand'] .site-footer{--surface-inverse:var(--primary);--inverse-foreground:var(--primary-fg)}` },
};

const IMAGE: Record<ResolvedStyle['image'], Fragment> = {
  rounded: {},
  square: { plain: `[data-site-image='square'] .site-media{border-radius:0}` },
  organic: { plain: `[data-site-image='organic'] .site-media{border-radius:2rem}` },
  frame: {
    plain: `[data-site-image='frame'] .site-media::after{content:'';position:absolute;inset:10px;border:1px solid rgb(255 255 255 / .6);pointer-events:none;z-index:2}`,
  },
};

// --------------------------------------------------------------------------- Kart düzeni (yapısal)
// Aynı kart işaretlemesi (property-card.tsx'teki pc-* kancaları) farklı düzenle yerleşir;
// telefonda her düzen tek sütun ve dokunmaya uygun kalır.
const CARD_LAYOUT: Record<ResolvedStyle['cardLayout'], Fragment> = {
  standard: {},
  // Görsel üstü: metin fotoğrafın üzerinde, alttan koyulaşan örtüyle (kontrast)
  overlay: {
    // Görsel ve künye aynı ızgara hücresinde üst üste (konumlandırma yok): başlık bağlantısının
    // kartı kaplayan katmanı yine bütün kartı tıklanabilir yapar; favori/karşılaştır üstte kalır.
    plain: `[data-site-card-layout='overlay'] .property-card{display:grid;grid-template:minmax(0,1fr)/minmax(0,1fr);padding:0;overflow:hidden;isolation:isolate}[data-site-card-layout='overlay'] .property-card>:is(.pc-media,.pc-body){grid-area:1/1}[data-site-card-layout='overlay'] .property-card .pc-media{aspect-ratio:4/5;border-radius:inherit}[data-site-card-layout='overlay'] .property-card .pc-scrim{height:78%;opacity:1;background:linear-gradient(to top,rgb(8 10 12 / .9),rgb(8 10 12 / .5) 48%,transparent)}[data-site-card-layout='overlay'] .property-card :is(.pc-type,.pc-count){display:none}[data-site-card-layout='overlay'] .property-card .pc-body{align-self:end;z-index:1;padding:1.25rem 1.25rem .5rem;color:#fff}[data-site-card-layout='overlay'] .property-card :is(.pc-price,.pc-title){color:#fff}[data-site-card-layout='overlay'] .property-card :is(.pc-location,.pc-highlights){color:rgb(255 255 255 / .8)}[data-site-card-layout='overlay'] .property-card .pc-specs{border-color:rgb(255 255 255 / .2);color:rgb(255 255 255 / .85)}[data-site-card-layout='overlay'] .property-card .pc-specs span[aria-hidden]{background:rgb(255 255 255 / .5)}[data-site-card-layout='overlay'] .property-card .pc-footer :is(a,button){color:rgb(255 255 255 / .92)}`,
  },
  // Editoryal: kutusuz, dikey (4:5) görsel, serif başlık, sade künye
  editorial: {
    plain: `[data-site-card-layout='editorial'] .property-card{padding:0;background:transparent;border-color:transparent;box-shadow:none}[data-site-card-layout='editorial'] .property-card:hover{transform:none;box-shadow:none}[data-site-card-layout='editorial'] .property-card .pc-media{aspect-ratio:4/5}[data-site-card-layout='editorial'] .property-card .pc-body{padding:1rem 0 0}[data-site-card-layout='editorial'] .property-card .pc-title{order:-1;margin-top:0;font-family:var(--font-display);font-size:1.3rem;line-height:1.2;font-weight:var(--site-heading-weight,500)}[data-site-card-layout='editorial'] .property-card .pc-pricebox{margin-top:.5rem}[data-site-card-layout='editorial'] .property-card .pc-price{font-size:1.05rem}[data-site-card-layout='editorial'] .property-card .pc-specs{border-top:0;padding-top:0;margin-top:.5rem;text-transform:uppercase;letter-spacing:.08em;font-size:11.5px}[data-site-card-layout='editorial'] .property-card .pc-highlights{display:none}`,
  },
  // Yatay: geniş ekranda görsel solda, bilgiler sağda (listelerde 2 sütun); telefonda dikey
  horizontal: {
    plain: `@media (min-width:640px){[data-site-card-layout='horizontal'] .property-card{display:grid;grid-template-columns:minmax(0,42%) minmax(0,1fr);gap:.25rem;align-items:stretch}[data-site-card-layout='horizontal'] .property-card .pc-media{aspect-ratio:auto;min-height:13.5rem;height:100%}[data-site-card-layout='horizontal'] .property-card .pc-body{padding:.75rem .75rem .5rem 1rem}[data-site-card-layout='horizontal'] .listing-grid{grid-template-columns:repeat(1,minmax(0,1fr))}}@media (min-width:1024px){[data-site-card-layout='horizontal'] .listing-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`,
  },
};

// --------------------------------------------------------------------------- Header düzeni
const HEADER_LAYOUT: Record<ResolvedStyle['headerLayout'], Fragment> = {
  classic: {},
  centered: {},
  // Yüzen header: üstten ayrık, yarı saydam (yalnızca sabit öğede bulanıklık; kaydırılan içerikte yok)
  floating: {
    plain: `[data-site-header-layout='floating'] .site-header{background:transparent;border-color:transparent;backdrop-filter:none;padding-top:.625rem;pointer-events:none}[data-site-header-layout='floating'] .site-header-bar{pointer-events:auto;border:1px solid color-mix(in oklab,var(--foreground) 10%,transparent);border-radius:1.25rem;background:color-mix(in oklab,var(--surface) 88%,transparent);backdrop-filter:blur(14px);box-shadow:0 18px 40px -28px rgb(15 23 20 / .35);padding-inline:1rem}@media (min-width:1024px){[data-site-header-layout='floating'] .site-header-bar{border-radius:9999px;padding-inline:1.5rem}}`,
  },
};

// --------------------------------------------------------------------------- Hareket dili
// Yalnızca transform/opacity; JavaScript yok (CSS kaydırma zaman çizelgesi). Desteklemeyen
// tarayıcıda ve "hareketi azalt" tercihinde hiç animasyon olmaz; içerik her durumda görünür.
const REVEAL = `@keyframes site-reveal{from{opacity:0;transform:translateY(var(--motion-distance,24px))}to{opacity:1;transform:none}}`;
const MOTION: Record<ResolvedStyle['motion'], Fragment> = {
  none: {},
  subtle: {
    plain: `${REVEAL}@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){[data-site-motion] main>section:not(:first-child){animation:site-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 180px}}}`,
  },
  expressive: {
    plain: `${REVEAL}@keyframes site-settle{from{transform:scale(1.06)}to{transform:none}}@media (prefers-reduced-motion:no-preference){[data-site-motion] .hero-media img{animation:site-settle 1.4s cubic-bezier(.22,1,.36,1) both}@supports (animation-timeline:view()){[data-site-motion] main>section:not(:first-child){--motion-distance:40px;animation:site-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 220px}[data-site-motion] .listing-grid>*{animation:site-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 160px}}}`,
  },
};

/** Sitenin seçtiği tema ve varyantların CSS'i (seçilmeyenlerin hiçbiri yazılmaz) */
export function designCss(themeId: ThemeId, style: ResolvedStyle): string {
  const parts: Fragment[] = [
    CARD_SURFACE[style.card],
    THEME[themeId],
    HEADER_TONE[style.header],
    BUTTON[style.button],
    FOOTER_TONE[style.footer],
    IMAGE[style.image],
    CARD_LAYOUT[style.cardLayout],
    HEADER_LAYOUT[style.headerLayout],
    MOTION[style.motion],
  ].filter(Boolean);
  const layered = parts.map((p) => p.layered ?? '').join('');
  const plain = parts.map((p) => p.plain ?? '').join('');
  return `${layered ? `${LAYER_ORDER}@layer components{${layered}}` : ''}${plain}`;
}
