/**
 * PILOT · I: ilk kurulum ve tek seferlik tasarım seçimi (supabase/pending/20261108000005_org_setup.sql).
 * Gerçek (yerel) Supabase'e karşı; kendi geçici organizasyonlarını (ostest-*) ve kullanıcılarını oluşturur, sonunda SİLER.
 *
 *   OS-01  konsoldan (süper yönetici) açılan ofis 'setup_pending'; migration'dan önce var olan ofis (varsayılan kiracı)
 *          'setup_completed' + 'legacy'; service_role ile açılan ofis satır almaz (eski davranış)
 *   OS-02  sahip kendi ofisi için bir kez seçer: adım + aday kaydedilir, onayda tasarım yayına yazılır, denetim kaydı
 *   OS-03  ikinci seçim ve tamamlanmış kurulumda adım kaydı reddedilir (setup_completed); izinsiz aile reddedilir
 *   OS-04  başka ofisin sahibi A için seçemez / adım kaydedemez (forbidden); A'nın durumu değişmez
 *   OS-05  danışman (agent), görüntüleyici (viewer) ve anon seçemez; istemci tabloya doğrudan yazamaz
 *   OS-06  kilit: sahip tema / aile değiştiremez (site_save_draft, site_apply_design, eski sürüme dönüş); marka, logo, iletişim,
 *          header, ana sayfa ve yayınlama çalışır
 *   OS-07  yeniden açma: yalnız süper yönetici; denetim kaydı (site.setup_reopened, işlemi yapan); sahip çağıramaz
 *   OS-08  yeniden açıldıktan sonra sahip yeniden seçer; yeni aile yayında; tekrar kilitlenir
 *   OS-09  eşzamanlı çift onay: tam olarak biri kazanır, yayın sürümü bir kez artar
 *   OS-10  eski / satırsız ofis: kurulum gerekmiyor (setup_not_required), tasarım kilitli değil
 *
 * I uygulanmamış veritabanında atlanır; CI'da (CI=true) atlanmaz, hata verir.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; kurulum testleri yalnızca yerel Supabase ile çalışır`);
}
const missing = !url || !anonKey || !serviceKey;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = missing ? null : createClient(url, serviceKey, opts);
const anon = missing ? null : createClient(url, anonKey, opts);
let skip = missing ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;

const RUN = randomBytes(3).toString('hex');
const PASSWORD = `Os-${randomBytes(8).toString('hex')}-7a`;
const prefix = () => 'S' + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const users = [];
const orgs = [];
const U = {};
const O = {};
const FAMILIES = ['klasik-guven', 'sinematik-vitrin'];

/** site_apply_design'ın beklediği beş tasarım bölümü (içerik okuma tarafında şemayla temizlenir) */
const sections = (family, theme) => ({
  theme,
  colors: { mode: 'preset', preset: 'premium-gold', scheme: 'light' },
  typography: {},
  style: { origin: { siteType: 'residential-office', family, homepage: 'family' } },
  home: { sections: [] },
});

