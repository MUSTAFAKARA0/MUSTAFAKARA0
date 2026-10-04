/**
 * P0.1 — Ofis site yönetimi (/admin/site): ortak site düzenleyici servisi ve yetki sınırları.
 *
 *  OS-01  Ofis işlemleri: her biri settings.manage ister; organizasyon OTURUMDAN gelir (parametre yok)
 *  OS-02  Taslak kaydı yalnızca site_save_draft çağırır (yayın yazılmaz); geçersiz değer DB'ye gitmez
 *  OS-03  Aile doğrulaması: izinsiz aile reddedilir (DB çağrısı yok); izinli aile 5 bölümü taslağa yazar
 *  OS-04  Yayın / geri alma / taslağı geri alma ortak servisten; sürüm doğrulanır
 *  OS-05  Ofis KARAY'a ait işlemleri (durum, özellik, aile izni, alan adı, planlar) çağıramaz
 *  OS-06  KARAY ve ofis AYNI servisi ve AYNI formları kullanır (iki ayrı uygulama yok)
 *  OS-07  Veritabanı: taslak/yayın/geri alma assert_site_editor; durum/özellik/platform süper admin
 *  OS-08  Önizleme = canlı: aynı Site Engine, önizlemede yalnızca yapılandırma kaynağı (taslak) farklı
 *  OS-09  Ofis Tasarım sekmesi yalnızca izinli aileleri istemciye gönderir
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');

const ORG = '11111111-1111-4111-8111-111111111111';

/** Sahte oturum istemcisi: yapılan RPC çağrılarını ve okumaları kaydeder */
function fakeDb({ draft = {}, settings = { display_name: 'Ofis', primary_color: '#112233', accent_color: '#445566' }, rpcError = null } = {}) {
  const calls = [];
  const db = {
    calls,
    rpc(name, args) {
      calls.push({ name, args });
      if (rpcError && rpcError(name, args)) return Promise.resolve({ data: null, error: { code: '42501', message: 'forbidden' } });
      return Promise.resolve({ data: name === 'site_publish' || name === 'site_rollback' ? 7 : null, error: null });
    },
    from(table) {
      const q = {
        select: () => q,
        eq: (col, val) => {
          calls.push({ name: `read:${table}`, args: { [col]: val } });
          return q;
        },
        maybeSingle: () =>
          Promise.resolve({ data: table === 'site_configs' ? { draft } : table === 'organization_settings' ? settings : null, error: null }),
      };
      return q;
    },
  };
  return db;
}

const service = await import('@/site-editor/service');

describe('OS-01: ofis işlemleri — yetki ve organizasyon kaynağı', () => {
  const src = read('src/app/actions/admin-site.ts');
  const exported = [...src.matchAll(/export async function (\w+)\(([^)]*)\)/g)];

  test('her dışa açık işlem settings.manage yetkisini sunucuda doğrular', () => {
    assert.ok(exported.length >= 7, 'ofis işlemleri bulunamadı');
    assert.match(src, /async function editor\(\)\s*\{\s*return requirePermission\('settings\.manage'\);/);
    for (const [, name] of exported) {
      const body = src.slice(src.indexOf(`export async function ${name}(`)).split('\nexport ')[0];
      assert.match(body, /const ctx = await editor\(\);/, `${name}: yetki kontrolü yok`);
    }
  });

  test('hiçbir ofis işlemi organizasyon/site kimliği parametresi almaz; kimlik oturumdan (ctx.org.id)', () => {
    for (const [, name, params] of exported) {
      assert.doesNotMatch(params, /\b(org\w*|organization\w*|tenant\w*|site_?id)\s*\??:/i, `${name}: istemciden organizasyon alıyor`);
      const body = src.slice(src.indexOf(`export async function ${name}(`)).split('\nexport ')[0];
      assert.match(body, /ctx\.org\.id/, `${name}: organizasyon oturumdan alınmıyor`);
    }
    assert.doesNotMatch(src, /createServiceClient|SUPABASE_SERVICE_ROLE/, 'ofis işlemi hizmet anahtarı kullanıyor');
  });

  test('sayfa verisi de organizasyonu oturumdan alır; adreste/istemcide site kimliği yok', () => {
    const data = read('src/app/admin/(panel)/site/site-data.ts');
    assert.match(data, /requirePagePermission\('settings\.manage'\)/);
    assert.match(data, /getSiteAdmin\(ctx, ctx\.org\.id\)/);
    const dirs = readdirSync(root + 'src/app/admin/(panel)/site');
    assert.ok(!dirs.some((d) => d.startsWith('[')), 'ofis site rotasında dinamik kimlik parçası var');
  });
});

