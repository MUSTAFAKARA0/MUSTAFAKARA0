/**
 * Production (ff2f7da) için yalnız güvenlik yaması — veritabanına dokunmaz.
 *  SP-01  next ≥ 16.4.1, sharp ≥ 0.35.5 (librsvg ≥ 2.63.2), source-map-js ≥ 1.2.2
 *  SP-02…SP-05  inspectImage dosya imzasını sharp'tan ÖNCE denetler (doğrulama dalındaki 4aa0ae3 ile aynı)
 *  SP-06  zod ≥ 4.6.6
 * Testler doğrulama dalındaki tests/unit/security-backup.test.mjs'ten alınmıştır (yedek bölümleri hariç).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
const json = (p) => JSON.parse(read(p));
const atLeast = (version, min) => {
  const a = version.replace(/^[^\d]*/, '').split('.').map((n) => parseInt(n, 10));
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  return true;
};

const { inspectImage, sniffImageContainer, MediaValidationError } = await import('@/modules/media/processing');
const sharp = (await import('sharp')).default;
// Mevcut ret mesajı metinleri (değişmemeli)
const UNSUPPORTED = 'Bu dosya desteklenmeyen bir formatta. JPG, PNG, WEBP veya AVIF yükleyin.';
const CORRUPT = 'Dosya okunamadı. Bozuk veya desteklenmeyen bir görsel olabilir.';

describe('SP-01 bağımlılıklar yamalı', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  test('next ≥ 16.4.1 (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r)', () => {
    assert.ok(atLeast(pkg.dependencies.next, '16.4.1'), `package.json: ${pkg.dependencies.next}`);
    assert.ok(atLeast(lock.packages['node_modules/next'].version, '16.4.1'), 'kilit dosyası');
    assert.ok(atLeast(json('node_modules/next/package.json').version, '16.4.1'), 'kurulu sürüm');
  });
  test('sharp ≥ 0.35.5 ve librsvg ≥ 2.63.2 (GHSA-wq5f-xc86-pv6w)', () => {
    assert.ok(atLeast(pkg.dependencies.sharp, '0.35.5'), `package.json: ${pkg.dependencies.sharp}`);
    assert.ok(atLeast(lock.packages['node_modules/sharp'].version, '0.35.5'), 'kilit dosyası');
    assert.ok(atLeast(sharp.versions.sharp, '0.35.5'), `kurulu sharp ${sharp.versions.sharp}`);
    assert.ok(atLeast(sharp.versions.rsvg, '2.63.2'), `kurulu librsvg ${sharp.versions.rsvg}`);
  });
  test('kilit dosyasındaki her source-map-js ≥ 1.2.2 (GHSA-68fv-2mgg-jv7q)', () => {
    const entries = Object.entries(lock.packages).filter(([k]) => k.endsWith('node_modules/source-map-js'));
    assert.ok(entries.length > 0);
    for (const [k, v] of entries) assert.ok(atLeast(v.version, '1.2.2'), `${k}: ${v.version}`);
  });
});

describe('SP-02 kabul edilen biçimler', async () => {
  const base = sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 80, b: 40 } } });
  const samples = {
    jpeg: [await base.clone().jpeg().toBuffer(), 'image/jpeg'],
    png: [await base.clone().png().toBuffer(), 'image/png'],
    webp: [await base.clone().webp().toBuffer(), 'image/webp'],
    isobmff: [await base.clone().avif().toBuffer(), 'image/avif'],
  };
  for (const [container, [buf, mime]] of Object.entries(samples)) {
    test(`${container}: imza tanınır, görsel kabul edilir (${mime})`, async () => {
      assert.equal(sniffImageContainer(buf), container);
      assert.deepEqual(await inspectImage(buf), { mime, width: 800, height: 600 });
    });
  }
});

