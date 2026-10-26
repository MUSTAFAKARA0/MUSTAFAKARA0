/**
 * WP-A2 · medya sonlandırma RPC'si, sütun yetkileri ve dosya kuyruğu
 * (supabase/pending/20261027000001_media_finalize_rpc.sql = A, 20261027000002_media_column_privileges.sql = B).
 * Gerçek (yerel) Supabase'e karşı çalışır; kendi geçici organizasyonlarını (mftest-*) oluşturur ve sonunda SİLER.
 *
 *   MF-01  Bildirilen 1 B, gerçek dosya 2 KB → gerçek boyut yazılır; aralık koşulu indeks kullanır (EXPLAIN)
 *   MF-02  Başka kurum / kardeş klasör / demo yolu reddedilir; üye olmayan forbidden (kilit beklemez); anon reddedilir
 *   MF-03  Korunan sütunlara doğrudan güncelleme 42501; alt_text/sıralama/kapak çalışır; kötü ekleme reddedilir
 *   MF-04  Kota hatası satırı değiştirmez; ready döndürme kotada eski tabanı korur; eksik varyant; mark_failed
 *   MF-05  8 eşzamanlı sonlandırma kotayı aşmaz; eşzamanlı döndürmede media_conflict
 *   MF-07  Eski kodun SQL cümleleri: A altında geçer, A+B altında 42501
 *   MF-08  B kendini korur: A yokken 'apply A first'
 *   MQ     Silme kuyruğu (doğrudan silme, deyim düzeyi), kira, yetki, rapor
 *
 * CI'da (CI=true) atlanmaz, hata verir. B (sütun yetkileri) uygulanmış olmalıdır; MF-07 geçici olarak geri alıp yeniden uygular.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const execFileP = promisify(execFile);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; medya testleri yalnızca yerel Supabase ile çalışır`);
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
/** Yerel veritabanında psql (yalnızca yerel DB_URL); input verilirse stdin'e yazılır */
const psql = async (args, input) => {
  needDb();
  const child = execFileP('psql', [dbUrl, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...args], { maxBuffer: 1 << 24 });
  if (input !== undefined) child.child.stdin.end(input);
  else child.child.stdin.end();
  return (await child).stdout;
};
const psqlSql = (sql) => psql([], `${sql.trimEnd().replace(/;$/, '')};\n`);

const RUN = randomBytes(3).toString('hex');
const prefix = (first) => first + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const PASSWORD = `Mf-${randomBytes(8).toString('hex')}-7a`;
const BIG = `mfbig_${RUN}`;
const SMALL = `mfsmall_${RUN}`;
const createdUsers = [];
const createdOrgs = [];
const uploaded = { media: [], 'media-originals': [] };
let taxonomy;

