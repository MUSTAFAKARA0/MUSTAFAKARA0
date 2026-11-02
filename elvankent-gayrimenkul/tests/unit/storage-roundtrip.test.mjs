/**
 * KI-24 K6 · Storage gidiş-dönüş doğrulaması (scripts/storage-roundtrip-drill.mjs) — sahte YEREL Storage sunucusuyla.
 *
 *   SR-01  Sentetik dosyalar: hepsi geri indirilir, SHA-256 aynı → çıkış 0; nesne adları opak (gerçek yol sunucuya gitmez),
 *          çıktıda dosya adı yok; geçici kova ve nesneleri silinir.
 *   SR-02  Sunucu içeriği bozarsa (tek bayt) → çıkış 1 "SHA-256 farklı"; yükleme hatası → çıkış 1; her durumda kova silinir.
 *   SR-03  Yalıtım: yerel olmayan ya da yol/sorgu/kullanıcı bilgisi içeren adres → çıkış 2, sunucuya HİÇ istek gitmez.
 *   SR-04  Örnek yoksa → çıkış 1 (boş prova "başarılı" sayılmaz).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const root = new URL('../../', import.meta.url).pathname;
const SCRIPT = path.join(root, 'scripts/storage-roundtrip-drill.mjs');

function fakeStorage({ corrupt = false, failUpload = false } = {}) {
  const state = { buckets: new Set(), objects: new Map(), requests: [], everBuckets: [] };
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const url = req.url ?? '';
      state.requests.push(`${req.method} ${url}`);
      if (req.headers.authorization !== 'Bearer yerel-anahtar') { res.writeHead(401).end(); return; }
      let m;
      if (req.method === 'POST' && url === '/storage/v1/bucket') {
        const { id, public: pub } = JSON.parse(body.toString());
        assert.equal(pub, false, 'kova özel olmalı');
        state.buckets.add(id); state.everBuckets.push(id);
        res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      } else if (req.method === 'POST' && (m = url.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/))) {
        if (failUpload) { res.writeHead(500).end(); return; }
        state.objects.set(`${m[1]}/${m[2]}`, body);
        res.writeHead(200).end('{}');
      } else if (req.method === 'GET' && (m = url.match(/^\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)$/))) {
        const obj = state.objects.get(`${m[1]}/${m[2]}`);
        if (!obj) { res.writeHead(404).end(); return; }
        const out = Buffer.from(obj);
        if (corrupt && out.length) out[0] ^= 0xff;
        res.writeHead(200).end(out);
      } else if (req.method === 'DELETE' && (m = url.match(/^\/storage\/v1\/object\/([^/]+)$/))) {
        for (const p of JSON.parse(body.toString()).prefixes) state.objects.delete(`${m[1]}/${p}`);
        res.writeHead(200).end('[]');
      } else if (req.method === 'DELETE' && (m = url.match(/^\/storage\/v1\/bucket\/([^/]+)$/))) {
        if ([...state.objects.keys()].some((k) => k.startsWith(`${m[1]}/`))) { res.writeHead(409).end(); return; }
        state.buckets.delete(m[1]);
        res.writeHead(200).end('{}');
      } else {
        res.writeHead(404).end();
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, state, port: server.address().port })));
}

function run(url, from, extra = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, `--from=${from}`, `--result=${path.join(from, '..', 'sonuc.txt')}`, ...extra], {
      env: { PATH: process.env.PATH, STORAGE_DRILL_URL: url, STORAGE_DRILL_KEY: 'yerel-anahtar' },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (status) => {
      let result = '';
      try { result = readFileSync(path.join(from, '..', 'sonuc.txt'), 'utf8'); } catch { /* yok */ }
      resolve({ status, out, result });
    });
  });
}

