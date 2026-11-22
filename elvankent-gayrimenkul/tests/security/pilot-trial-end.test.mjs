/**
 * PILOT · H: deneme (pilot) bitiş tarihi (supabase/pending/20261108000004_pilot_trial_end.sql).
 * Gerçek (yerel) Supabase'e karşı; kendi geçici organizasyonunu (pttest-*) ve kullanıcılarını oluşturur, sonunda SİLER.
 *
 *   PT-01  süper yönetici güncel deneme aboneliğinin bitişini 60 gün sonrasına ayarlar; plan, durum ve satır sayısı değişmez
 *   PT-02  sınırlar: geçmiş, 1 günden yakın ve 365 günden uzak tarih reddedilir (invalid_trial_end)
 *   PT-03  deneme dışı (active) abonelikte reddedilir (no_trial_subscription)
 *   PT-04  ofis sahibi ve anon çağıramaz; başka ofisin aboneliği değişmez
 *   PT-05  denetim kaydı yazılır (subscription.trial_end_set)
 *
 * H uygulanmamış veritabanında atlanır; CI'da (CI=true) atlanmaz, hata verir.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; pilot testleri yalnızca yerel Supabase ile çalışır`);
}
const missing = !url || !anonKey || !serviceKey;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = missing ? null : createClient(url, serviceKey, opts);
const anon = missing ? null : createClient(url, anonKey, opts);
let skip = missing ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;

const RUN = randomBytes(3).toString('hex');
const PASSWORD = `Pt-${randomBytes(8).toString('hex')}-7a`;
const prefix = () => 'P' + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const users = [];
const orgs = [];
let admin;
let owner;
let A;
let B;
const days = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

async function makeUser(label) {
  const email = `pt-${RUN}-${label}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(error);
  users.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email, password: PASSWORD })).error);
  return { id: data.user.id, client };
}
async function makeOrg(label, status) {
  const org = await service.from('organizations').insert({ slug: `pttest-${RUN}-${label}`, name: `Pilot ${label}`, reference_prefix: prefix(), status: 'active' }).select('id').single();
  assert.ifError(org.error);
  orgs.push(org.data.id);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: org.data.id, plan_id: 'kurumsal', status, trial_ends_at: status === 'trialing' ? days(14) : null })).error);
  return org.data.id;
}
const subs = async (org) => (await service.from('subscriptions').select('id, plan_id, status, trial_ends_at').eq('organization_id', org).order('id')).data;

before(async () => {
  if (skip) return;
  A = await makeOrg('a', 'trialing');
  B = await makeOrg('b', 'trialing');
  admin = await makeUser('admin');
  assert.ifError((await service.from('profiles').update({ is_super_admin: true }).eq('id', admin.id)).error);
  owner = await makeUser('owner');
  assert.ifError((await service.from('organization_members').insert({ organization_id: A, user_id: owner.id, role: 'owner', status: 'active' })).error);
  const probe = await admin.client.rpc('platform_set_trial_end', { p_org: A, p_ends_at: days(20) });
  if (probe.error && /function|schema cache|PGRST202/i.test(`${probe.error.code} ${probe.error.message}`)) {
    if (process.env.CI) throw new Error('CI: PILOT bekleyen migration (H) uygulanmamış');
    skip = 'PILOT bekleyen migration (H) bu veritabanında uygulanmamış (supabase/pending)';
  }
});

after(async () => {
  if (missing) return;
  for (const id of orgs) await service.from('organizations').delete().eq('id', id);
  for (const id of users) await service.auth.admin.deleteUser(id);
});

describe('PT pilot deneme bitişi', () => {
  test('PT-01 süper yönetici bitişi 60 gün sonrasına ayarlar; plan/durum/satır sayısı değişmez', async (t) => {
    if (skip) return t.skip(skip);
    const before = await subs(A);
    const target = days(60);
    const r = await admin.client.rpc('platform_set_trial_end', { p_org: A, p_ends_at: target });
    assert.ifError(r.error);
    const after = await subs(A);
    assert.equal(after.length, before.length, 'yeni abonelik satırı açılmamalı');
    const trial = after.find((s) => s.status === 'trialing');
    assert.equal(trial.plan_id, 'kurumsal');
    assert.equal(new Date(trial.trial_ends_at).toISOString(), new Date(target).toISOString());
  });

  test('PT-02 geçmiş, 1 günden yakın ve 365 günden uzak tarih reddedilir', async (t) => {
    if (skip) return t.skip(skip);
    for (const bad of [days(-1), days(0.5), days(366)]) {
      const r = await admin.client.rpc('platform_set_trial_end', { p_org: A, p_ends_at: bad });
      assert.ok(r.error, bad);
      assert.match(r.error.message, /invalid_trial_end/);
    }
  });

  test('PT-03 deneme dışı (active) abonelikte reddedilir', async (t) => {
    if (skip) return t.skip(skip);
    const C = await makeOrg('c', 'active');
    const r = await admin.client.rpc('platform_set_trial_end', { p_org: C, p_ends_at: days(30) });
    assert.ok(r.error);
    assert.match(r.error.message, /no_trial_subscription/);
  });

  test('PT-04 ofis sahibi ve anon çağıramaz; başka ofisin aboneliği değişmez', async (t) => {
    if (skip) return t.skip(skip);
    const beforeB = await subs(B);
    assert.ok((await owner.client.rpc('platform_set_trial_end', { p_org: A, p_ends_at: days(90) })).error, 'ofis sahibi çağırmamalı');
    assert.ok((await owner.client.rpc('platform_set_trial_end', { p_org: B, p_ends_at: days(90) })).error, 'başka ofis için çağırmamalı');
    assert.ok((await anon.rpc('platform_set_trial_end', { p_org: B, p_ends_at: days(90) })).error, 'anon çağırmamalı');
    assert.deepEqual(await subs(B), beforeB);
  });

  test('PT-05 denetim kaydı yazılır', async (t) => {
    if (skip) return t.skip(skip);
    const log = await service.from('audit_logs').select('action, actor_id').eq('organization_id', A).eq('action', 'subscription.trial_end_set');
    assert.ifError(log.error);
    assert.ok(log.data.length >= 1);
    assert.equal(log.data[0].actor_id, admin.id);
  });
});
