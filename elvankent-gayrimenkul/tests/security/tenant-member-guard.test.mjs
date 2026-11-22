/**
 * P0-3 · F: izinsiz üyelik ve yabancı OG görseli (supabase/pending/20261108000002_tenant_member_guard.sql).
 * Gerçek (yerel) Supabase'e karşı çalışır; kendi geçici organizasyonlarını (tgtest-*) ve kullanıcılarını oluşturur, sonunda SİLER.
 *
 *   TG-01  A sahibi, B ofisinin sahibini (başka ofise bağlı hesap) kendi ofisine ekleyemez; B'nin profili A'ya açılmaz
 *   TG-02  A sahibi, KARAYS süper yöneticisini ekleyemez
 *   TG-03  hiçbir ofise bağlı olmayan hesap (yeni / çıkarılıp yeniden eklenen) eklenebilir
 *   TG-04  üyelik satırının user_id'si başka bir kişiye çevrilemez; rol güncellemesi etkilenmez
 *   TG-05  service_role (ofis açılışı, davet) bir kişiyi ikinci ofise ekleyebilir
 *   TG-06  ilanın og_media_id'si yalnız aynı ofisin medyası olabilir
 *   TG-07  tetikleyici fonksiyonları RPC olarak çağrılamaz
 *
 * F uygulanmamış veritabanında atlanır; CI'da (CI=true) atlanmaz, hata verir.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; üyelik koruması testleri yalnızca yerel Supabase ile çalışır`);
}
const missing = !url || !anonKey || !serviceKey;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = missing ? null : createClient(url, serviceKey, opts);
const anon = missing ? null : createClient(url, anonKey, opts);
let skip = missing ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;

const RUN = randomBytes(3).toString('hex');
const prefix = (first) => first + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const PASSWORD = `Tg-${randomBytes(8).toString('hex')}-7a`;
const createdUsers = [];
const createdOrgs = [];
let taxonomy;
const O = {};

async function makeUser(label) {
  const email = `tg-${RUN}-${label}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(error);
  createdUsers.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  return { id: data.user.id, client };
}

async function makeOrg(label) {
  const org = await service
    .from('organizations')
    .insert({ slug: `tgtest-${RUN}-${label}`, name: `Üyelik koruması ${label}`, reference_prefix: prefix('T'), status: 'active' })
    .select('id')
    .single();
  assert.ifError(org.error);
  createdOrgs.push(org.data.id);
  assert.ifError((await service.from('organization_settings').insert({ organization_id: org.data.id, display_name: `Koruma ${label}` })).error);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: org.data.id, plan_id: 'kurumsal', status: 'active' })).error);
  const owner = await makeUser(`${label}-owner`);
  assert.ifError((await service.from('organization_members').insert({ organization_id: org.data.id, user_id: owner.id, role: 'owner', status: 'active' })).error);
  const listing = await owner.client
    .from('properties')
    .insert({
      organization_id: org.data.id,
      title: `Koruma ilanı ${label}`,
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
  const mediaId = randomUUID();
  const media = await service.from('media_assets').insert({
    id: mediaId,
    organization_id: org.data.id,
    property_id: listing.data.id,
    kind: 'property_photo',
    status: 'pending',
    original_path: `organizations/${org.data.id}/properties/${listing.data.id}/images/${mediaId}/original`,
    mime_type: 'image/jpeg',
    byte_size: 1000,
    original_filename: 'x.jpg',
    created_by: owner.id,
  });
  assert.ifError(media.error);
  return { id: org.data.id, owner, propertyId: listing.data.id, mediaId };
}

const addMember = (org, userId) =>
  org.owner.client.from('organization_members').insert({ organization_id: org.id, user_id: userId, role: 'agent', status: 'active' }).select('user_id');
const memberRow = async (orgId, userId) =>
  (await service.from('organization_members').select('user_id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle()).data;

before(async () => {
  if (skip) return;
  const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
  assert.ifError(type.error);
  const district = await anon.from('districts').select('id, city_id').limit(1).single();
  assert.ifError(district.error);
  taxonomy = { typeId: type.data.id, districtId: district.data.id, cityId: district.data.city_id };
  O.a = await makeOrg('a');
  O.b = await makeOrg('b');
  // F uygulanmış mı: A sahibi B sahibini ekleyebiliyorsa uygulanmamıştır (deneme geri alınır)
  const probe = await addMember(O.a, O.b.owner.id);
  if (!probe.error) {
    await service.from('organization_members').delete().eq('organization_id', O.a.id).eq('user_id', O.b.owner.id);
    if (process.env.CI) throw new Error('CI: P0-3 bekleyen migration (F) uygulanmamış');
    skip = 'P0-3 bekleyen migration (F) bu veritabanında uygulanmamış (supabase/pending)';
  }
});

after(async () => {
  if (missing) return;
  for (const id of createdOrgs) await service.from('organizations').delete().eq('id', id);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
});

describe('TG üyelik hedefi', () => {
  test('TG-01 başka ofise bağlı hesap eklenemez; profili A ekibine açılmaz', async (t) => {
    if (skip) return t.skip(skip);
    const r = await addMember(O.a, O.b.owner.id);
    assert.ok(r.error, 'B sahibi A ofisine eklenmemeli');
    assert.match(r.error.message, /member_unavailable/);
    assert.equal(await memberRow(O.a.id, O.b.owner.id), null);
    const seen = await O.a.owner.client.from('profiles').select('id').eq('id', O.b.owner.id);
    assert.equal((seen.data ?? []).length, 0, "B sahibinin profili A'ya görünmemeli");
  });

  test('TG-02 KARAYS süper yöneticisi eklenemez', async (t) => {
    if (skip) return t.skip(skip);
    const sa = await makeUser('superadmin');
    assert.ifError((await service.from('profiles').update({ is_super_admin: true }).eq('id', sa.id)).error);
    const r = await addMember(O.a, sa.id);
    assert.ok(r.error);
    assert.match(r.error.message, /member_unavailable/);
  });

  test('TG-03 hiçbir ofise bağlı olmayan hesap eklenir; çıkarılıp yeniden eklenebilir', async (t) => {
    if (skip) return t.skip(skip);
    const free = await makeUser('free');
    assert.ifError((await addMember(O.a, free.id)).error);
    assert.ok(await memberRow(O.a.id, free.id));
    assert.ifError((await O.a.owner.client.from('organization_members').delete().eq('organization_id', O.a.id).eq('user_id', free.id)).error);
    assert.ifError((await addMember(O.a, free.id)).error, 'çıkarılan kişi yeniden eklenebilmeli');
  });

  test('TG-04 user_id başka bir kişiye çevrilemez; rol güncellenebilir', async (t) => {
    if (skip) return t.skip(skip);
    const m = await makeUser('member');
    const other = await makeUser('other');
    assert.ifError((await addMember(O.a, m.id)).error);
    const swap = await O.a.owner.client.from('organization_members').update({ user_id: other.id }).eq('organization_id', O.a.id).eq('user_id', m.id).select('user_id');
    assert.ok(swap.error, 'user_id değişmemeli');
    assert.match(swap.error.message, /member_user_immutable/);
    const swapForeign = await O.a.owner.client.from('organization_members').update({ user_id: O.b.owner.id }).eq('organization_id', O.a.id).eq('user_id', m.id).select('user_id');
    assert.ok(swapForeign.error, 'B sahibine devredilmemeli');
    assert.equal(await memberRow(O.a.id, O.b.owner.id), null);
    const role = await O.a.owner.client.from('organization_members').update({ role: 'viewer' }).eq('organization_id', O.a.id).eq('user_id', m.id).select('user_id');
    assert.ifError(role.error);
    assert.equal(role.data.length, 1);
  });

  test('TG-05 service_role bir kişiyi ikinci ofise ekleyebilir (ofis açılışı, KARAYS konsolu)', async (t) => {
    if (skip) return t.skip(skip);
    assert.ifError((await service.from('organization_members').insert({ organization_id: O.a.id, user_id: O.b.owner.id, role: 'viewer', status: 'active' })).error);
    assert.ifError((await service.from('organization_members').delete().eq('organization_id', O.a.id).eq('user_id', O.b.owner.id)).error);
  });
});

describe('TG og_media_id', () => {
  test('TG-06 ilanın paylaşım görseli yalnız aynı ofisin medyası olabilir', async (t) => {
    if (skip) return t.skip(skip);
    const own = await O.a.owner.client.from('properties').update({ og_media_id: O.a.mediaId }).eq('id', O.a.propertyId).select('og_media_id');
    assert.ifError(own.error);
    assert.equal(own.data[0].og_media_id, O.a.mediaId);
    const foreign = await O.a.owner.client.from('properties').update({ og_media_id: O.b.mediaId }).eq('id', O.a.propertyId).select('og_media_id');
    assert.ok(foreign.error, "B'nin medyası A ilanına bağlanmamalı");
    assert.match(foreign.error.message, /cross_tenant_reference/);
    assert.ok((await service.from('properties').update({ og_media_id: O.b.mediaId }).eq('id', O.a.propertyId)).error, 'service_role ile de bağlanamaz');
    const row = await service.from('properties').select('og_media_id').eq('id', O.a.propertyId).single();
    assert.equal(row.data.og_media_id, O.a.mediaId);
  });
});

describe('TG yetkiler', () => {
  test('TG-07 tetikleyici fonksiyonları RPC olarak çağrılamaz', async (t) => {
    if (skip) return t.skip(skip);
    for (const fn of ['organization_members_target_guard', 'properties_og_media_guard']) {
      assert.ok((await O.a.owner.client.rpc(fn)).error, `${fn} istemciye açık olmamalı`);
      assert.ok((await anon.rpc(fn)).error, `${fn} anon'a açık olmamalı`);
    }
  });
});
