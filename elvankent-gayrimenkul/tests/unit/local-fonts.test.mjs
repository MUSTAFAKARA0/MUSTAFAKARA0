/**
 * K-13 — yerel yazı tipleri: build Google Fonts'a bağlanmaz.
 *
 * Ofis paneli (Manrope, Fraunces) ve KARAY (Poppins) yazı tipleri next/font/local ile depodaki
 * dosyalardan yüklenir (scripts/fonts/build-local-fonts.mjs üretir). Google'ın yanıtına bağlı
 * aralıklı build hatası (next/font/google) bu sayede ortadan kalktı. Bu testler harici yazı tipi
 * kullanımının geri eklenmesini ve yerel tanımların bozulmasını yakalar.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { FONT_PACKAGES } from '@/theme-engine/typography/packages.generated';

const ROOT = new URL('../..', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const { getFallbackFontOverrideMetrics } = require('next/dist/compiled/@next/font/dist/google/get-fallback-font-override-metrics.js');

/** Build girdileri: kaynak, statik dosyalar ve kökteki yapılandırma (scripts/ build'e girmez) */
const SCAN = ['src', 'public'];
const ROOT_FILES = ['next.config.ts', 'postcss.config.mjs', 'package.json'];
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|html|json|svg|md)$/;
const FORBIDDEN = [
  [/next\/font\/google/, 'next/font/google (build sırasında Google Fonts\'a bağlanır)'],
  [/@next\/font/, '@next/font (eski paket)'],
  [/fonts\.googleapis\.com|fonts\.gstatic\.com/, 'Google Fonts adresi'],
  [/@import\s+(url\()?\s*['"]?(https?:)?\/\//i, 'harici CSS @import'],
];

/** Ailenin tanım klasörü: [aile, klasör, birincil modülün değişkeni] */
const FAMILIES = [
  ['Manrope', 'src/components/ui/fonts', '--font-manrope'],
  ['Fraunces', 'src/components/ui/fonts', '--font-fraunces'],
  ['Poppins', 'src/platform/branding/fonts', null],
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (TEXT.test(e.name)) out.push(p);
  }
  return out;
}

/** Üretilmiş bir alt küme modülünün next/font/local seçenekleri (kaynak metinden; modül Next dışında çalıştırılamaz) */
function readModule(file) {
  const text = readFileSync(file, 'utf8');
  return {
    text,
    exportName: text.match(/export const (\w+) = localFont\(\{/)?.[1],
    usesLocal: /^import localFont from 'next\/font\/local';$/m.test(text),
    srcs: [...text.matchAll(/\{ path: '([^']+)', weight: '([^']+)', style: '([^']+)' \}/g)].map((m) => ({ path: path.resolve(path.dirname(file), m[1]), weight: m[2], style: m[3] })),
    range: text.match(/declarations: \[\{ prop: 'unicode-range', value: '([^']+)' \}\]/)?.[1],
    noAutoFallback: /adjustFontFallback: false,/.test(text),
    fallback: text.match(/fallback: \['([^']+)'\]/)?.[1] ?? null,
    variable: text.match(/variable: '([^']+)'/)?.[1] ?? null,
  };
}

/** Ailenin index modülünün içe aktarma sırası (alt kümeler) ve birincil modülü */
function familyIndex(family, dir) {
  const id = family.toLowerCase();
  const text = readFileSync(path.join(ROOT, dir, `${id}.ts`), 'utf8');
  const order = [...text.matchAll(new RegExp(`^(?:import|export \\{ ${family} as ${id} \\} from) '\\./${id}-([a-z0-9-]+)';$`, 'gm'))].map((m) => m[1]);
  const primary = text.match(new RegExp(`^export \\{ ${family} as ${id} \\} from '\\./${id}-([a-z0-9-]+)';$`, 'm'))?.[1];
  return { id, text, order, primary, fallbackCss: text.includes(`import './${id}-fallback.css';`) };
}

describe('K-13 yerel yazı tipleri', () => {
  test('LF-01: build girdilerinde harici yazı tipi kullanımı yok (next/font/google, Google Fonts adresi, harici @import)', () => {
    const files = [...SCAN.flatMap((d) => walk(path.join(ROOT, d))), ...ROOT_FILES.map((f) => path.join(ROOT, f)).filter(existsSync)];
    assert.ok(files.length > 100, `taranan dosya sayısı beklenenden az: ${files.length}`);
    const found = [];
    for (const f of files) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const [re, why] of FORBIDDEN) if (re.test(line)) found.push(`${path.relative(ROOT, f)}:${i + 1} — ${why}`);
        });
    }
    assert.deepEqual(found, [], `Yazı tipleri yerel olmalı (next/font/local; scripts/fonts/build-local-fonts.mjs):\n${found.join('\n')}`);
  });

  for (const [family, dir, variable] of FAMILIES) {
    test(`LF-02 ${family}: alt küme modülleri next/font/local, aynı aile adı, unicode-range ve diskteki woff2 dosyaları`, () => {
      const { id, order } = familyIndex(family, dir);
      const modules = readdirSync(path.join(ROOT, dir)).filter((f) => f.startsWith(`${id}-`) && f.endsWith('.ts'));
      assert.deepEqual(modules.map((f) => f.slice(id.length + 1, -3)).sort(), [...order].sort(), `${family}: index her alt küme modülünü içe aktarmalı`);
      assert.ok(order.includes('latin') && order.includes('latin-ext'), `${family}: latin ve latin-ext alt kümeleri`);
      for (const sub of order) {
        const m = readModule(path.join(ROOT, dir, `${id}-${sub}.ts`));
        assert.ok(m.usesLocal, `${id}-${sub}: next/font/local`);
        // next/font/local @font-face ailesini değişken adından alır: bütün alt kümeler aynı bileşik aile
        assert.equal(m.exportName, family, `${id}-${sub}: dışa aktarılan ad aile adı olmalı`);
        assert.ok(m.range && /^U\+[0-9A-F]/.test(m.range), `${id}-${sub}: unicode-range`);
        assert.ok(m.noAutoFallback, `${id}-${sub}: adjustFontFallback: false (yedek metrikleri ${id}-fallback.css)`);
        assert.ok(m.srcs.length > 0, `${id}-${sub}: src`);
        for (const s of m.srcs) {
          assert.ok(existsSync(s.path), `${id}-${sub}: dosya yok: ${path.relative(ROOT, s.path)}`);
          assert.equal(readFileSync(s.path).subarray(0, 4).toString('latin1'), 'wOF2', `${id}-${sub}: woff2 değil: ${path.relative(ROOT, s.path)}`);
          assert.equal(s.style, 'normal', `${id}-${sub}: stil`);
        }
      }
    });

    test(`LF-03 ${family}: birincil modül latin; sıra Google'ınki gibi; CSS değişkeni ve yedek yazı tipi korunur`, () => {
      const { id, order, primary, fallbackCss } = familyIndex(family, dir);
      // Çakışan unicode-range'lerde (ör. ı U+0131) sonraki tanım önceliklidir: latin en sonda
      assert.equal(primary, 'latin');
      assert.equal(order.at(-1), 'latin');
      assert.ok(fallbackCss, `${id}.ts: ${id}-fallback.css içe aktarılmalı`);
      for (const sub of order) {
        const m = readModule(path.join(ROOT, dir, `${id}-${sub}.ts`));
        assert.equal(m.fallback, sub === primary ? `${family} Fallback` : null, `${id}-${sub}: yedek aile`);
        assert.equal(m.variable, sub === primary ? variable : null, `${id}-${sub}: CSS değişkeni`);
      }
      // Yedek metrikleri next/font/google'ın önceden hesapladığı değerlerle aynı (düzen kayması olmaz)
      const css = readFileSync(path.join(ROOT, dir, `${id}-fallback.css`), 'utf8');
      const m = getFallbackFontOverrideMetrics(family);
      assert.match(css, new RegExp(`font-family: '${family} Fallback';`));
      assert.match(css, new RegExp(`src: local\\('${m.fallbackFont}'\\);`));
      for (const [prop, value] of [['ascent-override', m.ascentOverride], ['descent-override', m.descentOverride], ['line-gap-override', m.lineGapOverride], ['size-adjust', m.sizeAdjust]]) {
        assert.ok(css.includes(`${prop}: ${value};`), `${id}-fallback.css: ${prop} ${value}`);
      }
    });

    test(`LF-04 ${family}: OFL lisansı depoda`, () => {
      const file = path.join(ROOT, `assets/fonts/OFL-${family}.txt`);
      assert.ok(existsSync(file), `assets/fonts/OFL-${family}.txt yok`);
      const text = readFileSync(file, 'utf8');
      assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1/);
      assert.match(text, new RegExp(`^Copyright \\d{4} The ${family} Project Authors`, 'm'));
    });
  }

  // unicode-range karşılaştırılmaz: panel Google'ın güncel CSS'indeki aralıkları taşır (K-13 öncesi çıktıyla
  // aynı); tema paketi build-site-fonts.mjs'in çalıştırıldığı günün kopyasıdır (latin-ext'te U+20C1-20C4 eksik;
  // dosyada bu karakterlerin glifi yok, görünüm farkı yok).
  test('LF-05: paneldeki Manrope ve Fraunces, Klasik tema paketiyle aynı dosyaları (ağırlık ve stilleriyle) kullanır', () => {
    for (const [family, dir] of FAMILIES.filter(([f]) => f !== 'Poppins')) {
      const id = family.toLowerCase();
      const theme = [...FONT_PACKAGES[id].css.matchAll(/@font-face\{font-family:'([^']+)';font-style:([^;]+);font-weight:([^;]+);[^}]*src:url\(([^)]+)\)/g)]
        .filter((m) => m[1] === family)
        .map((m) => `${m[3]} ${m[2]} ${path.join(ROOT, 'public', m[4])}`);
      const { order } = familyIndex(family, dir);
      const local = order.flatMap((sub) => readModule(path.join(ROOT, dir, `${id}-${sub}.ts`)).srcs.map((s) => `${s.weight} ${s.style} ${s.path}`));
      assert.ok(theme.length > 0, `${id}: tema paketi`);
      assert.deepEqual([...local].sort(), [...theme].sort(), `${family}: panel ve Klasik tema farklı dosyalar kullanıyor — scripts/fonts/build-site-fonts.mjs ve build-local-fonts.mjs'i birlikte çalıştırın`);
    }
  });

  test('LF-06: panel ve KARAY yazı tipi modülleri yerel tanımları kullanır', () => {
    const base = readFileSync(path.join(ROOT, 'src/components/ui/base-fonts.ts'), 'utf8');
    assert.match(base, /from '@\/components\/ui\/fonts\/manrope';/);
    assert.match(base, /from '@\/components\/ui\/fonts\/fraunces';/);
    assert.match(readFileSync(path.join(ROOT, 'src/platform/branding/platform-font.ts'), 'utf8'), /from '@\/platform\/branding\/fonts\/poppins';/);
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.ok(!('@next/font' in { ...pkg.dependencies, ...pkg.devDependencies }), '@next/font bağımlılığı');
  });
});
