#!/usr/bin/env node
/**
 * Yerel yazı tipleri (next/font/local) — tekrar üretilebilir paketleme (K-13).
 *
 * Ofis paneli (Manrope, Fraunces) ve KARAY (Poppins) yazı tipleri next/font/google yerine depodaki
 * dosyalardan next/font/local ile yüklenir: build Google Fonts'a hiç bağlanmaz (Google'ın yanıtına
 * bağlı aralıklı build hatası ortadan kalkar). Bu betik o dosyaları ve tanımları ÜRETİR; yalnızca
 * geliştirici çalıştırır, build çalıştırmaz:
 *
 *   1. Her aile için Google Fonts CSS'i next/font'un KENDİ fonksiyonlarıyla, eski next/font/google
 *      çağrısının seçenekleriyle istenir (aynı URL, aynı tarayıcı kimliği) → dosyalar, alt kümeler,
 *      unicode-range'ler ve ağırlıklar eski çıktıyla birebir aynıdır.
 *   2. Manrope ve Fraunces dosyaları Klasik temanın paketleriyle ortaktır (public/fonts/site/,
 *      build-site-fonts.mjs üretir): betik onları yalnızca doğrular, yazmaz. Poppins dosyaları
 *      src/platform/branding/fonts/poppins/ altına içerik özetli adla yazılır.
 *   3. Her alt küme için bir modül yazılır: `export const <Aile> = localFont({...})`. next/font/local
 *      @font-face ailesini değişken adından alır; bir ailenin bütün alt küme modülleri aynı adı
 *      kullandığından tek bir bileşik aile oluşur (Google'ın CSS'indeki gibi: her dosya yalnızca kendi
 *      unicode-range'indeki karakter sayfada geçerse iner). Modüller Google'ın sırasıyla içe aktarılır
 *      (çakışan aralıklarda sonraki tanım önceliklidir; latin en sondadır).
 *   4. Yedek yazı tipi (size-adjust vb.) next/font/google'ın önceden hesaplanmış değerleriyle yazılır
 *      (<aile>-fallback.css). next/font/local'ın dosyadan hesapladığı değerler farklıdır; kullanılmaz.
 *
 * Google bir aileyi güncellerse: önce `node scripts/fonts/build-site-fonts.mjs` (Klasik tema
 * paketleri), sonra bu betik. Lisanslar: assets/fonts/OFL-<Aile>.txt (SIL OFL 1.1).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const G = (m) => require(path.join(ROOT, 'node_modules/next/dist/compiled/@next/font/dist/google', m));
const { validateGoogleFontFunctionCall } = G('validate-google-font-function-call.js');
const { getFontAxes } = G('get-font-axes.js');
const { getGoogleFontsUrl } = G('get-google-fonts-url.js');
const { fetchCSSFromGoogleFonts } = G('fetch-css-from-google-fonts.js');
const { fetchFontFile } = G('fetch-font-file.js');
const { getFallbackFontOverrideMetrics } = G('get-fallback-font-override-metrics.js');

const SUBSETS = ['latin', 'latin-ext'];
/** Eski next/font/google çağrılarıyla aynı seçenekler. files: dosya klasörü; shared: Klasik tema paketiyle ortak (yalnızca doğrulanır) */
const FAMILIES = [
  { fn: 'Manrope', data: { subsets: SUBSETS, variable: '--font-manrope', display: 'optional' }, out: 'src/components/ui/fonts', files: 'public/fonts/site/manrope', shared: true },
  { fn: 'Fraunces', data: { subsets: SUBSETS, variable: '--font-fraunces', display: 'optional', weight: ['400', '500', '600'] }, out: 'src/components/ui/fonts', files: 'public/fonts/site/fraunces', shared: true },
  { fn: 'Poppins', data: { subsets: SUBSETS, weight: ['400', '500', '600'], display: 'swap' }, out: 'src/platform/branding/fonts', files: 'src/platform/branding/fonts/poppins', shared: false },
];

const HEADER = '// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs';
const q = (s) => `'${s}'`;

/** Google'ın CSS'i: her @font-face'in üstünde alt küme yorumu vardır */
function parseFaces(css) {
  const faces = [];
  for (const m of css.matchAll(/\/\* ([a-z0-9-]+) \*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    const prop = (name) => m[2].match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
    const url = m[2].match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)?.[1];
    const face = { subset: m[1], style: prop('font-style'), weight: prop('font-weight'), unicodeRange: prop('unicode-range'), url };
    for (const [k, v] of Object.entries(face)) if (!v) throw new Error(`@font-face çözümlenemedi (${k}): ${m[0].slice(0, 200)}`);
    faces.push(face);
  }
  if (faces.length !== (css.match(/@font-face/g) ?? []).length) throw new Error('Google CSS biçimi beklenenden farklı (alt küme yorumu olmayan @font-face)');
  return faces;
}

