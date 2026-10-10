#!/usr/bin/env node
/**
 * Site yazı tipi paketleri (Theme Engine › tipografi) — tekrar üretilebilir paketleme.
 *
 * Kiracı siteleri artık katalogdaki bütün yazı tiplerini next/font ile <html>'e bağlamıyor;
 * her site yalnızca kendi seçtiği ailelerin @font-face bildirimlerini satır içi alıyor
 * (src/theme-engine/typography/font-css.ts). Bu betik o bildirimlerin kaynağını üretir:
 *
 *   1. Her aile için Google Fonts CSS'i next/font'un KENDİ fonksiyonlarıyla istenir (aynı URL,
 *      aynı tarayıcı kimliği) → dosyalar ve unicode-range'ler next/font çıktısıyla birebir aynıdır.
 *   2. woff2 dosyaları public/fonts/site/<aile>/ altına içerik özetli adla yazılır.
 *   3. Yedek yazı tipi metrikleri (size-adjust vb.) next/font'un önceden hesaplanmış
 *      değerlerinden alınır (düzen kayması olmaz).
 *   4. src/theme-engine/typography/packages.generated.ts (kiracı sitesi; sunucuda satır içi) ve
 *      public/fonts/site/<aile>/preview.css (tema önizlemesi; <link> ile) yazılır.
 *
 * Yeni yazı tipi: aşağıdaki FONTS listesine ekleyin, `node scripts/fonts/build-site-fonts.mjs`
 * çalıştırın, ids.ts › FONT_IDS ve catalog.ts'e kimliği ekleyin. Mevcut sitelerin sayfaları
 * değişmez (yalnızca o yazı tipini seçen site onu alır).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const G = (m) => require(path.join(ROOT, 'node_modules/next/dist/compiled/@next/font/dist/google', m));
const { validateGoogleFontFunctionCall } = G('validate-google-font-function-call.js');
const { getFontAxes } = G('get-font-axes.js');
const { getGoogleFontsUrl } = G('get-google-fonts-url.js');
const { fetchCSSFromGoogleFonts } = G('fetch-css-from-google-fonts.js');
const { findFontFilesInCss } = G('find-font-files-in-css.js');
const { fetchFontFile } = G('fetch-font-file.js');
const { getFallbackFontOverrideMetrics } = G('get-fallback-font-override-metrics.js');

const SUBSETS = ['latin', 'latin-ext'];
const W = ['400', '500', '600', '700'];
/** [kimlik, next/font işlev adı, CSS değişkeni, ağırlıklar (yoksa değişken yazı tipi)] */
const FONTS = [
  ['manrope', 'Manrope', '--font-manrope', null],
  ['fraunces', 'Fraunces', '--font-fraunces', ['400', '500', '600']],
  ['inter', 'Inter', '--font-inter', W],
  ['playfair', 'Playfair_Display', '--font-playfair', W],
  ['dm-sans', 'DM_Sans', '--font-dm-sans', W],
  ['lora', 'Lora', '--font-lora', W],
  ['cormorant', 'Cormorant_Garamond', '--font-cormorant', W],
  ['space-grotesk', 'Space_Grotesk', '--font-space-grotesk', W],
  ['outfit', 'Outfit', '--font-outfit', W],
  ['newsreader', 'Newsreader', '--font-newsreader', W],
];

const OUT_DIR = path.join(ROOT, 'public/fonts/site');
const OUT_TS = path.join(ROOT, 'src/theme-engine/typography/packages.generated.ts');

rmSync(OUT_DIR, { recursive: true, force: true });
const packages = {};
for (const [id, fn, cssVar, weight] of FONTS) {
  const data = { subsets: SUBSETS, display: 'optional', variable: cssVar, ...(weight ? { weight } : {}) };
  const { fontFamily, weights, styles, display, selectedVariableAxes } = validateGoogleFontFunctionCall(fn, data);
  const axes = getFontAxes(fontFamily, weights, styles, selectedVariableAxes);
  const url = getGoogleFontsUrl(fontFamily, axes, display);
  let css = (await fetchCSSFromGoogleFonts(url, fontFamily, false)).split('body {', 1)[0];
  const files = findFontFilesInCss(css, SUBSETS);
  const dir = path.join(OUT_DIR, id);
  mkdirSync(dir, { recursive: true });
  const preload = [];
  for (const { googleFontFileUrl, preloadFontFile } of files) {
    const buf = await fetchFontFile(googleFontFileUrl, false);
    const name = `${createHash('sha256').update(buf).digest('hex').slice(0, 16)}.woff2`;
    writeFileSync(path.join(dir, name), buf);
    const local = `/fonts/site/${id}/${name}`;
    css = css.split(googleFontFileUrl).join(local);
    if (preloadFontFile) preload.push(local);
  }
  // Google'ın biçimli CSS'i sıkıştırılır (yorumlar ve boşluklar)
  const faces = css
    .replace(/\/\*[^*]*\*\//g, '')
    .replace(/@font-face\s*\{/g, '@font-face{')
    .replace(/\s*\n\s*/g, '')
    .replace(/:\s+/g, ':')
    .replace(/;\s*}/g, '}')
    .replace(/,\s+/g, ',');
  const m = getFallbackFontOverrideMetrics(fontFamily);
  const fallback = m
    ? `@font-face{font-family:'${fontFamily} Fallback';src:local("${m.fallbackFont}");ascent-override:${m.ascentOverride};descent-override:${m.descentOverride};line-gap-override:${m.lineGapOverride};size-adjust:${m.sizeAdjust}}`
    : '';
  packages[id] = { family: fontFamily, cssVar, css: faces + fallback, preload };
  // Tema önizlemesi (KARAY yüzeyleri) için statik dosya: yalnızca önizlenen aile <link> ile yüklenir,
  // "swap" ile (önizlemenin amacı yazı tipini göstermektir); JS paketine yazı tipi verisi girmez.
  writeFileSync(path.join(dir, 'preview.css'), (faces + fallback).replace(/font-display:optional/g, 'font-display:swap'));
  console.log(`${id}: ${files.length} dosya, ${preload.length} ön yükleme`);
}

const header = `// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-site-fonts.mjs
// Site yazı tipi paketleri: her kimlik için @font-face bildirimleri (yerel dosyalar) ve ön yüklenecek
// dosyalar. Yalnızca sitenin seçtiği paketler sayfaya yazılır (typography/font-css.ts).
import type { FontId } from '@/theme-engine/ids';

export interface FontPackage {
  family: string;
  cssVar: string;
  css: string;
  preload: string[];
}

export const FONT_PACKAGES: Record<FontId, FontPackage> = `;
writeFileSync(OUT_TS, `${header}${JSON.stringify(packages, null, 2)};\n`);
console.log('yazıldı:', path.relative(ROOT, OUT_TS));
