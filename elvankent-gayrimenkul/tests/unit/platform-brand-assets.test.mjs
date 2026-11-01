/**
 * K-15 — platform marka dosyaları proxy'nin rota olarak yakaladığı yollarda tutulmaz.
 *
 * Giriş ekranının, /karay header/footer'ının logoları ve platform simgeleri /platform/ altındaydı.
 * Proxy bu yolu (uzantısı ne olursa olsun) konsol rotası sayar ve oturumsuz isteği /platform/giris'e
 * yönlendirir: logo ve simgeler oturum açılmadan yüklenmiyordu. Bu testler PLATFORM_BRAND'deki her
 * dosyanın public/ altında var olduğunu, proxy matcher'ındaki hiçbir önekin altında bulunmadığını ve
 * uzantısının matcher'ın statik dosya olarak geçirdiği uzantılardan olduğunu denetler.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';

const ROOT = new URL('../..', import.meta.url).pathname;
const matcher = (() => {
  const src = readFileSync(path.join(ROOT, 'src/proxy.ts'), 'utf8');
  return src.slice(src.indexOf('matcher:'));
})();
/** '/önek/:path*' girişleri: bu öneklerdeki istekler dosya uzantısıyla bitse de proxy'den geçer */
const PREFIXES = [...matcher.matchAll(/'(\/[a-z-]+)\/:path\*'/g)].map((m) => m[1]);
/** İlk girişin hariç tuttuğu uzantılar: bunlarla biten diğer yollar proxy'ye hiç uğramaz */
const STATIC = new RegExp(`\\.(?:${matcher.match(/\\\\\.\(\?:([a-z0-9?|]+)\)\$/)?.[1]})$`);
const ASSETS = [...Object.values(PLATFORM_BRAND.logos), ...Object.values(PLATFORM_BRAND.icons)];

describe('Platform marka dosyaları (K-15)', () => {
  test('proxy matcher okunur', () => {
    for (const p of ['/platform', '/admin', '/api', '/karay', '/t', '/site-onizleme']) assert.ok(PREFIXES.includes(p), p);
    for (const f of ['a.svg', 'a.png', 'a.ico', 'a.webp']) assert.match(f, STATIC);
  });

  test('her dosya public/ altında vardır', () => {
    assert.ok(ASSETS.length >= 8);
    for (const a of ASSETS) assert.ok(existsSync(path.join(ROOT, 'public', a)), a);
  });

  test('hiçbir dosya proxy öneklerinin altında değildir ve statik dosya olarak sunulur', () => {
    for (const a of ASSETS) {
      for (const p of PREFIXES) assert.ok(!a.startsWith(`${p}/`), `${a} → ${p} rotası`);
      assert.match(a, STATIC, `${a}: uzantı proxy'den geçer`);
    }
  });
});
