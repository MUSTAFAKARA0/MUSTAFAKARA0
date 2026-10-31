/**
 * KI-38 · başıboş medya dosyaları (supabase/pending/20261031000001_media_stray_sweep.sql = D) ve C'nin "bir kez yaz" kuralı.
 * Gerçek (yerel) Supabase'e karşı çalışır; kendi geçici organizasyonlarını (swtest-*) oluşturur ve sonunda SİLER.
 *
 *   SW-01  media: güncel taban dışındaki ve 1 saatten eski varyant listelenir; güncel taban ve yeni (< 1 saat) taban listelenmez
 *   SW-02  kaydı silinmiş satırın varyantları listelenir; satırsız ve 24 saatten eski orijinal listelenir, yenisi ve satırlı olan listelenmez
 *   SW-03  media_stray_objects yalnız service_role; anon/authenticated çağıramaz; org_id yoldaki kurumdur; sınır 1000
 *   SW-04  C bir kez yazar: bekleyen satırda da var olan orijinalin üzerine yazılamaz (oturum, upsert imzası); yeni yükleme çalışır
 *   SW-05  D kendini korur: A yokken 'apply A first'; dosya sırası
 *
 * Nesnelerin yaşını geri almak için storage.objects.created_at psql ile değiştirilir (bakım penceresi altında, yalnız yerel).
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
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; başıboş dosya testleri yalnızca yerel Supabase ile çalışır`);
}
const missing = !url || !anonKey || !serviceKey;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = missing ? null : createClient(url, serviceKey, opts);
const anon = missing ? null : createClient(url, anonKey, opts);

let skip = missing ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;
if (!skip) {
  const probe = await service.rpc('media_queue_claim', { p_limit: 0 });
  if (probe.error) {
    if (process.env.CI) throw new Error(`CI: WP-A2 bekleyen migration (A) uygulanmamış (${probe.error.message})`);
    skip = 'WP-A2 bekleyen migration (A) bu veritabanında uygulanmamış (supabase/pending)';
  }
}
const dbUrl = process.env.DB_URL;
const dbUrlLocal = !!dbUrl && /^postgres(ql)?:\/\/([^@/]*@)?(127\.0\.0\.1|localhost)(:\d+)?(\/\w+)?$/.test(dbUrl);
if (!skip && !dbUrl) {
  if (process.env.CI) throw new Error('CI: DB_URL tanımlı değil (bu test psql ile yerel veritabanına bağlanır)');
  skip = 'DB_URL tanımlı değil';
}
const psql = async (input) => {
  assert.ok(dbUrlLocal, 'DB_URL yerel değil; test yalnızca yerel veritabanında çalışır');
  const child = execFileP('psql', [dbUrl, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { maxBuffer: 1 << 24 });
  child.child.stdin.end(`${input.trimEnd().replace(/;$/, '')};\n`);
  return (await child).stdout;
};

const RUN = randomBytes(3).toString('hex');
const prefix = (first) => first + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const PASSWORD = `Sw-${randomBytes(8).toString('hex')}-7a`;
const PLAN = `swplan_${RUN}`;
const createdUsers = [];
const createdOrgs = [];
const uploaded = { media: new Set(), 'media-originals': new Set() };
let taxonomy;

async function makeOrg(label) {
  const { data: org, error } = await service
    .from('organizations')
    .insert({ slug: `swtest-${RUN}-${label}`, name: `Süpürme ${label}`, reference_prefix: prefix('W'), status: 'active' })
    .select('id')
    .single();
  assert.ifError(error);
  createdOrgs.push(org.id);
  assert.ifError((await service.from('organization_settings').insert({ organization_id: org.id, display_name: `Süpürme ${label}` })).error);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: org.id, plan_id: PLAN, status: 'active' })).error);
  const email = `sw-${RUN}-${label}@example.test`;
  const u = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(u.error);
  createdUsers.push(u.data.user.id);
  assert.ifError((await service.from('organization_members').insert({ organization_id: org.id, user_id: u.data.user.id, role: 'owner', status: 'active' })).error);
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  const listing = await client
    .from('properties')
    .insert({ organization_id: org.id, title: `Süpürme ${label}`, listing_type: 'sale', property_type_id: taxonomy.typeId, category: 'konut', city_id: taxonomy.cityId, district_id: taxonomy.districtId, slug: '', reference_no: '', status: 'draft' })
    .select('id')
    .single();
  assert.ifError(listing.error);
  return { id: org.id, userId: u.data.user.id, client, propertyId: listing.data.id };
}

const rev = () => randomBytes(6).toString('base64url').replace(/-/g, 'x');
const put = async (client, bucket, path, size, upsert = false) => {
  uploaded[bucket].add(path);
  return client.storage.from(bucket).upload(path, Buffer.alloc(size, 5), { contentType: bucket === 'media' ? 'image/webp' : 'image/jpeg', upsert });
};
/** Nesneyi "eski" yapar (yalnız yerel; C'nin tetikleyicisi UPDATE'i reddettiği için bakım penceresi altında) */
const age = (bucket, path, interval) =>
  psql(`begin;
insert into public.media_overwrite_window (id, open_until) values (true, now() + interval '1 minute') on conflict (id) do update set opened_at = now(), open_until = excluded.open_until;
update storage.objects set created_at = now() - interval '${interval}' where bucket_id = '${bucket}' and name = '${path}';
delete from public.media_overwrite_window;
commit`);
const stray = async () => {
  const r = await service.rpc('media_stray_objects', { p_limit: 1000 });
  assert.ifError(r.error);
  return r.data.filter((x) => createdOrgs.includes(x.org_id));
};
const has = (list, bucket, path) => list.some((x) => x.bucket === bucket && x.path === path);