async function makeUser(label) {
  const email = `mf-${RUN}-${label}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(error);
  createdUsers.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  return { id: data.user.id, client };
}

/** Kurum + etkin abonelik + sahibi + bir ilan */
async function makeOrg(label, planId = BIG) {
  const { data: org, error } = await service
    .from('organizations')
    .insert({ slug: `mftest-${RUN}-${label}`, name: `Medya ${label}`, reference_prefix: prefix('M'), status: 'active' })
    .select('id')
    .single();
  assert.ifError(error);
  createdOrgs.push(org.id);
  assert.ifError((await service.from('organization_settings').insert({ organization_id: org.id, display_name: `Medya ${label}` })).error);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: org.id, plan_id: planId, status: 'active' })).error);
  const owner = await makeUser(`${label}-owner`);
  assert.ifError((await service.from('organization_members').insert({ organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' })).error);
  const listing = await owner.client
    .from('properties')
    .insert({
      organization_id: org.id,
      title: `Medya testi ${label}`,
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
const put = async (bucket, path, size, contentType) => {
  const r = await service.storage.from(bucket).upload(path, Buffer.alloc(size, 7), { contentType, upsert: true });
  assert.ifError(r.error);
  uploaded[bucket].push(path);
};

/** Oturum istemcisiyle kanonik bekleyen satır (yeni kodun yaptığı gibi) */
async function pendingRow(org, { declared = 1000, kind = 'property_photo', client = org.owner.client, userId = org.owner.id } = {}) {
  const id = randomUUID();
  const folder = kind === 'post_cover' ? `organizations/${org.id}/content/${id}` : `organizations/${org.id}/properties/${org.propertyId}/images/${id}`;
  const r = await client
    .from('media_assets')
    .insert({
      id,
      organization_id: org.id,
      property_id: kind === 'post_cover' ? null : org.propertyId,
      kind,
      status: 'pending',
      original_path: `${folder}/original`,
      mime_type: 'image/jpeg',
      byte_size: declared,
      original_filename: 'x.jpg',
      created_by: userId,
    })
    .select('id')
    .single();
  assert.ifError(r.error);
  return { id, folder, orgId: org.id };
}

/** Orijinali ve yeni varyantları yükler; yeni tabanı döndürür */
async function stage(row, { orig = 2048, widths = [320, 640], vbytes = 1000, skipOriginal = false, only } = {}) {
  if (!skipOriginal) await put('media-originals', `${row.folder}/original`, orig, 'image/jpeg');
  const base = `${row.folder}/${rev()}`;
  for (const w of only ?? widths) await put('media', `${base}/w${w}.webp`, vbytes, 'image/webp');
  return base;
}

const finalize = (client, row, base, { expected = null, widths = [320, 640], width = 1920, height = 1280, blur = null } = {}) =>
  client.rpc('media_finalize', {
    p_media: row.id,
    p_expected_base: expected,
    p_public_base: base,
    p_variant_widths: widths,
    p_width: width,
    p_height: height,
    p_blur: blur,
  });
const readRow = async (id) => {
  const r = await service.from('media_assets').select('*').eq('id', id).single();
  assert.ifError(r.error);
  return r.data;
};
/** Kuyruktaki bu testin satırlarını kiralar (başka satırlara dokunulmaz; kira 5 dk sonra biter) */
async function claimMine(orgIds) {
  const mine = [];
  for (let i = 0; i < 20; i += 1) {
    const r = await service.rpc('media_queue_claim', { p_limit: 1000 });
    assert.ifError(r.error);
    mine.push(...r.data.filter((x) => orgIds.some((id) => x.path.includes(id))));
    if (r.data.length < 1000) break;
  }
  return mine;
}
const doneAll = async (rows) => {
  if (rows.length) assert.ifError((await service.rpc('media_queue_done', { p_ids: rows.map((x) => x.id) })).error);
};

const O = {};

before(async () => {
  if (skip) return;
  const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
  assert.ifError(type.error);
  const district = await anon.from('districts').select('id, city_id').limit(1).single();
  assert.ifError(district.error);
  taxonomy = { typeId: type.data.id, districtId: district.data.id, cityId: district.data.city_id };
  assert.ifError((await service.from('plans').insert({ id: BIG, name: 'Medya büyük', max_users: 5, max_properties: 5, max_storage_mb: 500, is_public: false })).error);
  assert.ifError((await service.from('plans').insert({ id: SMALL, name: 'Medya küçük', max_users: 5, max_properties: 5, max_storage_mb: 1, is_public: false })).error);
  O.a = await makeOrg('a');
  O.b = await makeOrg('b');
});

after(async () => {
  if (skip) return;
  for (const id of createdOrgs) await service.from('organizations').delete().eq('id', id);
  await claimMine(createdOrgs).then(doneAll).catch(() => {});
  for (const bucket of Object.keys(uploaded)) {
    for (let i = 0; i < uploaded[bucket].length; i += 100) await service.storage.from(bucket).remove(uploaded[bucket].slice(i, i + 100));
  }
  await service.from('plans').delete().in('id', [BIG, SMALL]);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
});

describe('MF-01 gerçek boyut', { skip }, () => {
  test('bildirilen 1 B, gerçek dosya 2 KB: gerçek boyut yazılır; sonuç alanları sayı', async () => {
    const row = await pendingRow(O.a, { declared: 1 });
    const base = await stage(row, { orig: 2048, widths: [320, 640], vbytes: 1000 });
    const r = await finalize(O.a.owner.client, row, base, { blur: null });
    assert.ifError(r.error);
    assert.equal(r.data.previous_base, null);
    assert.deepEqual(r.data.previous_widths, []);
    assert.equal(r.data.byte_size, 2048);
    assert.equal(r.data.variants_byte_size, 2000);
    const db = await readRow(row.id);
    assert.equal(db.status, 'ready');
    assert.equal(Number(db.byte_size), 2048);
    assert.equal(Number(db.variants_byte_size), 2000);
    assert.equal(db.public_base, base);
    assert.deepEqual(db.variant_widths, [320, 640]);
    assert.equal(db.blur_data_url, null);
    assert.equal(db.error, null);
    assert.ok(db.processed_at);
  });

  test('post_cover da sonlandırılır; blur ve döndürme etiketi (-r90) kabul edilir', async () => {
    const row = await pendingRow(O.a, { kind: 'post_cover' });
    const base = `${row.folder}/${rev()}-r90`;
    await put('media-originals', `${row.folder}/original`, 500, 'image/jpeg');
    await put('media', `${base}/w320.webp`, 300, 'image/webp');
    const r = await finalize(O.a.owner.client, row, base, { widths: [320], blur: 'data:image/webp;base64,AAAA' });
    assert.ifError(r.error);
    assert.equal(r.data.byte_size, 500);
    assert.equal(r.data.variants_byte_size, 300);
    assert.equal((await readRow(row.id)).blur_data_url, 'data:image/webp;base64,AAAA');
  });

  test('klasör aralığı komşu klasörü saymaz: "<taban>-r90/" ve "<taban>x/" dosyaları toplamda yok', async () => {
    const row = await pendingRow(O.a);
    const base = await stage(row, { orig: 100, widths: [320], vbytes: 400 });
    await put('media', `${base}-r90/w320.webp`, 9999, 'image/webp');
    await put('media', `${base}x/w320.webp`, 9999, 'image/webp');
    const r = await finalize(O.a.owner.client, row, base, { widths: [320] });
    assert.ifError(r.error);
    assert.equal(r.data.variants_byte_size, 400);
  });

  test('aralık koşulu COLLATE "C" ve storage.objects (bucket_id, name) indeksini kullanır (EXPLAIN)', { skip: dbSkip }, async () => {
    const src = await psqlSql("select prosrc from pg_proc where oid = 'public.media_finalize(uuid,text,text,smallint[],integer,integer,text)'::regprocedure");
    assert.match(src, /o\.name collate "C" >= v_lo collate "C"/);
    assert.match(src, /o\.name collate "C" < v_hi collate "C"/);
    const plan = await psql(
      [],
      [
        'set enable_seqscan = off;',
        "explain select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o",
        " where o.bucket_id = 'media' and o.name collate \"C\" >= 'organizations/x/a/' collate \"C\" and o.name collate \"C\" < 'organizations/x/a0' collate \"C\";",
        '',
      ].join('\n'),
    );
    assert.match(plan, /Index Cond:.*name/, plan);
    assert.doesNotMatch(plan, /Seq Scan/, plan);
    assert.match(plan, /Index (Only )?Scan using \S*objects\S*/, plan);
  });

  test('geçersiz girdi: boş/yedi/yinelenen/aralık dışı genişlik, negatif boyut, uzun blur → media_invalid_input', async () => {
    const row = await pendingRow(O.a);
    const base = await stage(row);
    const c = O.a.owner.client;
    for (const bad of [{ widths: [] }, { widths: [1, 2, 3, 4, 5, 6, 7] }, { widths: [320, 320] }, { widths: [0] }, { widths: [2881] }, { widths: [320, null] }, { width: 0 }, { height: -1 }, { width: null }, { height: null }, { blur: 'x'.repeat(2001) }]) {
      const r = await finalize(c, row, base, bad);
      assert.equal(r.error?.message, 'media_invalid_input', JSON.stringify(bad).slice(0, 80));
    }
    const noBase = await c.rpc('media_finalize', { p_media: row.id, p_expected_base: null, p_public_base: null, p_variant_widths: [320], p_width: 1, p_height: 1, p_blur: null });
    assert.equal(noBase.error?.message, 'media_invalid_input');
    assert.equal((await readRow(row.id)).status, 'pending');
  });
});

describe('MF-02 yol ve yetki', { skip }, () => {
  /** service rolüyle (tetikleyicileri aşarak) kasıtlı olarak bozuk satır */
  const forced = async (org, patch) => {
    const id = randomUUID();
    const folder = `organizations/${org.id}/properties/${org.propertyId}/images/${id}`;
    const r = await service.from('media_assets').insert({
      id,
      organization_id: org.id,
      property_id: org.propertyId,
      kind: 'property_photo',
      status: 'pending',
      original_path: `${folder}/original`,
      mime_type: 'image/jpeg',
      byte_size: 1000,
      created_by: org.owner.id,
      ...patch(id, folder),
    });
    assert.ifError(r.error);
    return { id, folder, orgId: org.id };
  };

  test('satırın original_path değeri başka kurumun yolu: media_invalid_path', async () => {
    const row = await forced(O.a, (id) => ({ original_path: `organizations/${O.b.id}/properties/${O.b.propertyId}/images/${id}/original` }));
    await put('media-originals', `organizations/${O.b.id}/properties/${O.b.propertyId}/images/${row.id}/original`, 100, 'image/jpeg');
    const base = `organizations/${O.b.id}/properties/${O.b.propertyId}/images/${row.id}/${rev()}`;
    await put('media', `${base}/w320.webp`, 100, 'image/webp');
    const r = await finalize(O.a.owner.client, row, base, { widths: [320] });
    assert.equal(r.error?.message, 'media_invalid_path');
  });

  test('kardeş klasör (başka kimlik), demo ve eksik yol reddedilir', async () => {
    const folderOf = (r) => `organizations/${O.a.id}/properties/${O.a.propertyId}/images/${r.id}`;
    const sibling = await forced(O.a, () => ({ original_path: `organizations/${O.a.id}/properties/${O.a.propertyId}/images/${randomUUID()}/original` }));
    assert.equal((await finalize(O.a.owner.client, sibling, `${folderOf(sibling)}/${rev()}`, { widths: [320] })).error?.message, 'media_invalid_path');
    const demo = await forced(O.a, () => ({ original_path: '/demo/living-room' }));
    assert.equal((await finalize(O.a.owner.client, demo, `${folderOf(demo)}/${rev()}`, { widths: [320] })).error?.message, 'media_invalid_path');
    const noExt = await forced(O.a, (id, folder) => ({ original_path: folder }));
    assert.equal((await finalize(O.a.owner.client, noExt, `${folderOf(noExt)}/${rev()}`, { widths: [320] })).error?.message, 'media_invalid_path');
  });

  test('kind general reddedilir; p_public_base başka klasör/demo/kötü sürüm etiketi: media_invalid_path', async () => {
    const general = await forced(O.a, () => ({ kind: 'general' }));
    assert.equal((await finalize(O.a.owner.client, general, `${general.folder}/${rev()}`, { widths: [320] })).error?.message, 'media_invalid_path');
    const row = await pendingRow(O.a);
    await stage(row, { widths: [320] });
    const c = O.a.owner.client;
    const bases = [
      '/demo/living-room',
      `organizations/${O.b.id}/properties/${O.b.propertyId}/images/${randomUUID()}/${rev()}`,
      `${row.folder}/../${rev()}`,
      `${row.folder}/${rev()}/extra`,
      `${row.folder}/short`,
      `${row.folder}/${rev()}-r45`,
      `${row.folder}/${rev()}\n`,
      `${row.folder}/ABCDEFG-`,
      row.folder,
      `${row.folder}x/${rev()}`,
    ];
    for (const base of bases) {
      const r = await finalize(c, row, base, { widths: [320] });
      assert.equal(r.error?.message, 'media_invalid_path', JSON.stringify(base));
    }
    assert.equal((await readRow(row.id)).status, 'pending');
  });

  test('üye olmayan forbidden (başka kurumun satırı da, olmayan satır da); anon reddedilir', async () => {
    const row = await pendingRow(O.a);
    const base = await stage(row);
    const foreign = await finalize(O.b.owner.client, row, base);
    assert.equal(foreign.error?.message, 'forbidden');
    assert.equal(foreign.error?.code, '42501');
    const none = await finalize(O.b.owner.client, { id: randomUUID() }, base);
    assert.equal(none.error?.message, 'forbidden');
    const failed = await O.b.owner.client.rpc('media_mark_failed', { p_media: row.id, p_error: 'x' });
    assert.equal(failed.error?.message, 'forbidden');
    const an = await finalize(anon, row, base);
    assert.equal(an.error?.code, '42501', 'anonim çağrı kabul edildi');
    const anFail = await anon.rpc('media_mark_failed', { p_media: row.id, p_error: 'x' });
    assert.equal(anFail.error?.code, '42501');
    assert.equal((await readRow(row.id)).status, 'pending');
  });
});

/** Kurumun kota kilidini ayrı bir psql oturumunda tutar (SL-07 yöntemi) */
async function holdLock(orgId, seconds) {
  const script = [`select pg_advisory_lock(hashtextextended('karay.quota:media_assets:${orgId}', 0));`, '\\echo LOCKED', `select pg_sleep(${seconds});`, ''].join('\n');
  const holder = spawn('psql', [dbUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  holder.stderr.on('data', (d) => (stderr += d));
  const locked = new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`kilit 10 sn içinde alınamadı: ${stderr}`)), 10_000);
    holder.stdout.on('data', (d) => {
      out += d;
      if (out.includes('LOCKED')) { clearTimeout(timer); resolve(); }
    });
    holder.on('error', (e) => { clearTimeout(timer); reject(e); });
    holder.on('exit', () => { clearTimeout(timer); reject(new Error(`psql kilit almadan çıktı: ${stderr}`)); });
  });
  holder.stdin.end(script);
  await locked;
  return holder;
}
const releaseLock = async (holder) => {
  holder.kill('SIGKILL');
  await new Promise((resolve) => (holder.exitCode !== null || holder.signalCode || holder.pid === undefined ? resolve() : (holder.once('exit', resolve), holder.once('error', resolve))));
};

describe('MF-02b yetkisiz sonlandırma başka kurumun kilidini beklemez', { skip: dbSkip }, () => {
  const HOLD_SECONDS = 5;
  const timed = async (fn) => {
    const t0 = performance.now();
    const result = await fn();
    return { result, ms: performance.now() - t0 };
  };

  test('kurum B kilidi tutulurken üye olmayan hızla forbidden alır; B sahibi bekler', async () => {
    needDb();
    const row = await pendingRow(O.b);
    const base = await stage(row);
    const holder = await holdLock(O.b.id, HOLD_SECONDS);
    try {
      const intruder = await timed(() => finalize(O.a.owner.client, row, base));
      assert.equal(intruder.result.error?.message, 'forbidden');
      assert.ok(intruder.ms < 1500, `yetkisiz sonlandırma kilidi bekledi (${Math.round(intruder.ms)} ms)`);
      const intruderFail = await timed(() => O.a.owner.client.rpc('media_mark_failed', { p_media: row.id, p_error: 'x' }));
      assert.ok(intruderFail.ms < 1500);
      // mark_failed kilit almaz: B sahibi bile beklemez
      const failedFast = await timed(() => O.b.owner.client.rpc('media_mark_failed', { p_media: randomUUID(), p_error: 'x' }));
      assert.ok(failedFast.ms < 1500, `mark_failed kilit bekledi (${Math.round(failedFast.ms)} ms)`);

      const owner = await timed(() => finalize(O.b.owner.client, row, base));
      assert.ifError(owner.result.error);
      assert.ok(owner.ms > 3000, `sahibin sonlandırması kilidi beklemedi (${Math.round(owner.ms)} ms); kilit tutulmuyor olabilir`);
    } finally {
      await releaseLock(holder);
    }
  });

  test('kilit 5 sn içinde alınamazsa media_busy (55P03); satır değişmez', async () => {
    needDb();
    const row = await pendingRow(O.b);
    const base = await stage(row);
    const holder = await holdLock(O.b.id, 8);
    try {
      const t = await timed(() => finalize(O.b.owner.client, row, base));
      assert.equal(t.result.error?.message, 'media_busy');
      assert.equal(t.result.error?.code, '55P03');
      assert.ok(t.ms > 4000 && t.ms < 7500, `beklenen ~5 sn, ölçülen ${Math.round(t.ms)} ms`);
    } finally {
      await releaseLock(holder);
    }
    assert.equal((await readRow(row.id)).status, 'pending');
    assert.ifError((await finalize(O.b.owner.client, row, base)).error, 'kilit bırakılınca sonlandırma geçer');
  });
});

describe('MF-03 sütun yetkileri ve ekleme şekli (B)', { skip: dbSkip }, () => {
  before(async () => {
    if (dbSkip) return;
    const ok = (await psqlSql("select has_column_privilege('authenticated', 'public.media_assets', 'status', 'update')")).trim();
    if (ok !== 'f') throw new Error('MF-03: B (20261027000002_media_column_privileges.sql) uygulanmamış');
  });

  test('korunan sütunlara doğrudan güncelleme 42501', async () => {
    const row = await pendingRow(O.a);
    const c = O.a.owner.client;
    const patches = [
      { status: 'ready' },
      { status: 'failed' },
      { byte_size: 1 },
      { variants_byte_size: 1 },
      { public_base: `organizations/${O.b.id}/x` },
      { original_path: `organizations/${O.b.id}/x` },
      { variant_widths: [320] },
      { kind: 'general' },
      { organization_id: O.b.id },
      { property_id: null },
      { created_by: O.b.owner.id },
      { error: 'x' },
      { width: 10 },
      { height: 10 },
      { blur_data_url: 'x' },
      { mime_type: 'image/png' },
      { processed_at: new Date().toISOString() },
      { original_filename: 'y.jpg' },
    ];
    for (const patch of patches) {
      const r = await c.from('media_assets').update(patch).eq('id', row.id).select('id');
      assert.equal(r.error?.code, '42501', `${Object.keys(patch)[0]}: ${r.error?.message}`);
    }
    const db = await readRow(row.id);
    assert.equal(db.status, 'pending');
    assert.equal(Number(db.byte_size), 1000);
    assert.equal(Number(db.variants_byte_size), 0);
  });

  test('alt_text, sıralama ve kapak çalışır; silme açık kalır', async () => {
    const row = await pendingRow(O.a);
    const c = O.a.owner.client;
    assert.ifError((await finalize(c, row, await stage(row))).error);
    assert.ifError((await c.from('media_assets').update({ alt_text: 'Salon' }).eq('id', row.id)).error);
    assert.ifError((await c.from('media_assets').update({ sort_order: 7 }).eq('id', row.id)).error);
    assert.ifError((await c.rpc('set_property_cover', { p_media_id: row.id })).error);
    const second = await pendingRow(O.a);
    assert.ifError((await finalize(c, second, await stage(second))).error);
    const ready = (await service.from('media_assets').select('id').eq('property_id', O.a.propertyId).eq('status', 'ready')).data.map((x) => x.id);
    assert.ifError((await c.rpc('reorder_property_media', { p_property_id: O.a.propertyId, p_ids: ready })).error);
    const db = await readRow(row.id);
    assert.equal(db.alt_text, 'Salon');
    assert.equal(db.is_cover, true);
    assert.ifError((await c.from('media_assets').delete().eq('id', second.id)).error);
  });

  test('başka kurumun satırında alt_text güncellemesi etkisiz (RLS)', async () => {
    const row = await pendingRow(O.a);
    const r = await O.b.owner.client.from('media_assets').update({ alt_text: 'çalındı' }).eq('id', row.id).select('id');
    assert.equal(r.data?.length ?? 0, 0);
    assert.equal((await readRow(row.id)).alt_text, null);
  });

  test("kötü eklemeler reddedilir: ready, yabancı yol, yabancı created_by, boyut, mime, kind, id'siz yol", async () => {
    const c = O.a.owner.client;
    const mk = (over = {}) => {
      const id = randomUUID();
      return {
        id,
        organization_id: O.a.id,
        property_id: O.a.propertyId,
        kind: 'property_photo',
        status: 'pending',
        original_path: `organizations/${O.a.id}/properties/${O.a.propertyId}/images/${id}/original`,
        mime_type: 'image/jpeg',
        byte_size: 1000,
        original_filename: 'x.jpg',
        created_by: O.a.owner.id,
        ...over,
      };
    };
    const bad = {
      'status ready': { status: 'ready' },
      'status failed': { status: 'failed' },
      'yabancı kurum yolu': { original_path: `organizations/${O.b.id}/properties/${O.b.propertyId}/images/${randomUUID()}/original` },
      'kardeş kimlik': { original_path: `organizations/${O.a.id}/properties/${O.a.propertyId}/images/${randomUUID()}/original` },
      'yol sonu original değil': { original_path: `organizations/${O.a.id}/properties/${O.a.propertyId}/images/x` },
      'kimliksiz eski yol': { original_path: `organizations/${O.a.id}/properties/${O.a.propertyId}/${randomBytes(8).toString('hex')}` },
      'yabancı created_by': { created_by: O.b.owner.id },
      'byte_size 0': { byte_size: 0 },
      'byte_size büyük': { byte_size: 52428801 },
      'byte_size yok': { byte_size: null },
      'mime gif': { mime_type: 'image/gif' },
      'mime yok': { mime_type: null },
      'kind general': { kind: 'general' },
    };
    for (const [label, over] of Object.entries(bad)) {
      const r = await c.from('media_assets').insert(mk(over));
      assert.equal(r.error?.message, 'media_invalid_input', `${label}: ${r.error?.message}`);
    }
    const cover = mk({ kind: 'post_cover', property_id: null });
    assert.equal((await c.from('media_assets').insert(cover)).error?.message, 'media_invalid_input', 'post_cover için içerik yolu gerekir');
    for (const over of [{ variants_byte_size: 1 }, { is_cover: true }, { public_base: 'x' }, { variant_widths: [320] }]) {
      const r = await c.from('media_assets').insert(mk(over));
      assert.equal(r.error?.code, '42501', JSON.stringify(over));
    }
    assert.ifError((await c.from('media_assets').insert(mk())).error);
    // üye olmayan: tek tip RLS hatası (şekil tetikleyicisi bilgi sızdırmaz)
    const foreign = await O.b.owner.client.from('media_assets').insert(mk());
    assert.match(foreign.error?.message ?? '', /row-level security/);
    assert.ok((await anon.from('media_assets').insert(mk())).error);
  });

  test('kurum başına en çok 50 bekleyen ya da başarısız satır (media_pending_limit); başka kurum etkilenmez', async () => {
    const org = await makeOrg('cap');
    for (let i = 0; i < 50; i += 1) await pendingRow(org, { declared: 1000 });
    const id = randomUUID();
    const over = await org.owner.client.from('media_assets').insert({
      id,
      organization_id: org.id,
      property_id: org.propertyId,
      kind: 'property_photo',
      status: 'pending',
      original_path: `organizations/${org.id}/properties/${org.propertyId}/images/${id}/original`,
      mime_type: 'image/jpeg',
      byte_size: 1000,
      created_by: org.owner.id,
    });
    assert.equal(over.error?.message, 'media_pending_limit');
    await pendingRow(O.b); // başka kurum serbest
    const first = (await service.from('media_assets').select('id').eq('organization_id', org.id).limit(1).single()).data;
    assert.ifError((await service.from('media_assets').update({ status: 'failed' }).eq('id', first.id)).error);
    const stillFull = await pendingRow(org).catch((e) => e);
    assert.match(String(stillFull.message ?? stillFull), /media_pending_limit/, 'failed satır da sayılır (50 pending + failed)');
    assert.ifError((await org.owner.client.from('media_assets').delete().eq('id', first.id)).error);
    await pendingRow(org); // satır silinince yer açılır
  });

  test('authenticated TRUNCATE/REFERENCES/TRIGGER ve tablo düzeyi UPDATE/INSERT yetkisi yok; DELETE var', async () => {
    const priv = async (p) => (await psqlSql(`select has_table_privilege('authenticated', 'public.media_assets', '${p}')`)).trim();
    assert.equal(await priv('truncate'), 'f');
    assert.equal(await priv('references'), 'f');
    assert.equal(await priv('trigger'), 'f');
    assert.equal(await priv('delete'), 't');
    assert.equal(await priv('update'), 'f');
    assert.equal(await priv('insert'), 'f');
  });
});

describe('MF-04 kota ve hatalar', { skip }, () => {
  const hog = (org, bytes) =>
    service.from('media_assets').insert({
      organization_id: org.id,
      property_id: org.propertyId,
      kind: 'property_photo',
      status: 'pending',
      original_path: `organizations/${org.id}/properties/${org.propertyId}/images/${randomUUID()}/original`,
      mime_type: 'image/jpeg',
      byte_size: bytes,
    });

  test('kota hatası satırı değiştirmez; yüklenen dosyalara dokunmaz', async () => {
    const org = await makeOrg('q1', SMALL); // 1 MiB
    assert.ifError((await hog(org, 700000)).error);
    const row = await pendingRow(org, { declared: 100000 });
    const base = await stage(row, { orig: 400000, widths: [320], vbytes: 10000 });
    const r = await finalize(org.owner.client, row, base, { widths: [320] });
    assert.equal(r.error?.message, 'plan_limit_storage');
    assert.equal(r.error?.code, 'P0001');
    const db = await readRow(row.id);
    assert.equal(db.status, 'pending');
    assert.equal(db.public_base, null);
    assert.equal(Number(db.byte_size), 100000);
    assert.equal(Number(db.variants_byte_size), 0);
    assert.equal(db.processed_at, null);
    const files = await service.storage.from('media').list(base);
    assert.equal(files.data?.length, 1, 'yeni varyant dosyası sonlandırma tarafından silinmedi');
  });

  test('ready döndürme kotada eski tabanı korur; küçülmeyen olmayan döndürme geçer, eski varyantlar kuyruğa', async () => {
    const org = await makeOrg('q2', SMALL);
    assert.ifError((await hog(org, 600000)).error);
    const row = await pendingRow(org, { declared: 100000 });
    const c = org.owner.client;
    const base0 = await stage(row, { orig: 200000, widths: [320, 640], vbytes: 2500 });
    const first = await finalize(c, row, base0, { expected: null });
    assert.ifError(first.error);
    assert.equal(first.data.variants_byte_size, 5000);
    const before = await readRow(row.id);

    // büyüyen döndürme: 600000 + 200000 + 300000 > 1 MiB → red, satır aynı
    const baseBig = await stage(row, { skipOriginal: true, widths: [320], vbytes: 300000 });
    const big = await finalize(c, row, baseBig, { expected: base0, widths: [320] });
    assert.equal(big.error?.message, 'plan_limit_storage');
    const afterFail = await readRow(row.id);
    assert.equal(afterFail.public_base, base0);
    assert.equal(afterFail.status, 'ready');
    assert.equal(Number(afterFail.variants_byte_size), Number(before.variants_byte_size));
    assert.deepEqual(afterFail.variant_widths, before.variant_widths);
    assert.equal(afterFail.processed_at, before.processed_at);
    assert.equal((await claimMine([org.id])).length, 0, 'başarısız döndürme önceki varyantları kuyruğa almamalı');

    // eşit boyutlu döndürme: new <= old → geçer
    const baseSame = await stage(row, { skipOriginal: true, widths: [320, 640], vbytes: 2500 });
    const same = await finalize(c, row, baseSame, { expected: base0 });
    assert.ifError(same.error);
    assert.equal(same.data.previous_base, base0);
    assert.deepEqual(same.data.previous_widths, [320, 640]);
    // kira henüz yeni: kuyruk satırları başarısız-döndürme claim'inden sonra eklendi
    const queued = await claimMine([org.id]);
    assert.deepEqual(queued.map((x) => x.path).sort(), [`${base0}/w320.webp`, `${base0}/w640.webp`]);
    assert.ok(queued.every((x) => x.bucket === 'media'));
    await doneAll(queued);
  });

  test('beklenen taban uyuşmazsa media_conflict; aynı taban media_invalid_input; satır değişmez', async () => {
    const row = await pendingRow(O.a);
    const base0 = await stage(row);
    assert.ifError((await finalize(O.a.owner.client, row, base0)).error);
    const base1 = await stage(row, { skipOriginal: true });
    const stale = await finalize(O.a.owner.client, row, base1, { expected: `${row.folder}/${rev()}` });
    assert.equal(stale.error?.message, 'media_conflict');
    const nullExpected = await finalize(O.a.owner.client, row, base1, { expected: null });
    assert.equal(nullExpected.error?.message, 'media_conflict');
    const same = await finalize(O.a.owner.client, row, base0, { expected: base0 });
    assert.equal(same.error?.message, 'media_invalid_input');
    assert.equal((await readRow(row.id)).public_base, base0);
  });

  test('orijinal yok: media_not_uploaded; eksik varyant: media_variants_missing; satır pending kalır', async () => {
    const row = await pendingRow(O.a);
    const base = await stage(row, { skipOriginal: true });
    assert.equal((await finalize(O.a.owner.client, row, base)).error?.message, 'media_not_uploaded');
    await put('media-originals', `${row.folder}/original`, 100, 'image/jpeg');
    const partial = await stage(row, { skipOriginal: true, widths: [320, 640], only: [320] });
    assert.equal((await finalize(O.a.owner.client, row, partial, { widths: [320, 640] })).error?.message, 'media_variants_missing');
    const none = `${row.folder}/${rev()}`;
    assert.equal((await finalize(O.a.owner.client, row, none, { widths: [320] })).error?.message, 'media_variants_missing');
    const db = await readRow(row.id);
    assert.equal(db.status, 'pending');
    assert.equal(db.public_base, null);
  });

  test('media_mark_failed: pending → true ve failed; ready → false ve satır aynı; failed satır sonra sonlandırılabilir', async () => {
    const row = await pendingRow(O.a);
    const c = O.a.owner.client;
    const failed = await c.rpc('media_mark_failed', { p_media: row.id, p_error: 'quota: depolama kotası doldu.' });
    assert.ifError(failed.error);
    assert.equal(failed.data, true);
    const db = await readRow(row.id);
    assert.equal(db.status, 'failed');
    assert.equal(db.error, 'quota: depolama kotası doldu.');
    const long = await c.rpc('media_mark_failed', { p_media: row.id, p_error: 'e'.repeat(500) });
    assert.equal(long.data, true);
    assert.equal((await readRow(row.id)).error.length, 300);

    const base = await stage(row);
    assert.ifError((await finalize(c, row, base)).error);
    const ready = await readRow(row.id);
    assert.equal(ready.status, 'ready');
    assert.equal(ready.error, null);

    const again = await c.rpc('media_mark_failed', { p_media: row.id, p_error: 'x' });
    assert.ifError(again.error);
    assert.equal(again.data, false);
    const same = await readRow(row.id);
    assert.equal(same.status, 'ready');
    assert.equal(same.public_base, base);
    assert.equal(same.error, null);
    assert.equal((await c.rpc('media_mark_failed', { p_media: randomUUID(), p_error: 'x' })).error?.message, 'forbidden');
  });
});

describe('MF-05 eşzamanlılık', { skip }, () => {
  test('8 eşzamanlı sonlandırma 1 MiB kotayı aşmaz (gerçek boyutla 5 sığar, 3 reddedilir)', async () => {
    const org = await makeOrg('race', SMALL);
    const rows = [];
    for (let i = 0; i < 8; i += 1) rows.push(await pendingRow(org, { declared: 10000 }));
    const bases = [];
    for (const row of rows) bases.push(await stage(row, { orig: 200000, widths: [320], vbytes: 1000 }));
    const results = await Promise.all(rows.map((row, i) => finalize(org.owner.client, row, bases[i], { widths: [320] })));
    const ok = results.filter((r) => !r.error).length;
    const rejected = results.filter((r) => r.error?.message === 'plan_limit_storage').length;
    assert.equal(ok, 5, JSON.stringify(results.map((r) => r.error?.message)));
    assert.equal(rejected, 3);
    const { data } = await service.from('media_assets').select('byte_size, variants_byte_size, status').eq('organization_id', org.id);
    const total = data.reduce((s, r) => s + Number(r.byte_size ?? 0) + Number(r.variants_byte_size), 0);
    assert.ok(total <= 1024 * 1024, `kota aşıldı: ${total}`);
    assert.equal(data.filter((r) => r.status === 'ready').length, 5);
  });

  test('aynı beklenen tabanla eşzamanlı iki döndürme: biri başarılı, diğeri media_conflict; yalnız önceki taban kuyruğa', async () => {
    const org = await makeOrg('rot');
    const row = await pendingRow(org);
    const base0 = await stage(row);
    assert.ifError((await finalize(org.owner.client, row, base0)).error);
    const baseA = await stage(row, { skipOriginal: true });
    const baseB = await stage(row, { skipOriginal: true });
    const [a, b] = await Promise.all([finalize(org.owner.client, row, baseA, { expected: base0 }), finalize(org.owner.client, row, baseB, { expected: base0 })]);
    const messages = [a, b].map((r) => r.error?.message ?? null);
    assert.equal(messages.filter((m) => m === null).length, 1, JSON.stringify(messages));
    assert.equal(messages.filter((m) => m === 'media_conflict').length, 1, JSON.stringify(messages));
    assert.equal((await readRow(row.id)).public_base, a.error ? baseB : baseA);
    const queued = await claimMine([org.id]);
    assert.equal(queued.length, 2, 'yalnız base0 varyantları (320, 640)');
    assert.ok(queued.every((x) => x.path.startsWith(`${base0}/`)));
    await doneAll(queued);
  });
});

describe('MQ silme kuyruğu', { skip }, () => {
  test('doğrudan silme (tek deyim, birden çok satır) orijinal + varyantları kuyruğa alır; demo ve legacy satırlar alınmaz', async () => {
    const org = await makeOrg('mq1');
    const c = org.owner.client;
    const r1 = await pendingRow(org);
    const r2 = await pendingRow(org);
    const b1 = await stage(r1, { widths: [320, 640] });
    const b2 = await stage(r2, { widths: [320] });
    assert.ifError((await finalize(c, r1, b1)).error);
    assert.ifError((await finalize(c, r2, b2, { widths: [320] })).error);
    assert.ifError((await service.from('media_assets').insert({ organization_id: org.id, property_id: org.propertyId, kind: 'property_photo', status: 'ready', public_base: '/demo/living-room', variant_widths: [320, 640] })).error);
    assert.ifError((await service.from('media_assets').insert({ organization_id: org.id, property_id: org.propertyId, kind: 'property_photo', status: 'ready', legacy_path: `${org.id}/old.jpg` })).error);

    assert.deepEqual(await claimMine([org.id]), [], 'ilk sonlandırma kuyruğa bir şey yazmaz');
    const del = await c.from('media_assets').delete().eq('organization_id', org.id).select('id');
    assert.ifError(del.error);
    assert.equal(del.data.length, 4);
    const queued = await claimMine([org.id]);
    const got = queued.map((x) => `${x.bucket}:${x.path}`).sort();
    const want = [
      `media-originals:${r1.folder}/original`,
      `media-originals:${r2.folder}/original`,
      `media:${b1}/w320.webp`,
      `media:${b1}/w640.webp`,
      `media:${b2}/w320.webp`,
    ].sort();
    assert.deepEqual(got, want);
    await doneAll(queued);
  });

  test('kira: ikinci claim aynı satırları vermez; done siler ve sayıyı döndürür', async () => {
    const org = await makeOrg('mq2');
    const row = await pendingRow(org);
    assert.ifError((await org.owner.client.from('media_assets').delete().eq('id', row.id)).error);
    const first = await claimMine([org.id]);
    assert.equal(first.length, 1);
    assert.equal(first[0].path, `${row.folder}/original`);
    assert.equal(first[0].org_id, org.id);
    assert.equal(first[0].bucket, 'media-originals');
    assert.equal((await claimMine([org.id])).length, 0, 'kira süresi dolmadan yeniden verildi');
    const done = await service.rpc('media_queue_done', { p_ids: first.map((x) => x.id) });
    assert.equal(done.data, 1);
    assert.equal((await service.rpc('media_queue_done', { p_ids: first.map((x) => x.id) })).data, 0, 'done tekrarlanabilir');
    assert.equal((await service.rpc('media_queue_claim', { p_limit: 0 })).data.length, 0);
  });

  test('claim ve done yalnız service_role; tabloya hiçbir istemci erişemez', async () => {
    for (const [name, client] of [['anon', anon], ['authenticated', O.a.owner.client]]) {
      assert.equal((await client.rpc('media_queue_claim', { p_limit: 10 })).error?.code, '42501', `${name}: claim`);
      assert.equal((await client.rpc('media_queue_done', { p_ids: [1] })).error?.code, '42501', `${name}: done`);
      const table = await client.from('media_file_queue').select('id').limit(1);
      assert.equal(table.error?.code, '42501', `${name}: tablo`);
    }
    assert.equal((await service.from('media_file_queue').select('id').limit(1)).error?.code, '42501', 'service_role da tabloya doğrudan erişemez');
  });

  test('kuyruk tablosunda yabancı anahtar ve politika yok, RLS açık; tetikleyici deyim düzeyi ve tanımlayıcı', { skip: dbSkip }, async () => {
    assert.equal((await psqlSql("select count(*) from pg_constraint where conrelid = 'public.media_file_queue'::regclass and contype = 'f'")).trim(), '0');
    assert.equal((await psqlSql("select relrowsecurity from pg_class where oid = 'public.media_file_queue'::regclass")).trim(), 't');
    const trg = await psqlSql("select pg_get_triggerdef(oid) from pg_trigger where tgname = 'media_assets_enqueue_files' and not tgisinternal");
    assert.match(trg, /AFTER DELETE ON public\.media_assets REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT/);
    assert.equal((await psqlSql("select prosecdef from pg_proc where oid = 'public.media_assets_enqueue_files()'::regprocedure")).trim(), 't');
    assert.equal((await psqlSql("select count(*) from pg_policies where tablename = 'media_file_queue'")).trim(), '0');
  });

  test('toplu silme: 300 satırlık tek DELETE tek deyimde 900 dosyayı kuyruğa alır', { skip: dbSkip }, async () => {
    const org = await makeOrg('mq3');
    const ids = Array.from({ length: 300 }, () => randomUUID());
    const folder = (id) => `organizations/${org.id}/properties/${org.propertyId}/images/${id}`;
    const values = ids.map((id) => `('${id}', '${org.id}', '${org.propertyId}', 'property_photo', 'ready', '${folder(id)}/original', '${folder(id)}/abcdefgh', '{320,640}')`).join(',');
    await psqlSql(`insert into public.media_assets (id, organization_id, property_id, kind, status, original_path, public_base, variant_widths) values ${values}`);
    const out = await psqlSql(`with d as (delete from public.media_assets where organization_id = '${org.id}' returning 1) select count(*) from d`);
    assert.equal(out.trim(), '300');
    const queued = await claimMine([org.id]);
    assert.equal(queued.length, 900);
    await doneAll(queued);
  });

  test('H1: kurum önekinin dışındaki yol silmede/sonlandırmada kuyruğa alınmaz; kendi yollar alınır; B kapısı DUR verir', async () => {
    const orgA = await makeOrg('h1a');
    const orgB = await makeOrg('h1b');
    const foreign = `organizations/${orgB.id}/properties/${orgB.propertyId}/images/${randomUUID()}`;
    const traversal = `organizations/${orgA.id}/../${foreign}`;
    const craft = (over) =>
      service.from('media_assets').insert({
        organization_id: orgA.id, property_id: orgA.propertyId, kind: 'property_photo', status: 'ready', variant_widths: [320], byte_size: 10, ...over,
      }).select('id').single();
    const own = await pendingRow(orgA);
    const ownBase = await stage(own, { widths: [320] });
    assert.ifError((await finalize(orgA.owner.client, own, ownBase, { widths: [320] })).error);
    const evil = await craft({ original_path: `${foreign}/original`, public_base: `${foreign}/abcdefgh` });
    const dots = await craft({ original_path: `${traversal}/original`, public_base: `${traversal}/abcdefgh` });
    const demo = await craft({ public_base: '/demo/x' });
    assert.ifError(evil.error || dots.error || demo.error);

    // B kapısı: kurum dışı yollu satır var → DUR
    const gate = await psql(['-f', 'supabase/ops/media_privileges/01_preflight.sql']);
    const outside = (out) => Number(out.match(/Kurum önekinin[^|\n]*\|(\d+)\|/)[1]);
    assert.match(gate, /Kurum önekinin[^\n]*\|[^|\n]*\|\s*DUR/);
    const outsideBefore = outside(gate);
    assert.ok(outsideBefore >= 2);

    assert.ifError((await service.from('media_assets').delete().in('id', [evil.data.id, dots.data.id, demo.data.id, own.id])).error);
    const queued = await claimMine([orgA.id, orgB.id]);
    const paths = queued.map((x) => x.path);
    assert.ok(paths.every((x) => !x.includes(orgB.id) && !x.includes('..')), `kuyrukta yabancı yol: ${paths.join(', ')}`);
    assert.deepEqual(paths.sort(), [`${own.folder}/original`, `${ownBase}/w320.webp`].sort(), 'kendi yollar kuyruğa alınır');
    await doneAll(queued);
    assert.equal(outside(await psql(['-f', 'supabase/ops/media_privileges/01_preflight.sql'])), outsideBefore - 2, 'silinen kurum dışı satırlar sayıdan düştü');
  });

  test('H1: finalize önceki tabanı yalnız kendi önekindeyse kuyruğa alır (kurum dışı ve ".." tabanı alınmaz)', async () => {
    const orgA = await makeOrg('h1c');
    const orgB = await makeOrg('h1d');
    const c = orgA.owner.client;
    for (const makeBase of [
      () => `organizations/${orgB.id}/properties/${orgB.propertyId}/images/${randomUUID()}/abcdefgh`,
      (row) => `${row.folder}/../../../../${orgB.id}/abcdefgh`,
      () => `organizations/${orgA.id}/..x/abcdefgh`,
    ]) {
      const row = await pendingRow(orgA);
      const crafted = makeBase(row);
      assert.ifError((await service.from('media_assets').update({ public_base: crafted, variant_widths: [320], status: 'ready' }).eq('id', row.id)).error);
      const next = await stage(row, { widths: [320] });
      const r = await finalize(c, row, next, { expected: crafted, widths: [320] });
      assert.ifError(r.error);
      assert.equal(r.data.previous_base, crafted);
    }
    const queued = await claimMine([orgA.id, orgB.id]);
    const bad = queued.filter((x) => x.path.includes(orgB.id) || x.path.includes('..'));
    assert.equal(bad.length, 0, `yabancı yol kuyrukta: ${bad.map((x) => x.path).join(', ')}`);
    // meşru döndürme hâlâ kuyruğa alır
    const row = await pendingRow(orgA);
    const b0 = await stage(row, { widths: [320] });
    assert.ifError((await finalize(c, row, b0, { widths: [320] })).error);
    const b1 = await stage(row, { skipOriginal: true, widths: [320] });
    assert.ifError((await finalize(c, row, b1, { expected: b0, widths: [320] })).error);
    const own = await claimMine([orgA.id]);
    assert.deepEqual(own.map((x) => x.path), [`${b0}/w320.webp`]);
    await doneAll(own);
    await doneAll(queued);
  });

  test('kuyruk kimlik dizisine anon/authenticated/PUBLIC erişemez', { skip: dbSkip }, async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const priv of ['usage', 'select', 'update']) {
        assert.equal((await psqlSql(`select has_sequence_privilege('${role}', 'public.media_file_queue_id_seq', '${priv}')`)).trim(), 'f', `${role} ${priv}`);
      }
    }
  });

  test('media_storage_report: satırsız yükleme görünür; yalnız service_role/süper admin', async () => {
    const org = await makeOrg('rep');
    await put('media-originals', `organizations/${org.id}/properties/${org.propertyId}/images/${randomUUID()}/original`, 1234, 'image/jpeg');
    await put('media', `organizations/${org.id}/properties/${org.propertyId}/images/${randomUUID()}/abcdefgh/w320.webp`, 321, 'image/webp');
    const row = await pendingRow(org, { declared: 5000 });
    assert.ifError((await finalize(org.owner.client, row, await stage(row, { orig: 100, widths: [320], vbytes: 50 }), { widths: [320] })).error);
    const report = await service.rpc('media_storage_report', { p_org: org.id });
    assert.ifError(report.error);
    assert.equal(report.data.db_rows, 1);
    assert.equal(report.data.db_bytes, 150);
    assert.equal(report.data.orphan_originals, 1);
    assert.equal(report.data.orphan_variants, 1);
    assert.equal(report.data.storage_bytes['media-originals'], 1234 + 100);
    assert.equal(report.data.storage_bytes.media, 321 + 50);
    assert.equal((await org.owner.client.rpc('media_storage_report', { p_org: org.id })).error?.message, 'forbidden');
    assert.equal((await anon.rpc('media_storage_report', { p_org: org.id })).error?.code, '42501');
  });
});

describe('MF-07 eski kod uyumluluğu (A altında geçer, A+B altında 42501)', { skip: dbSkip }, () => {
  const B_FILE = 'supabase/pending/20261027000002_media_column_privileges.sql';
  const B_ROLLBACK = 'supabase/ops/media_privileges/05_rollback.sql';

  test('markFailed, retry, son ready güncellemesi ve eski ekleme: B yokken geçer, B varken 42501 / reddedilir', async () => {
    needDb();
    const org = await makeOrg('old');
    const c = org.owner.client;
    const oldInsert = () =>
      c.from('media_assets')
        .insert({
          id: randomUUID(),
          organization_id: org.id,
          property_id: org.propertyId,
          kind: 'property_photo',
          status: 'pending',
          original_path: `organizations/${org.id}/properties/${org.propertyId}/${randomBytes(8).toString('hex')}`,
          mime_type: 'image/jpeg',
          byte_size: 1000,
          created_by: org.owner.id,
        })
        .select('id')
        .single();
    const oldStatements = (id) => ({
      markFailed: () => c.from('media_assets').update({ status: 'failed', error: 'eski kod' }).eq('id', id).neq('status', 'ready').select('id'),
      retry: () => c.from('media_assets').update({ status: 'pending', error: null }).eq('id', id).select('id'),
      finalUpdate: () =>
        c.from('media_assets')
          .update({
            status: 'ready',
            public_base: `organizations/${org.id}/properties/${org.propertyId}/images/${id}/abcdefgh`,
            variant_widths: [320, 640],
            width: 1920,
            height: 1280,
            blur_data_url: 'data:image/webp;base64,AAAA',
            variants_byte_size: 1,
            processed_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', id)
          .select('id, status, variants_byte_size')
          .single(),
    });
    try {
      // --- A altında (B geri alınmış) ---
      await psql(['-f', B_ROLLBACK]);
      const row = await oldInsert();
      assert.ifError(row.error);
      const s = oldStatements(row.data.id);
      const failed = await s.markFailed();
      assert.ifError(failed.error);
      assert.equal(failed.data.length, 1);
      assert.equal((await readRow(row.data.id)).status, 'failed');
      assert.ifError((await s.retry()).error);
      assert.equal((await readRow(row.data.id)).status, 'pending');
      const fin = await s.finalUpdate();
      assert.ifError(fin.error);
      assert.equal(fin.data.status, 'ready');
      assert.equal(Number(fin.data.variants_byte_size), 1);

      // --- A+B altında ---
      await psql(['-f', B_FILE]);
      const row2 = await service
        .from('media_assets')
        .insert({
          organization_id: org.id,
          property_id: org.propertyId,
          kind: 'property_photo',
          status: 'pending',
          byte_size: 1000,
          mime_type: 'image/jpeg',
          original_path: `organizations/${org.id}/properties/${org.propertyId}/images/${randomUUID()}/original`,
          created_by: org.owner.id,
        })
        .select('id')
        .single();
      assert.ifError(row2.error);
      const s2 = oldStatements(row2.data.id);
      assert.equal((await s2.markFailed()).error?.code, '42501');
      assert.equal((await s2.retry()).error?.code, '42501');
      assert.equal((await s2.finalUpdate()).error?.code, '42501');
      assert.equal((await readRow(row2.data.id)).status, 'pending');
      assert.equal((await oldInsert()).error?.message, 'media_invalid_input', 'eski kanonik olmayan ekleme B altında reddedilmeli');
    } finally {
      await psql(['-f', B_FILE]); // B uygulanmış durumda bırakılır
    }
  });
});

describe('MF-08 B kendini korur', { skip: dbSkip }, () => {
  test("A yokken B 'apply A first' ile durur ve işlem geri alınır", async () => {
    needDb();
    const script = [
      'begin;',
      'drop function public.media_finalize(uuid, text, text, smallint[], integer, integer, text);',
      '\\i supabase/pending/20261027000002_media_column_privileges.sql',
      'rollback;',
      '',
    ].join('\n');
    await assert.rejects(
      () => psql([], script),
      (err) => /apply A first/.test(String(err.stderr)),
    );
    assert.equal((await psqlSql("select to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null")).trim(), 't');
  });

  test("B dosyası A'dan sonra sıralanır (CI glob sırası)", () => {
    const files = readdirSync('supabase/pending').filter((f) => /^20261027/.test(f)).sort();
    assert.deepEqual(files.slice(0, 2), ['20261027000001_media_finalize_rpc.sql', '20261027000002_media_column_privileges.sql']);
  });
});
