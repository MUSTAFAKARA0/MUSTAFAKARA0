/**
 * K-15/K-16 — KARAYS platform markası: görünen ad, onaylı görsel paketi ve dosya yolları.
 *
 * Görünen platform adı KARAYS'tır (eski adı KARAY). /karay rotası, KARAY_HOSTS ve kod adları
 * teknik kimliktir ve değişmez; ancak kullanıcıya görünen metinlerde eski ad kalmamalıdır.
 *
 * Görseller onaylı KARAYS paketindendir (KARAYS_Orijinal_Gorsel_Paketi, VARLIK_LISTESI.json):
 *  - Depodaki her paket dosyası paketteki özgün dosyayla bayt bayt aynıdır (SHA-256): logo yeniden
 *    çizilmez, sıkıştırılmaz, oranı ve renkleri değişmez.
 *  - Sabit adresle istenen simgeler proxy'nin rota olarak yakaladığı yollarda tutulmaz (K-15: /platform
 *    altındaki logo ve simgeler oturumsuz ziyaretçide giriş sayfasına yönleniyordu) ve uzantıları proxy'nin
 *    statik dosya olarak geçirdiği uzantılardandır.
 *  - Paylaşım görseli /karay altındadır (yalnızca KARAYS sayfasının açıldığı adreslerde sunulur).
 *  - Eski KARAY görselleri kaldırılmıştır; kaynakta onlara başvuru kalmaz.
 *  - Maskotlar ve platform logosu kiracı (emlak ofisi) sitesi ve ofis paneli kodundan içe aktarılmaz.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
const ICONS = Object.values(PLATFORM_BRAND.icons);
const sha256 = (file) => createHash('sha256').update(readFileSync(path.join(ROOT, file))).digest('hex');

/** Depodaki dosya → paketteki karşılığı ve VARLIK_LISTESI.json'daki SHA-256 */
const PACKAGE_FILES = {
  'src/platform/branding/assets/karays-logo-yatay.webp': ['01_LOGOLAR/karays-logo-yatay.webp', '3e172a7ecbd2a02a1e7f11b84b344f99ffda690ae735c76ffeff85ad1d7dacdf'],
  'src/platform/branding/assets/karays-amblem.webp': ['01_LOGOLAR/karays-amblem.webp', 'e22a0789be25eb7903d68bf1f9df7b0ebfcf148641c92171ab4ba90c392cf761'],
  'src/platform/branding/assets/karo/KARO-durus.png': ['02_ANA_MASKOT_KARO/KARO-durus.png', '55018528ca177fb61f4526bc9fc41ea183303dfd89dfec8a0c3b7cf07b152bc9'],
  'src/platform/branding/assets/karo/KARO-hareketli.webp': ['04_KARO_ANIMASYON/KARO-hareketli.webp', '819c1ff4c701d86521ade8043744008e5b442966c34fe18b22efe78d72d1d720'],
  'src/platform/branding/assets/karays-helper/karays-yardimci-maskot.png': ['03_YARDIMCI_MASKOT/karays-yardimci-maskot.png', '0eecb942934cad6773efbec0b0df069726fa66650ef603bb74e111f28239c5d9'],
  'public/brand/karays/favicon.ico': ['01_LOGOLAR/favicon.ico', '9d885aee4b800fd18677aebbc8a7450b2e7de2eddb00d8a4b4e741e11b1c0ee3'],
  'public/brand/karays/karays-icon-180.png': ['01_LOGOLAR/karays-icon-180.png', '186f5f4fe4dbb732640be0c3837f35363597a045915ce189586dcbc9033596bb'],
  'public/brand/karays/karays-icon-192.png': ['01_LOGOLAR/karays-icon-192.png', '3cebc610fd4102084563ecd293d012f634a1e96a016d8eb9c57e22202a50edb6'],
  'public/brand/karays/karays-icon-512.png': ['01_LOGOLAR/karays-icon-512.png', '73f873452b29fc3b680231efe220217975682a3a07740e2c716ba7d6de225623'],
};

/** PNG genişlik × yükseklik (IHDR) */
function pngSize(file) {
  const b = readFileSync(path.join(ROOT, file));
  assert.equal(b.toString('latin1', 1, 4), 'PNG', `${file}: PNG değil`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function sources(dir, ext = /\.(ts|tsx)$/) {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sources(p, ext) : ext.test(e.name) ? [p] : [];
  });
}

