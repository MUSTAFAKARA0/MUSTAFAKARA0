/**
 * OPS-02 · abonelik limitlerinin zorlanması (supabase/pending/20261025000001_quota_lock.sql ve
 * 20261025000002_ops02_subscription_limits.sql).
 * Gerçek (yerel) Supabase'e karşı çalışır; kendi geçici organizasyonlarını (subtest-*), planını ve
 * kullanıcılarını oluşturur ve sonunda SİLER. Bayrağı (platform_settings.enforce_subscription_limits)
 * testler sırasında açıp kapatır ve sonunda başlangıç değerine döndürür; bu yüzden güvenlik testleri
 * sırayla çalışır (package.json › test:rls, --test-concurrency=1).
 *
 *   SL-01  Bayrak KAPALI: etkin aboneliği olmayan organizasyonda davranış eskisiyle aynı (org_plan boş,
 *          ilan/üye/yükleme serbest).
 *   SL-02  Bayrak AÇIK: iptal edilmiş, süresi dolmuş ya da hiç aboneliği olmayan organizasyonda yeni
 *          ilan, üye ve yükleme veritabanında reddedilir; mevcut ilan okunur ve düzenlenir.
 *   SL-03  Bayrak AÇIK: etkin aboneliği olan organizasyon etkilenmez; yeniden etkinleştirince haklar döner.
 *   SL-04  Bayrağı yalnızca süper admin değiştirir; ofis sahibi ve anonim ziyaretçi okuyamaz/değiştiremez.
 *          Abonelik durumu (iptal/süresi doldu) yalnızca kurumun üyesine görünür; anonim ve başka kiracı görmez.
 *   SL-05  Eşzamanlı ilan eklemeleri plan limitini aşamaz.
 *   SL-06  Depolama kotası veritabanında denetlenir (20261026000001_media_quota_lock.sql): eşzamanlı ya da
 *          media_upload_allowed() çağrılmadan doğrudan eklenen medya kayıtları kotayı aşamaz; başka kuruma
 *          (üye olmayan kullanıcı ya da anonim) yapılan ekleme RLS hatası alır, kota durumu sızmaz.
 *
 * Bekleyen migration uygulanmamış bir veritabanında testler atlanır; CI'da (CI=true) atlanmaz, hata verir.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Bu test tüm kiracıları etkileyen global bayrağı açıp kapatır: CI olsun olmasın YALNIZCA yerel Supabase'e bağlanır
if (url && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; abonelik limiti testleri yalnızca yerel Supabase ile çalışır`);
}
const missing = !url || !anonKey || !serviceKey;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = missing ? null : createClient(url, serviceKey, opts);
const anon = missing ? null : createClient(url, anonKey, opts);

let skip = missing ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;
if (!skip) {
  const probe = await service.from('platform_settings').select('enforce_subscription_limits').limit(1);
  if (probe.error) {
    if (process.env.CI) throw new Error(`CI: OPS-02 bekleyen migration uygulanmamış (${probe.error.message})`);
    skip = 'OPS-02 bekleyen migration bu veritabanında uygulanmamış (supabase/pending)';
  }
}

const RUN = randomBytes(3).toString('hex');
/** Kurum ilan öneki (A–Z, 2–5 harf, benzersiz): 4 rastgele harf, 456 976 olasılık */
const prefix = (first) => first + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const PASSWORD = `Sub-${randomBytes(8).toString('hex')}-7a`;
const PLAN = `subtest_${RUN}`;
const createdUsers = [];
const createdOrgs = [];
let taxonomy;
let initialFlag = false;

