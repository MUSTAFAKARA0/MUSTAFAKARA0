/** Faz 2: site-ui.css bütçesi ve güvenlik kuralları. */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const css = readFileSync(new URL('../../src/styles/site-ui.css', import.meta.url), 'utf8');
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('Faz 2 › site-ui.css', () => {
  test('CB-01 sıkıştırılmış boyut <= 4 KB', () => {
    const gz = gzipSync(css).length;
    assert.ok(gz <= 4096, `gzip ${gz} B`);
  });
  test('CB-02 @import ve dış/harici url() yok', () => {
    assert.ok(!/@import/.test(stripped));
    assert.ok(!/url\(/.test(stripped));
  });
  /** Dengeli süslü parantezle `@media (prefers-reduced-motion: no-preference) { ... }` bloklarını çıkarır */
  const withoutMotionBlocks = (src) => {
    const marker = '@media (prefers-reduced-motion: no-preference)';
    let out = src;
    for (let i = out.indexOf(marker); i !== -1; i = out.indexOf(marker)) {
      let depth = 0;
      let j = out.indexOf('{', i);
      for (; j < out.length; j++) {
        if (out[j] === '{') depth++;
        if (out[j] === '}' && --depth === 0) break;
      }
      out = out.slice(0, i) + out.slice(j + 1);
    }
    return out;
  };

  test('CB-03 animasyon/geçiş yalnızca hareket tercihi yokken tanımlıdır', () => {
    const outside = withoutMotionBlocks(stripped);
    assert.notEqual(outside.length, stripped.length, 'hareket bloğu bulunamadı');
    assert.ok(!/animation\s*:|transition\s*:|@keyframes/.test(outside), 'hareket tercihi dışında animasyon var');
  });

  test('CB-04 her animasyonun toplamı (gecikme + süre × tekrar) 5 sn altında, sonsuz döngü yok', () => {
    for (const m of stripped.matchAll(/animation\s*:\s*([^;]+);/g)) {
      const decl = m[1];
      assert.ok(!/infinite/.test(decl), `sonsuz animasyon: ${decl}`);
      const times = [...decl.matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map((t) => (t[2] === 'ms' ? Number(t[1]) / 1000 : Number(t[1])));
      const dur = times[0] ?? 0;
      const delay = times[1] ?? 0;
      const iter = Number(/\s(\d+)(?=[\s;]|$)/.exec(decl.replace(/(\d*\.?\d+)(ms|s)\b/g, ''))?.[1] ?? 1);
      assert.ok(delay + dur * iter <= 5, `${decl}: ${delay + dur * iter} sn`);
    }
    for (const m of stripped.matchAll(/transition\s*:[^;]+;/g)) for (const t of m[0].matchAll(/(\d*\.?\d+)s\b/g)) assert.ok(Number(t[1]) <= 5);
  });

  test('CB-05 yalnızca kiracı kökleri içe aktarır', () => {
    const users = ['src/app/t/layout.tsx', 'src/app/site-onizleme/layout.tsx'];
    for (const f of users) assert.ok(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8').includes('@/styles/site-ui.css'));
    for (const f of ['src/app/admin/layout.tsx', 'src/app/platform/layout.tsx', 'src/app/karay/layout.tsx']) {
      assert.ok(!readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8').includes('site-ui.css'), f);
    }
  });
});
