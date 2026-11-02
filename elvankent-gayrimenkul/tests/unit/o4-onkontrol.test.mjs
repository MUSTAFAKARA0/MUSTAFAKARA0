/**
 * O4-xx · O-4 yayın öncesi son kontroller (.github/workflows/elvankent-o4-onkontrol.yml + elvankent-o4-e2e.yml).
 *
 *   O4-01  Yalnız sabit commit'ler okunur (yayın 650fd4e, taban ff2f7da); push / dağıtım / sır / artifact yok;
 *          Node 22 ve 24 matrisi; npm audit bastırılmaz (|| true, --audit-level düşürme, continue-on-error yok).
 *   O4-02  E2E test düzeneği düzeltmesi YALNIZ playwright.config.ts kanal satırı ve git'in yok saydığı fixture;
 *          iş başka dosya değişirse durur. Aday, tabanda olmayan E2E başarısızlığı getirirse karşılaştırma kırmızı.
 *   O4-03  run betikleri bash sözdizimine uygun.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const code = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const main = read('../.github/workflows/elvankent-o4-onkontrol.yml');
const e2e = read('../.github/workflows/elvankent-o4-e2e.yml');
const RELEASE = '650fd4e1f217234b40c0560dbe7dd8a365b4039e';
const BASE = 'ff2f7da5444b39b837cf36af7d04526ba44e92e7';

describe('O4-01 salt okunur, sabit commit, Node 22/24, audit bastırılmaz', () => {
  test('sabit SHA ve ağaç; yalnız okuma izni; sır / artifact / push yok', () => {
    assert.match(main, new RegExp(`RELEASE_SHA: ${RELEASE}`));
    assert.match(main, /RELEASE_TREE: 29f81af937b1f211c04b1d25db6e396c8b59a146/);
    assert.match(main, new RegExp(`ref: ${BASE}\\n {6}variant: baseline`));
    assert.match(main, new RegExp(`ref: ${RELEASE}\\n {6}variant: candidate`));
    for (const wf of [main, e2e]) {
      const c = code(wf);
      assert.match(c, /\npermissions:\n {2}contents: read\n/);
      assert.doesNotMatch(c, /secrets\.|upload-artifact|git push|vercel|continue-on-error/i);
      assert.match(c, /persist-credentials: false/);
    }
  });
  test("Node matrisi ['22', '24'] ve sürüm denetimi", () => {
    assert.match(main, /node: \['22', '24'\]/);
    assert.match(main, /node-version: \$\{\{ matrix\.node \}\}/);
    assert.match(main, /case "\$v" in "v\$WANT"\.\*\)/);
  });
  test('npm audit yüksek/kritik ve bastırılmadan; kritik güvenlik testleri (npm test) koşar', () => {
    const line = code(main).split('\n').find((l) => l.includes('npm audit'));
    assert.equal(line.trim(), 'run: npm audit --omit=dev --audit-level=high');
    assert.match(main, /Kritik güvenlik testleri[^\n]*\n {8}run: npm test\n/);
    assert.match(main, /run: npm run test:unit\n/);
    assert.match(main, /run: npm run build\n/);
  });
});

describe('O4-02 E2E: yalnız test düzeneği düzeltmesi; yeni başarısızlık kırmızı', () => {
  test('düzeltme yalnız kanal satırı + yok sayılan fixture; başka değişiklik → dur', () => {
    assert.match(e2e, /sed -i "0,\/\^ {4}userAgent,\\\$\/s\/\/ {4}userAgent,\\n {4}channel: 'chromium',\/" playwright\.config\.ts/);
    assert.match(e2e, /\[ "\$changed" = " M elvankent-gayrimenkul\/playwright\.config\.ts" \]/);
    assert.match(e2e, /git check-ignore tests\/e2e\/\.fixtures\/kabul-logo\.png/);
    assert.doesNotMatch(code(e2e), /src\//, 'uygulama koduna dokunulmaz');
  });
  test('karşılaştırma: aday tabanda olmayan başarısızlık getirirse ya da daha az test koşarsa kırmızı', () => {
    assert.match(main, /if \(added\.length\) fail\(/);
    assert.match(main, /if \(cand\.total < base\.total\) fail\(/);
    assert.match(main, /if \(!env\.BASE_E2E \|\| !env\.CAND_E2E\) fail\(/);
  });
});

describe('O4-03 run betikleri', () => {
  test('bash -n', () => {
    for (const [name, text] of [['onkontrol', main], ['e2e', e2e]]) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        if (!/^\s*(?:- )?run: \|$/.test(lines[i])) continue;
        const body = [];
        let indent = null;
        for (let j = i + 1; j < lines.length; j += 1) {
          if (lines[j].trim() === '') { body.push(''); continue; }
          const ind = lines[j].match(/^\s*/)[0].length;
          if (indent === null) indent = ind;
          if (ind < indent) break;
          body.push(lines[j].slice(indent));
        }
        const r = spawnSync('bash', ['-n'], { input: body.join('\n'), encoding: 'utf8' });
        assert.equal(r.status, 0, `${name}:${i + 1} ${r.stderr}`);
      }
    }
  });
});
