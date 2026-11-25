import type { ThemeId } from '@/theme-engine/ids';

/**
 * TEMA İMZALARI (24.11.2026): her temanın renk ve yazı tipinin ötesindeki görsel dili.
 *
 * İki parça vardır; ikisi de YALNIZCA o temayı seçen sitenin sayfasına yazılır (design-css.ts):
 *   static  doku, çerçeve, köşe işaretleri, sayfa deseni ve fareyle üzerine gelme efektleri. Üzerine gelme
 *           efektleri yalnızca fareli cihazda ve "hareketi azalt" tercihi yoksa çalışır.
 *   motion  giriş ve kaydırma hareketleri. Yalnızca hareket dili açık sitelerde ([data-site-motion]),
 *           "hareketi azalt" tercihi yoksa ve (kaydırma zaman çizelgesi için) tarayıcı destekliyorsa.
 *
 * Kurallar (tests/unit/site-factory.test.mjs):
 *   - Her kural [data-site-theme='<tema>'] ile başlar: başka temanın sayfasına tek satır gitmez.
 *   - Animasyonlar yalnızca transform / opacity / filter / clip-path / background-position kullanır
 *     (yerleşimi yeniden hesaplatan top/left/width/height/margin yok).
 *   - İçerik hareket olmadan da görünür: başlangıç kareleri metni gizlemez (yalnızca kayma / bulanıklık);
 *     görseller kaydırmayla açılır ama tarayıcı desteklemiyorsa doğrudan görünür.
 *   - Kullanıcı verisinden CSS üretilmez; girdi kapalı listedeki tema kimliğidir.
 *   - Klasik temanın kalıcı imzası boştur (varsayılan site için tema sunum CSS'i boş kalır).
 */
export type SignatureFragment = { static?: string; motion?: string };

const HOVER = '@media (hover:hover) and (prefers-reduced-motion:no-preference)';
const OK = '@media (prefers-reduced-motion:no-preference)';
const VIEW = '@supports (animation-timeline:view())';
/** Kaydırma zaman çizelgesiyle bölüm içi öğe: görünüme girerken çalışır */
const inView = (anim: string, range = 'entry 0% entry 220px') => `animation:${anim} linear both;animation-timeline:view();animation-range:${range}`;

/**
 * Okuma ilerleme çizgisi: başlığın alt kenarında, sayfa kaydırıldıkça dolan ince çizgi (CSS kaydırma zaman
 * çizelgesi; JS yok). Başlık her düzende sticky ya da relative olduğu için çizgi başlığa bağlı kalır.
 */
const progress = (id: ThemeId, bg: string, h = '2px') =>
  // Yalnızca konumlandırılmış gerçek site başlığında (.sticky / .relative): konumsuz bir başlıkta (ör. panel
  // önizlemesi) çizgi sayfanın dışına taşamaz. Taban hâli scaleX(0): animasyon uygulanmazsa görünmez.
  `@keyframes sig-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}@supports (animation-timeline:scroll()){${OK}{${m(id)} .site-header:is(.sticky,.relative)::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:${h};pointer-events:none;transform-origin:left;transform:scaleX(0);background:${bg};animation:sig-grow linear both;animation-timeline:scroll(root)}}}`;

/** Hafif film greni (SVG gürültü, ~0,4 KB, ağ isteği yok; CSP img-src data:) */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")";

/** Ortak hareket kareleri (yalnızca transform/opacity/filter/clip-path) */
const K = {
  rise: '@keyframes sig-rise{from{transform:translateY(.45em);filter:blur(8px)}to{transform:none;filter:none}}',
  fade: '@keyframes sig-fade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}',
  zoomOut: '@keyframes sig-zoom-out{from{transform:scale(1.12)}to{transform:none}}',
  kenBurns: '@keyframes sig-ken-burns{from{transform:scale(1)}to{transform:scale(1.09) translate3d(-1.2%,-.8%,0)}}',
  unveilUp: '@keyframes sig-unveil-up{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}',
  wipe: '@keyframes sig-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}',
  grow: '@keyframes sig-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
  pop: '@keyframes sig-pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}',
  float: '@keyframes sig-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
  pulse: '@keyframes sig-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.55}}',
  route: '@keyframes sig-route{from{background-position:0 0}to{background-position:20px 0}}',
  shine: '@keyframes sig-shine{from{background-position:120% 0}to{background-position:-20% 0}}',
};