async function makeUser(label) {
  const email = `sub-${RUN}-${label}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(error);
  createdUsers.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  return { id: data.user.id, client };
}

/** Organizasyon + (isteğe bağlı) abonelik + sahibi; sahip bayrak kapalıyken eklenir */
async function makeOrg(label, subscription) {
  const { data: org, error } = await service
    .from('organizations')
    .insert({ slug: `subtest-${RUN}-${label}`, name: `Abonelik ${label}`, reference_prefix: prefix('S'), status: 'active' })
    .select('id')
    .single();
  assert.ifError(error);
  createdOrgs.push(org.id);
  assert.ifError((await service.from('organization_settings').insert({ organization_id: org.id, display_name: `Abonelik ${label}` })).error);
  if (subscription) assert.ifError((await service.from('subscriptions').insert({ organization_id: org.id, plan_id: subscription.plan, status: subscription.status })).error);
  const owner = await makeUser(`${label}-owner`);
  assert.ifError((await service.from('organization_members').insert({ organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' })).error);
  return { id: org.id, owner };
}

const setFlag = async (on) => assert.ifError((await service.from('platform_settings').update({ enforce_subscription_limits: on }).eq('id', true)).error);
const plan = async (orgId, client = service) => {
  const r = await client.rpc('org_plan', { p_org: orgId });
  assert.ifError(r.error);
  return r.data;
};
const listing = (orgId, title) => ({
  organization_id: orgId,
  title,
  listing_type: 'sale',
  property_type_id: taxonomy.typeId,
  category: 'konut',
  city_id: taxonomy.cityId,
  district_id: taxonomy.districtId,
  slug: '',
  reference_no: '',
  status: 'draft',
});
const addListing = (client, orgId, title) => client.from('properties').insert(listing(orgId, title)).select('id').single();
const addMember = async (orgId, label) => {
  const user = await makeUser(label);
  return service.from('organization_members').insert({ organization_id: orgId, user_id: user.id, role: 'agent', status: 'active' });
};

const O = {};

before(async () => {
  if (skip) return;
  initialFlag = (await service.from('platform_settings').select('enforce_subscription_limits').eq('id', true).single()).data?.enforce_subscription_limits ?? false;
  await setFlag(false);
  const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
  assert.ifError(type.error);
  const district = await anon.from('districts').select('id, city_id').limit(1).single();
  assert.ifError(district.error);
  taxonomy = { typeId: type.data.id, districtId: district.data.id, cityId: district.data.city_id };
  assert.ifError((await service.from('plans').insert({ id: PLAN, name: 'Abonelik testi', max_users: 5, max_properties: 3, max_storage_mb: 50, is_public: false })).error);
  O.active = await makeOrg('active', { plan: PLAN, status: 'active' });
  O.cancelled = await makeOrg('cancelled', { plan: PLAN, status: 'cancelled' });
  O.expired = await makeOrg('expired', { plan: PLAN, status: 'expired' });
  O.none = await makeOrg('none', null);
  // İptal edilmiş organizasyonun mevcut ilanı (bayrak kapalıyken)
  const existing = await addListing(O.cancelled.owner.client, O.cancelled.id, 'Abonelik testi mevcut ilan');
  assert.ifError(existing.error);
  O.cancelled.listingId = existing.data.id;
});

after(async () => {
  if (skip) return;
  await setFlag(initialFlag);
  for (const id of createdOrgs) await service.from('organizations').delete().eq('id', id);
  await service.from('plans').delete().eq('id', PLAN);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
});

describe('SL-01 bayrak kapalı: davranış değişmez', { skip }, () => {
  test('etkin aboneliği olmayan organizasyonda org_plan boş; ilan, üye ve yükleme serbest', async () => {
    await setFlag(false);
    for (const key of ['cancelled', 'expired', 'none']) {
      assert.deepEqual(await plan(O[key].id), [], `${key}: org_plan satır döndü`);
      const add = await addListing(O[key].owner.client, O[key].id, `Abonelik testi ${key} kapalı`);
      assert.ifError(add.error);
    }
    assert.ifError((await addMember(O.none.id, 'none-agent-off')).error);
    const upload = await O.expired.owner.client.rpc('media_upload_allowed', { p_org: O.expired.id, p_bytes: 1024 });
    assert.ifError(upload.error);
    assert.equal(upload.data, true);
  });
});

describe('SL-02 bayrak açık: etkin aboneliği olmayan organizasyon', { skip }, () => {
  before(async () => {
    if (!skip) await setFlag(true);
  });
  after(async () => {
    if (!skip) await setFlag(false);
  });

  test('org_plan sıfır limitli tek satır döner; son aboneliğin durumu görünür, özellikler kapalı', async () => {
    const [row, ...rest] = await plan(O.cancelled.id, O.cancelled.owner.client);
    assert.equal(rest.length, 0);
    assert.equal(row.plan_id, null);
    assert.equal(row.subscription_status, 'cancelled');
    assert.deepEqual([row.max_users, row.max_properties, row.max_storage_mb], [0, 0, 0]);
    assert.deepEqual([row.crm_enabled, row.analytics_enabled, row.pdf_enabled, row.custom_domain_enabled], [false, false, false, false]);
    assert.equal((await plan(O.expired.id, O.expired.owner.client))[0].subscription_status, 'expired');
    assert.equal((await plan(O.none.id, O.none.owner.client))[0].subscription_status, null);
  });

  test('iptal/süresi doldu durumu anonim ziyaretçiye ve başka kiracıya görünmez (limitler yine 0)', async () => {
    for (const client of [anon, O.active.owner.client]) {
      const [row] = await plan(O.cancelled.id, client);
      assert.equal(row.subscription_status, null, 'abonelik durumu üye olmayana göründü');
      assert.equal(row.max_properties, 0);
    }
  });

  test('yeni ilan reddedilir (sahip oturumuyla da, sunucu anahtarıyla da)', async () => {
    for (const key of ['cancelled', 'expired', 'none']) {
      const viaOwner = await addListing(O[key].owner.client, O[key].id, `Abonelik testi ${key} açık`);
      assert.ok(viaOwner.error, `${key}: sahip yeni ilan ekleyebildi`);
      assert.match(viaOwner.error.message, /plan_limit_properties/);
    }
    const viaService = await addListing(service, O.none.id, 'Abonelik testi servis');
    assert.match(viaService.error?.message ?? '', /plan_limit_properties/);
  });

  test('yeni üye ve yükleme reddedilir', async () => {
    const member = await addMember(O.cancelled.id, 'cancelled-agent-on');
    assert.match(member.error?.message ?? '', /plan_limit_users/);
    const upload = await O.cancelled.owner.client.rpc('media_upload_allowed', { p_org: O.cancelled.id, p_bytes: 1024 });
    assert.ifError(upload.error);
    assert.equal(upload.data, false);
  });

  test('mevcut ilan okunur ve düzenlenir', async () => {
    const read = await O.cancelled.owner.client.from('properties').select('id').eq('id', O.cancelled.listingId);
    assert.equal(read.data?.length, 1);
    const edit = await O.cancelled.owner.client.from('properties').update({ title: 'Abonelik testi düzenlendi' }).eq('id', O.cancelled.listingId).select('id');
    assert.ifError(edit.error);
    assert.equal(edit.data?.length, 1);
  });
});

describe('SL-03 bayrak açık: etkin abonelik etkilenmez, yeniden etkinleştirme', { skip }, () => {
  before(async () => {
    if (!skip) await setFlag(true);
  });
  after(async () => {
    if (!skip) await setFlag(false);
  });

  test('etkin aboneliği olan organizasyon plan limitleriyle çalışır', async () => {
    const [row] = await plan(O.active.id);
    assert.equal(row.plan_id, PLAN);
    assert.equal(row.max_properties, 3);
    assert.ifError((await addListing(O.active.owner.client, O.active.id, 'Abonelik testi etkin')).error);
  });

  test('abonelik yeniden etkinleşince yeni ilan eklenebilir', async () => {
    assert.ifError((await service.from('subscriptions').update({ status: 'active' }).eq('organization_id', O.expired.id)).error);
    assert.equal((await plan(O.expired.id))[0].plan_id, PLAN);
    assert.ifError((await addListing(O.expired.owner.client, O.expired.id, 'Abonelik testi yeniden etkin')).error);
  });
});

describe('SL-04 bayrağın yetkisi', { skip }, () => {
  test('ofis sahibi bayrağı okuyamaz ve değiştiremez; anonim okuyamaz; herkese açık profil göstermez', async () => {
    const read = await O.active.owner.client.from('platform_settings').select('enforce_subscription_limits');
    assert.ok(read.error || read.data.length === 0, 'ofis sahibi bayrağı okudu');
    const write = await O.active.owner.client.from('platform_settings').update({ enforce_subscription_limits: true }).eq('id', true).select('id');
    assert.ok(write.error || write.data.length === 0, 'ofis sahibi bayrağı değiştirdi');
    const flag = await service.from('platform_settings').select('enforce_subscription_limits').eq('id', true).single();
    assert.equal(flag.data.enforce_subscription_limits, false);
    const anonRead = await anon.from('platform_settings').select('enforce_subscription_limits');
    assert.ok(anonRead.error || anonRead.data.length === 0);
    const profile = await anon.rpc('public_platform_profile');
    const row = Array.isArray(profile.data) ? profile.data[0] : profile.data;
    assert.equal('enforce_subscription_limits' in (row ?? {}), false);
  });
});

describe('SL-05 eşzamanlı eklemeler', { skip }, () => {
  test('aynı anda gönderilen ilanlar plan limitini aşamaz', async () => {
    const org = await makeOrg('race', { plan: PLAN, status: 'active' });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => addListing(org.owner.client, org.id, `Abonelik testi eşzamanlı ${i}`)));
    const created = results.filter((r) => !r.error).length;
    const rejected = results.filter((r) => /plan_limit_properties/.test(r.error?.message ?? '')).length;
    const { count } = await service.from('properties').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).is('deleted_at', null);
    assert.equal(count, 3, `limit 3, veritabanında ${count} ilan`);
    assert.equal(created, 3);
    assert.equal(rejected, 5);
  });
});

describe('SL-06 depolama kotası veritabanında', { skip }, () => {
  const MB = 1024 * 1024;
  // Bildirilen boyutun 1,35 katı sayılır (varyant payı, media_upload_allowed ile aynı formül)
  const addMedia = (client, orgId, propertyId, mb) =>
    client.from('media_assets').insert({
      organization_id: orgId,
      property_id: propertyId,
      kind: 'property_photo',
      status: 'pending',
      original_path: `organizations/${orgId}/properties/${propertyId}/${randomBytes(8).toString('hex')}`,
      mime_type: 'image/jpeg',
      byte_size: mb * MB,
    });
  const orgWithListing = async (label, subscription) => {
    const org = await makeOrg(label, subscription);
    const created = await addListing(org.owner.client, org.id, `Abonelik testi medya ${label}`);
    assert.ifError(created.error);
    return { ...org, propertyId: created.data.id };
  };
  const usedBytes = async (orgId) => {
    const { data, error } = await service.from('media_assets').select('byte_size').eq('organization_id', orgId);
    assert.ifError(error);
    return data.reduce((sum, r) => sum + Number(r.byte_size ?? 0), 0);
  };

  test('aynı anda gönderilen medya kayıtları 50 MB kotayı aşamaz', async () => {
    const org = await orgWithListing('mrace', { plan: PLAN, status: 'active' });
    // Mevcut kayıtlar bildirilen boyutla, yeni kayıt 1,35 katıyla sayılır: 30 + 13,5 ≤ 50, 40 + 13,5 > 50 → 4 kayıt
    const results = await Promise.all(Array.from({ length: 8 }, () => addMedia(org.owner.client, org.id, org.propertyId, 10)));
    const created = results.filter((r) => !r.error).length;
    const rejected = results.filter((r) => /plan_limit_storage/.test(r.error?.message ?? '')).length;
    assert.equal(created, 4);
    assert.equal(rejected, 4);
    assert.equal(await usedBytes(org.id), 40 * MB);
  });

  test('media_upload_allowed() çağrılmadan doğrudan ekleme de sınırda reddedilir', async () => {
    const org = await orgWithListing('mdirect', { plan: PLAN, status: 'active' });
    const over = await addMedia(org.owner.client, org.id, org.propertyId, 38); // 51,3 MB
    assert.match(over.error?.message ?? '', /plan_limit_storage/);
    assert.ifError((await addMedia(org.owner.client, org.id, org.propertyId, 37)).error); // 49,95 MB
    assert.match((await addMedia(service, org.id, org.propertyId, 10)).error?.message ?? '', /plan_limit_storage/, 'service role kotayı aştı'); // 37 + 13,5
  });

  test('üyesi olmadığı kuruma site görseli ekleyen kullanıcı RLS hatası alır, kota durumu sızmaz', async () => {
    const org = await orgWithListing('mleak', { plan: PLAN, status: 'active' });
    assert.ifError((await addMedia(org.owner.client, org.id, org.propertyId, 37)).error); // kotaya yakın
    const attempt = (client, orgId) =>
      client.from('media_assets').insert({
        organization_id: orgId,
        property_id: null,
        kind: 'post_cover',
        status: 'pending',
        original_path: `organizations/${orgId}/content/${randomBytes(8).toString('hex')}`,
        mime_type: 'image/jpeg',
        byte_size: 10 * MB,
      });
    const atQuota = await attempt(O.active.owner.client, org.id);
    assert.ok(atQuota.error, 'yetkisiz ekleme kabul edildi');
    assert.doesNotMatch(atQuota.error.message, /plan_limit_storage/);
    assert.match(atQuota.error.message, /row-level security/);
    // Oturumsuz (anon) istek de kilit/kota denetimine ulaşmadan RLS hatası alır
    const anonAttempt = await attempt(anon, org.id);
    assert.ok(anonAttempt.error, 'anonim ekleme kabul edildi');
    assert.doesNotMatch(anonAttempt.error.message, /plan_limit_storage/);
    assert.equal(await usedBytes(org.id), 37 * MB);
  });

  test('planı sınırsız (etkin aboneliği yok, bayrak kapalı) organizasyon etkilenmez', async () => {
    await setFlag(false);
    const org = await orgWithListing('munl', null);
    assert.ifError((await addMedia(org.owner.client, org.id, org.propertyId, 500)).error);
  });
});
