/**
 * Alan adı sağlayıcısı birim testleri (ağ yok: fetch taklit edilir).
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createManualProvider, createVercelProvider, isApexDomain, vercelDnsRecords } from '../../src/modules/domains/provider.ts';

describe('DNS kayıtları', () => {
  test('kök alan adı A kaydı, alt alan adı CNAME ister (.com.tr dahil)', () => {
    assert.equal(isApexDomain('ornekemlak.com'), true);
    assert.equal(isApexDomain('ornekemlak.com.tr'), true);
    assert.equal(isApexDomain('www.ornekemlak.com.tr'), false);
    assert.deepEqual(vercelDnsRecords('ornekemlak.com'), [{ type: 'A', name: '@', value: '76.76.21.21' }]);
    assert.deepEqual(vercelDnsRecords('www.ornekemlak.com'), [{ type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' }]);
  });
  test('manual sağlayıcı DNS talimatı döndürür, dış istek yapmaz', async () => {
    const res = await createManualProvider().add('ornekemlak.com');
    assert.equal(res.ok, true);
    assert.equal(res.status.ready, false);
    assert.equal(res.status.records[0].type, 'A');
  });
});

describe('Vercel sağlayıcı (taklit API)', () => {
  function fakeFetch(routes) {
    const calls = [];
    const impl = async (url, init) => {
      calls.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body });
      const key = `${init.method} ${new URL(url).pathname}`;
      const [status, body] = routes[key] ?? [404, { error: { code: 'not_found' } }];
      return new Response(JSON.stringify(body), { status });
    };
    return { impl, calls };
  }

  test('ekleme: doğru uç nokta, token ve teamId; doğrulama TXT kaydı döner', async () => {
    const { impl, calls } = fakeFetch({
      'POST /v10/projects/prj_1/domains': [200, { name: 'ofis.com', verified: false }],
      'GET /v9/projects/prj_1/domains/ofis.com': [200, { name: 'ofis.com', verified: false, verification: [{ type: 'TXT', domain: '_vercel.ofis.com', value: 'vc-domain-verify=abc' }] }],
      'GET /v6/domains/ofis.com/config': [200, { misconfigured: true }],
    });
    const p = createVercelProvider({ token: 'tok_test', projectId: 'prj_1', teamId: 'team_9', fetch: impl });
    const res = await p.add('ofis.com');
    assert.equal(res.ok, true);
    assert.equal(res.status.ready, false);
    assert.deepEqual(res.status.records.map((r) => r.type).sort(), ['A', 'TXT']);
    assert.equal(calls[0].auth, 'Bearer tok_test');
    assert.ok(calls.every((c) => c.url.includes('teamId=team_9')));
    assert.deepEqual(JSON.parse(calls[0].body), { name: 'ofis.com' });
  });
  test('başka projede kullanılan alan adı açık hata verir', async () => {
    const { impl } = fakeFetch({ 'POST /v10/projects/prj_1/domains': [409, { error: { code: 'domain_already_in_use' } }] });
    const res = await createVercelProvider({ token: 't', projectId: 'prj_1', fetch: impl }).add('ofis.com');
    assert.equal(res.ok, false);
  });
  test('hazır alan adı: doğrulanmış ve DNS doğru', async () => {
    const { impl } = fakeFetch({
      'GET /v9/projects/prj_1/domains/ofis.com': [200, { name: 'ofis.com', verified: true }],
      'GET /v6/domains/ofis.com/config': [200, { misconfigured: false }],
    });
    const res = await createVercelProvider({ token: 't', projectId: 'prj_1', fetch: impl }).status('ofis.com');
    assert.equal(res.ok && res.status.ready, true);
  });
  test('kaldırma: 404 da başarı sayılır', async () => {
    const { impl } = fakeFetch({});
    assert.deepEqual(await createVercelProvider({ token: 't', projectId: 'prj_1', fetch: impl }).remove('yok.com'), { ok: true });
  });
});
