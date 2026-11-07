/**
 * Strict-Transport-Security alan adı kararı (D-15 / PF-10, KI-32) birim testleri.
 * KARAYS alan adlarında includeSubDomains; preload, müşteri alan adlarında yalnızca max-age,
 * yerel geliştirme adreslerinde başlık yok. Statik yol kuralları proxy matcher'ının tam tersidir.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { karayHostConfigFromEnv } from '../../src/platform/tenant/host.ts';
import { HSTS_KARAY, HSTS_TENANT, STATIC_ASSET_PATHS, hstsForHost, hstsHostPatterns, hstsStaticHeaderRules } from '../../src/platform/tenant/hsts.ts';

const require = createRequire(import.meta.url);
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match');

const plain = karayHostConfigFromEnv({});
const withKaray = karayHostConfigFromEnv({ KARAY_HOSTS: 'karays.com.tr, www.karays.com.tr', PLATFORM_ROOT_DOMAIN: 'karayapp.com' });

describe('hstsForHost', () => {
  test('KARAYS alan adları, platform kökü ve *.vercel.app: includeSubDomains; preload', () => {
    assert.equal(HSTS_KARAY, 'max-age=63072000; includeSubDomains; preload');
    for (const h of ['karays.com.tr', 'WWW.KARAYS.COM.TR:443', 'karayapp.com', 'www.karayapp.com', 'proje-abc.vercel.app']) assert.equal(hstsForHost(h, withKaray), HSTS_KARAY, h);
    assert.equal(hstsForHost('proje-abc.vercel.app', plain), HSTS_KARAY);
  });
  test('kiracı ve özel alan adları: yalnızca max-age (includeSubDomains/preload yok)', () => {
    assert.equal(HSTS_TENANT, 'max-age=63072000');
    for (const h of ['elvankentgayrimenkul.com', 'www.ornekemlak.com.tr', 'ofis1.karayapp.com', 'karays.com.tr.evil.com', 'vercel.app.evil.com', '', null]) {
      const v = hstsForHost(h, withKaray);
      assert.equal(v, HSTS_TENANT, String(h));
      assert.doesNotMatch(v, /includeSubDomains|preload/);
    }
    // KARAY_HOSTS tanımlı değilken benzer adlar KARAYS sayılmaz
    assert.equal(hstsForHost('karays.com.tr', plain), HSTS_TENANT);
    assert.equal(hstsForHost('karayapp.com', plain), HSTS_TENANT);
  });
  test('yerel geliştirme adresleri: başlık yok', () => {
    for (const h of ['localhost', 'localhost:3000', 'app.localhost', '127.0.0.1:3000', '[::1]:3000']) assert.equal(hstsForHost(h, withKaray), null, h);
  });
});

describe('statik yollar için next.config host kuralları', () => {
  // Next `has`/`missing` değerini ^…$ ile derler ve Host'u portsuz, küçük harfle karşılaştırır
  const hostMatches = (pattern, host) => new RegExp(`^${pattern}$`).test(host.split(':', 1)[0].toLowerCase());
  const staticValue = (host, cfg) => {
    let value = null;
    for (const rule of hstsStaticHeaderRules('/x', cfg)) {
      const has = (rule.has ?? []).every((h) => hostMatches(h.value, host));
      const missing = (rule.missing ?? []).some((h) => hostMatches(h.value, host));
      if (has && !missing) value = rule.headers.find((h) => h.key === 'Strict-Transport-Security').value;
    }
    return value;
  };
  test('hstsForHost ile aynı kararı verir', () => {
    for (const cfg of [plain, withKaray]) {
      for (const h of ['karays.com.tr', 'www.karays.com.tr', 'karayapp.com', 'www.karayapp.com', 'abc-123.vercel.app', 'ofis1.karayapp.com', 'ornekemlak.com', 'karays.com.tr.evil.com', 'xkarayapp.com', 'localhost:3000', 'app.localhost', '127.0.0.1', '[::1]:3000']) {
        assert.equal(staticValue(h, cfg), hstsForHost(h, cfg), `${h} ${JSON.stringify(cfg)}`);
      }
    }
  });
  test('alternatifler gruplanmıştır (^a|b$ hatası yok)', () => {
    const p = hstsHostPatterns(withKaray);
    assert.ok(p.karay.startsWith('(?:') && p.karay.endsWith(')'));
    assert.ok(p.localDev.startsWith('(?:') && p.localDev.endsWith(')'));
  });
});

describe('proxy matcher ve statik HSTS yolları', () => {
  const source = readFileSync(new URL('../../src/proxy.ts', import.meta.url), 'utf8');
  const matcherBlock = source.slice(source.indexOf('matcher: ['), source.indexOf('],', source.indexOf('matcher: [')));
  const matchers = [...matcherBlock.matchAll(/^\s*'([^']+)',?$/gm)].map((m) => m[1].replace(/\\\\/g, '\\'));
  const proxyRuns = (path) => matchers.some((m) => getPathMatch(m)(path) !== false);
  const staticRule = getPathMatch(STATIC_ASSET_PATHS);
  const paths = [
    '/', '/satilik', '/ilan/ornek-3-1', '/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/karay', '/karay/x.png', '/platform', '/platform/x.png',
    '/admin/logo.svg', '/api/x.js', '/t/x/y.css', '/site-onizleme/a.png', '/_next/static/chunks/a.js', '/_next/image', '/_next/static/media/f.woff2',
    '/__nextjs_original-stack-frame', '/favicon.ico', '/demo/a.jpg', '/brand/karays/video/tanitim.webm', '/brand/karays/video/tanitim.vtt',
    '/og-default.png', '/placeholder-property.svg', '/platform.png', '/t.png', '/admin-x/a.png', '/apix.css',
  ];
  test('matcher okunur', () => assert.ok(matchers.length >= 7, String(matchers.length)));
  test('her yol ya proxy ya da statik kural tarafından kapsanır, ikisi birden değil', () => {
    for (const p of paths) {
      const a = proxyRuns(p);
      const b = staticRule(p) !== false;
      assert.ok(a !== b, `${p}: proxy=${a} statik=${b}`);
    }
  });
  test('next.config statik başlıklarında sabit HSTS kalmadı', () => {
    const config = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(config, /key: 'Strict-Transport-Security'/);
    assert.match(config, /hstsStaticHeaderRules\(STATIC_ASSET_PATHS/);
  });
});
