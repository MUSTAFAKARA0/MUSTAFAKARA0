/**
 * Theme Engine yazı tipi tanımları: kiracı sitesi kataloğu (typography/fonts.ts) ile tema
 * önizlemesi (preview/preview-fonts.ts) aynı aileleri aynı ayarlarla tanımlamalı; tek fark
 * önizlemenin hiçbir yazı tipini önceden yüklememesidir. FONT_CATALOG'daki her yazı tipinin
 * tanımı olmalıdır. Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../src/theme-engine/${p}`, import.meta.url), 'utf8');

/** `const x = Ad({ ... });` tanımları → { değişken: normalize edilmiş çağrı } */
function definitions(source) {
  const out = new Map();
  for (const m of source.matchAll(/^const \w+ = (\w+)\(\{(.*)\}\);$/gm)) {
    const variable = /variable: '([^']+)'/.exec(m[2])[1];
    out.set(variable, { call: `${m[1]}(${m[2].replace(/,?\s*preload: false/, '').replace(/display: '\w+'/, "display: _")})`, preload: !/preload: false/.test(m[2]) });
  }
  return out;
}

const site = definitions(read('typography/fonts.ts'));
const preview = definitions(read('preview/preview-fonts.ts'));
const catalogVars = [...read('typography/catalog.ts').matchAll(/cssVar: '([^']+)'/g)].map((m) => m[1]);

describe('Theme Engine yazı tipleri', () => {
  test('katalogdaki her yazı tipi sitede ve önizlemede tanımlı', () => {
    assert.ok(catalogVars.length >= 10);
    assert.deepEqual([...site.keys()].sort(), [...catalogVars].sort());
    assert.deepEqual([...preview.keys()].sort(), [...catalogVars].sort());
  });
  test('önizleme tanımları siteyle aynı (aile, alt küme, ağırlık)', () => {
    for (const [v, d] of site) assert.equal(preview.get(v).call, d.call, v);
  });
  test('önizleme hiçbir yazı tipini önceden yüklemez; site yalnızca varsayılan çifti yükler', () => {
    for (const [v, d] of preview) assert.equal(d.preload, false, v);
    assert.deepEqual([...site].filter(([, d]) => d.preload).map(([v]) => v).sort(), ['--font-fraunces', '--font-manrope']);
  });
});
