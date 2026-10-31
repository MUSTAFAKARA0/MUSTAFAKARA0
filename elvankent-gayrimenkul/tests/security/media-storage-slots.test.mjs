/**
 * KI-37 · WP-A2 C: depolama yuvaları (supabase/pending/20261027000003_media_storage_slots.sql).
 * Gerçek (yerel) Supabase'e karşı çalışır; kendi geçici organizasyonlarını (mstest-*) oluşturur ve sonunda SİLER.
 *
 * Yerel ölçüm (storage-api v1.82.1): Storage, oturum isteğinde ve İMZALAMA anında RLS'yi rolü geri alınan bir
 * deneme yazımıyla denetler; imzalı adresle yapılan asıl yükleme RLS'yi ATLAR (token 2 saat geçerli). Bu yüzden:
 *   - politika: imzalama / doğrudan yükleme anında bekleyen satır ister (SL-08, SL-09, SL-11)
 *   - tetikleyici: imzalı adresle sonradan yapılan yazımı da reddeder (SL-10)
 *
 *   SL-08  media-originals: satırsız imzalama ve doğrudan yükleme reddedilir; bekleyen satırla kabul edilir
 *   SL-09  sonlandırma sonrası: orijinal için yeni imza (upsert) ve doğrudan üzerine yazma reddedilir
 *   SL-10  bekleme anında alınmış imzalı adres: sonlandırmadan sonra üzerine yazamaz; satır silinince yükleyemez
 *   SL-11  media (varyant): satırsız, başka kurum ve güncel (sonlanmış) tabana yazma reddedilir; yeni tabana yazılır
 *   SL-12  service_role: yeni nesne yükler (geri yükleme --apply); sonlanmış nesnenin üzerine yalnız bakım penceresinde
 *   SL-13  yardımcı fonksiyonlar anon'a kapalı; C kendini korur (B yoksa 'apply B first'); dosya sırası
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
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; depolama yuvası testleri yalnızca yerel Supabase ile çalışır`);
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
const dbSkip = skip || (!dbUrl && !process.env.CI ? 'DB_URL tanımlı değil' : false);
const needDb = () => {
  if (!dbUrl) throw new Error('CI: DB_URL tanımlı değil (bu test psql ile yerel veritabanına bağlanır)');
  assert.ok(dbUrlLocal, 'DB_URL yerel değil; test yalnızca yerel veritabanında çalışır');
};
const psql = async (args, input) => {
  needDb();
  const child = execFileP('psql', [dbUrl, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...args], { maxBuffer: 1 << 24 });
  child.child.stdin.end(input ?? '');
  return (await child).stdout;
};
const psqlSql = (sql) => psql([], `${sql.trimEnd().replace(/;$/, '')};\n`);

const RUN = randomBytes(3).toString('hex');
const prefix = (first) => first + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const PASSWORD = `Ms-${randomBytes(8).toString('hex')}-7a`;
const PLAN = `msplan_${RUN}`;
const createdUsers = [];
const createdOrgs = [];
const uploaded = { media: new Set(), 'media-originals': new Set() };
let taxonomy;

async function makeUser(label) {
  const email = `ms-${RUN}-${label}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(error);
  createdUsers.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  return { id: data.user.id, client };
}

async function makeOrg(label) {
  const { data: org, error } = await service
    .from('organizations')
    .insert({ slug: `mstest-${RUN}-${label}`, name: `Yuva ${label}`, reference_prefix: prefix('Y'), status: 'active' })
    .select('id')
    .single();
  assert.ifError(error);
  createdOrgs.push(org.id);
  assert.ifError((await service.from('organization_settings').insert({ organization_id: org.id, display_name: `Yuva ${label}` })).error);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: org.id, plan_id: PLAN, status: 'active' })).error);
  const owner = await makeUser(`${label}-owner`);
  assert.ifError((await service.from('organization_members').insert({ organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' })).error);
  const listing = await owner.client
    .from('properties')
    .insert({
      organization_id: org.id,
      title: `Yuva testi ${label}`,
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
  return { id: org.id, owner, propertyId: listing.data.id };
}

const rev = () => randomBytes(6).toString('base64url').replace(/-/g, 'x');
const JPEG = 'image/jpeg';
const WEBP = 'image/webp';
const track = (bucket, path) => uploaded[bucket].add(path);
/** service_role ile yükleme (sahibi boş; Storage yeni nesneyi INSERT, var olanı UPDATE eder) */
const sput = async (bucket, path, size, contentType, upsert = false) => {
  track(bucket, path);
  return service.storage.from(bucket).upload(path, Buffer.alloc(size, 7), { contentType, upsert });
};
/** Oturum istemcisiyle doğrudan yükleme (uygulamanın varyant yüklemesi böyle) */
const uput = async (client, bucket, path, size, contentType, upsert = false) => {
  track(bucket, path);
  return client.storage.from(bucket).upload(path, Buffer.alloc(size, 7), { contentType, upsert });
};
const sign = async (client, path, upsert = false) => {
  track('media-originals', path);
  return client.storage.from('media-originals').createSignedUploadUrl(path, upsert ? { upsert: true } : undefined);
};
const viaToken = (client, path, token, size, upsert = false) =>
  client.storage.from('media-originals').uploadToSignedUrl(path, token, Buffer.alloc(size, 3), { contentType: JPEG, upsert });