describe('Platform marka dosyaları (K-15/K-16)', () => {
  test('proxy matcher okunur', () => {
    for (const p of ['/platform', '/admin', '/api', '/karay', '/t', '/site-onizleme']) assert.ok(PREFIXES.includes(p), p);
    for (const f of ['a.svg', 'a.png', 'a.ico', 'a.webp']) assert.match(f, STATIC);
  });

  test('depodaki paket dosyaları onaylı paketle bayt bayt aynıdır (VARLIK_LISTESI.json SHA-256)', () => {
    for (const [file, [origin, hash]] of Object.entries(PACKAGE_FILES)) assert.equal(sha256(file), hash, `${file} ↔ ${origin}`);
  });

  test('simgeler public/brand/karays/ altında, proxy önekleri dışında ve statik uzantılı', () => {
    assert.equal(ICONS.length, 4);
    for (const a of ICONS) {
      assert.ok(a.startsWith('/brand/karays/'), a);
      assert.ok(existsSync(path.join(ROOT, 'public', a)), a);
      assert.ok(Object.hasOwn(PACKAGE_FILES, `public${a}`), `${a}: paket dosyası`);
      for (const p of PREFIXES) assert.ok(!a.startsWith(`${p}/`), `${a} → ${p} rotası`);
      assert.match(a, STATIC, `${a}: uzantı proxy'den geçer`);
    }
    assert.deepEqual(pngSize(`public${PLATFORM_BRAND.icons.apple}`), [180, 180]);
    assert.deepEqual(pngSize(`public${PLATFORM_BRAND.icons.png}`), [192, 192]);
    assert.deepEqual(pngSize(`public${PLATFORM_BRAND.icons.app}`), [512, 512]);
  });

  test('paylaşım görseli /karay altında, 1200 × 630 PNG', () => {
    const { url, width, height } = PLATFORM_BRAND.ogImage;
    assert.ok(url.startsWith('/karay/') && url.endsWith('.png'), url);
    assert.deepEqual(pngSize(`public${url}`), [width, height]);
    assert.deepEqual([width, height], [1200, 630]);
  });

  test('eski KARAY görselleri kaldırıldı; kaynakta onlara başvuru yok', () => {
    for (const old of ['public/brand/karay', 'public/platform', 'public/karay/og-karay.png']) assert.equal(existsSync(path.join(ROOT, old)), false, old);
    const OLD = /\/brand\/karay\/|og-karay\.png|karay-logo-yatay|uygulama-ikonu-|favicon\.svg/;
    const hits = sources('src').filter((f) => OLD.test(readFileSync(path.join(ROOT, f), 'utf8')));
    assert.deepEqual(hits, []);
  });

  test('maskotlar ve platform logosu kiracı sitesi ve ofis paneli kodundan içe aktarılmaz', () => {
    const PLATFORM_IMAGES = /@\/components\/brand\/(karo-mascot|helper-mascot|platform-wordmark)|@\/platform\/branding\/assets\//;
    const tenant = ['src/app/t', 'src/app/admin', 'src/components/admin', 'src/components/layout', 'src/components/home', 'src/components/property', 'src/components/site', 'src/components/patterns'];
    const hits = tenant.flatMap((d) => sources(d)).filter((f) => PLATFORM_IMAGES.test(readFileSync(path.join(ROOT, f), 'utf8')));
    assert.deepEqual(hits, []);
  });
});

/** Yorumlar ayıklanmış kaynak: blok/JSX yorumları ve satır yorumları (https:// gibi adresler korunur) */
function code(file) {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[\s;{}(])\/\/.*$/gm, '$1');
}

describe('Görünen marka adı (K-15)', () => {
  test('platform adı KARAYS', () => {
    assert.equal(PLATFORM_BRAND.name, 'KARAYS');
  });

  test('kaynakta görünen metin olarak eski ad (KARAY) kalmadı', () => {
    // Kelime sınırı: KARAYS, KARAY_HOSTS, KarayHeader gibi tanımlayıcılar eşleşmez
    const OLD = /\bKARAY\b(?!_)|\bKaray\b/;
    const hits = sources('src')
      .map((f) => [f, code(path.join(ROOT, f)).split('\n').find((l) => OLD.test(l))])
      .filter(([, line]) => line)
      .map(([f, line]) => `${f}: ${line.trim().slice(0, 120)}`);
    assert.deepEqual(hits, []);
  });
});