describe('OS-02: taslak kaydı (yayın yazılmaz)', () => {
  test('bölüm kaydı yalnızca site_save_draft çağırır; organizasyon olduğu gibi iletilir', async () => {
    const db = fakeDb();
    const nav = [{ id: 'a', label: 'İlanlar', href: '/ilanlar', visible: true, children: [] }];
    await service.saveDraftSection(db, ORG, 'navigation', nav);
    const rpcs = db.calls.filter((c) => !c.name.startsWith('read:'));
    assert.deepEqual(rpcs.map((c) => c.name), ['site_save_draft']);
    assert.equal(rpcs[0].args.p_org, ORG);
    assert.equal(rpcs[0].args.p_section, 'navigation');
    assert.ok(!db.calls.some((c) => /publish|rollback/.test(c.name)), 'taslak kaydı yayın çağırdı');
  });

  test('şemaya uymayan değer ve geçersiz bölüm veritabanına gitmez', async () => {
    const db = fakeDb();
    await assert.rejects(() => service.saveDraftSection(db, ORG, 'navigation', [{ label: '<script>' }]));
    await assert.rejects(() => service.saveDraftSection(db, ORG, 'hack', {}), /Geçersiz bölüm/);
    await assert.rejects(() => service.saveDraftSection(db, 'not-a-uuid', 'theme', 'atlas'), /Geçersiz site/);
    assert.equal(db.calls.length, 0);
  });

  test('marka taslağı: yalnızca canlıdan farklı alanlar brand bölümüne yazılır', async () => {
    const db = fakeDb();
    const empty = Object.fromEntries(['short_name', 'legal_name', 'tagline', 'description', 'phone', 'whatsapp', 'email', 'address_line', 'address_district', 'address_city', 'maps_url', 'instagram_url', 'facebook_url', 'x_url', 'youtube_url', 'linkedin_url', 'tiktok_url'].map((k) => [k, '']));
    await service.saveBrandDraft(db, ORG, { ...empty, display_name: 'Ofis', tagline: 'Yeni slogan', primary_color: '#112233', accent_color: '#445566' });
    const rpc = db.calls.find((c) => c.name === 'site_save_draft');
    assert.equal(rpc.args.p_section, 'brand');
    assert.deepEqual(rpc.args.p_value, { tagline: 'Yeni slogan' });
  });
});

describe('OS-03: tasarım ailesi doğrulaması', () => {
  test('izinli listede olmayan aile reddedilir ve veritabanına hiçbir şey yazılmaz', async () => {
    const db = fakeDb();
    await assert.rejects(() => service.applyFamilyToDraft(db, ORG, 'kurumsal-portfoy', ['sinematik-vitrin']), /açık değil/);
    await assert.rejects(() => service.applyFamilyToDraft(db, ORG, 'olmayan-aile', ['olmayan-aile']), /Geçersiz tasarım ailesi/);
    assert.equal(db.calls.filter((c) => c.name === 'site_save_draft').length, 0);
  });

  test('izinli aile 5 tasarım bölümünü TASLAĞA yazar (yayın yok); kaynak ailesi kayda geçer', async () => {
    const db = fakeDb();
    await service.applyFamilyToDraft(db, ORG, 'sinematik-vitrin', ['sinematik-vitrin']);
    const rpcs = db.calls.filter((c) => !c.name.startsWith('read:'));
    assert.deepEqual(rpcs.map((c) => c.args.p_section), ['theme', 'colors', 'typography', 'style', 'home']);
    assert.ok(rpcs.every((c) => c.name === 'site_save_draft'));
    assert.equal(rpcs.find((c) => c.args.p_section === 'style').args.p_value.origin.family, 'sinematik-vitrin');
  });

  test('bir bölüm reddedilirse yazılanlar eski taslak değerlerine döner', async () => {
    const db = fakeDb({ draft: { theme: 'atlas' }, rpcError: (name, a) => name === 'site_save_draft' && a.p_section === 'style' && a.p_value?.origin });
    await assert.rejects(() => service.applyFamilyToDraft(db, ORG, 'sinematik-vitrin', ['sinematik-vitrin']));
    const restored = db.calls.filter((c) => c.name === 'site_save_draft').slice(4);
    assert.deepEqual(restored.map((c) => c.args.p_section), ['theme', 'colors', 'typography']);
    assert.equal(restored[0].args.p_value, 'atlas');
  });
});

