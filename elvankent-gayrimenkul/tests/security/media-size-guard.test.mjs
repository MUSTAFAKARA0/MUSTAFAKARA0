/**
 * KI-42 · E: orijinal dosyanın gerçek boyutu bekleyen satırda bildirilen boyutu aşamaz
 * (supabase/pending/20261108000001_media_size_guard.sql). Gerçek (yerel) Supabase Storage'a karşı çalışır; kendi geçici
 * organizasyonlarını (sztest-*) oluşturur ve sonunda SİLER.
 *
 *   SZ-01  1 bayt bildirip büyük dosya: imzalı adresle ve oturumla yükleme reddedilir, nesne oluşmaz (02.11 medya denetimi;
 *          dış denetim 05.11 F02 / ME-02)
 *   SZ-02  dürüst yükleme (bildirilen = gerçek) ve bildirilenden küçük dosya kabul edilir; sonlandırma gerçek boyutu yazar
 *   SZ-03  içerik görseli (post_cover) yolu da korunur
 *   SZ-04  reddedilen yüklemeden sonra aynı satıra doğru boyutla yükleme çalışır
 *   SZ-05  service_role (sahibi boş: geri yükleme --apply) etkilenmez
 *   SZ-06  tetikleyici fonksiyonu hiçbir istemciye açık değil; E, C yokken 'apply C first' ile durur; dosya sırası
 *   SZ-07  panelin standart yolu (FormData, istek gövdesi dosyadan büyük): dürüst kabul, fazlası red
 *   SZ-08  panelin TUS yolu (eşik üstü, iki parça): dürüst kabul, 1 bayt bildirim tamamlamada red
 *   Kopyalama (POST /object/copy) ayrıca test edilmedi: storage-api v1.82.1 copyObject hedefi kaynağın metadata'sı (boyut
 *   dahil) ve çağıranın kimliğiyle canUpload'dan geçirir; E bayt kopyalanmadan reddeder (kaynaktan doğrulandı).
 *
 * CI'da (CI=true) atlanmaz, hata verir.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const execFileP = promisify(execFile);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; boyut koruması testleri yalnızca yerel Supabase ile çalışır`);
}
const missing = !url || !anonKey || !serviceKey;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = missing ? null : createClient(url, serviceKey, opts);
const anon = missing ? null : createClient(url, anonKey, opts);

const dbUrl = process.env.DB_URL;
const dbUrlLocal = !!dbUrl && /^postgres(ql)?:\/\/([^@/]*@)?(127\.0\.0\.1|localhost)(:\d+)?(\/\w+)?$/.test(dbUrl);
const psql = async (args, input) => {
  if (!dbUrl) throw new Error('CI: DB_URL tanımlı değil (bu test psql ile yerel veritabanına bağlanır)');
  assert.ok(dbUrlLocal, 'DB_URL yerel değil; test yalnızca yerel veritabanında çalışır');
  const child = execFileP('psql', [dbUrl, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...args], { maxBuffer: 1 << 24 });
  child.child.stdin.end(input ?? '');
  return (await child).stdout;
};
const psqlSql = (sql) => psql([], `${sql.trimEnd().replace(/;$/, '')};\n`);

let skip = missing ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;
if (!skip) {
  if (!dbUrlLocal) {
    if (process.env.CI) throw new Error('CI: DB_URL tanımlı değil ya da yerel değil');
    skip = 'DB_URL tanımlı değil (yerel)';
  } else {
    const has = (await psqlSql("select to_regprocedure('public.media_storage_size_guard()') is not null")).trim();
    if (has !== 't') {
      if (process.env.CI) throw new Error('CI: KI-42 bekleyen migration (E) uygulanmamış');
      skip = 'KI-42 bekleyen migration (E) bu veritabanında uygulanmamış (supabase/pending)';
    }
  }
}

const RUN = randomBytes(3).toString('hex');
const prefix = (first) => first + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const PASSWORD = `Sz-${randomBytes(8).toString('hex')}-7a`;
const PLAN = `szplan_${RUN}`;
const JPEG = 'image/jpeg';
const WEBP = 'image/webp';
const createdUsers = [];
const createdOrgs = [];
const uploaded = { media: new Set(), 'media-originals': new Set() };
let taxonomy;
let A;

async function makeOrg(label) {
  const { data: org, error } = await service
    .from('organizations')
    .insert({ slug: `sztest-${RUN}-${label}`, name: `Boyut ${label}`, reference_prefix: prefix('Z'), status: 'active' })
    .select('id')
    .single();
  assert.ifError(error);
  createdOrgs.push(org.id);
  assert.ifError((await service.from('organization_settings').insert({ organization_id: org.id, display_name: `Boyut ${label}` })).error);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: org.id, plan_id: PLAN, status: 'active' })).error);
  const email = `sz-${RUN}-${label}@example.test`;
  const u = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(u.error);
  createdUsers.push(u.data.user.id);
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  assert.ifError((await service.from('organization_members').insert({ organization_id: org.id, user_id: u.data.user.id, role: 'owner', status: 'active' })).error);
  const listing = await client
    .from('properties')
    .insert({
      organization_id: org.id,
      title: `Boyut testi ${label}`,
      listing_type: 'sale',
      property_type_id: taxonomy.typeId,
      category: 'konut',
      city_id: taxonomy.cityId,
      district_id: taxonomy.districtId,
      slug: '',
      reference_no: '',
      status: 'draft',
    })
    .select('id')
    .single();
  assert.ifError(listing.error);
  return { id: org.id, userId: u.data.user.id, client, propertyId: listing.data.id };
}

/** Uygulamanın createMediaUpload'ı gibi: oturumla bekleyen satır, bildirilen boyutla */
async function pendingRow(declared, kind = 'property_photo') {
  const id = randomUUID();
  const folder = kind === 'post_cover' ? `organizations/${A.id}/content/${id}` : `organizations/${A.id}/properties/${A.propertyId}/images/${id}`;
  const r = await A.client.from('media_assets').insert({
    id,
    organization_id: A.id,
    property_id: kind === 'post_cover' ? null : A.propertyId,
    kind,
    status: 'pending',
    original_path: `${folder}/original`,
    mime_type: JPEG,
    byte_size: declared,
    original_filename: 'x.jpg',
    created_by: A.userId,
  });
  assert.ifError(r.error);
  uploaded['media-originals'].add(`${folder}/original`);
  return { id, folder, original: `${folder}/original` };
}

