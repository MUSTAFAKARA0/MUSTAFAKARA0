/**
 * D7.3 yüzey desenlerinin CSS'i — YALNIZCA VERİ. SiteFrame bu metinlerden yalnızca sitenin
 * seçtiği desenlerinkini sayfaya satır içi yazar (patterns/styles.ts); seçilmeyen ailenin CSS'i
 * hiçbir kiracının sayfasına girmez, mevcut (standart) desenlerin CSS'i yoktur → eski kiracı
 * çıktısı değişmez. Renk, yazı tipi ve köşe yuvarlaklığı Theme Engine belirteçlerinden gelir
 * (var(--…)): aile yapıyı, tema görünümü belirler.
 */
const BASE =
  '.kp-kicker{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}.kp-track{letter-spacing:.08em}.kp-over{z-index:2}.kp-events{pointer-events:auto}.kp-start{align-self:flex-start}' +
  '.kp-pad-top{padding-top:1.5rem}@media (min-width:640px){.kp-pad-top{padding-top:2.5rem}}';

export const SURFACE_PATTERN_CSS: Record<string, string> = {
  'hero/immersive':
    '.kp-immersive-inner{min-height:inherit;padding-top:8rem;padding-bottom:2.5rem}@media (min-width:640px){.kp-immersive-inner{padding-bottom:3.5rem}}@media (min-width:1024px){.kp-immersive-inner{padding-bottom:5rem}}' +
    '.kp-hero-immersive{min-height:min(88svh,56rem)}' +
    '.kp-immersive-scrim{background:linear-gradient(180deg,rgb(0 0 0/.18) 0%,rgb(0 0 0/0) 30%,rgb(0 0 0/.25) 55%,rgb(0 0 0/.72) 100%)}' +
    '.kp-cta-light{display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 1.4rem;background:#fff;color:#111;font-weight:600;font-size:15px;border-radius:var(--radius-button,999px);transition:transform .3s var(--ease-premium)}.kp-cta-light:hover{transform:translateY(-1px)}' +
    '.kp-link-light{color:rgb(255 255 255/.85);font-size:14.5px;font-weight:500;border-bottom:1px solid rgb(255 255 255/.35);padding-bottom:2px}.kp-link-light:hover{color:#fff;border-color:#fff}',
  'hero/blueprint':
    '.kp-frame-media{aspect-ratio:4/3}@media (min-width:1024px){.kp-rule-grid{column-gap:2.5rem}.kp-index{margin-top:auto}.kp-frame-media{aspect-ratio:auto;height:100%;min-height:520px}}.kp-index-row:hover svg{color:var(--foreground)}' +
    '.kp-rule-grid{border-top:1px solid var(--foreground);padding-top:2rem}' +
    '.kp-index{border-top:1px solid var(--border)}.kp-index-row{display:flex;align-items:center;gap:1rem;padding:.85rem 0;border-bottom:1px solid var(--border);font-size:15px}.kp-index-row:hover{background:linear-gradient(90deg,var(--surface-muted),transparent)}' +
    '.kp-frame{padding:.75rem;border:1px solid var(--border)}.kp-frame::before,.kp-frame::after{content:"";position:absolute;width:14px;height:14px;border-color:var(--foreground);border-style:solid;pointer-events:none}.kp-frame::before{top:-1px;left:-1px;border-width:2px 0 0 2px}.kp-frame::after{right:-1px;bottom:-1px;border-width:0 2px 2px 0}' +
    '.kp-search-rule{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:1.25rem 0}',
  'hero/map-search':
    '.kp-map-canvas{border-radius:var(--radius-card,1.25rem)}' +
    '.kp-map-canvas{background-image:linear-gradient(100deg,var(--surface) 38%,transparent),radial-gradient(var(--border-strong) 1px,transparent 1px);background-size:100% 100%,22px 22px}' +
    '.kp-region-chip{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.7rem .85rem;border:1px solid var(--border);border-radius:calc(var(--radius-card,1rem)*.6);background:var(--surface);font-size:14px;transition:border-color .2s}.kp-region-chip:hover{border-color:var(--primary)}',
  'search/map-first':
    '.kp-district{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;padding:.4rem .8rem;border:1px solid var(--border);border-radius:999px;font-size:13.5px;font-weight:500;color:var(--foreground);background:var(--surface)}.kp-district:hover{border-color:var(--foreground)}.kp-district-on{background:var(--foreground);color:var(--background);border-color:var(--foreground)}',
  'listing/gallery-wide': '.kp-wide-grid{column-gap:2.5rem;row-gap:3.5rem}.kp-wide-media{aspect-ratio:4/5}@media (min-width:640px){.kp-wide-media{aspect-ratio:5/4}}.kp-wide-price{padding-top:.25rem}' + '.kp-wide-grid .site-media{border-radius:calc(var(--radius-card,1rem)*.5)}',
  'listing/ruled-index':
    '.kp-square{aspect-ratio:1}.kp-mute{filter:grayscale(.15)}.group:hover .kp-mute{filter:none}' +
    '.kp-ruled{border-top:1px solid var(--foreground)}.kp-ruled-item{padding:1.25rem 0 1.5rem;border-bottom:1px solid var(--border)}' +
    '@media (min-width:640px){.kp-ruled{column-gap:0}.kp-ruled-item{padding:1.25rem 1.25rem 1.5rem;border-right:1px solid var(--border)}.kp-ruled-item:nth-child(2n){border-right:0}}' +
    '@media (min-width:1280px){.kp-ruled-item:nth-child(2n){border-right:1px solid var(--border)}.kp-ruled-item:nth-child(3n){border-right:0}}' +
    '.kp-ruled .site-media{border-radius:0}.kp-cells{border-top:1px solid var(--border);padding-top:.75rem}.kp-cells>div+div{border-left:1px solid var(--border);padding-left:.75rem}',
  'listing/map-results':
    '.kp-result{grid-template-columns:7.5rem minmax(0,1fr)}@media (min-width:640px){.kp-result{grid-template-columns:10rem minmax(0,1fr)}}@media (min-width:1024px){.kp-map-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:1.5rem}}' +
    '.kp-result{border:1px solid var(--border);border-radius:calc(var(--radius-card,1rem)*.7);background:var(--surface);transition:border-color .2s,box-shadow .2s}.kp-result .site-media{border-radius:calc(var(--radius-card,1rem)*.5)}.kp-result-active,.kp-result:focus-within{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary)}' +
    '.kp-map-pane{height:70svh;border:1px solid var(--border);border-radius:calc(var(--radius-card,1rem)*.7)}@media (min-width:1024px){.kp-map-pane{height:calc(100svh - 8rem)}}' +
    '.kp-pin-wrap{width:auto!important;height:auto!important;background:none;border:0}.kp-pin{display:inline-block;transform:translate(-50%,-100%);white-space:nowrap;padding:3px 9px;border-radius:999px;background:var(--surface);color:var(--foreground);font:600 12.5px/1.4 var(--font-sans);box-shadow:0 1px 3px rgb(0 0 0/.25);border:1px solid var(--border)}.kp-pin-approx{border-style:dashed}.kp-pin-active,.kp-pin:hover{background:var(--primary);color:var(--primary-fg);border-color:var(--primary)}' +
    '.kp-pop{display:flex;flex-direction:column;gap:2px;color:inherit;text-decoration:none}.kp-pop strong{font-size:13.5px}.kp-pop span{font-size:12.5px;opacity:.75}path.kp-area{stroke:var(--primary);fill:var(--primary)}',
  'property-detail/immersive':
    '@media (min-width:768px){.kp-band-grid{grid-template-columns:minmax(0,1fr) minmax(0,380px);align-items:start}}' +
    '.kp-prose .prose-content{font-size:1.1rem;line-height:1.85}.kp-contact-band{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:3.5rem 0}',
  'property-detail/information-first':
    '@media (min-width:1024px){.kp-info-grid{grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:3rem}}' +
    '@media (min-width:1024px){.kp-spec-sheet{border-top:2px solid var(--foreground);padding-top:1.25rem}}.kp-spec-price{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:1rem 0}',
  'property-detail/map-first':
    '.kp-detail-mapbox{height:320px}@media (min-width:1024px){.kp-detail-split{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}.kp-detail-mapbox{height:100%;min-height:420px}}' +
    '.kp-area-link{display:flex;align-items:center;gap:.5rem;padding:.85rem 1rem;border:1px solid var(--border);border-radius:calc(var(--radius-card,1rem)*.7);font-size:14.5px;color:var(--foreground);background:var(--surface)}.kp-area-link:hover{border-color:var(--primary);color:var(--primary-ink)}.kp-detail-map>p{display:none}',
  'gallery/fullscreen':
    '.kp-gallery-fullscreen{background:#0a0a0a}@media (min-width:640px){.kp-gallery-fullscreen .kp-stage-bar{padding-bottom:2rem}.kp-gallery-fullscreen .kp-stage-bar>p{font-size:2.2rem}}' +
    '.kp-stage{height:min(78svh,48rem);min-height:22rem}.kp-stage-bar{background:linear-gradient(0deg,rgb(0 0 0/.6),transparent)}' +
    '.kp-arrow{display:inline-grid;place-items:center;height:2.75rem;min-width:2.75rem;border:1px solid rgb(255 255 255/.45);border-radius:999px;color:#fff;background:rgb(0 0 0/.2);backdrop-filter:blur(6px);transition:background .2s}.kp-arrow:hover{background:rgb(255 255 255/.15)}.kp-arrow-wide{display:inline-flex;gap:.5rem;padding:0 1rem;font-size:14px;font-weight:600}',
  'map/map-first': '',
};

/** Seçili D7.3 desenlerinin (tür/kimlik) CSS'i; hiçbiri seçili değilse boş metin */
export function surfacePatternCss(selected: readonly string[]): string {
  const parts = selected.filter((k) => k in SURFACE_PATTERN_CSS);
  return parts.length ? BASE + parts.map((k) => SURFACE_PATTERN_CSS[k]).join('') : '';
}
