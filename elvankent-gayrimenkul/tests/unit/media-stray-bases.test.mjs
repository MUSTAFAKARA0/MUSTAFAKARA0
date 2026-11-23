/**
 * KI-45: eski varyant tabanlarının işlemeden önce temizlenmesi (src/modules/media/stray-bases.ts) ve media.ts bağlantısı.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidateBases, isStaleBase, pruneStaleBasesIn, STRAY_BASE_MIN_AGE_MS } from '../../src/modules/media/stray-bases.ts';

const mediaSrc = readFileSync(new URL('../../src/app/actions/media.ts', import.meta.url), 'utf8');
const NOW = Date.parse('2026-11-24T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const dir = (name) => ({ name, id: null });
const file = (name, ageMs) => ({ name, id: `id-${name}`, created_at: ago(ageMs), updated_at: ago(ageMs) });
const FOLDER = 'organizations/o/properties/p/images/m';

describe('SB-01 candidateBases', () => {
  test('güncel taban ve dosyalar aday değildir; yalnız taban biçimindeki klasörler', () => {
    const entries = [dir('AbCdEf12'), dir('Zz9_xx00-r90'), dir('Cur00000'), file('original', 0), dir('baska-klasor'), dir('short')];
    assert.deepEqual(candidateBases(entries, `${FOLDER}/Cur00000`), ['AbCdEf12', 'Zz9_xx00-r90']);
  });
  test('güncel taban yoksa (bekleyen satır) tüm tabanlar adaydır', () => {
    assert.deepEqual(candidateBases([dir('AbCdEf12')], null), ['AbCdEf12']);
  });
  test('geçersiz döndürme eki kabul edilmez', () => {
    assert.deepEqual(candidateBases([dir('AbCdEf12-r45')], null), []);
  });
});

describe('SB-02 isStaleBase', () => {
  test('tüm dosyalar 15 dakikadan eskiyse silinebilir', () => {
    assert.equal(isStaleBase([file('w320.webp', STRAY_BASE_MIN_AGE_MS + 1), file('w640.webp', 3_600_000)], NOW), true);
  });
  test('tek bir yeni dosya tabanı korur (eşzamanlı işleme)', () => {
    assert.equal(isStaleBase([file('w320.webp', 3_600_000), file('w640.webp', 5_000)], NOW), false);
  });
  test('boş klasör, varyant dışı dosya ya da okunamayan zaman silinmez', () => {
    assert.equal(isStaleBase([], NOW), false);
    assert.equal(isStaleBase([file('original', 3_600_000)], NOW), false);
    assert.equal(isStaleBase([{ name: 'w320.webp', id: 'x', created_at: null, updated_at: null }], NOW), false);
  });
});

/** Sahte kova: klasör → girdiler; remove çağrılarını kaydeder */
function fakeBucket(tree) {
  const removed = [];
  return {
    removed,
    async list(path) { return { data: tree[path] ?? [], error: null }; },
    async remove(paths) { removed.push(...paths); return { data: paths.map((name) => ({ name })), error: null }; },
  };
}
const OLD = STRAY_BASE_MIN_AGE_MS + 60_000;
const tree = () => ({
  [FOLDER]: [dir('Cur00000'), dir('Old00000'), dir('New00000'), file('original', OLD)],
  [`${FOLDER}/Cur00000`]: [file('w320.webp', OLD)],
  [`${FOLDER}/Old00000`]: [file('w320.webp', OLD), file('w640.webp', OLD)],
  [`${FOLDER}/New00000`]: [file('w320.webp', 1_000)],
});

describe('SB-04 pruneStaleBasesIn', () => {
  test('yalnız eski ve güncel olmayan taban silinir', async () => {
    const b = fakeBucket(tree());
    const out = await pruneStaleBasesIn(b, FOLDER, `${FOLDER}/Cur00000`, { ready: true, now: NOW });
    assert.deepEqual(out, ['Old00000']);
    assert.deepEqual(b.removed.sort(), [`${FOLDER}/Old00000/w320.webp`, `${FOLDER}/Old00000/w640.webp`]);
  });
  test('güncel taban beklenmeyen biçimdeyse (eski demo yolu, sonda eğik çizgi, başka klasör) hiçbir şey silinmez', async () => {
    for (const current of ['/demo/living-room', `${FOLDER}/Cur00000/`, 'organizations/x/properties/y/images/z/Cur00000', `${FOLDER}/`]) {
      const b = fakeBucket(tree());
      assert.deepEqual(await pruneStaleBasesIn(b, FOLDER, current, { ready: true, now: NOW }), [], current);
      assert.equal(b.removed.length, 0, current);
    }
  });
  test('hazır satırın güncel tabanı yoksa hiçbir şey silinmez; bekleyen satırda eski tabanlar silinir', async () => {
    const ready = fakeBucket(tree());
    assert.deepEqual(await pruneStaleBasesIn(ready, FOLDER, null, { ready: true, now: NOW }), []);
    assert.equal(ready.removed.length, 0);
    const pending = fakeBucket(tree());
    assert.deepEqual((await pruneStaleBasesIn(pending, FOLDER, null, { ready: false, now: NOW })).sort(), ['Cur00000', 'Old00000']);
  });
  test('silme hatası raporlanır, döngü devam eder', async () => {
    const b = fakeBucket(tree());
    b.remove = async () => ({ data: null, error: { message: 'x' } });
    const failed = [];
    assert.deepEqual(await pruneStaleBasesIn(b, FOLDER, `${FOLDER}/Cur00000`, { ready: true, now: NOW, onError: (x) => failed.push(x) }), []);
    assert.deepEqual(failed, ['Old00000']);
  });
});

describe('SB-03 media.ts bağlantısı', () => {
  test('processMedia yeni tabanı üretmeden önce eski tabanları temizler', () => {
    const prune = mediaSrc.indexOf('await pruneStaleBases(ctx, media);');
    const base = mediaSrc.indexOf('const publicBase = newPublicBase(media.original_path, rotate);');
    assert.ok(prune > 0 && base > prune);
  });
  test('temizlik public kovada, ortak fonksiyonla, satırın güncel tabanı ve hazır durumu ile; hata işlemeyi durdurmaz', () => {
    const fn = mediaSrc.slice(mediaSrc.indexOf('async function pruneStaleBases'), mediaSrc.indexOf('/**\n * 2. adım'));
    assert.match(fn, /storage\.from\(MEDIA_BUCKETS\.public\)/);
    assert.match(fn, /pruneStaleBasesIn\(/);
    assert.match(fn, /media\.public_base/);
    assert.match(fn, /ready: media\.status === 'ready'/);
    assert.match(fn, /try \{[\s\S]*\} catch/);
    assert.doesNotMatch(fn, /MEDIA_BUCKETS\.originals/);
  });
});