async function makeUser(label) {
  const email = `os-${RUN}-${label}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  assert.ifError(error);
  users.push(data.user.id);
  return { id: data.user.id, email };
}
async function signIn(user) {
  const client = createClient(url, anonKey, opts);
  assert.ifError((await client.auth.signInWithPassword({ email: user.email, password: PASSWORD })).error);
  return client;
}
/** Konsol yolu: süper yönetici oturumuyla platform_create_organization (davetsiz, mevcut hesap sahip) */
async function consoleOrg(label, owner) {
  const { data, error } = await U.admin.client.rpc('platform_create_organization', {
    p_slug: `ostest-${RUN}-${label}`,
    p_name: `Kurulum ${label} ${RUN}`,
    p_prefix: prefix(),
    p_plan: 'kurumsal',
    p_owner: owner.id,
  });
  assert.ifError(error);
  orgs.push(data);
  assert.ifError((await U.admin.client.rpc('platform_set_org_design_families', { p_org: data, p_families: FAMILIES })).error);
  return data;
}
async function member(org, user, role) {
  assert.ifError((await service.from('organization_members').insert({ organization_id: org, user_id: user.id, role, status: 'active' })).error);
}
const setupRow = async (org) => (await service.from('organization_setup').select('state, origin, step, selected_family, completed_at, reopened_at').eq('organization_id', org).maybeSingle()).data;
const siteRow = async (org) => (await service.from('site_configs').select('draft, published, published_version').eq('organization_id', org).single()).data;
const errText = (res) => `${res.error?.code ?? ''} ${res.error?.message ?? ''}`;

before(async () => {
  if (skip) return;
  U.admin = await makeUser('admin');
  assert.ifError((await service.from('profiles').update({ is_super_admin: true }).eq('id', U.admin.id)).error);
  U.admin.client = await signIn(U.admin);
  for (const label of ['ownerA', 'ownerB', 'ownerC', 'ownerD', 'agentA', 'viewerA']) U[label] = await makeUser(label.toLowerCase());
  const probe = await U.admin.client.rpc('platform_reopen_org_setup', { p_org: '00000000-0000-0000-0000-000000000000' });
  if (probe.error && /function|schema cache|PGRST202/i.test(`${probe.error.code} ${probe.error.message}`)) {
    if (process.env.CI) throw new Error('CI: PILOT bekleyen migration (I) uygulanmamış');
    skip = 'PILOT bekleyen migration (I) bu veritabanında uygulanmamış (supabase/pending)';
    return;
  }
  O.A = await consoleOrg('a', U.ownerA);
  O.B = await consoleOrg('b', U.ownerB);
  O.C = await consoleOrg('c', U.ownerC);
  await member(O.A, U.agentA, 'agent');
  await member(O.A, U.viewerA, 'viewer');
  // Konsol dışı (service_role) açılan ofis: kurulum satırı yok
  const d = await service.from('organizations').insert({ slug: `ostest-${RUN}-d`, name: `Kurulum d ${RUN}`, reference_prefix: prefix(), status: 'active' }).select('id').single();
  assert.ifError(d.error);
  O.D = d.data.id;
  orgs.push(O.D);
  await service.from('organization_settings').insert({ organization_id: O.D, display_name: `Kurulum d ${RUN}` });
  await service.from('subscriptions').insert({ organization_id: O.D, plan_id: 'kurumsal', status: 'active' });
  await member(O.D, U.ownerD, 'owner');
  for (const k of ['ownerA', 'ownerB', 'ownerC', 'ownerD', 'agentA', 'viewerA']) U[k].client = await signIn(U[k]);
});

after(async () => {
  if (missing) return;
  for (const id of orgs) await service.from('organizations').delete().eq('id', id);
  for (const id of users) await service.auth.admin.deleteUser(id);
});

describe('OS ilk kurulum ve tasarım kilidi', () => {
  test('OS-01 konsoldan açılan ofis kurulum bekler; var olan ofis tamamlanmış (legacy); service_role ofisi satırsız', async (t) => {
    if (skip) return t.skip(skip);
    assert.deepEqual(await setupRow(O.A), { state: 'setup_pending', origin: 'onboarding', step: 0, selected_family: null, completed_at: null, reopened_at: null });
    const { data: def } = await service.from('organizations').select('id').eq('is_default', true).maybeSingle();
    if (def) {
      const row = await setupRow(def.id);
      assert.equal(row?.state, 'setup_completed', 'varsayılan kiracı kuruluma zorlanmaz');
      assert.equal(row?.origin, 'legacy');
    }
    // Migration'ın işaretlediği her ofis tamamlanmış; onboarding satırı yalnız süper yönetici açılışında
    const { data: legacy } = await service.from('organization_setup').select('organization_id').eq('origin', 'legacy').neq('state', 'setup_completed');
    assert.deepEqual(legacy, []);
    assert.equal(await setupRow(O.D), null);
  });

  test('OS-02 sahip adımı ve adayı kaydeder, bir kez onaylar; tasarım yayına yazılır, denetim kaydı', async (t) => {
    if (skip) return t.skip(skip);
    const c = U.ownerA.client;
    assert.equal((await c.rpc('org_setup_progress', { p_org: O.A, p_step: 1 })).data, 'setup_pending');
    assert.equal((await c.rpc('org_setup_progress', { p_org: O.A, p_step: 2 })).data, 'theme_selection_pending');
    assert.equal((await c.rpc('org_setup_progress', { p_org: O.A, p_step: 3, p_family: 'sinematik-vitrin' })).data, 'theme_selected');
    assert.equal((await setupRow(O.A)).selected_family, 'sinematik-vitrin');
    const before = await siteRow(O.A);
    const done = await c.rpc('org_setup_complete', { p_org: O.A, p_family: 'sinematik-vitrin', p_sections: sections('sinematik-vitrin', 'rezidans') });
    assert.ifError(done.error);
    const row = await setupRow(O.A);
    assert.equal(row.state, 'setup_completed');
    assert.equal(row.selected_family, 'sinematik-vitrin');
    const site = await siteRow(O.A);
    assert.equal(site.published_version, before.published_version + 1);
    assert.equal(site.published.style.origin.family, 'sinematik-vitrin');
    assert.equal(site.published.theme, 'rezidans');
    const { data: audit } = await service.from('audit_logs').select('action, actor_id').eq('organization_id', O.A).eq('action', 'site.setup_completed');
    assert.deepEqual(audit, [{ action: 'site.setup_completed', actor_id: U.ownerA.id }]);
  });

  test('OS-03 ikinci seçim ve tamamlanmış kurulumda adım kaydı reddedilir; izinsiz aile reddedilir', async (t) => {
    if (skip) return t.skip(skip);
    const c = U.ownerA.client;
    const again = await c.rpc('org_setup_complete', { p_org: O.A, p_family: 'klasik-guven', p_sections: sections('klasik-guven', 'klasik') });
    assert.match(errText(again), /setup_completed/);
    assert.match(errText(await c.rpc('org_setup_progress', { p_org: O.A, p_step: 2, p_family: 'klasik-guven' })), /setup_completed/);
    assert.equal((await siteRow(O.A)).published.style.origin.family, 'sinematik-vitrin');
    assert.match(errText(await U.ownerC.client.rpc('org_setup_progress', { p_org: O.C, p_step: 2, p_family: 'yalin-galeri' })), /family_not_allowed/);
  });

  test('OS-04 başka ofisin sahibi A için seçemez', async (t) => {
    if (skip) return t.skip(skip);
    const before = await setupRow(O.B);
    const c = U.ownerA.client;
    assert.match(errText(await c.rpc('org_setup_complete', { p_org: O.B, p_family: 'klasik-guven', p_sections: sections('klasik-guven', 'klasik') })), /forbidden|42501/);
    assert.match(errText(await c.rpc('org_setup_progress', { p_org: O.B, p_step: 3, p_family: 'klasik-guven' })), /forbidden|42501/);
    assert.deepEqual(await setupRow(O.B), before);
    // B'nin sahibi A'nın satırını okuyamaz (RLS)
    const { data } = await U.ownerB.client.from('organization_setup').select('organization_id').eq('organization_id', O.A);
    assert.deepEqual(data, []);
  });

  test('OS-05 danışman, görüntüleyici ve anon seçemez; istemci tabloya yazamaz', async (t) => {
    if (skip) return t.skip(skip);
    const before = await setupRow(O.B);
    for (const c of [U.agentA.client, U.viewerA.client, anon]) {
      assert.ok((await c.rpc('org_setup_complete', { p_org: O.A, p_family: 'klasik-guven', p_sections: sections('klasik-guven', 'klasik') })).error);
      assert.ok((await c.rpc('org_setup_progress', { p_org: O.A, p_step: 1 })).error);
    }
    // Sahip bile durumu doğrudan değiştiremez (yalnız fonksiyonlar)
    for (const c of [U.ownerB.client, U.agentA.client]) {
      const upd = await c.from('organization_setup').update({ state: 'setup_completed' }).eq('organization_id', O.B).select('state');
      assert.ok(upd.error || (upd.data ?? []).length === 0, 'istemci kurulum durumunu yazdı');
      const ins = await c.from('organization_setup').insert({ organization_id: O.D, state: 'setup_pending' });
      assert.ok(ins.error, 'istemci kurulum satırı açtı');
    }
    assert.deepEqual(await setupRow(O.B), before);
  });

  test('OS-06 kilit: tema / aile değişmez; marka, logo, iletişim, header, ana sayfa ve yayın çalışır', async (t) => {
    if (skip) return t.skip(skip);
    const c = U.ownerA.client;
    assert.match(errText(await c.rpc('site_save_draft', { p_org: O.A, p_section: 'theme', p_value: 'klasik' })), /design_locked/);
    assert.match(errText(await c.rpc('site_save_draft', { p_org: O.A, p_section: 'style', p_value: { origin: { siteType: 'residential-office', family: 'klasik-guven', homepage: 'family' } } })), /design_locked/);
    assert.match(errText(await c.rpc('site_apply_design', { p_org: O.A, p_family: 'klasik-guven', p_sections: sections('klasik-guven', 'klasik') })), /design_locked/);
    let site = await siteRow(O.A);
    assert.equal(site.draft.theme, 'rezidans');
    assert.equal(site.draft.style.origin.family, 'sinematik-vitrin');
    // Kilit dışı: marka (logo + iletişim) taslağı, header, ana sayfa bölümleri ve yayın
    assert.ifError((await c.rpc('site_save_draft', { p_org: O.A, p_section: 'brand', p_value: { phone: '+90 555 111 22 33', logo_url: 'https://cdn.example.test/logo.png', tagline: `Kilit ${RUN}` } })).error);
    assert.ifError((await c.rpc('site_save_draft', { p_org: O.A, p_section: 'header', p_value: { style: 'dark' } })).error);
    assert.ifError((await c.rpc('site_save_draft', { p_org: O.A, p_section: 'home', p_value: { sections: [] } })).error);
    assert.ifError((await c.rpc('site_publish', { p_org: O.A, p_note: 'kilit dışı değişiklikler' })).error);
    const { data: settings } = await service.from('organization_settings').select('phone, tagline, logo_url').eq('organization_id', O.A).single();
    assert.deepEqual(settings, { phone: '+90 555 111 22 33', tagline: `Kilit ${RUN}`, logo_url: 'https://cdn.example.test/logo.png' });
    site = await siteRow(O.A);
    assert.equal(site.published.theme, 'rezidans');
    assert.equal(site.published.header.style, 'dark');
    // Kurulum öncesi (tasarımsız) sürüme dönüş tasarımı değiştireceği için reddedilir
    const { data: revs } = await service.from('site_config_revisions').select('version, config').eq('organization_id', O.A).order('version');
    const older = (revs ?? []).find((r) => r.config?.theme !== 'rezidans');
    if (older) assert.match(errText(await c.rpc('site_rollback', { p_org: O.A, p_version: older.version })), /design_locked/);
  });

  test('OS-07 yeniden açma yalnız süper yönetici; denetim kaydı', async (t) => {
    if (skip) return t.skip(skip);
    for (const c of [U.ownerA.client, U.agentA.client, anon]) assert.ok((await c.rpc('platform_reopen_org_setup', { p_org: O.A })).error);
    assert.equal((await setupRow(O.A)).state, 'setup_completed');
    assert.ifError((await U.admin.client.rpc('platform_reopen_org_setup', { p_org: O.A, p_reason: 'müşteri talebi' })).error);
    const row = await setupRow(O.A);
    assert.equal(row.state, 'reopened_by_platform');
    assert.equal(row.step, 2);
    assert.ok(row.reopened_at);
    const { data: audit } = await service.from('audit_logs').select('actor_id, metadata').eq('organization_id', O.A).eq('action', 'site.setup_reopened');
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_id, U.admin.id);
    assert.equal(audit[0].metadata.previous_state, 'setup_completed');
    assert.equal(audit[0].metadata.reason, 'müşteri talebi');
  });

  test('OS-08 yeniden açıldıktan sonra sahip yeniden seçer ve yeniden kilitlenir', async (t) => {
    if (skip) return t.skip(skip);
    const c = U.ownerA.client;
    assert.equal((await c.rpc('org_setup_progress', { p_org: O.A, p_step: 3, p_family: 'klasik-guven' })).data, 'theme_selected');
    assert.ifError((await c.rpc('org_setup_complete', { p_org: O.A, p_family: 'klasik-guven', p_sections: sections('klasik-guven', 'klasik') })).error);
    const site = await siteRow(O.A);
    assert.equal(site.published.style.origin.family, 'klasik-guven');
    assert.equal(site.published.theme, 'klasik');
    assert.equal((await setupRow(O.A)).state, 'setup_completed');
    assert.match(errText(await c.rpc('site_save_draft', { p_org: O.A, p_section: 'theme', p_value: 'rezidans' })), /design_locked/);
  });

  test('OS-09 eşzamanlı çift onay: tam olarak biri kazanır', async (t) => {
    if (skip) return t.skip(skip);
    const second = await signIn(U.ownerC);
    const before = await siteRow(O.C);
    const results = await Promise.all([
      U.ownerC.client.rpc('org_setup_complete', { p_org: O.C, p_family: 'klasik-guven', p_sections: sections('klasik-guven', 'klasik') }),
      second.rpc('org_setup_complete', { p_org: O.C, p_family: 'sinematik-vitrin', p_sections: sections('sinematik-vitrin', 'rezidans') }),
    ]);
    const rejected = results.filter((r) => r.error);
    assert.equal(results.length - rejected.length, 1, 'tek kazanan');
    assert.equal(rejected.length, 1);
    assert.match(errText(rejected[0]), /setup_completed/);
    const site = await siteRow(O.C);
    assert.equal(site.published_version, before.published_version + 1);
    assert.equal((await setupRow(O.C)).selected_family, site.published.style.origin.family);
    const { data: audit } = await service.from('audit_logs').select('id').eq('organization_id', O.C).eq('action', 'site.setup_completed');
    assert.equal(audit.length, 1);
  });

  test('OS-10 satırsız (eski) ofis: kurulum gerekmiyor, tasarım kilitli değil', async (t) => {
    if (skip) return t.skip(skip);
    const c = U.ownerD.client;
    assert.match(errText(await c.rpc('org_setup_complete', { p_org: O.D, p_family: null, p_sections: null })), /setup_not_required/);
    assert.match(errText(await c.rpc('org_setup_progress', { p_org: O.D, p_step: 1 })), /setup_not_required/);
    assert.ifError((await c.rpc('site_save_draft', { p_org: O.D, p_section: 'theme', p_value: 'klasik' })).error);
    assert.equal((await siteRow(O.D)).draft.theme, 'klasik');
  });
});
