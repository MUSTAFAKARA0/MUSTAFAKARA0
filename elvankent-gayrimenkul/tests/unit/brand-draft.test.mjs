/**
 * P0.2 — Marka ve site içeriği taslağı (ortak çekirdek: src/site-editor/service.ts › saveBrandFields,
 * src/site-editor/branding.ts › uploadBrandingDraft).
 *
 *  BD-01  Marka taslağı: yalnızca site_save_draft (brand) çağrılır; canlıyla aynı alanlar taslaktan çıkar
 *  BD-02  İletişim / saatler / konum taslağı (tipli değerler; anahtar sırasından bağımsız karşılaştırma)
 *  BD-03  Logo: dosya yeni yola yüklenir, YOL taslağa bağlanır, eski dosya silinmez; taslak reddedilirse
 *         yalnızca yeni dosya silinir
 *  BD-04  Taslak kaydı yayına / ayar tablosuna yazmaz (canlı yayına kadar değişmez)
 *  BD-05  Önizleme taslağı okur (applyBrandDraft tipli alanları bindirir; load.ts önizlemede taslak)
 *  BD-06  Yayın / geri alma: aynı veritabanı fonksiyonları; marka uygulaması sütun tipine duyarlı
 *  BD-07  Yetki: /admin/sirket ve görsel uç noktası settings.manage + oturumun ofisi; istemci kimliği yok
 *  BD-08  Tek yayın noktası: ayar tablosuna doğrudan marka yazımı veritabanında reddedilir
 *  BD-09  Eşzamanlılık belirteci iletilir; eski taslak mesajı
 *  BD-10  Beyaz liste: uygulama (BRAND_FIELDS) = veritabanı (site_brand_columns)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
const ORG = '22222222-2222-4222-8222-222222222222';

const LIVE = {
  organization_id: ORG,
  display_name: 'Canlı Ofis',
  phone: '+90 312 111 11 11',
  email: 'canli@example.test',
  primary_color: '#112233',
  accent_color: '#445566',
  logo_url: `organizations/${ORG}/branding/logo-eski-200x80.png`,
  opening_hours: [{ opens: '09:00', days: ['mon'], closes: '18:00' }],
  office_latitude: 39.9,
  office_longitude: 32.8,
};

function fakeDb({ draft = {}, rpcError = null } = {}) {
  const calls = [];
  const db = {
    calls,
    rpc(name, args) {
      calls.push({ name, args });
      if (rpcError && rpcError(name, args)) return Promise.resolve({ data: null, error: { code: '42501', message: rpcError(name, args) } });
      return Promise.resolve({ data: name === 'site_save_draft' ? '2026-10-06T10:00:00.123456+00:00' : 7, error: null });
    },
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        // update/insert/delete YOK: servis ayar tablosuna doğrudan yazmaya kalkarsa test patlar
        maybeSingle: () => Promise.resolve({ data: table === 'site_configs' ? { draft } : table === 'organization_settings' ? LIVE : null, error: null }),
      };
      return q;
    },
  };
  return db;
}

function fakeStorage() {
  const ops = [];
  return {
    ops,
    storage: {
      from: (bucket) => ({
        upload: (path, buf, opts) => (ops.push({ op: 'upload', bucket, path, size: buf.length, opts }), Promise.resolve({ error: null })),
        remove: (paths) => (ops.push({ op: 'remove', bucket, paths }), Promise.resolve({ error: null })),
      }),
    },
  };
}

const service = await import('@/site-editor/service');
const branding = await import('@/site-editor/branding');
const { applyBrandDraft } = await import('@/site-config/brand');
const { BRAND_FIELDS, parseSiteConfig } = await import('@/site-config/schema');

const brandCall = (db) => db.calls.find((c) => c.name === 'site_save_draft' && c.args.p_section === 'brand');

describe('BD-01/02/04: marka ve iletişim taslağı', () => {
  test('firma adı ve telefon taslağa yazılır; canlıyla aynı alanlar taslağa girmez; yayın çağrılmaz', async () => {
    const db = fakeDb();
    const token = await service.saveBrandFields(db, ORG, { display_name: 'Yeni Ofis', phone: '+90 312 222 22 22', email: 'canli@example.test', primary_color: '#112233' });
    assert.equal(token, '2026-10-06T10:00:00.123456+00:00', 'yeni eşzamanlılık belirteci dönmeli');
    assert.deepEqual(brandCall(db).args.p_value, { display_name: 'Yeni Ofis', phone: '+90 312 222 22 22' });
    assert.ok(!db.calls.some((c) => /publish|rollback|apply/.test(c.name)), 'taslak kaydı yayın çağırdı');
  });

  test('önceki taslak korunur; canlı değere dönen alan taslaktan çıkar', async () => {
    const db = fakeDb({ draft: { brand: { tagline: 'Taslak slogan', phone: '+90 312 999 99 99' } } });
    await service.saveBrandFields(db, ORG, { phone: LIVE.phone });
    assert.deepEqual(brandCall(db).args.p_value, { tagline: 'Taslak slogan' });
  });

  test('saatler (JSON) ve konum (sayı): aynı değer farklı anahtar sırasıyla gelse de bekleyen değişiklik sayılmaz', async () => {
    const db = fakeDb();
    await service.saveBrandFields(db, ORG, { opening_hours: [{ days: ['mon'], opens: '09:00', closes: '18:00' }], office_latitude: 39.9, office_longitude: 32.85 });
    assert.deepEqual(brandCall(db).args.p_value, { office_longitude: 32.85 });
  });

  test('beyaz liste dışı alan ve geçersiz değer veritabanına gitmez', async () => {
    const db = fakeDb();
    await assert.rejects(() => service.saveBrandFields(db, ORG, { seo_title: 'x' }));
    await assert.rejects(() => service.saveBrandFields(db, ORG, { opening_hours: 'pazartesi' }));
    await assert.rejects(() => service.saveBrandFields(db, 'kimlik-degil', { display_name: 'X' }), /Geçersiz site/);
    assert.equal(db.calls.filter((c) => c.name === 'site_save_draft').length, 0);
  });

  test('KARAY marka formu ve ofis formları aynı çekirdekten geçer', () => {
    const src = read('src/site-editor/service.ts');
    assert.match(src, /export async function saveBrandDraft[\s\S]*?return saveBrandFields\(db, orgId, parsed\.data, expected\)/);
    const settings = read('src/app/actions/admin-settings.ts');
    assert.match(settings, /await saveBrandFields\(ctx\.supabase, ctx\.org\.id, values, expected\)/, '/admin/sirket ortak çekirdeği kullanmıyor');
    assert.match(settings, /saveBrandFields\(ctx\.supabase, ctx\.org\.id, \{ hero_title/, 'ana sayfa metinleri taslağa gitmiyor');
    // Şirket ayarları artık ayar tablosuna marka yazmaz
    const company = settings.slice(settings.indexOf('export async function saveCompanySettings'), settings.indexOf('export async function saveSiteSettings'));
    assert.doesNotMatch(company, /from\('organization_settings'\)/);
  });
});

describe('BD-03: logo yaşam döngüsü', async () => {
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 400, height: 160, channels: 4, background: { r: 20, g: 60, b: 90, alpha: 1 } } }).png().toBuffer();

  test('yeni logo yeni yola yüklenir ve YOLU taslağa bağlanır; canlı logo ve eski dosya dokunulmaz', async () => {
    const db = fakeDb();
    const st = fakeStorage();
    const res = await branding.uploadBrandingDraft({ db, storage: st, orgId: ORG, kind: 'logo', input: png });
    assert.match(res.path, new RegExp(`^organizations/${ORG}/branding/logo-[0-9a-f]{16}-\\d+x\\d+\\.png$`));
    assert.notEqual(res.path, LIVE.logo_url);
    assert.deepEqual(st.ops.map((o) => o.op), ['upload'], 'eski dosya silindi');
    assert.equal(st.ops[0].bucket, 'branding');
    assert.deepEqual(brandCall(db).args.p_value, { logo_url: res.path });
  });

  test('taslağa bağlanamazsa (yetki / başka kiracı) yalnızca YENİ dosya silinir', async () => {
    const db = fakeDb({ rpcError: (name) => (name === 'site_save_draft' ? 'forbidden' : null) });
    const st = fakeStorage();
    await assert.rejects(() => branding.uploadBrandingDraft({ db, storage: st, orgId: ORG, kind: 'logo', input: png }));
    const up = st.ops.find((o) => o.op === 'upload');
    const rm = st.ops.find((o) => o.op === 'remove');
    assert.deepEqual(rm.paths, [up.path]);
    assert.ok(!rm.paths.includes(LIVE.logo_url));
  });

  test('görsel kaldırma taslakta boş değer yazar, dosya silmez; paylaşım görseli ofiste taslak türü değildir', async () => {
    const db = fakeDb();
    await branding.removeBrandingDraft(db, ORG, 'logo');
    assert.deepEqual(brandCall(db).args.p_value, { logo_url: null });
    await assert.rejects(() => branding.removeBrandingDraft(fakeDb(), ORG, 'og'), /Geçersiz görsel türü/);
    assert.deepEqual([...branding.DRAFT_BRANDING_KINDS].sort(), ['favicon', 'hero', 'logo', 'logo_mobile']);
  });

  test('ofis görsel uç noktası taslak türlerini ortak çekirdeğe yollar; organizasyon oturumdan', () => {
    const route = read('src/app/api/admin/branding/route.ts');
    assert.match(route, /if \(DRAFT_BRANDING_KINDS\.includes\(kind\)\)[\s\S]*?uploadBrandingDraft\(\{[\s\S]*?orgId: ctx\.org\.id/);
    assert.doesNotMatch(route, /form\.get\('orgId'\)/);
    const platform = read('src/app/api/platform/branding/route.ts');
    assert.match(platform, /uploadBrandingDraft\(/);
    assert.doesNotMatch(platform, /\.from\('organization_settings'\)\.update/);
  });
});

describe('BD-05: önizleme taslağı okur', () => {
  test('applyBrandDraft tipli taslak alanlarını canlının üzerine bindirir', () => {
    const merged = applyBrandDraft(LIVE, { display_name: 'Önizleme Ofis', logo_url: 'organizations/x/branding/logo-yeni.png', opening_hours: [], office_latitude: 41 });
    assert.equal(merged.display_name, 'Önizleme Ofis');
    assert.equal(merged.logo_url, 'organizations/x/branding/logo-yeni.png');
    assert.deepEqual(merged.opening_hours, []);
    assert.equal(merged.office_latitude, 41);
    assert.equal(merged.phone, LIVE.phone);
    assert.equal(LIVE.display_name, 'Canlı Ofis', 'canlı nesne değişti');
  });

  test('taslak belgesindeki tipli marka alanları şemadan geçer (bozuk değer tüm markayı düşürmez)', () => {
    const cfg = parseSiteConfig({ brand: { display_name: 'A', opening_hours: [{ days: ['mon'], opens: '09:00', closes: '17:00' }], office_latitude: 39.1 } });
    assert.equal(cfg.brand.display_name, 'A');
    assert.equal(cfg.brand.office_latitude, 39.1);
    assert.equal(cfg.brand.opening_hours.length, 1);
  });

  test('kiracı sayfaları önizlemede taslak markayı kullanır (aynı Site Engine)', () => {
    const load = read('src/site-config/load.ts');
    assert.match(load, /return \{ \.\.\.tenant, settings: applyBrandDraft\(tenant\.settings, brand\) \};/);
    assert.match(read('src/app/t/[tenant]/layout.tsx'), /requireSiteTenant|withPreviewBrand/);
  });
});

/** Bir fonksiyonun migration'lardaki SON tanımı */
function lastDefinition(fn) {
  let def = null;
  for (const f of readdirSync(root + 'supabase/migrations').filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(root + 'supabase/migrations/' + f, 'utf8');
    for (const m of sql.matchAll(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?\\n\\$\\$;`, 'g'))) def = m[0];
  }
  return def;
}

describe('BD-06/08: yayın, geri alma ve tek yayın noktası (veritabanı)', () => {
  test('yayın ve geri alma markayı site_apply_brand ile uygular; uygulama sütun tipine duyarlı ve bayraklı', () => {
    assert.match(lastDefinition('site_publish'), /perform public\.site_apply_brand\(p_org, v_row\.draft -> 'brand'\);/);
    assert.match(lastDefinition('site_rollback'), /perform public\.site_apply_brand\(p_org, v_config -> 'brand'\);/);
    const apply = lastDefinition('site_apply_brand');
    assert.match(apply, /jsonb_populate_record\(null::public\.organization_settings/);
    assert.match(apply, /set_config\('app\.site_brand_apply', 'on', true\)/);
  });

  test('ayar kaydı koruması: marka/site içeriği yalnızca yayın bayrağıyla değişir (süper admin hariç); SEO serbest', () => {
    const guard = lastDefinition('organization_settings_guard');
    assert.match(guard, /f = any \(public\.site_brand_columns\(\)\) and f <> 'og_image_url'/);
    assert.match(guard, /current_setting\('app\.site_brand_apply', true\)/);
    assert.match(guard, /brand_requires_publish/);
    assert.match(guard, /not public\.has_org_permission\(new\.organization_id, 'settings\.manage'\)/);
  });

  test('yayın / geri alma servisleri aynı ortak fonksiyonlar', async () => {
    const db = fakeDb();
    await service.publishDraft(db, ORG);
    await service.rollbackToVersion(db, ORG, 2);
    assert.deepEqual(db.calls.map((c) => c.name), ['site_publish', 'site_rollback']);
  });
});

describe('BD-07: yetki ve organizasyon kaynağı', () => {
  const src = read('src/app/actions/admin-settings.ts');
  const body = (name) => src.slice(src.indexOf(`export async function ${name}(`)).split('\nexport ')[0];

  test("şirket ve ana sayfa ayarları settings.manage ister, kimliği oturumdan alır, organizasyon parametresi yok", () => {
    for (const fn of ['saveCompanySettings', 'saveSiteSettings']) {
      const b = body(fn);
      assert.match(b, /requirePermission\('settings\.manage'\)/, `${fn}: yetki yok`);
      assert.match(b, /ctx\.org\.id/);
      assert.doesNotMatch(b.split('\n')[0], /org|tenant|site_?id/i, `${fn}: istemciden kimlik alıyor`);
    }
  });

  test('görsel kaldırma tür yetkisine bağlı; taslak türleri settings.manage', async () => {
    const { BRANDING_PERMISSION } = await import('@/modules/media/branding');
    for (const k of branding.DRAFT_BRANDING_KINDS) assert.equal(BRANDING_PERMISSION[k], 'settings.manage', k);
    assert.match(body('removeBrandingImage'), /requirePermission\(BRANDING_PERMISSION\[kind\]\)[\s\S]*removeBrandingDraft\(ctx\.supabase, ctx\.org\.id, kind\)/);
  });
});

describe('BD-09: eşzamanlılık belirteci', () => {
  test('belirteç verilirse veritabanına iletilir; verilmezse eski davranış', async () => {
    const a = fakeDb();
    await service.saveBrandFields(a, ORG, { display_name: 'X Ofis' }, '2026-10-06T09:00:00.000001+00:00');
    assert.equal(brandCall(a).args.p_expected_updated_at, '2026-10-06T09:00:00.000001+00:00');
    const b = fakeDb();
    await service.saveBrandFields(b, ORG, { display_name: 'X Ofis' });
    assert.ok(!('p_expected_updated_at' in brandCall(b).args));
  });

  test('aile uygulamasında belirteç yalnızca ilk yazımda denetlenir (art arda kendi yazımına takılmaz)', async () => {
    const db = fakeDb();
    await service.applyFamilyToDraft(db, ORG, 'sinematik-vitrin', ['sinematik-vitrin'], 'T0');
    const writes = db.calls.filter((c) => c.name === 'site_save_draft');
    assert.equal(writes[0].args.p_expected_updated_at, 'T0');
    assert.ok(writes.slice(1).every((c) => !('p_expected_updated_at' in c.args)));
  });

  test('veritabanı eski taslağı reddeder (PostgREST yeniden denemesin diye 40001 değil)', async () => {
    const def = lastDefinition('site_save_draft');
    assert.match(def, /p_expected_updated_at is not null and v_updated_at is distinct from p_expected_updated_at/);
    assert.match(def, /raise exception 'stale_draft' using errcode = 'PT409'/);
    assert.match(def, /return v_now;/);
    const { mapDbError } = await import('@/platform/actions');
    assert.match(mapDbError({ message: 'stale_draft' }), /siz açtıktan sonra değiştirildi/);
  });
});

describe('BD-10: beyaz liste uygulama = veritabanı', () => {
  test('BRAND_FIELDS ile site_brand_columns aynı alanları içerir', () => {
    const cols = [...lastDefinition('site_brand_columns').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual([...BRAND_FIELDS].sort(), cols);
  });
});