for (const { fn, data, out, files, shared } of FAMILIES) {
  const { fontFamily, weights, styles, display, selectedVariableAxes } = validateGoogleFontFunctionCall(fn, data);
  const axes = getFontAxes(fontFamily, weights, styles, selectedVariableAxes);
  const url = getGoogleFontsUrl(fontFamily, axes, display);
  const faces = parseFaces(await fetchCSSFromGoogleFonts(url, fontFamily, false));
  const id = fontFamily.toLowerCase();
  const outDir = path.join(ROOT, out);
  const fileDir = path.join(ROOT, files);
  mkdirSync(outDir, { recursive: true });
  if (!shared) {
    rmSync(fileDir, { recursive: true, force: true });
    mkdirSync(fileDir, { recursive: true });
  }

  // Dosyalar: içerik özetli ad (build-site-fonts.mjs ile aynı adlandırma)
  const local = new Map();
  for (const u of new Set(faces.map((f) => f.url))) {
    const buf = await fetchFontFile(u, false);
    const name = `${createHash('sha256').update(buf).digest('hex').slice(0, 16)}.woff2`;
    const file = path.join(fileDir, name);
    if (shared) {
      if (!existsSync(file) || !readFileSync(file).equals(buf)) {
        throw new Error(`${files}/${name} yok ya da farklı: Google ${fontFamily} dosyasını güncellemiş. Önce scripts/fonts/build-site-fonts.mjs çalıştırın (Klasik tema ile panel aynı dosyaları kullanır).`);
      }
    } else writeFileSync(file, buf);
    local.set(u, `./${path.relative(outDir, file)}`.replace(/^\.\/\.\.\//, '../'));
  }

  // Alt kümeler Google'ın sırasıyla; latin (ön yüklenen, değişkeni ve yedeği taşıyan) en sonda olmalı
  const subsets = [...new Set(faces.map((f) => f.subset))];
  const primary = subsets.at(-1);
  if (primary !== 'latin') throw new Error(`${fontFamily}: son alt küme latin değil (${primary}); birincil modül seçimi gözden geçirilmeli`);
  for (const old of readdirSync(outDir).filter((f) => f.startsWith(`${id}-`) && f.endsWith('.ts'))) rmSync(path.join(outDir, old));

  for (const subset of subsets) {
    const own = faces.filter((f) => f.subset === subset);
    const ranges = new Set(own.map((f) => f.unicodeRange));
    if (ranges.size !== 1) throw new Error(`${fontFamily} ${subset}: ağırlıklar arasında unicode-range farklı`);
    const src = own.map((f) => `    { path: ${q(local.get(f.url))}, weight: ${q(f.weight)}, style: ${q(f.style)} },`).join('\n');
    const opts = [
      `  src: [\n${src}\n  ],`,
      `  display: ${q(display)},`,
      `  preload: ${SUBSETS.includes(subset)},`,
      `  adjustFontFallback: false,`,
      `  declarations: [{ prop: 'unicode-range', value: ${q([...ranges][0])} }],`,
      ...(subset === primary ? [...(data.variable ? [`  variable: ${q(data.variable)},`] : []), `  fallback: [${q(`${fontFamily} Fallback`)}],`] : []),
    ];
    const role = subset === primary ? 'birincil alt küme: CSS değişkeni, sınıf ve yedek yazı tipi bu modülden' : 'yalnızca @font-face (aile adı birincil modülle aynı)';
    writeFileSync(
      path.join(outDir, `${id}-${subset}.ts`),
      `${HEADER}\nimport localFont from 'next/font/local';\n\n/** ${fontFamily} · ${subset} — ${role} */\nexport const ${fontFamily} = localFont({\n${opts.join('\n')}\n});\n`,
    );
  }

  const m = getFallbackFontOverrideMetrics(fontFamily);
  if (!m) throw new Error(`${fontFamily}: yedek yazı tipi metrikleri yok`);
  writeFileSync(
    path.join(outDir, `${id}-fallback.css`),
    `/* ${HEADER.slice(3)} */\n/* ${fontFamily} yedeği: next/font'un Google yazı tipleri için önceden hesapladığı metrikler (düzen kayması olmaz) */\n` +
      `@font-face {\n  font-family: '${fontFamily} Fallback';\n  src: local('${m.fallbackFont}');\n  ascent-override: ${m.ascentOverride};\n  descent-override: ${m.descentOverride};\n  line-gap-override: ${m.lineGapOverride};\n  size-adjust: ${m.sizeAdjust};\n}\n`,
  );

  const sideEffects = subsets.filter((s) => s !== primary).map((s) => `import './${id}-${s}';`);
  writeFileSync(
    path.join(outDir, `${id}.ts`),
    `${HEADER}\n// ${fontFamily}: alt küme modülleri Google'ın CSS sırasıyla (çakışan aralıklarda sonraki tanım önceliklidir)\n` +
      `import './${id}-fallback.css';\n${sideEffects.join('\n')}\n\nexport { ${fontFamily} as ${id} } from './${id}-${primary}';\n`,
  );
  console.log(`${fontFamily}: ${faces.length} @font-face, ${local.size} dosya (${shared ? 'Klasik tema paketiyle ortak, doğrulandı' : 'yazıldı'}), ${subsets.length} alt küme: ${subsets.join(', ')}`);
}