async function pendingRow(org) {
  const id = randomUUID();
  const folder = `organizations/${org.id}/properties/${org.propertyId}/images/${id}`;
  const r = await org.client.from('media_assets').insert({
    id, organization_id: org.id, property_id: org.propertyId, kind: 'property_photo', status: 'pending',
    original_path: `${folder}/original`, mime_type: 'image/jpeg', byte_size: 1000, original_filename: 'x.jpg', created_by: org.userId,
  });
  assert.ifError(r.error);
  return { id, folder, original: `${folder}/original` };
}
async function readyRow(org) {
  const row = await pendingRow(org);
  assert.ifError((await put(org.client, 'media-originals', row.original, 300)).error);
  const base = `${row.folder}/${rev()}`;
  assert.ifError((await put(org.client, 'media', `${base}/w320.webp`, 100)).error);
  const f = await org.client.rpc('media_finalize', { p_media: row.id, p_expected_base: null, p_public_base: base, p_variant_widths: [320], p_width: 10, p_height: 10, p_blur: null });
  assert.ifError(f.error);
  return { ...row, base };
}

const O = {};
before(async () => {
  if (skip) return;
  const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
  assert.ifError(type.error);
  const district = await anon.from('districts').select('id, city_id').limit(1).single();
  assert.ifError(district.error);
  taxonomy = { typeId: type.data.id, districtId: district.data.id, cityId: district.data.city_id };
  assert.ifError((await service.from('plans').insert({ id: PLAN, name: 'Süpürme', max_users: 5, max_properties: 5, max_storage_mb: 500, is_public: false })).error);
  O.a = await makeOrg('a');
});

