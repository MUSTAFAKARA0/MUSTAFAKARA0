// Hata izleme (A7): Sentry'ye giden olayda kişisel veri/sır yok; iletim hatası sessiz kalmaz ve uygulamayı düşürmez.
// Gerçek ağ çağrısı yapılmaz: fetch sahtelenir, DSN uydurmadır (sentry.invalid).
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanPath, reportError, scrub } from '../../src/modules/monitoring/report.ts';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DSN = 'https://acikanahtar@sentry.invalid/42';
// Uydurma değerler çalışma anında parçalardan kurulur: dosyada anahtar biçimli sabit durmaz (gitleaks gerçek sır sanmasın).
const JWT = ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJ' + 'zdWIiOiIxMjM0NTY3ODkwIn0', 'c2lnbmF0dXJl' + 'LXBhcnQ'].join('.');
const KEY = ['sb', 'secret', '0123456789' + 'abcdefghij' + 'klmnopqrstuv'].join('_');

let calls;
let logs;
let fetchImpl;
const real = { fetch: globalThis.fetch, error: console.error };

beforeEach(() => {
  calls = [];
  logs = [];
  fetchImpl = async () => new Response(null, { status: 200 });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return fetchImpl(url, init);
  };
  console.error = (line) => logs.push(String(line));
  delete process.env.SENTRY_DSN;
  delete process.env.ERROR_WEBHOOK_URL;
});
afterEach(() => {
  globalThis.fetch = real.fetch;
  console.error = real.error;
  delete process.env.SENTRY_DSN;
  delete process.env.ERROR_WEBHOOK_URL;
});

const warnings = () => logs.map((l) => JSON.parse(l)).filter((l) => l.source === 'monitoring');

describe('MN-01 maskeleme', () => {
  test('e-posta, telefon, JWT ve uzun anahtarlar maskelenir; uzunluk sınırlanır', () => {
    const out = scrub(`Kayıt hatası: ayse.yilmaz@ornek.com.tr, +90 (532) 123 45 67, 12345678901, ${JWT}, ${KEY}`);
    for (const leaked of ['ayse.yilmaz', 'ornek.com', '532', '12345678901', JWT, KEY, 'eyJ']) assert.ok(!out.includes(leaked), leaked);
    assert.match(out, /\[e-posta\]/);
    assert.match(out, /\[telefon\]/);
    assert.equal(scrub('x'.repeat(10) + ' ' + 'kelime '.repeat(400)).length, 1000);
    assert.equal(scrub(undefined), undefined);
    assert.equal(scrub('Sıradan hata: ilan bulunamadı'), 'Sıradan hata: ilan bulunamadı');
  });
  test('yol: sorgu parametreleri ve # parçası atılır (şifre sıfırlama kodu, davet anahtarı)', () => {
    assert.equal(cleanPath('/auth/reset?code=gizli-kod&email=a@b.co'), '/auth/reset');
    assert.equal(cleanPath('/davet/kabul#access_token=abc'), '/davet/kabul');
    assert.equal(cleanPath(undefined), undefined);
  });
});

describe('MN-02 Sentry olayı', () => {
  test('DSN → envelope adresi; olayda kişisel veri, sorgu parametresi, başlık/çerez yok', async () => {
    process.env.SENTRY_DSN = DSN;
    await reportError({
      kind: 'server',
      name: 'TypeError',
      message: `MN-02 müşteri ali@ornek.com 0532 123 45 67 anahtar ${KEY}`,
      stack: `TypeError: ali@ornek.com\n    at handler (/var/task/x.js:1:1) ${JWT}`,
      path: '/admin/ilanlar?token=gizli#parca',
      method: 'POST',
      routePath: '/admin/ilanlar',
      routeType: 'action',
      digest: '1234567',
    });
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, 'https://sentry.invalid/api/42/envelope/');
    assert.deepEqual(Object.keys(init.headers).sort(), ['Content-Type', 'X-Sentry-Auth']);
    assert.match(init.headers['X-Sentry-Auth'], /sentry_key=acikanahtar\b/);
    for (const leaked of ['ali@ornek.com', '0532', KEY, JWT, 'token=gizli', 'parca', 'cookie', 'authorization']) assert.ok(!init.body.toLowerCase().includes(leaked.toLowerCase()), leaked);
    const event = JSON.parse(init.body.split('\n')[2]);
    assert.deepEqual(event.request, { url: '/admin/ilanlar', method: 'POST' });
    assert.equal(event.level, 'error');
    assert.equal(event.platform, 'node');
    assert.equal(event.exception.values[0].type, 'TypeError');
    assert.equal(event.tags.digest, '1234567');
    assert.equal(event.user, undefined); // kullanıcı kimliği, IP veya e-posta hiç eklenmez
    assert.equal(warnings().length, 0);
  });
  test('DSN yoksa dışarı istek gitmez; hata yine tek satır JSON olarak loglanır', async () => {
    await reportError({ kind: 'client', message: 'MN-02b tarayıcı hatası veli@ornek.com', path: '/ilan/1?x=1' });
    assert.equal(calls.length, 0);
    const line = JSON.parse(logs[0]);
    assert.equal(line.level, 'error');
    assert.equal(line.path, '/ilan/1');
    assert.ok(!logs[0].includes('veli@ornek.com'));
    assert.equal(line.stack, undefined);
  });
  test('aynı hata 60 sn içinde dışarıya bir kez gider; log her seferinde yazılır', async () => {
    process.env.SENTRY_DSN = DSN;
    const report = { kind: 'server', message: 'MN-02c tekrar eden hata', path: '/x' };
    await reportError(report);
    await reportError(report);
    assert.equal(calls.length, 1);
    assert.equal(logs.length, 2);
  });
  test('uygulama hatası olmayan durumlar (bağlantı kesildi vb.) raporlanmaz', async () => {
    process.env.SENTRY_DSN = DSN;
    await reportError({ kind: 'client', message: 'The operation was aborted' });
    await reportError({ kind: 'client', message: 'ResizeObserver loop limit exceeded' });
    assert.equal(calls.length, 0);
    assert.equal(logs.length, 0);
  });
});

