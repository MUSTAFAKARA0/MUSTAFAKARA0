/**
 * Mevcut 9 ailenin "altın" parmak izi hesaplayıcısı (tests/unit/family-golden.test.mjs kullanır).
 * Ailelerin derlenmiş çıktısı, tema CSS'i (3 hareket düzeyi × 2 koyu-izin durumu), tema öznitelikleri
 * ve desen CSS'i SHA-256 ile mühürlenir: yeni aile/tema/desen eklemek bunları DEĞİŞTİRMEMELİDİR.
 */
import { createHash } from 'node:crypto';
import { CATALOG } from '@/site-factory/catalog';
import { compileDesign } from '@/site-factory/compile';
import { applyTheme } from '@/theme-engine/runtime';
import { designCss } from '@/theme-engine/design-css';
import { resolveStyle } from '@/theme-engine/themes';
import { SURFACE_PATTERN_CSS, surfacePatternCss } from '@/components/patterns/surface-css';
import { INTERACTION_CSS } from '@/components/patterns/interaction/styles';
import { patternCss } from '@/components/patterns/styles';
import { parseSiteConfig } from '@/site-config/schema';

export const sha = (s) => createHash('sha256').update(typeof s === 'string' ? s : JSON.stringify(s)).digest('hex');
export const EXISTING_IDS = ['klasik-guven', 'sinematik-vitrin', 'editoryal-luks', 'kurumsal-portfoy', 'yalin-galeri', 'dogal-yasam', 'luxury', 'architectural', 'map-first'];
export const EXISTING_PATTERN_KEYS = Object.keys(SURFACE_PATTERN_CSS).filter((k) => ['hero/immersive','hero/blueprint','hero/map-search','search/map-first','listing/gallery-wide','listing/ruled-index','listing/map-results','property-detail/immersive','property-detail/information-first','property-detail/map-first','gallery/fullscreen','map/map-first','gallery/grid','gallery/carousel','header/transparent','header/structured','header/search-bar','footer/editorial','footer/structured','footer/discovery'].includes(k));

function selectionOf(style) {
  const s = style.slots ?? {};
  const keys = [];
  if (style.hero) keys.push(`hero/${style.hero}`);
  if (style.headerLayout) keys.push(`header/${style.headerLayout}`);
  if (style.footerLayout) keys.push(`footer/${style.footerLayout}`);
  if (s.search) keys.push(`search/${s.search}`);
  if (s.grid) keys.push(`listing/${s.grid}`);
  if (s.listingDetail) keys.push(`property-detail/${s.listingDetail}`);
  if (s.gallery) keys.push(`gallery/${s.gallery}`);
  if (s.mapList) keys.push(`map/${s.mapList}`);
  return { keys, interactions: s.interactions ?? [] };
}

export function computeGolden() {
  const out = { families: {}, patternCss: {}, interactionCss: {} };
  for (const id of EXISTING_IDS) {
    const f = CATALOG.find((x) => x.id === id);
    if (!f) throw new Error(`aile yok: ${id}`);
    const design = compileDesign(f, parseSiteConfig({}));
    const row = { compiled: sha(design), css: {}, attributes: {}, patternCss: '' };
    for (const motion of ['none', 'subtle', 'expressive']) {
      const style = { ...design.style, motion };
      const input = { theme: design.theme, colors: design.colors, typography: design.typography, style };
      row.css[motion] = sha(designCss(design.theme, resolveStyle(input)));
      for (const dark of [false, true]) {
        const applied = applyTheme(input, { primary_color: null, accent_color: null }, dark);
        row.css[`${motion}/full/${dark ? 'dark' : 'light'}`] = sha(applied.css);
        row.attributes[`${motion}/${dark ? 'dark' : 'light'}`] = sha(applied.attributes);
      }
    }
    const sel = selectionOf(design.style);
    row.patternCss = sha(patternCss({ interactions: sel.interactions, surfaces: sel.keys }));
    out.families[id] = row;
  }
  for (const k of EXISTING_PATTERN_KEYS) out.patternCss[k] = sha(surfacePatternCss([k]));
  out.patternCss['(empty)'] = sha(surfacePatternCss([]));
  for (const [k, v] of Object.entries(INTERACTION_CSS)) out.interactionCss[k] = sha(v);
  return out;
}