const objectSize = async (bucket, path) => {
  const slash = path.lastIndexOf('/');
  const r = await service.storage.from(bucket).list(path.slice(0, slash), { search: path.slice(slash + 1) });
  assert.ifError(r.error);
  const hit = r.data.find((o) => o.name === path.slice(slash + 1));
  return hit ? Number(hit.metadata?.size) : null;
};

/** Oturum istemcisiyle kanonik bekleyen satır (uygulamanın yaptığı gibi) */
async function pendingRow(org, kind = 'property_photo') {
  const id = randomUUID();
  const folder = kind === 'post_cover' ? `organizations/${org.id}/content/${id}` : `organizations/${org.id}/properties/${org.propertyId}/images/${id}`;
  const r = await org.owner.client.from('media_assets').insert({
    id,
    organization_id: org.id,
    property_id: kind === 'post_cover' ? null : org.propertyId,
    kind,
    status: 'pending',
    original_path: `${folder}/original`,
    mime_type: JPEG,
    byte_size: 1000,
    original_filename: 'x.jpg',
    created_by: org.owner.id,
  });
  assert.ifError(r.error);
  return { id, folder, original: `${folder}/original`, org };
}

/** Uygulamanın yolu: orijinal imzalı adresle, varyantlar oturumla; sonra media_finalize */
async function readyRow(org, kind = 'property_photo') {
  const row = await pendingRow(org, kind);
  const s = await sign(org.owner.client, row.original);
  assert.ifError(s.error);
  assert.ifError((await viaToken(org.owner.client, row.original, s.data.token, 2048)).error);
  const base = `${row.folder}/${rev()}`;
  assert.ifError((await uput(org.owner.client, 'media', `${base}/w320.webp`, 500, WEBP)).error);
  const f = await org.owner.client.rpc('media_finalize', {
    p_media: row.id,
    p_expected_base: null,
    p_public_base: base,
    p_variant_widths: [320],
    p_width: 1920,
    p_height: 1280,
    p_blur: null,
  });
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
  assert.ifError((await service.from('plans').insert({ id: PLAN, name: 'Yuva', max_users: 5, max_properties: 5, max_storage_mb: 500, is_public: false })).error);
  O.a = await makeOrg('a');
  O.b = await makeOrg('b');
});