describe('SP-03 SVG ve desteklenmeyen biçimler çözücüye gitmez', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600"/></svg>';
  const variants = {
    'düz SVG': Buffer.from(svg),
    'BOM + boşluk + XML bildirimi': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`\n  <?xml version="1.0"?>\n${svg}`)]),
    'HTML': Buffer.from('<!doctype html><html><body>x</body></html>'),
  };
  for (const [name, buf] of Object.entries(variants)) {
    test(`${name} → unsupported (mevcut mesaj metni)`, async () => {
      assert.equal(sniffImageContainer(buf), 'svg');
      await assert.rejects(inspectImage(buf), (e) => e instanceof MediaValidationError && e.code === 'unsupported' && e.message === UNSUPPORTED);
    });
  }
  test('bozuk SVG çözücüye hiç ulaşmaz (ulaşsaydı librsvg ayrıştırma hatası → "corrupt" olurdu)', async () => {
    const broken = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect');
    await assert.rejects(sharp(broken, { failOn: 'error' }).metadata(), /XML parse error/, 'kontrol: sharp bu dosyayı librsvg ile ayrıştırmayı dener');
    await assert.rejects(inspectImage(broken), (e) => e.code === 'unsupported' && e.message === UNSUPPORTED);
  });
  const base = sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } } });
  for (const [kind, buf] of [['gif', await base.clone().gif().toBuffer()], ['tiff', await base.clone().tiff().toBuffer()]]) {
    test(`${kind} → unsupported (önceki mesaj)`, async () => {
      assert.equal(sniffImageContainer(buf), kind);
      await assert.rejects(inspectImage(buf), (e) => e.code === 'unsupported' && e.message === UNSUPPORTED);
    });
  }
});

describe('SP-04 tanınmayan içerik', () => {
  for (const [name, buf] of [['metin', Buffer.from('merhaba dünya')], ['PDF başlığı', Buffer.from('%PDF-1.7\n')], ['boş', Buffer.alloc(0)], ['kesik JPEG', Buffer.from([0xff, 0xd8])]]) {
    test(`${name} → corrupt (önceki mesaj)`, async () => {
      assert.equal(sniffImageContainer(buf), null);
      await assert.rejects(inspectImage(buf), (e) => e.code === 'corrupt' && e.message === CORRUPT);
    });
  }
  test('imzası doğru ama bozuk JPEG yine sharp hatasıyla "corrupt"', async () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
    assert.equal(sniffImageContainer(buf), 'jpeg');
    await assert.rejects(inspectImage(buf), (e) => e.code === 'corrupt' && e.message === CORRUPT);
  });
});

describe('SP-06 zod ≥ 4.6.6 (GHSA-mrhx-c7xc-m3w5)', () => {
  test('package.json ve kilit dosyası', () => {
    assert.ok(atLeast(json('package.json').dependencies.zod, '4.6.6'));
    assert.ok(atLeast(json('package-lock.json').packages['node_modules/zod'].version, '4.6.6'));
  });
});

describe('SP-05 sıra ve kapsam', () => {
  const src = read('src/modules/media/processing.ts');
  const body = src.slice(src.indexOf('export async function inspectImage'), src.indexOf('export async function processImage'));
  test('inspectImage: imza denetimi sharp çağrısından önce', () => {
    const sniff = body.indexOf('sniffImageContainer(input)');
    const decode = body.indexOf('sharp(input');
    assert.ok(sniff > 0 && decode > 0, 'iki çağrı da var');
    assert.ok(sniff < decode, 'imza denetimi önce');
    assert.match(body, /if \(!DECODABLE\.has\(container\)\) throw/);
  });
  test('çözücüye izin verilen kapsayıcılar yalnızca JPEG, PNG, WebP, HEIF/AVIF', () => {
    assert.match(src, /const DECODABLE: ReadonlySet<ImageContainer> = new Set\(\['jpeg', 'png', 'webp', 'isobmff'\]\);/);
  });
  test('marka (logo) yolu değişmedi: SVG bilerek kabul edilir (karar D-15 bekliyor)', () => {
    const branding = read('src/modules/media/branding.ts');
    assert.match(branding, /looksLikeSvg/);
    assert.match(branding, /\.\.\.\(svg \? \['svg'\] : \[\]\)/);
  });
});