function sampleDir(t, count = 6) {
  const dir = mkdtempSync(path.join(tmpdir(), 'karay-k6-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const from = path.join(dir, 'ornek');
  mkdirSync(path.join(from, 'organizations', 'gizli-kurum-kimligi'), { recursive: true });
  for (let i = 0; i < count; i += 1) writeFileSync(path.join(from, 'organizations', 'gizli-kurum-kimligi', `ilan-${i}.jpg`), randomBytes(1000 + i * 777));
  writeFileSync(path.join(from, 'bos-dosya'), '');
  return from;
}

describe('SR-01 sentetik dosyalarla gidiş-dönüş', () => {
  test('hepsi aynı: çıkış 0; opak nesne adları; çıktıda yol yok; kova silinir', async (t) => {
    const fake = await fakeStorage();
    t.after(() => fake.server.close());
    const from = sampleDir(t);
    const r = await run(`http://127.0.0.1:${fake.port}`, from);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /K6 Storage: TAMAM — 7\/7/);
    assert.match(r.result, /^STORAGE=TAMAM$/m);
    assert.match(r.result, /^STORAGE_DOSYA=7$/m);
    assert.doesNotMatch(r.out, /organizations|gizli-kurum|ilan-|bos-dosya/);
    assert.ok(fake.state.requests.every((q) => !/organizations|gizli-kurum|ilan-/.test(q)), 'gerçek yol sunucuya gitmez');
    assert.match(fake.state.everBuckets[0], /^karay-k6-\d+-\d+$/);
    assert.equal(fake.state.buckets.size, 0, 'geçici kova silindi');
    assert.equal(fake.state.objects.size, 0, 'nesneler silindi');
  });
});

describe('SR-02 farklar yakalanır, temizlik her durumda', () => {
  test('sunucu içeriği bozarsa: çıkış 1, SHA-256 farklı, kova silinir', async (t) => {
    const fake = await fakeStorage({ corrupt: true });
    t.after(() => fake.server.close());
    const from = sampleDir(t);
    const r = await run(`http://127.0.0.1:${fake.port}`, from);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /K6 Storage: HATA — 1\/7 SHA-256 aynı \(SHA-256 farklı: 6\)/);
    assert.match(r.result, /^STORAGE=HATA$/m);
    assert.equal(fake.state.buckets.size, 0);
  });
  test('yükleme hatası: çıkış 1, kova silinir', async (t) => {
    const fake = await fakeStorage({ failUpload: true });
    t.after(() => fake.server.close());
    const from = sampleDir(t);
    const r = await run(`http://127.0.0.1:${fake.port}`, from);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /yükleme HTTP 500: 7/);
    assert.equal(fake.state.buckets.size, 0);
  });
});

describe('SR-03 yalıtım: yalnız yerel geçici Storage', () => {
  for (const url of [
    'https://abcdefghijklmnopqrst.supabase.co',
    'http://203.0.113.9:54321',
    'http://localhost.evil.example:54321',
    'http://user@127.0.0.1:PORT',
    'http://127.0.0.1:PORT/storage',
    'http://127.0.0.1:PORT?x=1',
    '',
  ]) {
    test(`reddedilir: ${url || '(boş)'}`, async (t) => {
      const fake = await fakeStorage();
      t.after(() => fake.server.close());
      const from = sampleDir(t);
      const r = await run(url.replace('PORT', String(fake.port)), from);
      assert.equal(r.status, 2, r.out);
      assert.match(r.out, /YALITIM/);
      assert.equal(fake.state.requests.length, 0, 'hiçbir istek gitmez');
    });
  }
});

describe('SR-04 boş örnek başarılı sayılmaz', () => {
  test('dosya yok: çıkış 1', async (t) => {
    const fake = await fakeStorage();
    t.after(() => fake.server.close());
    const dir = mkdtempSync(path.join(tmpdir(), 'karay-k6-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    mkdirSync(path.join(dir, 'ornek'));
    const r = await run(`http://127.0.0.1:${fake.port}`, path.join(dir, 'ornek'));
    assert.equal(r.status, 1, r.out);
    assert.match(r.result, /^STORAGE=HATA$/m);
    assert.equal(fake.state.requests.length, 0);
  });
});