after(async () => {
  if (skip) return;
  if (dbUrlLocal) await psqlSql('delete from public.media_overwrite_window').catch(() => {});
  for (const id of createdOrgs) await service.from('organizations').delete().eq('id', id);
  // Silme kuyruğuna düşen bu testin satırları (A'nın tetikleyicisi) temizlenir
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

describe('SL-08 orijinal: imzalama anında bekleyen satır', { skip }, () => {
  test('satırsız yol: imzalama ve doğrudan yükleme reddedilir; nesne oluşmaz', async () => {
    const path = `organizations/${O.a.id}/properties/${O.a.propertyId}/images/${randomUUID()}/original`;
    assert.ok((await sign(O.a.owner.client, path)).error, 'satırsız imzalama reddedilmeli');
    assert.ok((await sign(O.a.owner.client, path, true)).error, 'satırsız upsert imzalama reddedilmeli');
    assert.ok((await uput(O.a.owner.client, 'media-originals', path, 100, JPEG)).error, 'satırsız doğrudan yükleme reddedilmeli');
    assert.equal(await objectSize('media-originals', path), null);
  });

  test('kanonik olmayan ad (aynı klasörde original.jpg, alt klasör) reddedilir', async () => {
    const row = await pendingRow(O.a);
    assert.ok((await sign(O.a.owner.client, `${row.folder}/original.jpg`)).error);
    assert.ok((await sign(O.a.owner.client, `${row.folder}/x/original`)).error);
  });

  test('bekleyen satırla imzalama ve imzalı yükleme çalışır; yenileme (upsert) de bekleyen satırda çalışır', async () => {
    for (const kind of ['property_photo', 'post_cover']) {
      const row = await pendingRow(O.a, kind);
      const s = await sign(O.a.owner.client, row.original);
      assert.ifError(s.error);
      assert.ifError((await viaToken(O.a.owner.client, row.original, s.data.token, 700)).error);
      const again = await sign(O.a.owner.client, row.original, true);
      assert.ifError(again.error);
      assert.ifError((await viaToken(O.a.owner.client, row.original, again.data.token, 900, true)).error);
      assert.equal(await objectSize('media-originals', row.original), 900);
    }
  });

  test('başka kurumun bekleyen satırının yolu imzalanamaz', async () => {
    const row = await pendingRow(O.b);
    assert.ok((await sign(O.a.owner.client, row.original)).error);
    assert.ok((await uput(O.a.owner.client, 'media-originals', row.original, 100, JPEG)).error);
  });

  test('başarısız (failed) satırın orijinali imzalanamaz', async () => {
    const row = await pendingRow(O.a);
    assert.equal((await O.a.owner.client.rpc('media_mark_failed', { p_media: row.id, p_error: 'deneme' })).data, true);
    assert.ok((await sign(O.a.owner.client, row.original)).error);
  });
});

describe('SL-09 sonlandırma sonrası orijinal', { skip }, () => {
  test('ready satırın orijinali için yeni imza (upsert ya da değil) ve doğrudan üzerine yazma reddedilir; dosya aynı', async () => {
    const row = await readyRow(O.a);
    assert.ok((await sign(O.a.owner.client, row.original, true)).error, 'upsert imzası reddedilmeli');
    assert.ok((await sign(O.a.owner.client, row.original)).error, 'imza reddedilmeli');
    assert.ok((await uput(O.a.owner.client, 'media-originals', row.original, 4096, JPEG, true)).error, 'doğrudan üzerine yazma reddedilmeli');
    assert.equal(await objectSize('media-originals', row.original), 2048);
  });

  test('ready satırın orijinali silinip yeniden yüklenemez (satır bekleyen değil)', async () => {
    const row = await readyRow(O.a);
    assert.ifError((await O.a.owner.client.storage.from('media-originals').remove([row.original])).error);
    assert.ok((await uput(O.a.owner.client, 'media-originals', row.original, 4096, JPEG)).error);
    assert.ok((await sign(O.a.owner.client, row.original)).error);
  });
});

describe('SL-10 bekleme anında alınmış imzalı adres (Storage asıl yüklemede RLS denetlemez)', { skip }, () => {
  test('upsert imzası sonlandırmadan sonra üzerine yazamaz; dosya ve satır boyutu aynı', async () => {
    const row = await pendingRow(O.a);
    const early = await sign(O.a.owner.client, row.original, true);
    assert.ifError(early.error);
    assert.ifError((await viaToken(O.a.owner.client, row.original, early.data.token, 2048, true)).error);
    const base = `${row.folder}/${rev()}`;
    assert.ifError((await uput(O.a.owner.client, 'media', `${base}/w320.webp`, 500, WEBP)).error);
    const f = await O.a.owner.client.rpc('media_finalize', {
      p_media: row.id, p_expected_base: null, p_public_base: base, p_variant_widths: [320], p_width: 10, p_height: 10, p_blur: null,
    });
    assert.ifError(f.error);
    const late = await viaToken(O.a.owner.client, row.original, early.data.token, 9000, true);
    assert.ok(late.error, 'sonlandırma sonrası imzalı üzerine yazma reddedilmeli');
    assert.equal(await objectSize('media-originals', row.original), 2048);
  });

  test('satır silindikten sonra eski imzayla yükleme reddedilir (satırsız dosya oluşmaz)', async () => {
    const row = await pendingRow(O.a);
    const early = await sign(O.a.owner.client, row.original);
    assert.ifError(early.error);
    assert.ifError((await O.a.owner.client.from('media_assets').delete().eq('id', row.id)).error);
    assert.ok((await viaToken(O.a.owner.client, row.original, early.data.token, 1000)).error);
    assert.equal(await objectSize('media-originals', row.original), null);
  });

  test('silinen ready satırın eski upsert imzası dosyayı geri getiremez', async () => {
    const row = await pendingRow(O.a);
    const early = await sign(O.a.owner.client, row.original, true);
    assert.ifError(early.error);
    assert.ifError((await viaToken(O.a.owner.client, row.original, early.data.token, 2048, true)).error);
    assert.ifError((await O.a.owner.client.storage.from('media-originals').remove([row.original])).error);
    assert.ifError((await O.a.owner.client.from('media_assets').delete().eq('id', row.id)).error);
    assert.ok((await viaToken(O.a.owner.client, row.original, early.data.token, 5000, true)).error);
  });
});

describe('SL-11 varyantlar (media kovası)', { skip }, () => {
  test('satırsız klasöre, başka kurumun satırına ve kanonik olmayan ada yazılamaz', async () => {
    const ghost = `organizations/${O.a.id}/properties/${O.a.propertyId}/images/${randomUUID()}/${rev()}/w320.webp`;
    assert.ok((await uput(O.a.owner.client, 'media', ghost, 100, WEBP)).error, 'satırsız varyant reddedilmeli');
    const foreign = await pendingRow(O.b);
    assert.ok((await uput(O.a.owner.client, 'media', `${foreign.folder}/${rev()}/w320.webp`, 100, WEBP)).error, 'başka kurum reddedilmeli');
    const own = await pendingRow(O.a);
    for (const bad of [`${own.folder}/w320.webp`, `${own.folder}/${rev()}/w320.png`, `${own.folder}/${rev()}/x/w320.webp`, `${own.folder}/bad!rev!/w320.webp`]) {
      assert.ok((await uput(O.a.owner.client, 'media', bad, 100, WEBP)).error, `kanonik olmayan ad reddedilmeli: ${bad.slice(-30)}`);
    }
  });

  test('bekleyen ve ready satırda YENİ tabana yazılır (işleme ve döndürme)', async () => {
    const pending = await pendingRow(O.a);
    assert.ifError((await uput(O.a.owner.client, 'media', `${pending.folder}/${rev()}/w320.webp`, 100, WEBP)).error);
    const ready = await readyRow(O.a, 'post_cover');
    assert.ifError((await uput(O.a.owner.client, 'media', `${ready.folder}/${rev()}-r90/w320.webp`, 100, WEBP)).error);
  });

  test('sonlanmış (güncel) tabana yeni dosya eklenemez ve var olanın üzerine yazılamaz', async () => {
    const row = await readyRow(O.a);
    assert.ok((await uput(O.a.owner.client, 'media', `${row.base}/w640.webp`, 100, WEBP)).error, 'güncel tabana ekleme reddedilmeli');
    assert.ok((await uput(O.a.owner.client, 'media', `${row.base}/w320.webp`, 4000, WEBP, true)).error, 'güncel tabanda üzerine yazma reddedilmeli');
    assert.equal(await objectSize('media', `${row.base}/w320.webp`), 500);
  });
});

describe('SL-12 service_role ve bakım penceresi', { skip: dbSkip }, () => {
  test('service_role yeni nesne yükler (geri yükleme --apply), satırsız da', async () => {
    const path = `organizations/${O.a.id}/properties/${O.a.propertyId}/images/${randomUUID()}/original`;
    assert.ifError((await sput('media-originals', path, 100, JPEG)).error);
    const row = await readyRow(O.a);
    assert.ifError((await O.a.owner.client.storage.from('media-originals').remove([row.original])).error);
    assert.ifError((await sput('media-originals', row.original, 2048, JPEG)).error);
  });

  test('sonlanmış nesnenin üzerine service_role da yazamaz; bakım penceresi açıkken yazar, kapanınca yine reddedilir', async () => {
    const row = await readyRow(O.a);
    assert.ok((await sput('media-originals', row.original, 3000, JPEG, true)).error, 'pencere kapalıyken reddedilmeli');
    assert.ok((await sput('media', `${row.base}/w320.webp`, 3000, WEBP, true)).error, 'pencere kapalıyken reddedilmeli');
    await psqlSql("insert into public.media_overwrite_window (id, open_until) values (true, now() + interval '5 minutes') on conflict (id) do update set open_until = excluded.open_until");
    try {
      assert.ifError((await sput('media-originals', row.original, 3000, JPEG, true)).error);
      assert.ifError((await sput('media', `${row.base}/w320.webp`, 3000, WEBP, true)).error);
      // Pencere yalnız service_role'ü açar; oturum istemcisi yine reddedilir (politika)
      assert.ok((await uput(O.a.owner.client, 'media-originals', row.original, 10, JPEG, true)).error);
    } finally {
      await psqlSql('delete from public.media_overwrite_window');
    }
    assert.ok((await sput('media-originals', row.original, 4000, JPEG, true)).error, 'pencere kapanınca yine reddedilmeli');
    assert.equal(await objectSize('media-originals', row.original), 3000);
  });

  test('bakım penceresi tablosuna istemciler erişemez', async () => {
    for (const client of [anon, O.a.owner.client]) {
      const w = await client.from('media_overwrite_window').insert({ id: true, open_until: new Date(Date.now() + 3600e3).toISOString() });
      assert.ok(w.error, 'pencere istemciden açılamamalı');
    }
    assert.equal((await psqlSql('select count(*) from public.media_overwrite_window')).trim(), '0');
  });
});

describe('SL-13 yetkiler ve sıra', { skip: dbSkip }, () => {
  test('yuva fonksiyonları anon ve PUBLIC için kapalı, authenticated için açık; tetikleyici fonksiyonu kimseye açık değil', async () => {
    const out = await psqlSql(`select string_agg(p || ':' || has_function_privilege('anon', p, 'execute') || '/' || has_function_privilege('authenticated', p, 'execute'), ',' order by p)
      from unnest(array['public.media_original_slot_open(text)', 'public.media_variant_slot_open(text)']) p`);
    assert.equal(out.trim(), 'public.media_original_slot_open(text):false/true,public.media_variant_slot_open(text):false/true');
    const g = await psqlSql(`select has_function_privilege('anon', 'public.media_storage_slot_guard()', 'execute') or has_function_privilege('authenticated', 'public.media_storage_slot_guard()', 'execute')`);
    assert.equal(g.trim(), 'f');
    assert.equal((await anon.rpc('media_original_slot_open', { p_name: 'organizations/x/content/y/original' })).data ?? false, false);
  });

  test("C, B yokken 'apply B first' ile durur ve işlem geri alınır", async () => {
    const script = [
      'begin;',
      'drop trigger media_assets_pending_shape on public.media_assets;',
      '\\i supabase/pending/20261027000003_media_storage_slots.sql',
      'rollback;',
      '',
    ].join('\n');
    await assert.rejects(() => psql([], script), (err) => /apply B first/.test(String(err.stderr)));
    assert.equal((await psqlSql("select count(*) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal")).trim(), '1');
  });

  test("C varken B'nin 05'i 'önce C geri alınır' ile durur; B ve C yerinde kalır", async () => {
    await assert.rejects(() => psql(['-f', 'supabase/ops/media_privileges/05_rollback.sql']), (err) => /önce C geri alınır/.test(String(err.stderr)));
    const out = await psqlSql(`select (select count(*) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal)
      || '/' || (select count(*) from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal)`);
    assert.equal(out.trim(), '1/1');
  });

  test("C dosyası A ve B'den sonra sıralanır (CI glob sırası)", () => {
    const files = readdirSync('supabase/pending').filter((f) => /^20261027/.test(f)).sort();
    assert.deepEqual(files, [
      '20261027000001_media_finalize_rpc.sql',
      '20261027000002_media_column_privileges.sql',
      '20261027000003_media_storage_slots.sql',
    ]);
  });
});