describe('MN-03 iletim hatası sessiz kalmaz, uygulamayı düşürmez, sır sızdırmaz', () => {
  test('Sentry 401 (yanlış/iptal edilmiş DSN) → uyarı satırı: hedef ve durum kodu', async () => {
    process.env.SENTRY_DSN = DSN;
    fetchImpl = async () => new Response('{"detail":"bad sentry DSN public key"}', { status: 401 });
    await reportError({ kind: 'server', message: 'MN-03a', path: '/a' });
    const w = warnings();
    assert.equal(w.length, 1);
    assert.equal(w[0].level, 'warn');
    assert.equal(w[0].target, 'sentry');
    assert.equal(w[0].reason, 'HTTP 401');
    for (const line of logs) for (const leaked of ['acikanahtar', 'sentry.invalid', 'bad sentry DSN']) assert.ok(!line.includes(leaked), leaked);
  });
  test('ağ hatası / zaman aşımı → yalnız hata türü loglanır (adres içeren mesaj loglanmaz)', async () => {
    process.env.SENTRY_DSN = DSN;
    process.env.ERROR_WEBHOOK_URL = 'https://hooks.invalid/services/T000/B000/gizliwebhook';
    fetchImpl = async (url) => {
      throw new TypeError(`fetch failed: ${url}`);
    };
    await assert.doesNotReject(reportError({ kind: 'server', message: 'MN-03b', path: '/b' }));
    const w = warnings();
    assert.deepEqual(w.map((x) => x.target).sort(), ['sentry', 'webhook']);
    for (const x of w) assert.equal(x.reason, 'TypeError');
    for (const line of logs) for (const leaked of ['gizliwebhook', 'hooks.invalid', 'acikanahtar', 'sentry.invalid']) assert.ok(!line.includes(leaked), leaked);
  });
  test('çözülemeyen DSN → istek gitmez, uyarı yazılır (DSN değeri loglanmaz)', async () => {
    process.env.SENTRY_DSN = 'bozuk-dsn-degeri';
    await reportError({ kind: 'server', message: 'MN-03c', path: '/c' });
    assert.equal(calls.length, 0);
    assert.equal(warnings()[0].reason, 'DSN çözülemedi');
    for (const line of logs) assert.ok(!line.includes('bozuk-dsn-degeri'));
  });
});

describe('MN-04 kaynak: sunucu ve tarayıcı raporları başlık/çerez/gövde taşımaz', () => {
  test('instrumentation yalnız yol, yöntem ve rota bilgisini iletir', () => {
    const code = read('src/instrumentation.ts');
    assert.doesNotMatch(code, /request\.headers|cookies|request\.body/);
    assert.match(code, /path: request\.path/);
  });
  test('tarayıcı uç noktası: çapraz site reddi, boyut sınırı, şema doğrulama, hız sınırı', () => {
    const code = read('src/app/api/monitoring/client-error/route.ts');
    assert.match(code, /sec-fetch-site'\) === 'cross-site'\) return new Response\(null, \{ status: 403 \}\)/);
    assert.match(code, /raw\.length > 8000\) return new Response\(null, \{ status: 413 \}\)/);
    assert.match(code, /schema\.safeParse/);
    assert.match(code, /limited\(ipHash\)\) return new Response\(null, \{ status: 429 \}\)/);
  });
  test('tarayıcı raporu yalnız pathname gönderir (sorgu parametresi yok)', () => {
    const code = read('src/modules/monitoring/client.ts');
    assert.match(code, /path: window\.location\.pathname/);
    assert.doesNotMatch(code, /location\.(href|search|hash)|document\.cookie|localStorage/);
  });
});
