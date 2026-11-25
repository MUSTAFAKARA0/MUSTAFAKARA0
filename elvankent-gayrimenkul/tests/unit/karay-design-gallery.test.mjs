/**
 * KARAYS sayfası tasarım şeridi (src/components/karay/design-gallery.tsx) — 24.11.2026.
 * Sayfa katman kuralı gereği Site Factory kataloğunu içe aktaramaz; şeritteki aile kimlikleri ve adları
 * katalogla birebir aynı kalmalı, her ailenin görüntüsü depoda bulunmalı.
 * Çalıştırma: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { DESIGN_FAMILIES } from '@/site-factory/families';

const src = readFileSync(new URL('../../src/components/karay/design-gallery.tsx', import.meta.url), 'utf8');
const rows = [...src.matchAll(/\{ id: '([a-z-]+)', name: '([^']+)', text: '([^']+)', shot: (\w+) \}/g)].map((m) => ({ id: m[1], name: m[2], text: m[3], shot: m[4] }));

test('KG-01 şerit katalogdaki tüm aileleri aynı sırayla ve aynı adla gösterir', () => {
  assert.deepEqual(
    rows.map((r) => [r.id, r.name]),
    DESIGN_FAMILIES.map((f) => [f.id, f.name]),
  );
});

test('KG-02 her ailenin görüntüsü statik olarak içe aktarılır ve depoda küçük bir dosyadır', () => {
  for (const r of rows) {
    assert.match(src, new RegExp(`import ${r.shot} from '@/app/karay/_images/aileler/${r.id}\\.webp';`));
    const file = new URL(`../../src/app/karay/_images/aileler/${r.id}.webp`, import.meta.url);
    assert.ok(existsSync(file), r.id);
    assert.ok(statSync(file).size < 120_000, `${r.id} görüntüsü 120 KB altında olmalı`);
  }
});

test('KG-03 kopya sıra ekran okuyuculardan gizli; asıl görsellerin alternatif metni vardır', () => {
  assert.match(src, /aria-hidden=\{copy \|\| undefined\}/);
  assert.match(src, /alt=\{copy \? '' : `\$\{f\.name\} tasarım ailesiyle/);
  const css = readFileSync(new URL('../../src/app/karay/karay.css', import.meta.url), 'utf8');
  // Kopya sıra yalnızca hareket açıkken görünür; hareket yoksa şerit yatay kaydırılan galeridir
  assert.match(css, /\.ky-track > li\.ky-copy \{\s*display: none;/);
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.match(motion, /\.ky-track > li\.ky-copy \{ display: block; \}/);
  assert.match(motion, /animation-play-state: paused/);
});