const sign = (path) => A.client.storage.from('media-originals').createSignedUploadUrl(path);
const viaToken = (path, token, size) =>
  A.client.storage.from('media-originals').uploadToSignedUrl(path, token, Buffer.alloc(size, 3), { contentType: JPEG });
const objectSize = async (path) => {
  const slash = path.lastIndexOf('/');
  const r = await service.storage.from('media-originals').list(path.slice(0, slash), { search: path.slice(slash + 1) });
  assert.ifError(r.error);
  const hit = r.data.find((o) => o.name === path.slice(slash + 1));
  return hit ? Number(hit.metadata?.size) : null;
};
const rowOf = async (id) => {
  const r = await service.from('media_assets').select('status, byte_size').eq('id', id).single();
  assert.ifError(r.error);
  return r.data;
};

before(async () => {
  if (skip) return;
  const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
  assert.ifError(type.error);
  const district = await anon.from('districts').select('id, city_id').limit(1).single();
  assert.ifError(district.error);
  taxonomy = { typeId: type.data.id, districtId: district.data.id, cityId: district.data.city_id };
  assert.ifError((await service.from('plans').insert({ id: PLAN, name: 'Boyut', max_users: 5, max_properties: 5, max_storage_mb: 500, is_public: false })).error);
  A = await makeOrg('a');
});

after(async () => {
  if (skip) return;
  for (const id of createdOrgs) await service.from('organizations').delete().eq('id', id);
  for (let i = 0; i < 20; i += 1) {
    const r = await service.rpc('media_queue_claim', { p_limit: 1000 });
    if (r.error) break;
    const mine = r.data.filter((x) => createdOrgs.some((id) => x.path.includes(id)));
    if (mine.length) await service.rpc('media_queue_done', { p_ids: mine.map((x) => x.id) });
    if (r.data.length < 1000) break;
  }
  for (const bucket of Object.keys(uploaded)) {
    const paths = [...uploaded[bucket]];
    for (let i = 0; i < paths.length; i += 100) await service.storage.from(bucket).remove(paths.slice(i, i + 100));
  }
  await service.from('plans').delete().eq('id', PLAN);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
});

