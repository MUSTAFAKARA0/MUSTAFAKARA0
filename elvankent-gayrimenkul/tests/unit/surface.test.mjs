/**
 * Alan adı yüzeyi ve istek yönlendirme kararı (KARAY ↔ kiracı ayrımı) birim testleri.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hostSurface, karayHostConfigFromEnv, karayHostKind, resolveRequestSurface, tenantKeyForHost } from '../../src/platform/tenant/host.ts';

const plain = karayHostConfigFromEnv({});
const withRoot = karayHostConfigFromEnv({ PLATFORM_ROOT_DOMAIN: 'karayapp.com' });
const withKaray = karayHostConfigFromEnv({ KARAY_HOSTS: 'karay.com.tr, www.karay.com.tr', PLATFORM_ROOT_DOMAIN: 'karayapp.com' });
const kind = (path, host, cfg = plain) => resolveRequestSurface(path, host, cfg);

describe('Alan adı yüzeyi', () => {
  test('KARAY alan adı, platform kökü ve geliştirme/önizleme adresleri KARAY yüzeyidir', () => {
    assert.equal(hostSurface('karay.com.tr', withKaray), 'karay');
    assert.equal(hostSurface('WWW.KARAY.COM.TR:443', withKaray), 'karay');
    assert.equal(hostSurface('karayapp.com', withRoot), 'shared');
    assert.equal(hostSurface('www.karayapp.com', withRoot), 'shared');
    for (const h of ['localhost:3000', 'app.localhost', '127.0.0.1', '[::1]:3000', 'proje-abc.vercel.app']) assert.equal(hostSurface(h, plain), 'shared', h);
  });
  test('müşteri alan adları ve alt alan adları kiracı yüzeyidir; boş alan adı kiracı sayılır', () => {
    assert.equal(hostSurface('elvankentgayrimenkul.com', withKaray), 'tenant');
    assert.equal(hostSurface('www.ornekemlak.com.tr', plain), 'tenant');
    assert.equal(hostSurface('ofis1.karayapp.com', withRoot), 'tenant');
    assert.equal(hostSurface('', plain), 'tenant');
    assert.equal(hostSurface(null, plain), 'tenant');
    // Kök alan adı tanımlı değilken benzer adlar KARAY sayılmaz
    assert.equal(hostSurface('karayapp.com', plain), 'tenant');
    assert.equal(hostSurface('karay.com.tr.evil.com', withKaray), 'tenant');
  });
});

describe('Kiracı (müşteri) alan adında yönlendirme', () => {
  const host = 'ornekemlak.com';
  test('/ ve site sayfaları kiracı sitesidir', () => {
    for (const p of ['/', '/satilik', '/ilan/ornek-3-1', '/iletisim', '/onizleme/ilan/1']) assert.deepEqual(kind(p, host), { kind: 'tenant-site' }, p);
  });
  test('/admin ofis panelidir', () => {
    assert.deepEqual(kind('/admin', host), { kind: 'panel', area: 'admin' });
    assert.deepEqual(kind('/admin/giris', host), { kind: 'panel', area: 'admin' });
  });
  test('/platform, /platform/*, /api/platform/* ve /karay 404', () => {
    for (const p of ['/platform', '/platform/giris', '/platform/talepler', '/platform/siteler/x/tema', '/api/platform/branding', '/karay', '/karay/yasal/kvkk', '/karay/sitemap.xml'])
      assert.deepEqual(kind(p, host, withKaray), { kind: 'not-found' }, p);
  });
  test('benzer ama farklı yollar etkilenmez (ör. /platformlar, /karaylar kiracı sayfasıdır)', () => {
    assert.deepEqual(kind('/platformlar', host), { kind: 'tenant-site' });
    assert.deepEqual(kind('/karaylar', host), { kind: 'tenant-site' });
  });
  test('ortak API rotaları çalışır', () => {
    for (const p of ['/api/track', '/api/health', '/api/admin/branding', '/api/site-preview']) assert.deepEqual(kind(p, host), { kind: 'api' }, p);
  });
  test('/t iç rotası her alan adında 404', () => {
    assert.deepEqual(kind('/t/elvankent', host), { kind: 'not-found' });
    assert.deepEqual(kind('/t', 'localhost'), { kind: 'not-found' });
  });
});

describe('KARAY alan adlarında yönlendirme', () => {
  test('KARAY alan adında konsol ve KARAY sayfası açılır; kök KARAY sayfasıdır', () => {
    assert.deepEqual(kind('/platform', 'karay.com.tr', withKaray), { kind: 'panel', area: 'platform' });
    assert.deepEqual(kind('/platform/giris', 'karay.com.tr', withKaray), { kind: 'panel', area: 'platform' });
    assert.deepEqual(kind('/api/platform/branding', 'karay.com.tr', withKaray), { kind: 'api' });
    assert.deepEqual(kind('/karay', 'karay.com.tr', withKaray), { kind: 'karay' });
    assert.deepEqual(kind('/', 'karay.com.tr', withKaray), { kind: 'karay-rewrite' });
    // Müşteri girişi bağlantısı KARAY alan adında da çalışır
    assert.deepEqual(kind('/admin/giris', 'karay.com.tr', withKaray), { kind: 'panel', area: 'admin' });
  });
  test('platform kökü ve geliştirme adreslerinde konsol açılır', () => {
    assert.deepEqual(kind('/platform', 'karayapp.com', withRoot), { kind: 'panel', area: 'platform' });
    assert.deepEqual(kind('/platform', 'localhost:3000'), { kind: 'panel', area: 'platform' });
    assert.deepEqual(kind('/platform/giris', 'proje.vercel.app'), { kind: 'panel', area: 'platform' });
    assert.deepEqual(kind('/karay', 'localhost:3000'), { kind: 'karay' });
  });
  test('KARAY_HOSTS tanımlıyken /karay yalnızca KARAY alan adındadır (konsol önizlemede açık kalır)', () => {
    assert.deepEqual(kind('/karay', 'proje.vercel.app', withKaray), { kind: 'not-found' });
    assert.deepEqual(kind('/platform', 'proje.vercel.app', withKaray), { kind: 'panel', area: 'platform' });
    assert.equal(karayHostKind('karay.com.tr', withKaray), 'dedicated');
    assert.equal(karayHostKind('localhost', plain), 'shared');
    assert.equal(karayHostKind('ornekemlak.com', plain), null);
  });
});

describe('Kiracı çözümleme değişmedi', () => {
  const cfg = { defaultSlug: 'varsayilan', platformRootDomain: 'karayapp.com', defaultHosts: ['ornek.com', 'www.ornek.com'] };
  test('özel alan adı, alt alan adı ve varsayılan kiracı', () => {
    assert.equal(tenantKeyForHost('ornekemlak.com', cfg), 'ornekemlak.com');
    assert.equal(tenantKeyForHost('ofis1.karayapp.com', cfg), 'ofis1');
    assert.equal(tenantKeyForHost('localhost:3000', cfg), 'varsayilan');
    assert.equal(tenantKeyForHost('www.ornek.com', cfg), 'varsayilan');
  });
});
