/** KARAYS tanıtım sayfası katman sınırı (eslint karayPublic bölgesini tamamlar): yasak bölgelerden içe aktarma yok. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const FORBIDDEN = /from\s+'@\/(site-engine|site-factory|site-preview|site-editor|components\/(admin|platform|site-editor)|app\/(admin|platform|site-onizleme))(\/|')/;
const dirs = ['../../src/components/karay/', '../../src/app/karay/'].map((d) => new URL(d, import.meta.url));

test('src/components/karay ve src/app/karay dosyaları yasak katmanlardan içe aktarmaz', () => {
  let n = 0;
  for (const dir of dirs) {
    for (const f of readdirSync(dir).filter((x) => /\.(tsx?|mjs)$/.test(x))) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      for (const line of src.split('\n').filter((l) => /^\s*(import|export)\b.*from\s+'/.test(l))) {
        assert.doesNotMatch(line, FORBIDDEN, `${f}: ${line.trim()}`);
        n++;
      }
    }
  }
  assert.ok(n > 40, `${n} içe aktarma tarandı`);
});
