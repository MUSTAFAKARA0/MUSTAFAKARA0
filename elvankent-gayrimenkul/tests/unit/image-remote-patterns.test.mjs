/**
 * SEC-06: next/image yalnızca uygulamanın kendi Supabase adreslerindeki public Storage
 * görsellerini işler. Eşleşme, Next.js'in kendi desen eşleyicisiyle (hasRemoteMatch) sınanır.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { storageImagePatterns } from '../../src/lib/image-remote-patterns.ts';

const require = createRequire(import.meta.url);
const { hasRemoteMatch } = require('next/dist/shared/lib/match-remote-pattern');

const allowed = (patterns, href) => hasRemoteMatch([], patterns, new URL(href));

describe('SEC-06 görsel kaynakları (images.remotePatterns)', () => {
  const own = storageImagePatterns([new URL('https://abcdefgh.supabase.co'), null]);

  test('kendi projenin public Storage görseli izinli', () => {
    assert.equal(allowed(own, 'https://abcdefgh.supabase.co/storage/v1/object/public/media/a/b.webp'), true);
  });

  test('başka bir Supabase projesinin görseli reddedilir', () => {
    assert.equal(allowed(own, 'https://otherproject.supabase.co/storage/v1/object/public/media/x.webp'), false);
  });

  test('kendi projede public olmayan yol ve http reddedilir', () => {
    assert.equal(allowed(own, 'https://abcdefgh.supabase.co/storage/v1/object/sign/media/x.webp'), false);
    assert.equal(allowed(own, 'http://abcdefgh.supabase.co/storage/v1/object/public/media/x.webp'), false);
  });

  test('ayrı Storage adresi ve yerel geliştirme adresi port ile eklenir; tekrarlar birleşir', () => {
    const p = storageImagePatterns([
      new URL('http://127.0.0.1:54321'),
      new URL('https://abcdefgh.storage.supabase.co'),
      new URL('http://127.0.0.1:54321'),
    ]);
    assert.equal(p.length, 2);
    assert.equal(allowed(p, 'http://127.0.0.1:54321/storage/v1/object/public/media/x.webp'), true);
    assert.equal(allowed(p, 'http://127.0.0.1:9999/storage/v1/object/public/media/x.webp'), false);
    assert.equal(allowed(p, 'https://abcdefgh.storage.supabase.co/storage/v1/object/public/media/x.webp'), true);
  });

  test('adres yoksa hiçbir uzak görsele izin verilmez', () => {
    assert.deepEqual(storageImagePatterns([null, undefined]), []);
  });

  // next.config.ts uzantısız göreli içe aktarma kullandığından birim çalıştırıcısında yüklenemez;
  // desenlerin davranışı yukarıda sınanır, burada yalnızca yapılandırmanın bu yardımcıya bağlı
  // olduğu ve joker host desenine dönülmediği denetlenir.
  test('next.config desenleri yardımcıdan alır, joker host deseni yok', () => {
    const config = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8');
    assert.match(config, /remotePatterns\s*=\s*storageImagePatterns\(/);
    assert.doesNotMatch(config, /hostname:\s*['"`][^'"`]*\*/);
  });
});