describe('SZ-01 bildirilenden büyük orijinal reddedilir', { skip }, () => {
  test('1 bayt bildirip 64 KB: imzalı adresle yükleme reddedilir, nesne oluşmaz, satır bekleyen ve 1 bayt kalır', async () => {
    const row = await pendingRow(1);
    const s = await sign(row.original);
    assert.ifError(s.error, 'imzalama (yükleme öncesi deneme) gerçek boyut olmadan geçer');
    const up = await viaToken(row.original, s.data.token, 64 * 1024);
    assert.ok(up.error, 'büyük dosya reddedilmeli');
    assert.equal(await objectSize(row.original), null, 'reddedilen yüklemenin nesnesi kalmamalı');
    assert.deepEqual(await rowOf(row.id), { status: 'pending', byte_size: 1 });
  });

  test('oturumla doğrudan yükleme de reddedilir (bildirilen + 1 bayt)', async () => {
    const row = await pendingRow(1000);
    const up = await A.client.storage.from('media-originals').upload(row.original, Buffer.alloc(1001, 4), { contentType: JPEG });
    assert.ok(up.error, 'bildirilenden 1 bayt büyük dosya reddedilmeli');
    assert.equal(await objectSize(row.original), null);
  });
});

describe('SZ-02 dürüst yükleme etkilenmez', { skip }, () => {
  test('bildirilen = gerçek: yükleme ve media_finalize çalışır; satıra gerçek boyut yazılır', async () => {
    const row = await pendingRow(2048);
    const s = await sign(row.original);
    assert.ifError(s.error);
    assert.ifError((await viaToken(row.original, s.data.token, 2048)).error);
    assert.equal(await objectSize(row.original), 2048);
    const base = `${row.folder}/${randomBytes(6).toString('base64url').replace(/-/g, 'x')}`;
    uploaded.media.add(`${base}/w320.webp`);
    assert.ifError((await A.client.storage.from('media').upload(`${base}/w320.webp`, Buffer.alloc(500, 7), { contentType: WEBP })).error);
    const f = await A.client.rpc('media_finalize', {
      p_media: row.id,
      p_expected_base: null,
      p_public_base: base,
      p_variant_widths: [320],
      p_width: 1920,
      p_height: 1280,
      p_blur: null,
    });
    assert.ifError(f.error);
    assert.deepEqual(await rowOf(row.id), { status: 'ready', byte_size: 2048 });
  });

  test('bildirilenden küçük dosya kabul edilir', async () => {
    const row = await pendingRow(5000);
    const s = await sign(row.original);
    assert.ifError(s.error);
    assert.ifError((await viaToken(row.original, s.data.token, 1200)).error);
    assert.equal(await objectSize(row.original), 1200);
  });
});

describe('SZ-03 içerik görseli', { skip }, () => {
  test('post_cover yolu: bildirilenden büyük reddedilir, eşit kabul edilir', async () => {
    const big = await pendingRow(10, 'post_cover');
    const s1 = await sign(big.original);
    assert.ifError(s1.error);
    assert.ok((await viaToken(big.original, s1.data.token, 4096)).error);
    assert.equal(await objectSize(big.original), null);
    const ok = await pendingRow(4096, 'post_cover');
    const s2 = await sign(ok.original);
    assert.ifError(s2.error);
    assert.ifError((await viaToken(ok.original, s2.data.token, 4096)).error);
  });
});

describe('SZ-04 reddedilen yüklemeden sonra', { skip }, () => {
  test('aynı satıra bildirilen boyutta dosya yüklenebilir (nesne yarım kalmaz)', async () => {
    const row = await pendingRow(3000);
    const s = await sign(row.original);
    assert.ifError(s.error);
    assert.ok((await viaToken(row.original, s.data.token, 3001)).error);
    const again = await sign(row.original);
    assert.ifError(again.error);
    assert.ifError((await viaToken(row.original, again.data.token, 3000)).error);
    assert.equal(await objectSize(row.original), 3000);
  });
});

describe('SZ-05 service_role', { skip }, () => {
  test('sahibi boş yazım (geri yükleme --apply) bildirilenden büyük dosyayı yükler', async () => {
    const row = await pendingRow(1);
    assert.ifError((await service.storage.from('media-originals').upload(row.original, Buffer.alloc(4096, 9), { contentType: JPEG })).error);
    assert.equal(await objectSize(row.original), 4096);
  });
});

/** Panelin standart yolu (upload-engine.ts standardUpload): imzalı adrese çok parçalı (FormData) PUT */
async function panelStandardUpload(path, token, size) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', new Blob([Buffer.alloc(size, 6)], { type: JPEG }));
  const res = await fetch(`${url}/storage/v1/object/upload/sign/media-originals/${encoded}?token=${encodeURIComponent(token)}`, {
    method: 'PUT',
    headers: { apikey: anonKey },
    body,
  });
  await res.arrayBuffer();
  return res.status;
}