after(async () => {
  if (skip) return;
  for (const id of createdOrgs) await service.from('organizations').delete().eq('id', id);
  for (let i = 0; i < 20; i += 1) {
    const r = await service.rpc('media_queue_claim', { p_limit: 1000 });
    if (r.error) break;
    const mine = r.data.filter((x) => createdOrgs.includes(x.org_id));
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

describe('SW-01 güncel olmayan varyantlar', { skip }, () => {
  test('eski ek taban listelenir; güncel taban ve yeni ek taban listelenmez', async () => {
    const row = await readyRow(O.a);
    const old = `${row.folder}/${rev()}/w320.webp`;
    const fresh = `${row.folder}/${rev()}/w320.webp`;
    assert.ifError((await put(O.a.client, 'media', old, 50)).error);
    assert.ifError((await put(O.a.client, 'media', fresh, 50)).error);
    await age('media', old, '2 hours');
    await age('media', `${row.base}/w320.webp`, '2 hours');
    const list = await stray();
    assert.ok(has(list, 'media', old), 'eski ek taban listelenmeli');
    assert.ok(!has(list, 'media', fresh), '1 saatten yeni taban listelenmemeli');
    assert.ok(!has(list, 'media', `${row.base}/w320.webp`), 'güncel taban listelenmemeli');
    assert.equal(list.find((x) => x.path === old).org_id, O.a.id);
  });
});

describe('SW-02 kaydı olmayan dosyalar', { skip }, () => {
  test('silinen satırın ek tabanı listelenir; satırsız eski orijinal listelenir; yenisi ve satırlı orijinal listelenmez', async () => {
    const row = await readyRow(O.a);
    const extra = `${row.folder}/${rev()}/w640.webp`;
    assert.ifError((await put(O.a.client, 'media', extra, 50)).error);
    await age('media', extra, '2 hours');
    assert.ifError((await O.a.client.from('media_assets').delete().eq('id', row.id)).error);

    const keep = await readyRow(O.a);
    await age('media-originals', keep.original, '3 days');

    const orphanOld = `organizations/${O.a.id}/properties/${O.a.propertyId}/images/${randomUUID()}/original`;
    const orphanNew = `organizations/${O.a.id}/content/${randomUUID()}/original`;
    uploaded['media-originals'].add(orphanOld);
    uploaded['media-originals'].add(orphanNew);
    assert.ifError((await service.storage.from('media-originals').upload(orphanOld, Buffer.alloc(10, 1), { contentType: 'image/jpeg' })).error);
    assert.ifError((await service.storage.from('media-originals').upload(orphanNew, Buffer.alloc(10, 1), { contentType: 'image/jpeg' })).error);
    await age('media-originals', orphanOld, '25 hours');

    const list = await stray();
    assert.ok(has(list, 'media', extra), 'silinen satırın ek tabanı listelenmeli');
    assert.ok(has(list, 'media-originals', orphanOld), 'satırsız eski orijinal listelenmeli');
    assert.ok(!has(list, 'media-originals', orphanNew), '24 saatten yeni orijinal listelenmemeli');
    assert.ok(!has(list, 'media-originals', keep.original), 'satırı olan orijinal listelenmemeli');
  });
});

describe('SW-03 yetki ve sınır', { skip }, () => {
  test('yalnız service_role çağırır; sınır 0 boş, 1000 üstü 1000 ile sınırlı', async () => {
    assert.ok((await anon.rpc('media_stray_objects', { p_limit: 10 })).error);
    assert.ok((await O.a.client.rpc('media_stray_objects', { p_limit: 10 })).error);
    assert.deepEqual((await service.rpc('media_stray_objects', { p_limit: 0 })).data, []);
    const priv = await psql(`select has_function_privilege('anon', 'public.media_stray_objects(integer)', 'execute')::text || '/' || has_function_privilege('authenticated', 'public.media_stray_objects(integer)', 'execute')::text || '/' || has_function_privilege('service_role', 'public.media_stray_objects(integer)', 'execute')::text`);
    assert.equal(priv.trim(), 'false/false/true');
    assert.match(await psql("select prosrc from pg_proc where oid = 'public.media_stray_objects(integer)'::regprocedure"), /least\(coalesce\(p_limit, 0\), 1000\)/);
  });
});

describe('SW-04 C: nesneler bir kez yazılır (KI-38, DB #5)', { skip }, () => {
  test('bekleyen satırda var olan orijinalin üzerine oturum ve upsert imzasıyla yazılamaz; dosya aynı kalır', async () => {
    const row = await pendingRow(O.a);
    const s = await O.a.client.storage.from('media-originals').createSignedUploadUrl(row.original, { upsert: true });
    assert.ifError(s.error);
    uploaded['media-originals'].add(row.original);
    assert.ifError((await O.a.client.storage.from('media-originals').uploadToSignedUrl(row.original, s.data.token, Buffer.alloc(700, 2), { contentType: 'image/jpeg', upsert: true })).error);
    const again = await O.a.client.storage.from('media-originals').uploadToSignedUrl(row.original, s.data.token, Buffer.alloc(900, 3), { contentType: 'image/jpeg', upsert: true });
    assert.ok(again.error, 'imzalı üzerine yazma reddedilmeli');
    assert.ok((await put(O.a.client, 'media-originals', row.original, 950, true)).error, 'oturumla üzerine yazma reddedilmeli');
    const size = await psql(`select (metadata->>'size') from storage.objects where bucket_id = 'media-originals' and name = '${row.original}'`);
    assert.equal(size.trim(), '700');
  });
});

describe('SW-05 sıra', { skip }, () => {
  test("D, A yokken 'apply A first' ile durur ve işlem geri alınır", async () => {
    const script = "begin;\ndrop function public.media_queue_claim(integer);\n\\i supabase/pending/20261031000001_media_stray_sweep.sql\nrollback";
    await assert.rejects(() => psql(script), (err) => /apply A first/.test(String(err.stderr)));
    assert.equal((await psql("select to_regprocedure('public.media_queue_claim(integer)') is not null")).trim(), 't');
  });
  test("D dosyası C'den sonra sıralanır", () => {
    const files = readdirSync('supabase/pending').filter((f) => /^2026(1027|1031)/.test(f)).sort();
    assert.deepEqual(files.slice(-2), ['20261027000003_media_storage_slots.sql', '20261031000001_media_stray_sweep.sql']);
  });
});