/** Tema seçicisi */
const t = (id: ThemeId) => `[data-site-theme='${id}']`;
/** Hareketi açık sitede tema seçicisi */
const m = (id: ThemeId) => `[data-site-theme='${id}'][data-site-motion]`;
const HERO = "section[aria-labelledby='hero-baslik']";
const HERO_IMG = `${HERO} img[fetchpriority='high']`;

export const SIGNATURE: Record<ThemeId, SignatureFragment> = {
  // ----------------------------------------------------------------- Klasik: ölçülü, güven veren
  klasik: {
    motion:
      K.rise + K.grow + K.fade +
      `${OK}{${m('klasik')} #hero-baslik{animation:sig-rise 1s cubic-bezier(.22,1,.36,1) both}${m('klasik')} .eyebrow-line::before{transform-origin:left;animation:sig-grow .9s .2s cubic-bezier(.22,1,.36,1) both}}` +
      `${HOVER}{${m('klasik')} .property-card .site-media img{transition:transform .8s cubic-bezier(.22,1,.36,1)}${m('klasik')} .property-card:hover .site-media img{transform:scale(1.05)}${m('klasik')} .btn svg{transition:transform .25s ease}${m('klasik')} .btn:hover svg{transform:translateX(3px)}}`,
  },

  // ----------------------------------------------------------------- Rezidans (Sinematik Vitrin): sinema
  rezidans: {
    static:
      // Hero fotoğrafında hafif film greni ve sinema kararması; kart görsellerinde ışık süpürmesi
      `${t('rezidans')} ${HERO} .hero-media.isolate::after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:${GRAIN};opacity:.16;mix-blend-mode:overlay}` +
      `${t('rezidans')} ${HERO} .hero-media.isolate::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(120% 90% at 50% 40%,transparent 55%,rgb(0 0 0 / .38))}` +
      `${t('rezidans')} .property-card .site-media::before{content:'';position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(110deg,transparent 35%,rgb(255 255 255 / .28) 50%,transparent 65%);transform:translateX(-130%)}` +
      `${t('rezidans')} :is(h1,h2).font-display{text-wrap:balance}` +
      `${t('rezidans')} section[aria-labelledby='rakamlar'] dd.numeric{background:linear-gradient(180deg,var(--foreground) 40%,color-mix(in oklab,var(--accent) 60%,var(--foreground)));-webkit-background-clip:text;background-clip:text;color:transparent}` +
      `@media (forced-colors:active){${t('rezidans')} section[aria-labelledby='rakamlar'] dd.numeric{color:CanvasText;background:none}}` +
      `${HOVER}{${t('rezidans')} .property-card .site-media img{transition:transform 1.1s cubic-bezier(.22,1,.36,1)}${t('rezidans')} .property-card:hover .site-media img{transform:scale(1.08)}${t('rezidans')} .property-card .site-media::before{transition:transform 1.1s cubic-bezier(.22,1,.36,1)}${t('rezidans')} .property-card:hover .site-media::before{transform:translateX(130%)}}`,
    motion:
      K.rise + K.kenBurns + K.grow + K.fade + K.unveilUp +
      `${OK}{${m('rezidans')} ${HERO_IMG}{animation:sig-ken-burns 24s ease-in-out 2 alternate}${m('rezidans')} #hero-baslik{animation:sig-rise 1.2s cubic-bezier(.22,1,.36,1) both}${m('rezidans')} #hero-baslik+p{animation:sig-rise 1.2s .18s cubic-bezier(.22,1,.36,1) both}${m('rezidans')} .eyebrow-line::before{transform-origin:left;animation:sig-grow 1s .25s cubic-bezier(.22,1,.36,1) both}` +
      `${VIEW}{${m('rezidans')} section[aria-labelledby='rakamlar'] dl>div{${inView('sig-fade', 'entry 0% entry 160px')}}${m('rezidans')} section[aria-labelledby='rakamlar'] dl>div:nth-child(2){animation-range:entry 30px entry 190px}${m('rezidans')} section[aria-labelledby='rakamlar'] dl>div:nth-child(3){animation-range:entry 60px entry 220px}${m('rezidans')} section[aria-labelledby='rakamlar'] dl>div:nth-child(4){animation-range:entry 90px entry 250px}${m('rezidans')} .property-card .pc-media{${inView('sig-unveil-up', 'entry 0% entry 260px')}}}}` +
      progress('rezidans', 'var(--accent)'),
  },

  // ----------------------------------------------------------------- Prestij (Lüks, Editoryal Lüks): altın varak
  prestij: {
    static:
            // Kart görselinde içten altın çerçeve (üzerine gelince belirir), düğmede altın süpürme
      `${t('prestij')} .property-card .site-media::before{content:'';position:absolute;inset:12px;z-index:2;pointer-events:none;border:1px solid color-mix(in oklab,var(--accent) 85%,white);opacity:0;transform:scale(1.03)}` +
      // Tam ekran hero: sol tarafta okunurluk perdesi ve içten ince altın çerçeve
      `${t('prestij')} .kp-hero-immersive::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,rgb(14 10 4 / .52),rgb(14 10 4 / .18) 45%,transparent 70%)}` +
      `${t('prestij')} .kp-hero-immersive::after{content:'';position:absolute;inset:clamp(10px,1.6vw,22px);z-index:-1;pointer-events:none;border:1px solid color-mix(in oklab,var(--accent) 55%,transparent)}` +
      // Bölüm başlıklarının altında altın süs çizgisi
      `${t('prestij')} main>section:not(:first-child) h2.font-display::after{content:'';display:block;width:3.25rem;height:1px;margin-top:.85rem;background:linear-gradient(90deg,var(--accent),transparent)}` +
      `${t('prestij')} .eyebrow-line::before{background:linear-gradient(90deg,var(--accent),color-mix(in oklab,var(--accent) 35%,white),var(--accent)) 0 0/250% 100%}` +
      `${t('prestij')} .btn.bg-primary{background-image:linear-gradient(100deg,transparent 40%,rgb(255 255 255 / .22) 50%,transparent 60%);background-size:250% 100%;background-position:120% 0}` +
      `${HOVER}{${t('prestij')} .property-card .site-media img{transition:transform 1.4s cubic-bezier(.16,1,.3,1),filter .6s}${t('prestij')} .property-card:hover .site-media img{transform:scale(1.06);filter:brightness(1.06)}${t('prestij')} .property-card .site-media::before{transition:opacity .6s,transform .8s cubic-bezier(.16,1,.3,1)}${t('prestij')} .property-card:hover .site-media::before{opacity:1;transform:none}${t('prestij')} .btn.bg-primary{transition:background-position .9s ease,background-color .15s}${t('prestij')} .btn.bg-primary:hover{background-position:-20% 0}}`,
    motion:
      K.rise + K.zoomOut + K.unveilUp + K.grow + K.shine +
      `${OK}{${m('prestij')} ${HERO_IMG}{animation:sig-zoom-out 2.4s cubic-bezier(.16,1,.3,1) both}${m('prestij')} #hero-baslik{animation:sig-rise 1.4s .1s cubic-bezier(.16,1,.3,1) both}${m('prestij')} .eyebrow-line::before{animation:sig-grow 1.2s .3s cubic-bezier(.16,1,.3,1) both,sig-shine 3.2s 1.6s ease-in-out both}${m('prestij')} .eyebrow-line::before{transform-origin:left}` +
      `${VIEW}{${m('prestij')} .property-card .site-media{${inView('sig-unveil-up', 'entry 0% entry 320px')}}${m('prestij')} main>section:not(:first-child) h2.font-display{${inView('sig-rise', 'entry 0% entry 200px')}}}}` +
      progress('prestij', 'linear-gradient(90deg,color-mix(in oklab,var(--accent) 60%,white),var(--accent))'),
  },

  // ----------------------------------------------------------------- Kent (Architectural): planlama çizimi
  kent: {
    static:
      `${t('kent')} main{counter-reset:sig-bolum;background-image:linear-gradient(color-mix(in oklab,var(--foreground) 4.5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in oklab,var(--foreground) 4.5%,transparent) 1px,transparent 1px);background-size:56px 56px;background-position:-1px -1px}` +
      `${t('kent')} main>section:not(:first-child) h2.font-display::before{counter-increment:sig-bolum;content:counter(sig-bolum,decimal-leading-zero) ' / ';content:counter(sig-bolum,decimal-leading-zero) ' / ' / '';font-family:var(--font-mono,ui-monospace,monospace);font-size:.42em;letter-spacing:.08em;vertical-align:.55em;color:var(--accent);margin-right:.35em}` +
      // Görsellerde dört köşe işareti (plan/çizim kadrajı)
      `${t('kent')} .property-card .site-media::before{content:'';position:absolute;inset:10px;z-index:2;pointer-events:none;--c:rgb(255 255 255 / .9);background:linear-gradient(var(--c),var(--c)) 0 0/16px 1.5px,linear-gradient(var(--c),var(--c)) 0 0/1.5px 16px,linear-gradient(var(--c),var(--c)) 100% 0/16px 1.5px,linear-gradient(var(--c),var(--c)) 100% 0/1.5px 16px,linear-gradient(var(--c),var(--c)) 0 100%/16px 1.5px,linear-gradient(var(--c),var(--c)) 0 100%/1.5px 16px,linear-gradient(var(--c),var(--c)) 100% 100%/16px 1.5px,linear-gradient(var(--c),var(--c)) 100% 100%/1.5px 16px;background-repeat:no-repeat}` +
      `${HOVER}{${t('kent')} .property-card{transition:outline-offset .35s cubic-bezier(.22,1,.36,1),outline-color .35s;outline:1px solid transparent;outline-offset:2px}${t('kent')} .property-card:hover{outline-color:var(--foreground);outline-offset:7px}${t('kent')} .property-card .site-media::before{transition:inset .4s cubic-bezier(.22,1,.36,1)}${t('kent')} .property-card:hover .site-media::before{inset:16px}}`,
    motion:
      K.wipe + K.grow + K.rise +
      `${OK}{${m('kent')} #hero-baslik{animation:sig-rise 1s cubic-bezier(.22,1,.36,1) both}${m('kent')} ${HERO} .site-media{animation:sig-wipe .9s cubic-bezier(.77,0,.18,1) both}` +
      `${VIEW}{${m('kent')} .property-card .site-media{${inView('sig-wipe', 'entry 0% entry 280px')}}}}` +
      progress('kent', 'var(--foreground)', '3px'),
  },

  // ----------------------------------------------------------------- Doğa (Doğal Yaşam): organik, yumuşak
  doga: {
    static:
      `${t('doga')} .property-card .site-media{border-radius:1.6rem 1.6rem 1.6rem .45rem}` +
      `${t('doga')} section.bg-glow{background-image:radial-gradient(32rem 22rem at 8% 18%,color-mix(in oklab,var(--accent) 16%,transparent),transparent 70%),radial-gradient(28rem 20rem at 92% 82%,color-mix(in oklab,var(--primary) 12%,transparent),transparent 70%)}` +
      `${t('doga')} .eyebrow-line::before{box-shadow:0 0 0 5px color-mix(in oklab,var(--accent) 22%,transparent)}` +
      `${HOVER}{${t('doga')} .property-card .site-media{transition:border-radius .7s cubic-bezier(.22,1,.36,1)}${t('doga')} .property-card:hover .site-media{border-radius:.45rem 1.6rem 1.6rem 1.6rem}${t('doga')} .property-card .site-media img{transition:transform 1s cubic-bezier(.22,1,.36,1)}${t('doga')} .property-card:hover .site-media img{transform:scale(1.06) rotate(-.6deg)}}`,
    motion:
      K.rise + K.pop + K.pulse + K.float +
      `${OK}{${m('doga')} #hero-baslik{animation:sig-rise 1.1s cubic-bezier(.22,1,.36,1) both}${m('doga')} .eyebrow-line::before{animation:sig-pulse 3.4s ease-in-out 1}${m('doga')} ${HERO} .btn{animation:sig-float 2.5s ease-in-out 1.2s 1}` +
      `${VIEW}{${m('doga')} .property-card{${inView('sig-pop', 'entry 0% entry 200px')}}}}` +
      progress('doga', 'linear-gradient(90deg,var(--primary),var(--accent))', '3px'),
  },

  // ----------------------------------------------------------------- Yalın (Yalın Galeri): galeri sessizliği
  yalin: {
    static:
      `${t('yalin')} .property-card .site-media img{filter:saturate(.82) contrast(1.02)}` +
      // Yalnızca metin içi bağlantılar; arka plan rengi ve kart bağlantıları etkilenmez (yalnızca background-image/size)
      `${t('yalin')} main :where(p,li,dd)>a:not(.btn){background-image:linear-gradient(currentColor,currentColor);background-position:0 100%;background-size:0 1px;background-repeat:no-repeat}` +
      `${HOVER}{${t('yalin')} .property-card .site-media img{transition:filter .6s ease,transform 1.2s cubic-bezier(.16,1,.3,1)}${t('yalin')} .property-card:hover .site-media img{filter:none;transform:scale(1.035)}${t('yalin')} main :where(p,li,dd)>a:not(.btn){transition:background-size .35s ease}${t('yalin')} main :where(p,li,dd)>a:not(.btn):hover{background-size:100% 1px}}`,
    motion:
      K.fade + K.rise +
      `${OK}{${m('yalin')} #hero-baslik{animation:sig-rise 1.2s cubic-bezier(.16,1,.3,1) both}` +
      `${VIEW}{${m('yalin')} .listing-grid>*{${inView('sig-fade', 'entry 0% entry 240px')}}${m('yalin')} .listing-grid>*:nth-child(3n+2){animation-range:entry 40px entry 280px}${m('yalin')} .listing-grid>*:nth-child(3n){animation-range:entry 80px entry 320px}}}`,
  },

  // ----------------------------------------------------------------- Grafit (Kurumsal Portföy): cam ve degrade
  grafit: {
    static:
      `${t('grafit')} section[aria-labelledby='rakamlar']>div{position:relative;isolation:isolate}${t('grafit')} section[aria-labelledby='rakamlar']>div::before{content:'';position:absolute;inset:-1px -1rem;z-index:-1;border-radius:1.5rem;background:radial-gradient(40rem 14rem at 15% 0%,color-mix(in oklab,var(--accent) 14%,transparent),transparent 70%),radial-gradient(36rem 16rem at 90% 100%,color-mix(in oklab,var(--primary) 12%,transparent),transparent 70%)}` +
      `${t('grafit')} section[aria-labelledby='rakamlar'] dd.numeric{background:linear-gradient(120deg,var(--primary),var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent}` +
      `@media (forced-colors:active){${t('grafit')} section[aria-labelledby='rakamlar'] dd.numeric{color:CanvasText;background:none}}` +
      // Kartta degrade kenar (üzerine gelince)
      `${t('grafit')} .card-lift{position:relative}${t('grafit')} .card-lift::before{content:'';position:absolute;inset:-1px;border-radius:inherit;padding:1.5px;pointer-events:none;background:linear-gradient(135deg,var(--accent),var(--primary));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0}` +
      `${HOVER}{${t('grafit')} .card-lift::before{transition:opacity .35s ease}${t('grafit')} .card-lift:hover::before{opacity:1}${t('grafit')} .property-card .site-media img{transition:transform .8s cubic-bezier(.22,1,.36,1)}${t('grafit')} .property-card:hover .site-media img{transform:scale(1.05)}}`,
    motion:
      K.rise + K.pop + K.fade +
      `${OK}{${m('grafit')} #hero-baslik{animation:sig-rise 1s cubic-bezier(.22,1,.36,1) both}` +
      `${VIEW}{${m('grafit')} section[aria-labelledby='rakamlar'] dl>div{${inView('sig-pop', 'entry 0% entry 160px')}}${m('grafit')} section[aria-labelledby='rakamlar'] dl>div:nth-child(2n){animation-range:entry 40px entry 200px}${m('grafit')} .listing-grid>*{${inView('sig-fade', 'entry 0% entry 200px')}}}}` +
      progress('grafit', 'linear-gradient(90deg,var(--primary),var(--accent))'),
  },

  // ----------------------------------------------------------------- Atlas (Map First): harita ve rota
  atlas: {
    static:
      `${t('atlas')} main{background-image:radial-gradient(color-mix(in oklab,var(--foreground) 11%,transparent) 1px,transparent 1.3px);background-size:22px 22px}` +
      `${t('atlas')} .eyebrow-line::before{width:2.25rem;height:2px;background:repeating-linear-gradient(90deg,var(--accent) 0 6px,transparent 6px 10px)}` +
      `${t('atlas')} main .lucide-map-pin{color:var(--accent)}` +
      `${HOVER}{${t('atlas')} .property-card .site-media img{transition:transform .8s cubic-bezier(.22,1,.36,1)}${t('atlas')} .property-card:hover .site-media img{transform:scale(1.05)}${t('atlas')} .property-card .lucide-map-pin{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}${t('atlas')} .property-card:hover .lucide-map-pin{transform:translateY(-3px) scale(1.15)}}`,
    motion:
      K.rise + K.route + K.pulse +
      `${OK}{${m('atlas')} #hero-baslik{animation:sig-rise 1s cubic-bezier(.22,1,.36,1) both}${m('atlas')} .eyebrow-line::before{animation:sig-route 1.1s linear 4}${m('atlas')} ${HERO} .lucide-map-pin{animation:sig-pulse 2.6s ease-in-out 2}}` +
      progress('atlas', 'repeating-linear-gradient(90deg,var(--accent) 0 10px,transparent 10px 14px)', '3px'),
  },

  // ----------------------------------------------------------------- Marble: damarlı taş dokusu
  marble: {
    static:
      `${t('marble')} section.bg-glow{background-image:linear-gradient(115deg,transparent 40%,color-mix(in oklab,var(--foreground) 5%,transparent) 41%,transparent 43%),linear-gradient(160deg,transparent 60%,color-mix(in oklab,var(--foreground) 4%,transparent) 61%,transparent 62%)}` +
      `${HOVER}{${t('marble')} .property-card .site-media img{transition:transform 1s cubic-bezier(.22,1,.36,1)}${t('marble')} .property-card:hover .site-media img{transform:scale(1.05)}}`,
    motion: K.rise + `${OK}{${m('marble')} #hero-baslik{animation:sig-rise 1.1s cubic-bezier(.22,1,.36,1) both}}`,
  },

  // ----------------------------------------------------------------- Dergi: dergi sayfası
  dergi: {
    static:
      `${t('dergi')} main>section:not(:first-child) h2.font-display{border-top:3px double var(--foreground);padding-top:.5rem}` +
      `${HOVER}{${t('dergi')} .property-card .site-media img{transition:transform 1s cubic-bezier(.22,1,.36,1),filter .6s}${t('dergi')} .property-card:hover .site-media img{transform:scale(1.04);filter:contrast(1.05)}}`,
    motion: K.rise + K.unveilUp + `${OK}{${m('dergi')} #hero-baslik{animation:sig-rise 1.1s cubic-bezier(.22,1,.36,1) both}${VIEW}{${m('dergi')} .property-card .site-media{${inView('sig-unveil-up', 'entry 0% entry 280px')}}}}`,
  },
};
