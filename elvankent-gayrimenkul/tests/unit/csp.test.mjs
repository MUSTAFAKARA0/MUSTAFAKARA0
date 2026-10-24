/**
 * CSP ve Supabase adresleri (K-19, D-15 hazırlığı).
 *  - storageUrlFor: env.ts (yükleme adresi) ve next.config.ts (CSP) aynı kuralı kullanır.
 *  - contentSecurityPolicy: uygulamanın kendi adresleri (ana + depolama) her zaman açıkça yazılır;
 *    *.supabase.co joker deseni yalnızca bayrakla eklenir. Joker kapatılınca başka bir Supabase
 *    projesine bağlantı ve görsel izni kalmaz, kendi yükleme adresimiz kalır.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentSecurityPolicy } from '../../src/lib/csp.ts';
import { storageUrlFor } from '../../src/lib/supabase-origins.ts';

const directive = (csp, name) => csp.split('; ').find((d) => d.startsWith(`${name} `))?.split(' ').slice(1) ?? [];

describe('storageUrlFor', () => {
  test('Supabase barındırmalı projede doğrudan depolama adresi türetilir', () => {
    assert.equal(storageUrlFor('https://abcdefgh.supabase.co'), 'https://abcdefgh.storage.supabase.co');
  });
  test('açık adres önceliklidir (sondaki / atılır); özel alan adı ve yerel kurulumda ana adres', () => {
    assert.equal(storageUrlFor('https://abcdefgh.supabase.co', ' https://depo.example.com/ '), 'https://depo.example.com');
    assert.equal(storageUrlFor('https://api.example.com'), 'https://api.example.com');
    assert.equal(storageUrlFor('http://127.0.0.1:54321'), 'http://127.0.0.1:54321');
    assert.equal(storageUrlFor(''), '');
  });
});

describe('contentSecurityPolicy', () => {
  const origins = ['https://abcdefgh.supabase.co', 'https://abcdefgh.storage.supabase.co'];

  test('kendi adresler img-src ve connect-src içinde açıkça yer alır; tekrarlar birleşir', () => {
    const csp = contentSecurityPolicy({ supabaseOrigins: [...origins, origins[0]], supabaseWildcard: false, development: false });
    for (const name of ['img-src', 'connect-src']) {
      const sources = directive(csp, name);
      for (const o of origins) assert.ok(sources.includes(o), `${name}: ${o}`);
      assert.equal(sources.filter((s) => s === origins[0]).length, 1);
    }
  });

  test('joker kapalıyken başka bir Supabase projesine izin yoktur', () => {
    const csp = contentSecurityPolicy({ supabaseOrigins: origins, supabaseWildcard: false, development: false });
    assert.doesNotMatch(csp, /\*\.supabase\.co/);
    assert.ok(!directive(csp, 'connect-src').includes('https://baskaproje.supabase.co'));
  });

  test('joker açıkken (bugünkü yayın) önceki politikayla aynı kaynaklar', () => {
    const csp = contentSecurityPolicy({ supabaseOrigins: origins, supabaseWildcard: true, development: false });
    assert.deepEqual(directive(csp, 'connect-src'), ["'self'", 'https://*.supabase.co', ...origins]);
    assert.deepEqual(directive(csp, 'img-src'), ["'self'", 'data:', 'blob:', 'https://*.supabase.co', ...origins]);
  });

  test("'unsafe-eval' yalnızca geliştirmede; çerçeveleme, base-uri, form ve object kapalı", () => {
    const prod = contentSecurityPolicy({ supabaseOrigins: origins, supabaseWildcard: false, development: false });
    const dev = contentSecurityPolicy({ supabaseOrigins: origins, supabaseWildcard: false, development: true });
    assert.doesNotMatch(prod, /unsafe-eval/);
    assert.match(dev, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
    for (const d of ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'", "default-src 'self'"]) assert.ok(prod.includes(d), d);
  });

  test('next.config CSP\'yi bu modülden kurar; joker kararı (D-15) tek yerde', () => {
    const config = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8');
    assert.match(config, /contentSecurityPolicy\(\{ supabaseOrigins, supabaseWildcard: (true|false), development:/);
    assert.match(config, /storageUrlFor\(supabaseUrl\.origin\)/);
    assert.doesNotMatch(config, /img-src|connect-src/, 'direktifler next.config içinde yeniden yazılmaz');
  });
});
