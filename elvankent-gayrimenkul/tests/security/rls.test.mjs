/**
 * Supabase RLS / yetki testleri — gerçek bir Supabase projesine (veya yerel
 * Supabase'e) karşı çalışır. Ziyaretçi, normal üye ve admin rolleriyle
 * izin verilen/verilmeyen işlemleri doğrular.
 *
 * Gerekli ortam değişkenleri:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD   (profiles.role = 'admin' olan hesap)
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD     (admin OLMAYAN hesap)
 *
 * Çalıştırma: npm run test:rls
 * UYARI: Test, geçici bir taslak ilan oluşturup siler. Canlı veritabanında
 * çalıştırmadan önce yedek almanız önerilir.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const missing = !url || !anonKey || !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_USER_EMAIL;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = missing ? null : createClient(url, anonKey, opts);
const user = missing ? null : createClient(url, anonKey, opts);
const admin = missing ? null : createClient(url, anonKey, opts);

let draftId;
let typeId;
let cityId;
let districtId;

before(async () => {
  if (missing) return;
  const a = await admin.auth.signInWithPassword({
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  });
  assert.ifError(a.error);
  const u = await user.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
  });
  assert.ifError(u.error);
  typeId = (await anon.from('property_types').select('id').eq('slug', 'daire').single()).data.id;
  const d = (await anon.from('districts').select('id, city_id').limit(1).single()).data;
  districtId = d.id;
  cityId = d.city_id;
});

after(async () => {
  if (missing || !draftId) return;
  await admin.from('properties').delete().eq('id', draftId);
  // Silme tetikleyicisinin oluşturduğu yönlendirmeyi temizle
  await admin.from('redirects').delete().like('from_path', '/ilan/rls-test-taslak-%');
});

const skip = missing ? 'Ortam değişkenleri tanımlı değil' : false;

test('admin taslak ilan oluşturabilir', { skip }, async () => {
  const { data, error } = await admin
    .from('properties')
    .insert({
      slug: 'rls-test-taslak',
      title: 'RLS test taslak ilanı (otomatik)',
      description: 'Bu kayıt otomatik güvenlik testi tarafından oluşturulur ve silinir.',
      listing_type: 'sale',
      property_type_id: typeId,
      city_id: cityId,
      district_id: districtId,
      price: 1000,
      status: 'draft',
    })
    .select('id, slug, listing_no')
    .single();
  assert.ifError(error);
  assert.match(data.slug, new RegExp(`-${data.listing_no}$`));
  draftId = data.id;
  const loc = await admin
    .from('property_locations')
    .insert({ property_id: draftId, address: 'Gizli test adresi', latitude: 39.95, longitude: 32.62, precision: 'approximate' });
  assert.ifError(loc.error);
});

test('ziyaretçi taslak ilanı göremez, aktif ilanları görebilir', { skip }, async () => {
  const draft = await anon.from('properties').select('id').eq('id', draftId);
  assert.equal(draft.data.length, 0);
  const active = await anon.from('properties').select('id, status').limit(50);
  assert.ifError(active.error);
  assert.ok(active.data.every((p) => p.status === 'active'));
});

test('normal üye taslak ilanı göremez ve ilan ekleyemez', { skip }, async () => {
  const draft = await user.from('properties').select('id').eq('id', draftId);
  assert.equal(draft.data.length, 0);
  const ins = await user.from('properties').insert({
    slug: 'yetkisiz', title: 'Yetkisiz kullanıcı ilanı denemesi', description: 'x'.repeat(40),
    listing_type: 'sale', property_type_id: typeId, city_id: cityId, district_id: districtId, price: 1,
  });
  assert.ok(ins.error, 'normal üye ilan ekleyebilmemeli');
});

test('ziyaretçi ilan güncelleyemez / silemez', { skip }, async () => {
  const { data: one } = await anon.from('properties').select('id, price').limit(1).single();
  const upd = await anon.from('properties').update({ price: 1 }).eq('id', one.id).select();
  assert.ok(upd.error || upd.data.length === 0);
  const del = await anon.from('properties').delete().eq('id', one.id).select();
  assert.ok(del.error || del.data.length === 0);
  const again = await anon.from('properties').select('price').eq('id', one.id).single();
  assert.equal(Number(again.data.price), Number(one.price));
});

test('açık adres ve kesin koordinat sadece admin tarafından okunur', { skip }, async () => {
  const a = await anon.from('property_locations').select('*').limit(1);
  assert.ok(a.error || a.data.length === 0);
  const u = await user.from('property_locations').select('*').limit(1);
  assert.ok(u.error || u.data.length === 0);
  const ad = await admin.from('property_locations').select('address').eq('property_id', draftId).single();
  assert.equal(ad.data.address, 'Gizli test adresi');
});

test('iletişim talepleri ziyaretçiye ve üyeye kapalı', { skip }, async () => {
  const a = await anon.from('contact_requests').select('*').limit(1);
  assert.ok(a.error || a.data.length === 0);
  const ins = await anon.from('contact_requests').insert({ full_name: 'Spam', message: 'spam spam', phone: '1' });
  assert.ok(ins.error, 'ziyaretçi doğrudan talep ekleyememeli');
  const rpc = await anon.rpc('submit_contact_request', {
    p_full_name: 'Spam', p_phone: '1', p_email: null, p_message: 'spam spam', p_property_id: null,
    p_source: 'contact_page', p_kvkk_consent: true, p_ip_hash: 'x', p_user_agent: 'x',
  });
  assert.ok(rpc.error, 'ziyaretçi RPC ile doğrudan talep ekleyememeli');
});

test('istatistik olayları ve sayaçlar ziyaretçiye kapalı', { skip }, async () => {
  const ev = await anon.rpc('track_property_event', { p_property_id: draftId, p_event: 'view', p_session_hash: 'abcdefghij' });
  assert.ok(ev.error);
  const st = await anon.from('property_stats').select('*').limit(1);
  assert.ok(st.error || st.data.length === 0);
  const dash = await user.rpc('admin_dashboard_stats');
  assert.ok(dash.error, 'normal üye dashboard verisi alamamalı');
  const adminDash = await admin.rpc('admin_dashboard_stats');
  assert.ifError(adminDash.error);
  assert.equal(typeof adminDash.data.total, 'number');
});

test('üye kendi rolünü admin yapamaz', { skip }, async () => {
  const { data: me } = await user.auth.getUser();
  const upd = await user.from('profiles').update({ role: 'admin' }).eq('id', me.user.id);
  assert.ok(upd.error, 'role sütunu güncellenememeli');
  const isAdmin = await user.rpc('is_admin');
  assert.equal(isAdmin.data, false);
});

test('site ayarları herkese okunur, sadece admin günceller', { skip }, async () => {
  const r = await anon.from('site_settings').select('business_name').single();
  assert.ifError(r.error);
  const u = await user.from('site_settings').update({ business_name: 'Hacked' }).eq('id', 1).select();
  assert.ok(u.error || u.data.length === 0);
  const again = await anon.from('site_settings').select('business_name').single();
  assert.notEqual(again.data.business_name, 'Hacked');
});

test('storage: ziyaretçi ve üye dosya yükleyemez', { skip }, async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
  const a = await anon.storage.from('property-images').upload(`rls-test/${Date.now()}.webp`, blob);
  assert.ok(a.error, 'ziyaretçi yükleyememeli');
  const u = await user.storage.from('property-images').upload(`rls-test/${Date.now()}.webp`, blob);
  assert.ok(u.error, 'üye yükleyememeli');
  const path = `rls-test/${Date.now()}.webp`;
  const ad = await admin.storage.from('property-images').upload(path, blob, { contentType: 'image/webp' });
  assert.ifError(ad.error);
  const rm = await admin.storage.from('property-images').remove([path]);
  assert.ifError(rm.error);
});