/** Panelin devam ettirilebilir yolu (upload-engine.ts resumableUpload): TUS, imza başlığıyla, 6 MB parça */
async function panelResumableUpload(path, token, size) {
  const tus = await import('tus-js-client');
  return new Promise((resolve) => {
    const upload = new tus.Upload(Buffer.alloc(size, 8), {
      endpoint: `${url}/storage/v1/upload/resumable/sign`,
      headers: { 'x-signature': token, apikey: anonKey },
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      retryDelays: [],
      storeFingerprintForResuming: false,
      metadata: { bucketName: 'media-originals', objectName: path, contentType: JPEG, cacheControl: '3600' },
      onError: (error) => resolve({ ok: false, status: error?.originalResponse?.getStatus?.() ?? 0 }),
      onSuccess: () => resolve({ ok: true }),
    });
    upload.start();
  });
}

describe('SZ-07 panelin çok parçalı (FormData) yolu: istek gövdesi dosyadan büyük olsa da dürüst yükleme kabul', { skip }, () => {
  test('bildirilen = dosya boyutu: kabul, depodaki boyut dosyanınki; bildirilenden büyük: red', async () => {
    const honest = await pendingRow(3333);
    const s1 = await sign(honest.original);
    assert.ifError(s1.error);
    const st = await panelStandardUpload(honest.original, s1.data.token, 3333);
    assert.ok(st >= 200 && st < 300, `dürüst çok parçalı yükleme kabul edilmeli (HTTP ${st})`);
    assert.equal(await objectSize(honest.original), 3333);
    const liar = await pendingRow(1);
    const s2 = await sign(liar.original);
    assert.ifError(s2.error);
    const st2 = await panelStandardUpload(liar.original, s2.data.token, 3333);
    assert.ok(st2 >= 400, `bildirilenden büyük reddedilmeli (HTTP ${st2})`);
    assert.equal(await objectSize(liar.original), null);
  });
});

describe('SZ-08 panelin devam ettirilebilir (TUS) yolu, eşik üstü dosya', { skip }, () => {
  const SIZE = 7 * 1024 * 1024; // RESUMABLE_THRESHOLD (6 MB) üstü: iki parça
  test('bildirilen = dosya boyutu: TUS ile kabul; 1 bayt bildirip aynı dosya: tamamlamada red, nesne yok', async () => {
    const honest = await pendingRow(SIZE);
    const s1 = await sign(honest.original);
    assert.ifError(s1.error);
    const ok = await panelResumableUpload(honest.original, s1.data.token, SIZE);
    assert.deepEqual(ok, { ok: true }, 'dürüst TUS yüklemesi kabul edilmeli');
    assert.equal(await objectSize(honest.original), SIZE);
    const liar = await pendingRow(1);
    const s2 = await sign(liar.original);
    assert.ifError(s2.error);
    const bad = await panelResumableUpload(liar.original, s2.data.token, SIZE);
    assert.equal(bad.ok, false, 'bildirilenden büyük TUS yüklemesi reddedilmeli');
    assert.equal(await objectSize(liar.original), null);
  });
});

describe('SZ-06 yetkiler ve sıra', { skip }, () => {
  test('tetikleyici fonksiyonu anon, authenticated ve service_role için kapalı; tetikleyici tam bir kez', async () => {
    const out = await psqlSql(`select string_agg(r || '=' || has_function_privilege(r, 'public.media_storage_size_guard()', 'execute'), ',' order by r)
      from unnest(array['anon', 'authenticated', 'service_role']) r`);
    assert.equal(out.trim(), 'anon=false,authenticated=false,service_role=false');
    const t = await psqlSql("select count(*) from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = 'storage.objects'::regclass");
    assert.equal(t.trim(), '1');
  });

  test("E, C yokken 'apply C first' ile durur ve işlem geri alınır", async () => {
    const script = ['begin;', 'drop table public.media_overwrite_window;', '\\i supabase/pending/20261108000001_media_size_guard.sql', 'rollback;', ''].join('\n');
    await assert.rejects(() => psql([], script), (err) => /apply C first/.test(String(err.stderr)));
    assert.equal((await psqlSql("select to_regclass('public.media_overwrite_window') is not null")).trim(), 't');
  });

  test("E dosyası C'den sonra sıralanır (CI glob sırası)", () => {
    const files = readdirSync('supabase/pending').sort();
    assert.ok(files.indexOf('20261108000001_media_size_guard.sql') > files.indexOf('20261027000003_media_storage_slots.sql'));
  });
});