describe('OS-04: yayın, geri alma, taslağı geri alma', () => {
  test('yayın site_publish, geri alma site_rollback, taslağı geri alma site_discard_draft çağırır', async () => {
    const db = fakeDb();
    assert.equal(await service.publishDraft(db, ORG, 'not'), 7);
    assert.equal(await service.rollbackToVersion(db, ORG, 3), 7);
    await service.discardDraft(db, ORG);
    assert.deepEqual(db.calls.map((c) => c.name), ['site_publish', 'site_rollback', 'site_discard_draft']);
    assert.ok(db.calls.every((c) => c.args.p_org === ORG));
  });

  test('geçersiz sürüm reddedilir; veritabanı yetki hatası kullanıcıya iletilir', async () => {
    await assert.rejects(() => service.rollbackToVersion(fakeDb(), ORG, 0), /Geçersiz sürüm/);
    await assert.rejects(() => service.rollbackToVersion(fakeDb(), ORG, 1.5), /Geçersiz sürüm/);
    const denied = fakeDb({ rpcError: () => true });
    await assert.rejects(() => service.publishDraft(denied, ORG), /yetkiniz yok/);
  });
});

describe('OS-05: ofis KARAY işlemlerini çağıramaz', () => {
  test('ofis işlemleri ve ortak servis platform/durum/özellik/alan adı işlemi içermez', () => {
    for (const file of ['src/app/actions/admin-site.ts', 'src/site-editor/service.ts', 'src/site-editor/preview-link.ts']) {
      const src = read(file);
      for (const forbidden of ['site_set_status', 'site_set_features', 'platform_set_', 'organization_domains', 'requireSuperAdmin', 'subscriptions', 'plans']) {
        assert.ok(!src.includes(forbidden), `${file}: ${forbidden}`);
      }
    }
  });

  test('alan adı sekmesi yalnızca okur (ekleme/silme işlemi yok)', () => {
    const src = read('src/app/admin/(panel)/site/alan-adi/page.tsx');
    assert.doesNotMatch(src, /use server|\.insert\(|\.delete\(|\.update\(|removeDomain|DomainForm/);
  });
});

describe('OS-06: tek kaynak — KARAY ve ofis aynı servis ve aynı formlar', () => {
  test('KARAY işlemleri de ortak servisi çağırır; RPC çağrısı yalnızca serviste', () => {
    const karay = read('src/app/actions/site-builder.ts');
    for (const fn of ['saveDraftSection', 'saveBrandDraft', 'applyFamilyToDraft', 'publishDraft', 'rollbackToVersion', 'discardDraft', 'createPreviewUrl']) {
      assert.match(karay, new RegExp(`\\b${fn}\\(`), `KARAY ${fn} kullanmıyor`);
    }
    for (const src of [karay, read('src/app/actions/admin-site.ts')]) {
      for (const rpc of ['site_save_draft', 'site_publish', 'site_rollback', 'site_discard_draft']) assert.ok(!src.includes(`'${rpc}'`), `${rpc} işlemde doğrudan çağrılıyor`);
    }
  });

  test('formlar ortak klasörde; işlem bağlamdan gelir (formlar KARAY/ofis işlemi içe aktarmaz)', () => {
    const dir = root + 'src/components/site-editor/';
    for (const f of readdirSync(dir)) {
      const src = readFileSync(dir + f, 'utf8');
      assert.doesNotMatch(src, /@\/app\/actions\//, `${f}: sunucu işlemini doğrudan içe aktarıyor`);
    }
    const office = read('src/app/admin/(panel)/site/layout.tsx');
    const platform = read('src/app/platform/(konsol)/siteler/[id]/layout.tsx');
    for (const l of [office, platform]) assert.match(l, /<SiteEditorProvider/);
    assert.ok(!require_exists('src/components/admin/settings/office-design-picker.tsx'), 'eski ayrı ofis tasarım uygulaması duruyor');
    assert.ok(!require_exists('src/app/actions/admin-design.ts'), 'eski anında yayın işlemi duruyor');
  });
});

function require_exists(p) {
  try {
    readFileSync(root + p);
    return true;
  } catch {
    return false;
  }
}

/** Bir fonksiyonun migration'lardaki SON tanımı */
function lastDefinition(fn) {
  const files = readdirSync(root + 'supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  let def = null;
  for (const f of files) {
    const sql = readFileSync(root + 'supabase/migrations/' + f, 'utf8');
    const re = new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?\\n\\$\\$;`, 'g');
    for (const m of sql.matchAll(re)) def = m[0];
  }
  return def;
}

describe('OS-07: veritabanı yetkileri (son migration tanımları)', () => {
  test('taslak/yayın/geri alma/taslağı geri alma: assert_site_editor (süper admin veya kendi ofisinde settings.manage)', () => {
    for (const fn of ['site_save_draft', 'site_publish', 'site_rollback', 'site_discard_draft']) {
      const def = lastDefinition(fn);
      assert.ok(def, fn);
      assert.match(def, /perform public\.assert_site_editor\(p_org\);/, `${fn}: yetki kontrolü`);
    }
    const guard = lastDefinition('assert_site_editor');
    assert.match(guard, /has_org_permission\(p_org, 'settings\.manage'\)/);
    assert.match(guard, /auth\.uid\(\)\) is null/);
  });

  test('site_save_draft: süper admin olmayan çağıranda izinsiz aile reddedilir', () => {
    const def = lastDefinition('site_save_draft');
    assert.match(def, /p_section = 'style' and not public\.is_super_admin\(\)/);
    assert.match(def, /org_design_family_access\(p_org\)/);
    assert.match(def, /family_not_allowed/);
    // Taslak kaydı yayına yazmaz
    assert.doesNotMatch(def, /set published|published =/);
  });

  test('durum, özellikler ve platform işlemleri yalnızca süper admin', () => {
    for (const fn of ['site_set_status', 'site_set_features', 'platform_set_org_design_families', 'platform_set_design_family']) {
      const def = lastDefinition(fn);
      assert.ok(def, fn);
      assert.match(def, /perform public\.assert_super_admin\(\);/, `${fn} süper admin dışına açıldı`);
      assert.doesNotMatch(def, /assert_site_editor/, `${fn} ofise açıldı`);
    }
  });
});

describe('OS-08: önizleme = canlı (aynı Site Engine, kaynak taslak)', () => {
  test('getSiteView önizlemede taslağı, değilse yayındaki yapılandırmayı okur; çizim aynı kod', () => {
    const load = read('src/site-config/load.ts');
    assert.match(load, /const raw: unknown = draft \?\? tenant\.site\.published;/);
    assert.match(load, /\.select\('draft'\)/);
    const route = read('src/app/api/site-preview/route.ts');
    assert.match(route, /tenant\.id !== orgId/, 'önizleme belirteci kiracıyla eşleşmiyor');
  });

  test('ofis ve KARAY önizleme bağlantısı aynı fonksiyondan (createPreviewUrl)', () => {
    assert.match(read('src/app/actions/admin-site.ts'), /createPreviewUrl\(ctx\.supabase, ctx\.org\.id, path\)/);
    assert.match(read('src/app/actions/site-builder.ts'), /createPreviewUrl\(session\.supabase, orgId, path\)/);
  });
});

describe('OS-09: ofis tasarım sekmesi yalnızca izinli aileleri gönderir', () => {
  test('familyOptions(izinli) dışındaki aileler listeye girmez; sayfa izin listesini verir', async () => {
    const { familyOptions } = await import('@/site-editor/families');
    const { parseSiteConfig } = await import('@/site-config/schema');
    const all = familyOptions(parseSiteConfig({}));
    assert.ok(all.length >= 4);
    const some = familyOptions(parseSiteConfig({}), ['sinematik-vitrin']);
    assert.deepEqual(some.map((f) => f.id), ['sinematik-vitrin']);
    assert.deepEqual(familyOptions(parseSiteConfig({}), []), []);
    const page = read('src/app/admin/(panel)/site/tasarim/page.tsx');
    assert.match(page, /familyOptions\(d, access\.families\)/);
  });
});
