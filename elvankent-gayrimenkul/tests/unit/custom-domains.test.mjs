/**
 * P0.5 — Özel alan adı: normalizasyon, doğrulama, kiracı çözümlemesi, kanonik adres.
 *
 *  CD-01  Kanonik hostname (karşılaştırma): şema/yol/sorgu/port/nokta/büyük harf temizlenir
 *  CD-02  Kullanıcı girişi KATI: URL, yol, sorgu, port, IP, localhost, iç ad, tek etiket reddedilir
 *  CD-03  KARAY / platform ad alanı ortamdan (kodda üretim alan adı yok) ve alt alan adlarıyla reddedilir
 *  CD-04  Deneme uzantıları (.test/.example) yalnızca üretim DIŞINDA
 *  CD-05  Doğrulama kodu: alan adı + kiracı + nonce bağlı HMAC; DB'ye yalnızca SHA-256 özeti
 *  CD-06  DNS soyutlaması (DoH): TXT/CNAME/A ayrıştırma; hata = kayıt yok
 *  CD-07  Çözümleme önceliği: KARAY/paylaşılan → varsayılan → alt alan adı → özel alan adı;
 *         /platform ve /admin özel alan adında kiracılaşmaz; x-tenant-key istemciden alınmaz
 *  CD-08  Veritabanı: yalnızca AKTİF alan adı çözülür; durum kısıtları; tekillik; yetki; süre; özet
 *  CD-09  Sunucu işlemleri: organizasyon oturumdan; KARAY elle onayı yalnızca süper admin
 *  CD-10  Kanonik / sitemap / OG: kiracı baseUrl birincil AKTİF alan adından; DNS hedefi ortamdan
 *  CD-11  Önbellek: alan adı durumu değişince kiracı önbelleği etiketle yenilenir
 *  CD-12  Performans: ziyaretçi sitesi alan adı yönetim kodunu yüklemez
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { canonicalHostname, isUnderSuffix, parseDomainInput } from '../../src/modules/domains/hostname.ts';
import { domainConfigFromEnv } from '../../src/modules/domains/config.ts';
import { dohResolver } from '../../src/modules/domains/dns.ts';
import { DEFAULT_TENANT_KEY, karayHostConfigFromEnv, resolveRequestSurface, tenantKeyForHost } from '../../src/platform/tenant/host.ts';

// Sunucu imza anahtarı (yalnızca test değeri; modül yüklenmeden önce)
process.env.IP_HASH_SALT ||= 'unit-test-salt-not-a-secret';
const { hashVerificationValue, newVerification, verificationValue } = await import('../../src/modules/domains/verification.ts');

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
const SQL = read('supabase/migrations/20261009000001_custom_domains.sql');
const SERVICE = read('src/modules/domains/service.ts');
const fn = (name) => {
  const start = SQL.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} tanımı yok`);
  return SQL.slice(start, SQL.indexOf('\n$$;', start));
};
const ENV = { PLATFORM_ROOT_DOMAIN: 'karayapp.com', KARAY_HOSTS: 'karay.com.tr,www.karay.com.tr', NEXT_PUBLIC_SITE_URL: 'https://www.elvankentgayrimenkul.com', DOMAIN_RESERVED_SUFFIXES: 'ic.karay.net' };
const policy = domainConfigFromEnv(ENV).policy;
const prodPolicy = domainConfigFromEnv({ ...ENV, SITE_ENV: 'production' }).policy;
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const ID_A = '33333333-3333-4333-8333-333333333333';
const ID_B = '44444444-4444-4444-8444-444444444444';

function walk(dir) {
  return readdirSync(root + dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(root + p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe('CD-01 kanonik hostname', () => {
  test('aynı alan adının farklı yazımları tek biçime iner', () => {
    for (const v of ['HTTPS://WWW.Example.COM/', 'www.example.com', 'WWW.EXAMPLE.COM', 'www.example.com.', 'https://user@www.example.com:443/yol?x=1#y', 'www.example.com:8080']) {
      assert.equal(canonicalHostname(v), 'www.example.com', v);
    }
    for (const v of ['', null, 'localhost', '127.0.0.1', 'http://10.0.0.1/', 'a..b.com', '-a.com', 'example', 'exa_mple.com']) assert.equal(canonicalHostname(v), null, String(v));
  });
});

describe('CD-02 kullanıcı girişi (katı)', () => {
  test('geçerli çıplak alan adları kabul edilir (büyük harf / sondaki nokta normalize)', () => {
    for (const [input, out] of [['example.com', 'example.com'], ['WWW.Example.COM', 'www.example.com'], ['www.ornekemlak.com.tr.', 'www.ornekemlak.com.tr'], ['  ofis-1.example.org ', 'ofis-1.example.org']]) {
      assert.deepEqual(parseDomainInput(input, policy), { ok: true, hostname: out });
    }
  });
  test('URL, yol, sorgu, port, IP, localhost, iç ad ve bozuk ad reddedilir (anlaşılır kodla)', () => {
    const cases = {
      'https://example.com': 'url',
      'example.com/foo': 'url',
      'example.com?x=1': 'url',
      'example.com#a': 'url',
      'user@example.com': 'url',
      'example.com:8080': 'port',
      '127.0.0.1': 'ip',
      '10.0.0.5': 'ip',
      '[::1]': 'ip',
      localhost: 'internal',
      'printer.local': 'internal',
      'db.internal': 'internal',
      'nas.lan': 'internal',
      intranet: 'single_label',
      'exa_mple.com': 'invalid',
      '-bad.com': 'invalid',
      'a..b.com': 'invalid',
      'example.c0m': 'invalid',
      '': 'empty',
    };
    for (const [input, code] of Object.entries(cases)) {
      const r = parseDomainInput(input, policy);
      assert.equal(r.ok, false, input);
      assert.equal(r.error, code, input);
      assert.ok(r.message.length > 5);
    }
    assert.equal(parseDomainInput(null, policy).ok, false);
    assert.equal(parseDomainInput(`${'a'.repeat(64)}.com`, policy).ok, false);
  });
});

describe('CD-03 KARAY / platform ad alanı koruması', () => {
  test('platform kökü, KARAY alan adları, varsayılan site, barındırma önizlemesi ve ek liste (alt alan adları dâhil) reddedilir', () => {
    for (const h of ['karayapp.com', 'ofis1.karayapp.com', 'www.karayapp.com', 'karay.com.tr', 'www.karay.com.tr', 'panel.karay.com.tr', 'elvankentgayrimenkul.com', 'www.elvankentgayrimenkul.com', 'proje.vercel.app', 'x.ic.karay.net']) {
      assert.equal(parseDomainInput(h, policy).error, 'reserved', h);
    }
    // Benzer ama farklı adlar ayrılmış sayılmaz
    for (const h of ['karayapp.com.tr', 'notkarayapp.com', 'karay.com.tr.example.org']) assert.equal(parseDomainInput(h, policy).ok, true, h);
    assert.equal(isUnderSuffix('a.b.example.com', ['example.com']), true);
    assert.equal(isUnderSuffix('badexample.com', ['example.com']), false);
  });
  test('ayrılmış liste kodda yazılı değil, ortamdan gelir', () => {
    assert.deepEqual(domainConfigFromEnv({}).policy.reservedSuffixes, ['vercel.app']);
    const code = read('src/modules/domains/config.ts') + read('src/modules/domains/hostname.ts');
    assert.doesNotMatch(code, /karayapp|karay\.com|elvankent/i);
  });
});

describe('CD-04 deneme uzantıları', () => {
  test('.test / .example yerel ve E2E ortamında kabul, üretimde reddedilir', () => {
    assert.equal(parseDomainInput('ofis.e2e.test', policy).ok, true);
    assert.equal(parseDomainInput('ofis.e2e.test', prodPolicy).error, 'internal');
    assert.equal(parseDomainInput('demo.example', prodPolicy).error, 'internal');
  });
});

describe('CD-05 doğrulama kodu', () => {
  test('alan adı + kiracı + nonce bağlı; aynı girdi aynı kod; herhangi biri değişince farklı kod', () => {
    const base = { id: ID_A, orgId: ORG_A, hostname: 'a.example.com', nonce: 'a'.repeat(32) };
    const v = verificationValue(base);
    assert.match(v, /^karay-site-verification=[A-Za-z0-9_-]{43}$/);
    assert.equal(verificationValue(base), v);
    for (const change of [{ id: ID_B }, { orgId: ORG_B }, { hostname: 'b.example.com' }, { nonce: 'b'.repeat(32) }]) assert.notEqual(verificationValue({ ...base, ...change }), v, JSON.stringify(change));
  });
  test('veritabanına giden: rastgele nonce + SHA-256 özeti (ham kod değil)', () => {
    const a = newVerification({ id: ID_A, orgId: ORG_A, hostname: 'a.example.com' });
    const b = newVerification({ id: ID_A, orgId: ORG_A, hostname: 'a.example.com' });
    assert.match(a.nonce, /^[0-9a-f]{32}$/);
    assert.notEqual(a.nonce, b.nonce);
    assert.notEqual(a.value, b.value);
    assert.equal(a.hash, createHash('sha256').update(a.value).digest('hex'));
    assert.equal(hashVerificationValue(` ${a.value} `), a.hash);
    assert.match(SERVICE, /p_nonce: v\.nonce, p_token_hash: v\.hash/);
    assert.doesNotMatch(SERVICE, /p_token_hash: v\.value|p_value/);
  });
});

describe('CD-06 DNS soyutlaması', () => {
  test('DoH JSON: TXT tırnakları birleşir, CNAME sondaki nokta / büyük harf normalize, tür filtrelenir', async () => {
    const calls = [];
    const fake = async (url) => {
      calls.push(String(url));
      const type = new URL(url).searchParams.get('type');
      const Answer = type === 'TXT' ? [{ type: 16, data: '"karay-site-verification=abc" "def"' }, { type: 5, data: 'x.' }] : type === 'CNAME' ? [{ type: 5, data: 'Sites.Karay.Test.' }] : [{ type: 1, data: '203.0.113.10' }];
      return new Response(JSON.stringify({ Answer }), { status: 200 });
    };
    const r = dohResolver('http://127.0.0.1:4011/dns-query', fake);
    assert.deepEqual(await r.txt('_karay-verification.a.example.com'), ['karay-site-verification=abcdef']);
    assert.deepEqual(await r.cname('www.a.example.com'), ['sites.karay.test']);
    assert.deepEqual(await r.a('a.example.com'), ['203.0.113.10']);
    assert.match(calls[0], /name=_karay-verification\.a\.example\.com&type=TXT/);
  });
  test('ağ hatası / HTTP hatası "kayıt yok" sayılır (doğrulama başarısız, istisna yok)', async () => {
    const down = dohResolver('http://127.0.0.1:1/dns-query', async () => {
      throw new Error('ECONNREFUSED');
    });
    assert.deepEqual(await down.txt('x.example.com'), []);
    const bad = dohResolver('http://127.0.0.1:1/dns-query', async () => new Response('no', { status: 500 }));
    assert.deepEqual(await bad.cname('x.example.com'), []);
  });
});

describe('CD-07 kiracı çözümleme önceliği', () => {
  const surface = karayHostConfigFromEnv(ENV);
  const hostCfg = { defaultSlug: DEFAULT_TENANT_KEY, platformRootDomain: 'karayapp.com', defaultHosts: ['elvankentgayrimenkul.com', 'www.elvankentgayrimenkul.com'] };
  test('KARAY → paylaşılan/varsayılan → platform alt alan adı → özel alan adı', () => {
    assert.equal(resolveRequestSurface('/', 'karay.com.tr', surface).route.kind, 'karay-rewrite');
    assert.equal(tenantKeyForHost('localhost:3000', hostCfg), DEFAULT_TENANT_KEY);
    assert.equal(tenantKeyForHost('www.elvankentgayrimenkul.com', hostCfg), DEFAULT_TENANT_KEY);
    assert.equal(tenantKeyForHost('ofis1.karayapp.com', hostCfg), 'ofis1');
    assert.equal(tenantKeyForHost('WWW.Ornek-Emlak.com.', hostCfg), 'www.ornek-emlak.com');
    // Platform ad alanında hiçbir ad özel alan adı olarak çözülmez
    assert.equal(tenantKeyForHost('a.b.karayapp.com', hostCfg), DEFAULT_TENANT_KEY);
  });
  test('özel alan adında /platform, /api/platform, /karay, /site-onizleme 404; /admin ofis paneli; site kiracı', () => {
    const k = (p) => resolveRequestSurface(p, 'www.ornek-emlak.com', surface).route;
    assert.equal(k('/platform').kind, 'not-found');
    assert.equal(k('/platform/siteler').kind, 'not-found');
    assert.equal(k('/api/platform/branding').kind, 'not-found');
    assert.equal(k('/karay').kind, 'not-found');
    assert.equal(k('/site-onizleme').kind, 'not-found');
    assert.deepEqual(k('/admin'), { kind: 'panel', area: 'admin' });
    assert.equal(k('/t/baska-ofis').kind, 'not-found');
    assert.equal(k('/').kind, 'tenant-site');
  });
  test('proxy kiracıyı yalnızca Host başlığından seçer; x-forwarded-host / x-tenant-key istemciden alınmaz', () => {
    const proxy = read('src/proxy.ts');
    assert.match(proxy, /const host = request\.headers\.get\('host'\);/);
    assert.doesNotMatch(proxy, /x-forwarded-host/i);
    assert.match(proxy, /requestHeaders\.set\(TENANT_HEADER, tenantKey\);/);
    assert.match(read('src/platform/tenant/config.ts'), /hostSurface\(\(await headers\(\)\)\.get\('host'\)/);
  });
});

describe('CD-08 veritabanı kuralları', () => {
  test('herkese açık çözümleme ve kanonik alan adları YALNIZCA aktif', () => {
    assert.match(fn('public_tenant'), /where d\.hostname = lower\(p_hostname\)\s+and d\.status = 'active'/);
    assert.match(fn('public_tenant_domains'), /and d\.status = 'active';/);
    assert.doesNotMatch(fn('public_tenant'), /verified_at is not null/);
  });
  test('durum kısıtları: verified/active → verified_at; active ⇔ activated_at; birincil yalnızca aktif', () => {
    assert.match(SQL, /check \(status in \('pending', 'verified', 'active'\)\)/);
    assert.match(SQL, /\(status = 'pending' or verified_at is not null\)\s+and \(\(status = 'active'\) = \(activated_at is not null\)\)/);
    assert.match(SQL, /check \(not is_primary or status = 'active'\)/);
  });
  test('tekillik gerçek indeks: bağlı hostname tek kiracıda; aynı kiracıda tekrar yok', () => {
    assert.match(SQL, /create unique index if not exists organization_domains_bound_idx\s+on public\.organization_domains \(hostname\) where status in \('verified', 'active'\);/);
    assert.match(SQL, /create unique index if not exists organization_domains_org_host_idx\s+on public\.organization_domains \(organization_id, hostname\);/);
    assert.match(fn('domain_mark_verified'), /exception when unique_violation then\s+raise exception 'domain_taken'/);
  });
  test('doğrulama: bekleyen + bu kiracı + süresi geçmemiş + özet eşleşmesi; aktiflik yalnızca doğrulanmıştan', () => {
    const v = fn('domain_mark_verified');
    assert.match(v, /where d\.id = p_id and d\.organization_id = p_org and d\.status = 'pending'/);
    assert.match(v, /and d\.verification_expires_at > now\(\)/);
    assert.match(v, /and d\.verification_token_hash = any \(coalesce\(p_found_hashes, '\{\}'::text\[\]\)\)/);
    assert.match(fn('domain_mark_active'), /where d\.id = p_id and d\.organization_id = p_org and d\.status = 'verified' and d\.verified_at is not null/);
    assert.match(fn('domain_set_primary'), /d\.organization_id = p_org and d\.status = 'active'/);
    assert.match(fn('domain_set_primary'), /update public\.organization_domains d set is_primary = true where d\.id = p_id and d\.organization_id = p_org;/);
    assert.match(fn('domain_set_primary'), /set is_primary = false where d\.organization_id = p_org and d\.is_primary/);
    assert.match(fn('domain_verification_ttl'), /select interval '7 days';/);
    assert.equal((SQL.match(/now\(\) \+ public\.domain_verification_ttl\(\)/g) ?? []).length, 2);
  });
  test('yetki: her yazma işlemi işlemi yapanı doğrular; fonksiyonlar yalnızca service_role; istemci yalnızca okur, özet okunmaz', () => {
    for (const name of ['domain_add', 'domain_rotate_verification', 'domain_check_begin', 'domain_mark_verified', 'domain_mark_active', 'domain_set_primary', 'domain_remove', 'domain_list']) {
      assert.match(fn(name), /if not public\._domain_actor_allowed\(p_actor, p_org, p_platform\) then\s+raise exception 'forbidden'/, name);
    }
    const actor = fn('_domain_actor_allowed');
    assert.match(actor, /when p_platform then exists \(select 1 from public\.profiles p where p\.id = p_actor and p\.is_super_admin\)/);
    assert.match(actor, /where m\.organization_id = p_org and m\.user_id = p_actor and m\.status = 'active'/);
    assert.match(actor, /rp\.permission = 'settings\.manage'/);
    assert.match(SQL, /execute format\('revoke all on function %s from public, anon, authenticated', f\);\s+execute format\('grant execute on function %s to service_role', f\);/);
    assert.match(SQL, /revoke all on public\.organization_domains from anon, authenticated;/);
    const grant = /grant select \(([^)]+)\)\s+on public\.organization_domains to authenticated;/.exec(SQL);
    assert.ok(grant && !/token_hash|nonce/.test(grant[1]));
    // Anonim: tablo yetkisi var ama anonim RLS politikası YOK → satır dönmez (özet de dönmez)
    assert.match(SQL, /grant select on public\.organization_domains to anon;/);
    assert.doesNotMatch(SQL, /create policy[^;]+organization_domains[^;]+to anon/);
    assert.doesNotMatch(SQL, /create policy[^;]+organization_domains[^;]+for (insert|update|delete|all)/);
    assert.match(fn('domain_mark_active'), /if p_manual and not p_platform then\s+raise exception 'forbidden'/);
    assert.match(fn('domain_add'), /if not p_platform and not coalesce\(\(select pl\.custom_domain_enabled from public\.org_plan\(p_org\) pl limit 1\), false\)/);
  });
  test('deneme sınırı DNS sorgusundan ÖNCE veritabanında', () => {
    assert.match(fn('domain_check_begin'), /a\.action = 'domain\.checked' and a\.target_id = p_id::text\s+and a\.created_at > now\(\) - interval '10 minutes'\) >= 10/);
    const verify = SERVICE.slice(SERVICE.indexOf('export async function verifyDomain'));
    assert.ok(verify.indexOf("rpc('domain_check_begin'") < verify.indexOf('resolver.txt('));
  });
  test('mevcut veri: doğrulanmış kayıtlar aktif olur, veri silinmez; eski platform_add_domain artık aktif EKLEMEZ', () => {
    assert.match(SQL, /set status = 'active', activated_at = coalesce\(activated_at, verified_at\)\s+where verified_at is not null and status = 'pending' and activated_at is null;/);
    assert.doesNotMatch(SQL.replace(fn('domain_remove'), ''), /delete from public\.organization_domains/);
    assert.match(fn('platform_add_domain'), /values \(p_org, lower\(btrim\(p_hostname\)\), false, 'pending'\)/);
    assert.doesNotMatch(fn('platform_add_domain'), /verified_at/);
  });
});

describe('CD-09 sunucu işlemleri', () => {
  test('ofis: organizasyon oturumdan (ctx.org.id), settings.manage; istemciden kimlik parametresi yok', () => {
    const code = read('src/app/actions/admin-domains.ts');
    assert.match(code, /const ctx = await requirePermission\('settings\.manage'\);\s+return \{ orgId: ctx\.org\.id, actor: \{ userId: ctx\.user\.id, platform: false \} \};/);
    assert.doesNotMatch(code, /orgId\??\s*:\s*string|organization_id|organizationId/);
    // Her işlem kimliği yalnızca office() üzerinden (ctx.org.id) alır
    const exported = [...code.matchAll(/export async function (\w+)\(([^)]*)\)/g)];
    assert.equal(exported.length, 6);
    for (const [, name, params] of exported) assert.match(params, /^(hostname|domainId): string$/, name);
    assert.equal((code.match(/const \{ orgId, actor \} = await office\(\);/g) ?? []).length, 6);
    assert.doesNotMatch(code, /manual/);
  });
  test('KARAY: requireSuperAdmin; elle bağlantı onayı yalnızca KARAY; servis ofis için elle onayı reddeder', () => {
    const code = read('src/app/actions/platform.ts');
    assert.match(code, /async function platformDomainActor\(orgId: string\) \{\s+const session = await requireSuperAdmin\(\);/);
    assert.match(code, /return \{ userId: session\.user\.id, platform: true \};/);
    assert.match(SERVICE, /if \(manual && !actor\.platform\) throw new ActionError/);
  });
  test('giriş katı ayrıştırılır ve ayrılmış ad alanı servis katmanında reddedilir (DB çağrısından önce)', () => {
    const add = SERVICE.slice(SERVICE.indexOf('export async function addDomain'));
    assert.ok(add.indexOf('parseDomainInput(input, domainConfig().policy)') < add.indexOf("rpc('domain_add'"));
  });
});

describe('CD-10 kanonik adres ve bağlantı hedefi', () => {
  test('kiracı baseUrl birincil AKTİF alan adından (public_tenant_domains), sitemap/metadata/OG aynı baseUrl', () => {
    const tenant = read('src/platform/tenant/tenant.ts');
    assert.match(tenant, /const primaryDomain = domainsRes\.data\?\.find\(\(d\) => d\.is_primary\)\?\.hostname;/);
    assert.match(tenant, /\? `https:\/\/\$\{primaryDomain\}`/);
    assert.match(read('src/app/t/[tenant]/layout.tsx'), /baseUrl: tenant\.baseUrl/);
  });
  test('DNS hedefi ortamdan; kodda sabit Vercel değeri kullanılmaz (servis ve ekranlar)', () => {
    const cfg = domainConfigFromEnv({ DOMAIN_TARGET_CNAME: 'Sites.Karay.Test.', DOMAIN_TARGET_A: '203.0.113.10, x, 203.0.113.11' });
    assert.equal(cfg.targetCname, 'sites.karay.test');
    assert.deepEqual(cfg.targetA, ['203.0.113.10', '203.0.113.11']);
    assert.equal(domainConfigFromEnv({}).targetCname, null);
    assert.equal(domainConfigFromEnv({}).verificationRecord, '_karay-verification');
    for (const p of ['src/modules/domains/service.ts', 'src/components/domains/domain-manager.tsx', 'src/app/admin/(panel)/site/alan-adi/page.tsx', 'src/app/platform/(konsol)/siteler/[id]/alan-adi/page.tsx']) {
      assert.doesNotMatch(read(p), /vercelDnsRecords|76\.76\.21\.21|cname\.vercel-dns\.com/, p);
    }
  });
});

describe('CD-11 önbellek', () => {
  test('her durum değişikliğinden sonra kiracı + ofis etiketi yenilenir', () => {
    assert.match(SERVICE, /function refresh\(orgId: string\) \{\s+updateTag\(cacheTags\.tenants\);\s+updateTag\(cacheTags\.org\(orgId\)\);/);
    for (const name of ['addDomain', 'verifyDomain', 'connectDomain', 'setPrimaryDomain', 'removeDomain']) {
      const body = SERVICE.slice(SERVICE.indexOf(`export async function ${name}`));
      const end = body.indexOf('\n}\n');
      assert.match(body.slice(0, end), /refresh\(orgId\);/, name);
    }
  });
});

describe('CD-12 performans', () => {
  test('ziyaretçi sitesi alan adı yönetim kodunu içe aktarmaz', () => {
    const files = [...walk('src/app/t'), ...walk('src/components/site'), ...walk('src/site-config'), ...walk('src/theme-engine')];
    for (const p of files) assert.doesNotMatch(read(p), /modules\/domains|domain-manager|admin-domains/, p);
  });
});
