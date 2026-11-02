/**
 * Üyelik değişikliğinin AÇIK oturuma etkisi (K-19, tenant izolasyonu).
 * Yetki JWT'de taşınmaz; her istekte veritabanındaki üyelikten okunur. Rol düşürülen, üyeliği kapatılan
 * ya da silinen kullanıcı, oturumu yenilemeden aynı istemciyle de eski yetkisini kullanamaz.
 *
 *   MC-01  Rol düşürme: yönetici → izleyici; aynı oturumda denetim kaydı, ayar ve ilan yazma kapanır.
 *   MC-02  Üyelik kapatma (disabled): aynı oturumda ofis verisi görünmez; yeniden açınca erişim döner.
 *   MC-03  Üyelik silme: aynı oturumda ofis verisi görünmez.
 *
 * Kendi geçici organizasyonunu (mctest-*) ve kullanıcılarını oluşturur, sonunda SİLER.
 * Yalnızca yerel Supabase'e bağlanır (kullanıcı oluşturur ve siler).
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; üyelik testleri yalnızca yerel Supabase ile çalışır`);
}
const skip = !url || !anonKey || !serviceKey ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = skip ? null : createClient(url, serviceKey, opts);
const anon = skip ? null : createClient(url, anonKey, opts);

const RUN = randomBytes(3).toString('hex');
/** Kurum ilan öneki (A–Z, 2–5 harf, benzersiz): 4 rastgele harf, 456 976 olasılık */
const prefix = (first) => first + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const PASSWORD = `Mc-${randomBytes(8).toString('hex')}-7a`;
const users = [];
let orgId;
let draftId;
let taxonomy;
let owner;
let member;

async function makeUser(label) {
  const email = `mc-${RUN}-${label}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(error);
  users.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  return { id: data.user.id, client };
}

const membership = () => service.from('organization_members').select('role, status').eq('organization_id', orgId).eq('user_id', member.id).maybeSingle();
const setMember = async (patch) => {
  // Değişikliği ofis sahibi kendi oturumuyla yapar (uygulamadaki yol); sonuç sunucu anahtarıyla doğrulanır
  const r = await owner.client.from('organization_members').update(patch).eq('organization_id', orgId).eq('user_id', member.id).select('user_id');
  assert.ifError(r.error);
  assert.equal(r.data.length, 1);
};
const seesDraft = async () => ((await member.client.from('properties').select('id').eq('id', draftId)).data ?? []).length === 1;
const seesAudit = async () => ((await member.client.from('audit_logs').select('id').eq('organization_id', orgId).limit(1)).data ?? []).length > 0;

before(async () => {
  if (skip) return;
  const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
  assert.ifError(type.error);
  const district = await anon.from('districts').select('id, city_id').limit(1).single();
  assert.ifError(district.error);
  taxonomy = { typeId: type.data.id, districtId: district.data.id, cityId: district.data.city_id };
  const org = await service.from('organizations').insert({ slug: `mctest-${RUN}`, name: 'Üyelik testi', reference_prefix: prefix('M'), status: 'active' }).select('id').single();
  assert.ifError(org.error);
  orgId = org.data.id;
  assert.ifError((await service.from('organization_settings').insert({ organization_id: orgId, display_name: 'Üyelik testi' })).error);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: orgId, plan_id: 'kurumsal', status: 'active' })).error);
  owner = await makeUser('owner');
  member = await makeUser('member');
  assert.ifError((await service.from('organization_members').insert({ organization_id: orgId, user_id: owner.id, role: 'owner', status: 'active' })).error);
  assert.ifError((await service.from('organization_members').insert({ organization_id: orgId, user_id: member.id, role: 'admin', status: 'active' })).error);
  const draft = await owner.client.from('properties').insert({ organization_id: orgId, title: 'Üyelik testi taslak ilan', listing_type: 'sale', property_type_id: taxonomy.typeId, category: 'konut', city_id: taxonomy.cityId, district_id: taxonomy.districtId, slug: '', reference_no: '', status: 'draft' }).select('id').single();
  assert.ifError(draft.error);
  draftId = draft.data.id;
});

after(async () => {
  if (skip) return;
  if (orgId) await service.from('organizations').delete().eq('id', orgId);
  for (const id of users) await service.auth.admin.deleteUser(id);
});

describe('Üyelik değişikliği açık oturuma hemen yansır', { skip }, () => {
  test('MC-01 rol düşürme: yönetici → izleyici; aynı oturumda yönetici işlemleri kapanır', async () => {
    // Önce: yönetici denetim kaydını görür ve ilan ayarını değiştirir
    assert.ok(await seesAudit(), 'kontrol: yönetici denetim kaydını görmeli');
    const before = await member.client.from('organization_settings').update({ default_location_precision: 'approximate' }).eq('organization_id', orgId).select('organization_id');
    assert.equal(before.data?.length, 1, 'kontrol: yönetici ayarı değiştirebilmeli');

    await setMember({ role: 'viewer' });
    assert.equal((await membership()).data.role, 'viewer');

    // Aynı istemci (oturum yenilenmedi)
    assert.equal(await seesAudit(), false, 'izleyiciye düşen kullanıcı denetim kaydını gördü');
    const settings = await member.client.from('organization_settings').update({ default_location_precision: 'exact' }).eq('organization_id', orgId).select('organization_id');
    assert.ok(settings.error || settings.data.length === 0, 'izleyiciye düşen kullanıcı ayarı değiştirdi');
    const insert = await member.client.from('properties').insert({ organization_id: orgId, title: 'Düşürülmüş rol ilanı', listing_type: 'sale', property_type_id: taxonomy.typeId, category: 'konut', slug: '', reference_no: '' }).select('id');
    assert.ok(insert.error, 'izleyiciye düşen kullanıcı ilan ekledi');
    assert.ok(await seesDraft(), 'izleyici okumaya devam eder');
  });

  test('MC-02 üyelik kapatma: aynı oturumda ofis verisi görünmez; yeniden açınca döner', async () => {
    await setMember({ status: 'disabled' });
    assert.equal(await seesDraft(), false, 'kapatılan üye taslak ilanı gördü');
    const settings = await member.client.from('organization_settings').select('organization_id').eq('organization_id', orgId);
    assert.ok(settings.error || settings.data.length === 0, 'kapatılan üye ayarları gördü');
    await setMember({ status: 'active' });
    assert.ok(await seesDraft(), 'yeniden açılan üye erişimini geri almalı');
  });

  test('MC-03 üyelik silme: aynı oturumda ofis verisi görünmez', async () => {
    const r = await owner.client.from('organization_members').delete().eq('organization_id', orgId).eq('user_id', member.id).select('user_id');
    assert.ifError(r.error);
    assert.equal(r.data.length, 1);
    assert.equal((await membership()).data, null);
    assert.equal(await seesDraft(), false, 'silinen üye taslak ilanı gördü');
    const members = await member.client.from('organization_members').select('user_id').eq('organization_id', orgId);
    assert.ok(members.error || members.data.length === 0, 'silinen üye ekip listesini gördü');
  });
});
