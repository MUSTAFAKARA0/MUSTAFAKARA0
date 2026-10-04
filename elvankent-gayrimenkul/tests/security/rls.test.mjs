/**
 * V2 güvenlik testleri — gerçek bir Supabase projesine (veya yerel Supabase'e)
 * karşı çalışır ve veritabanı seviyesindeki korumaları doğrular:
 *
 *   • Anonim ziyaretçi yalnızca yayındaki içeriği görebilir.
 *   • Kiracı izolasyonu: Tenant A, Tenant B'nin ilanını, müşterisini,
 *     talebini, medyasını, denetim kaydını, dosyasını GÖREMEZ ve DEĞİŞTİREMEZ.
 *   • Rol yetkileri (owner, admin, agent, editor, viewer) veritabanında uygulanır.
 *   • Yetki yükseltme ve IDOR denemeleri reddedilir.
 *   • Depolama (Storage) klasörleri kiracılar arasında yalıtılmıştır.
 *   • Uygulamadaki yetki listesi veritabanındaki role_permissions ile aynıdır.
 *   • İki adımlı doğrulama (MFA): faktörü olan kullanıcı ve MFA zorunlu ofisin
 *     sahip/yöneticisi, kod girilmemiş (aal1) oturumla hiçbir veriye erişemez.
 *   • Bildirim ayarları ve bildirim kayıtları kiracılar arasında yalıtılmıştır.
 *
 * Test kendi geçici organizasyonlarını (rlstest-*) ve kullanıcılarını
 * (rls-*@example.test) oluşturur ve sonunda SİLER. Mevcut verilere dokunmaz.
 *
 * Gerekli ortam değişkenleri:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Çalıştırma: npm run test:rls
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../src/platform/auth/permissions.ts';
import { freshTotp } from './totp.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const missing = !url || !anonKey || !serviceKey;
const skip = missing ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = missing ? null : createClient(url, serviceKey, opts);
const anon = missing ? null : createClient(url, anonKey, opts);

const RUN = randomBytes(3).toString('hex');
const PASSWORD = `Rls-${randomBytes(8).toString('hex')}-7a`;
const ROLES = ['owner', 'admin', 'agent', 'editor', 'viewer'];
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' + '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

/** @type {Record<'A'|'B', any>} */
const T = { A: { users: {} }, B: { users: {} } };
let outsider;
let taxonomy;
const createdUsers = [];
const storageObjects = [];

/** Reddedildi mi? (hata döndü veya hiçbir satır etkilenmedi/döndürülmedi) */
function denied(res) {
  if (res.error) return true;
  if (Array.isArray(res.data)) return res.data.length === 0;
  return res.data === null;
}

function letters(n) {
  return Array.from(randomBytes(n), (b) => String.fromCharCode(65 + (b % 26))).join('');
}

async function makeUser(label) {
  const email = `rls-${RUN}-${label}@example.test`.toLowerCase();
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `RLS ${label}` } });
  assert.ifError(error);
  createdUsers.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  assert.ifError(signIn.error);
  return { id: data.user.id, email, client };
}

async function makeOrg(key) {
  const t = T[key];
  const { data: org, error } = await service
    .from('organizations')
    .insert({ slug: `rlstest-${RUN}-${key.toLowerCase()}`, name: `RLS Test ${key}`, reference_prefix: `R${letters(3)}`, status: 'active' })
    .select('id, slug')
    .single();
  assert.ifError(error);
  t.orgId = org.id;
  t.slug = org.slug;
  assert.ifError((await service.from('organization_settings').insert({ organization_id: org.id, display_name: `RLS Test ${key}` })).error);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: org.id, plan_id: 'kurumsal', status: 'active' })).error);
  for (const role of ROLES) {
    const user = await makeUser(`${key}-${role}`);
    assert.ifError((await service.from('organization_members').insert({ organization_id: org.id, user_id: user.id, role, status: 'active' })).error);
    t.users[role] = user;
  }

  const base = {
    organization_id: org.id,
    listing_type: 'sale',
    property_type_id: taxonomy.typeId,
    category: 'konut',
    city_id: taxonomy.cityId,
    district_id: taxonomy.districtId,
    slug: '',
    reference_no: '',
  };
  // Taslak ilan: sahibin kendi oturumuyla (RLS ile) oluşturulur
  const draft = await t.users.owner.client.from('properties').insert({ ...base, title: `RLS ${key} taslak ilan`, status: 'draft' }).select('id').single();
  assert.ifError(draft.error);
  t.draftId = draft.data.id;

  // Yayındaki ilan: kontrol listesi (fotoğraf, açıklama, fiyat, konum) sağlanarak
  const pub = await service
    .from('properties')
    .insert({
      ...base,
      title: `RLS ${key} yayındaki örnek ilan`,
      description: 'Bu ilan yalnızca otomatik güvenlik testleri için oluşturulmuştur ve test sonunda silinir.',
      price: 1000000,
      currency: 'TRY',
      status: 'draft',
    })
    .select('id')
    .single();
  assert.ifError(pub.error);
  t.publishedId = pub.data.id;
  const media = await service
    .from('media_assets')
    .insert({
      organization_id: org.id,
      property_id: t.publishedId,
      kind: 'property_photo',
      status: 'ready',
      public_base: '/demo/living-room',
      variant_widths: [320, 640],
      width: 1920,
      height: 1280,
    })
    .select('id')
    .single();
  assert.ifError(media.error);
  t.mediaId = media.data.id;
  assert.ifError((await service.from('properties').update({ status: 'published' }).eq('id', t.publishedId)).error);

  // CRM
  const customer = await service.from('customers').insert({ organization_id: org.id, full_name: `RLS ${key} Müşteri`, phone: '05320000000' }).select('id').single();
  assert.ifError(customer.error);
  t.customerId = customer.data.id;
  const lead = await service
    .from('leads')
    .insert({ organization_id: org.id, customer_id: t.customerId, property_id: t.publishedId, status: 'new', source: 'website', intent: 'buy' })
    .select('id')
    .single();
  assert.ifError(lead.error);
  t.leadId = lead.data.id;
  const collection = await service
    .from('collections')
    .insert({ organization_id: org.id, title: `RLS ${key} seçki`, token: randomBytes(32).toString('base64url') })
    .select('id, token')
    .single();
  assert.ifError(collection.error);
  t.collectionId = collection.data.id;

  // Özel kovada orijinal dosya
  t.originalPath = `organizations/${org.id}/properties/${t.publishedId}/images/${t.mediaId}/original`;
  assert.ifError((await service.storage.from('media-originals').upload(t.originalPath, PNG, { contentType: 'image/png', upsert: true })).error);
  storageObjects.push(['media-originals', t.originalPath]);
}

before(async () => {
  if (missing) return;
  const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
  assert.ifError(type.error);
  const district = await anon.from('districts').select('id, city_id').limit(1).single();
  assert.ifError(district.error);
  taxonomy = { typeId: type.data.id, districtId: district.data.id, cityId: district.data.city_id };
  await makeOrg('A');
  await makeOrg('B');
  outsider = await makeUser('outsider');
});

after(async () => {
  if (missing) return;
  for (const [bucket, path] of storageObjects) await service.storage.from(bucket).remove([path]);
  for (const key of ['A', 'B']) if (T[key].orgId) await service.from('organizations').delete().eq('id', T[key].orgId);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
});

// -----------------------------------------------------------------------------
describe('Anonim ziyaretçi', { skip }, () => {
  test('yayındaki ilanı görebilir, taslağı göremez', async () => {
    const pub = await anon.from('properties').select('id').eq('id', T.A.publishedId);
    assert.equal(pub.data?.length, 1);
    assert.ok(denied(await anon.from('properties').select('id').eq('id', T.A.draftId)));
  });
  test('müşteri, talep, üyelik, denetim kaydı ve özel konum verisini göremez', async () => {
    for (const table of ['customers', 'leads', 'organization_members', 'audit_logs', 'property_locations', 'collections']) {
      assert.ok(denied(await anon.from(table).select('*').eq('organization_id', T.A.orgId)), `${table} anonim okunabildi`);
    }
  });
  test('ilan oluşturamaz ve değiştiremez', async () => {
    const insert = await anon.from('properties').insert({ organization_id: T.A.orgId, title: 'Anonim deneme ilanı', listing_type: 'sale', property_type_id: taxonomy.typeId, category: 'konut', slug: '', reference_no: '' }).select('id');
    assert.ok(insert.error, 'anonim ilan ekleyebildi');
    assert.ok(denied(await anon.from('properties').update({ title: 'Değiştirildi' }).eq('id', T.A.publishedId).select('id')));
  });
  test('yayındaki görselin yalnızca görüntüleme sütunlarını okuyabilir (dosya adı, yükleyen, özel yol kapalı)', async () => {
    const ok = await anon.from('media_assets').select('id, public_base, variant_widths, is_cover').eq('id', T.A.mediaId);
    assert.equal(ok.data?.length, 1);
    for (const column of ['original_filename', 'original_path', 'created_by', 'error', 'byte_size']) {
      assert.ok((await anon.from('media_assets').select(column).eq('id', T.A.mediaId)).error, `${column} anonim okunabildi`);
    }
  });
  test('özel kovadaki orijinal dosyayı indiremez', async () => {
    const res = await anon.storage.from('media-originals').download(T.A.originalPath);
    assert.ok(res.error, 'anonim orijinal dosyayı indirebildi');
  });
  test('platform fonksiyonlarını çağıramaz', async () => {
    assert.ok((await anon.rpc('platform_organizations')).error);
  });
});

// -----------------------------------------------------------------------------
describe('Kiracı izolasyonu (Tenant A ↔ Tenant B)', { skip }, () => {
  test('kontrol: A kendi taslağını, müşterisini, talebini, seçkisini ve kayıtlarını görür', async () => {
    const a = T.A.users.owner.client;
    assert.equal((await a.from('properties').select('id').eq('id', T.A.draftId)).data?.length, 1);
    assert.equal((await a.from('customers').select('id').eq('id', T.A.customerId)).data?.length, 1);
    assert.equal((await a.from('leads').select('id').eq('id', T.A.leadId)).data?.length, 1);
    assert.equal((await a.from('collections').select('id').eq('id', T.A.collectionId)).data?.length, 1);
    assert.ok(((await a.from('audit_logs').select('id').eq('organization_id', T.A.orgId)).data ?? []).length > 0);
    assert.ok(!denied(await a.from('properties').update({ title: 'RLS A taslak ilan (güncel)' }).eq('id', T.A.draftId).select('id')));
  });
  test("A'nın sahibi B'nin taslak ilanını, müşterisini, talebini, medyasını, seçkisini ve kayıtlarını göremez", async () => {
    const a = T.A.users.owner.client;
    assert.ok(denied(await a.from('properties').select('id').eq('id', T.B.draftId)), 'B taslak ilanı görüldü');
    assert.ok(denied(await a.from('customers').select('id').eq('id', T.B.customerId)), 'B müşterisi görüldü');
    assert.ok(denied(await a.from('leads').select('id').eq('id', T.B.leadId)), 'B talebi görüldü');
    assert.ok(denied(await a.from('collections').select('id').eq('id', T.B.collectionId)), 'B seçkisi görüldü');
    assert.ok(denied(await a.from('audit_logs').select('id').eq('organization_id', T.B.orgId)), 'B denetim kaydı görüldü');
    assert.ok(denied(await a.from('property_locations').select('property_id').eq('organization_id', T.B.orgId)), 'B özel konum görüldü');
    // B'nin taslak ilanına ait medya satırları görünmez (yalnızca yayındaki ilanın hazır görselleri herkese açıktır)
    assert.ok(denied(await a.from('media_assets').select('id').eq('property_id', T.B.draftId)));
  });
  test("A'nın sahibi B'nin ilanını değiştiremez ve silemez", async () => {
    const a = T.A.users.owner.client;
    assert.ok(denied(await a.from('properties').update({ title: 'Ele geçirildi' }).eq('id', T.B.publishedId).select('id')));
    assert.ok(denied(await a.from('properties').delete().eq('id', T.B.draftId).select('id')));
    const check = await service.from('properties').select('title').eq('id', T.B.publishedId).single();
    assert.notEqual(check.data.title, 'Ele geçirildi');
  });
  test("A'nın sahibi B adına kayıt ekleyemez (organization_id istemciden güvenilmez)", async () => {
    const a = T.A.users.owner.client;
    const prop = await a.from('properties').insert({ organization_id: T.B.orgId, title: 'Başka ofise ilan', listing_type: 'sale', property_type_id: taxonomy.typeId, category: 'konut', slug: '', reference_no: '' }).select('id');
    assert.ok(prop.error, 'B adına ilan eklendi');
    const customer = await a.from('customers').insert({ organization_id: T.B.orgId, full_name: 'Sahte müşteri', phone: '05321111111' }).select('id');
    assert.ok(customer.error, 'B adına müşteri eklendi');
    const member = await a.from('organization_members').insert({ organization_id: T.B.orgId, user_id: T.A.users.owner.id, role: 'owner' }).select('user_id');
    assert.ok(member.error, 'B organizasyonuna kendini ekledi');
  });
  test('başka kiracının medyasına bağlantı verilemez (cross-tenant reference)', async () => {
    const a = T.A.users.owner.client;
    const post = await a.from('posts').insert({ organization_id: T.A.orgId, title: 'RLS test yazısı', slug: '', cover_media_id: T.B.mediaId }).select('id');
    assert.ok(post.error, 'B medyası A yazısına kapak yapıldı');
  });
  test("B'nin panel fonksiyonları A'ya kapalıdır", async () => {
    const a = T.A.users.owner.client;
    assert.ok((await a.rpc('org_dashboard', { p_org: T.B.orgId, p_days: 30 })).error, 'B panosu okundu');
    assert.ok((await a.rpc('org_usage', { p_org: T.B.orgId })).error, 'B kullanımı okundu');
    assert.ok((await a.rpc('list_org_members', { p_org: T.B.orgId })).error, 'B üyeleri listelendi');
    assert.ok(denied(await a.from('organization_settings').update({ tagline: 'ele geçirildi' }).eq('organization_id', T.B.orgId).select('organization_id')));
  });
  test("Depolama: A, B'nin klasörüne yazamaz, listeleyemez ve dosyasını indiremez", async () => {
    const a = T.A.users.owner.client;
    const foreign = `organizations/${T.B.orgId}/properties/${T.B.publishedId}/images/${randomUUID()}/original`;
    const up = await a.storage.from('media-originals').upload(foreign, PNG, { contentType: 'image/png' });
    if (!up.error) storageObjects.push(['media-originals', foreign]);
    assert.ok(up.error, "B'nin özel klasörüne yüklendi");
    const upPublic = await a.storage.from('media').upload(`organizations/${T.B.orgId}/x/${randomUUID()}.webp`, PNG, { contentType: 'image/webp' });
    assert.ok(upPublic.error, "B'nin herkese açık klasörüne yüklendi");
    const upBrand = await a.storage.from('branding').upload(`organizations/${T.B.orgId}/branding/logo-x.png`, PNG, { contentType: 'image/png' });
    assert.ok(upBrand.error, "B'nin marka klasörüne yüklendi");
    const list = await a.storage.from('media-originals').list(`organizations/${T.B.orgId}/properties/${T.B.publishedId}/images/${T.B.mediaId}`);
    assert.ok(list.error || (list.data ?? []).length === 0, "B'nin klasörü listelendi");
    const dl = await a.storage.from('media-originals').download(T.B.originalPath);
    assert.ok(dl.error, "B'nin orijinal dosyası indirildi");
    const rm = await a.storage.from('media-originals').remove([T.B.originalPath]);
    const still = await service.storage.from('media-originals').download(T.B.originalPath);
    assert.ok(!still.error, "B'nin dosyası silindi");
    void rm;
  });
  test('Depolama (kontrol): A kendi klasörüne yazabilir', async () => {
    const a = T.A.users.owner.client;
    const own = `organizations/${T.A.orgId}/properties/${T.A.publishedId}/images/${randomUUID()}/original`;
    const up = await a.storage.from('media-originals').upload(own, PNG, { contentType: 'image/png' });
    assert.ifError(up.error);
    storageObjects.push(['media-originals', own]);
    const list = await a.storage.from('media-originals').list(own.replace(/\/original$/, ''));
    assert.ok((list.data ?? []).some((f) => f.name === 'original'), 'A kendi klasörünü listeleyemedi');
  });
  test('üyeliği olmayan kullanıcı hiçbir kiracının özel verisini göremez', async () => {
    const o = outsider.client;
    for (const [table, key] of [['customers', 'customerId'], ['leads', 'leadId'], ['collections', 'collectionId']]) {
      assert.ok(denied(await o.from(table).select('id').eq('id', T.A[key])), `${table} görüldü`);
    }
    assert.ok(denied(await o.from('properties').select('id').eq('id', T.A.draftId)));
  });
});

// -----------------------------------------------------------------------------
describe('Rol yetkileri (Tenant A içinde)', { skip }, () => {
  test('viewer: okur ama değiştiremez', async () => {
    const v = T.A.users.viewer.client;
    assert.equal((await v.from('properties').select('id').eq('id', T.A.draftId)).data?.length, 1);
    assert.equal((await v.from('leads').select('id').eq('id', T.A.leadId)).data?.length, 1);
    assert.ok((await v.from('properties').insert({ organization_id: T.A.orgId, title: 'Viewer ilanı', listing_type: 'sale', property_type_id: taxonomy.typeId, category: 'konut', slug: '', reference_no: '' }).select('id')).error);
    assert.ok(denied(await v.from('properties').update({ title: 'Viewer değiştirdi' }).eq('id', T.A.draftId).select('id')));
    assert.ok(denied(await v.from('leads').update({ status: 'closed' }).eq('id', T.A.leadId).select('id')));
    assert.ok(denied(await v.from('audit_logs').select('id').eq('organization_id', T.A.orgId)));
  });
  test('editor: ilan düzenler ama yayınlayamaz; müşteri verisini göremez', async () => {
    const e = T.A.users.editor.client;
    assert.ok(!denied(await e.from('properties').update({ title: 'RLS A taslak ilan (editör)' }).eq('id', T.A.draftId).select('id')));
    const publish = await e.from('properties').update({ status: 'archived' }).eq('id', T.A.publishedId).select('id');
    assert.ok(denied(publish), 'editör yayın durumunu değiştirdi');
    assert.ok(denied(await e.from('leads').select('id').eq('id', T.A.leadId)), 'editör talebi gördü');
    assert.ok(denied(await e.from('customers').select('id').eq('id', T.A.customerId)), 'editör müşteriyi gördü');
  });
  test('agent: talepleri yönetir; ayarları, kullanıcıları ve kayıtları yönetemez; ilan silemez', async () => {
    const g = T.A.users.agent.client;
    assert.ok(!denied(await g.from('leads').update({ status: 'contacted' }).eq('id', T.A.leadId).select('id')));
    assert.ok(denied(await g.from('organization_settings').update({ tagline: 'agent' }).eq('organization_id', T.A.orgId).select('organization_id')));
    assert.ok(denied(await g.from('organization_members').update({ role: 'admin' }).eq('organization_id', T.A.orgId).eq('user_id', T.A.users.viewer.id).select('user_id')));
    assert.ok(denied(await g.from('audit_logs').select('id').eq('organization_id', T.A.orgId)));
    assert.ok(denied(await g.from('properties').update({ deleted_at: new Date().toISOString() }).eq('id', T.A.draftId).select('id')), 'agent ilanı çöpe taşıdı');
  });
  test('admin: ayarları ve kayıtları yönetir; sahip atayamaz, kendi rolünü değiştiremez', async () => {
    const ad = T.A.users.admin.client;
    // P0.2: marka/site içeriği doğrudan değil, taslak + yayınla değişir; ilan ayarı doğrudan yazılabilir
    assert.ok(!denied(await ad.from('organization_settings').update({ default_location_precision: 'approximate' }).eq('organization_id', T.A.orgId).select('organization_id')));
    assert.ok(!denied(await ad.from('audit_logs').select('id').eq('organization_id', T.A.orgId)));
    const promote = await ad.from('organization_members').update({ role: 'owner' }).eq('organization_id', T.A.orgId).eq('user_id', T.A.users.viewer.id).select('user_id');
    assert.ok(promote.error, 'admin sahip atadı');
    assert.match(promote.error.message, /owner_required/);
    const self = await ad.from('organization_members').update({ role: 'owner' }).eq('organization_id', T.A.orgId).eq('user_id', T.A.users.admin.id).select('user_id');
    assert.ok(self.error, 'admin kendi rolünü değiştirdi');
    const demoteOwner = await ad.from('organization_members').update({ role: 'viewer' }).eq('organization_id', T.A.orgId).eq('user_id', T.A.users.owner.id).select('user_id');
    assert.ok(demoteOwner.error, 'admin sahibi düşürdü');
  });
  test('owner: kendi üyeliğini değiştiremez (son sahip korunur)', async () => {
    const ow = T.A.users.owner.client;
    const res = await ow.from('organization_members').update({ role: 'viewer' }).eq('organization_id', T.A.orgId).eq('user_id', T.A.users.owner.id).select('user_id');
    assert.ok(res.error);
  });
});

// -----------------------------------------------------------------------------
describe('Yetki yükseltme ve IDOR', { skip }, () => {
  test('kullanıcı kendini süper admin yapamaz', async () => {
    const g = T.A.users.agent.client;
    const res = await g.from('profiles').update({ is_super_admin: true }).eq('id', T.A.users.agent.id).select('id');
    assert.ok(denied(res));
    const check = await service.from('profiles').select('is_super_admin').eq('id', T.A.users.agent.id).single();
    assert.equal(check.data.is_super_admin, false);
  });
  test('rol yetki tablosu değiştirilemez', async () => {
    const ow = T.A.users.owner.client;
    assert.ok((await ow.from('role_permissions').insert({ role: 'viewer', permission: 'users.manage' })).error);
  });
  test('platform fonksiyonları yalnızca süper admin içindir', async () => {
    const ow = T.A.users.owner.client;
    assert.ok((await ow.rpc('platform_organizations')).error);
    assert.ok((await ow.rpc('platform_set_org_plan', { p_org: T.A.orgId, p_plan: 'kurumsal', p_status: 'active' })).error);
    assert.ok((await ow.rpc('platform_set_org_status', { p_org: T.B.orgId, p_status: 'suspended' })).error);
  });
  test('denetim kayıtları değiştirilemez ve silinemez', async () => {
    const ow = T.A.users.owner.client;
    assert.ok(denied(await ow.from('audit_logs').update({ action: 'x.y' }).eq('organization_id', T.A.orgId).select('id')));
    assert.ok(denied(await ow.from('audit_logs').delete().eq('organization_id', T.A.orgId).select('id')));
  });
  test('tahmin edilen seçki bağlantısı bir şey döndürmez', async () => {
    const res = await anon.rpc('get_public_collection', { p_token: randomBytes(32).toString('base64url') });
    const status = Array.isArray(res.data) ? res.data[0]?.status : res.data?.status;
    assert.ok(res.error || !status || status === 'not_found', 'rastgele bağlantı bir seçki döndürdü');
  });
  test('askıya alınan kiracının verisi herkese kapanır', async () => {
    assert.ifError((await service.from('organizations').update({ status: 'suspended' }).eq('id', T.B.orgId)).error);
    const pub = await anon.from('properties').select('id').eq('id', T.B.publishedId);
    await service.from('organizations').update({ status: 'active' }).eq('id', T.B.orgId);
    assert.ok(denied(pub), 'askıdaki kiracının ilanı göründü');
  });
});

// -----------------------------------------------------------------------------
describe('Yetki tablosu (uygulama ↔ veritabanı)', { skip }, () => {
  test('src/platform/auth/permissions.ts ile role_permissions birebir aynıdır', async () => {
    const { data, error } = await service.from('role_permissions').select('role, permission');
    assert.ifError(error);
    for (const role of ROLES) {
      const db = data.filter((r) => r.role === role).map((r) => r.permission).sort();
      const app = [...ROLE_PERMISSIONS[role]].sort();
      assert.deepEqual(db, app, `${role} rolünün yetkileri farklı`);
    }
    const known = new Set(PERMISSIONS);
    for (const r of data) assert.ok(known.has(r.permission), `Uygulamada tanımsız yetki: ${r.permission}`);
  });
});

// -----------------------------------------------------------------------------
async function freshSession(user) {
  const client = createClient(url, anonKey, opts);
  const res = await client.auth.signInWithPassword({ email: user.email, password: PASSWORD });
  assert.ifError(res.error);
  return client;
}

/** Kullanıcıya TOTP faktörü kurar; istemci oturumu aal2 olur. */
async function enrollTotp(user) {
  const enroll = await user.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `rls-${RUN}` });
  assert.ifError(enroll.error);
  const { code, counter } = await freshTotp(enroll.data.totp.secret);
  const verify = await user.client.auth.mfa.challengeAndVerify({ factorId: enroll.data.id, code });
  assert.ifError(verify.error);
  user.factor = { factorId: enroll.data.id, secret: enroll.data.totp.secret, lastCounter: counter };
  return user.factor;
}

async function upgrade(client, factor) {
  const next = await freshTotp(factor.secret, factor.lastCounter);
  factor.lastCounter = next.counter;
  const res = await client.auth.mfa.challengeAndVerify({ factorId: factor.factorId, code: next.code });
  assert.ifError(res.error);
}

describe('İki adımlı doğrulama (MFA) veritabanında zorunlu', { skip }, () => {
  let adminFactor;
  let ownerFactor;

  test('MFA kuran kullanıcı, kod girilmemiş oturumla ofis verisine erişemez; kodla erişir', async () => {
    const admin = T.A.users.admin;
    adminFactor = await enrollTotp(admin);
    // Kurulumu yapan oturum aal2: erişim var
    assert.equal((await admin.client.from('leads').select('id').eq('id', T.A.leadId)).data?.length, 1);

    const aal1 = await freshSession(admin);
    assert.ok(denied(await aal1.from('leads').select('id').eq('id', T.A.leadId)), 'aal1 oturumu talebi okudu');
    assert.ok(denied(await aal1.from('properties').select('id').eq('id', T.A.draftId)), 'aal1 oturumu taslağı okudu');
    assert.ok((await aal1.rpc('org_dashboard', { p_org: T.A.orgId, p_days: 30 })).error, 'aal1 oturumu panoyu okudu');
    assert.ok(denied(await aal1.from('properties').update({ title: 'aal1 değişikliği' }).eq('id', T.A.draftId).select('id')), 'aal1 oturumu yazdı');
    const upload = await aal1.storage.from('media-originals').upload(`organizations/${T.A.orgId}/mfa-${RUN}.png`, PNG, { contentType: 'image/png' });
    assert.ok(upload.error, 'aal1 oturumu depolamaya yazdı');

    await upgrade(aal1, adminFactor);
    assert.equal((await aal1.from('leads').select('id').eq('id', T.A.leadId)).data?.length, 1, 'aal2 sonrası erişim yok');
  });

  test('zorunluluğu yalnızca MFA doğrulanmış sahip açabilir', async () => {
    const agentTry = await T.A.users.agent.client.rpc('set_require_admin_mfa', { p_org: T.A.orgId, p_value: true });
    assert.ok(agentTry.error, 'danışman zorunluluğu değiştirdi');
    const ownerNoMfa = await T.A.users.owner.client.rpc('set_require_admin_mfa', { p_org: T.A.orgId, p_value: true });
    assert.ok(ownerNoMfa.error, 'MFA kurmamış sahip zorunluluğu açtı (kilitlenme riski)');
    const otherOrg = await T.A.users.owner.client.rpc('set_require_admin_mfa', { p_org: T.B.orgId, p_value: true });
    assert.ok(otherOrg.error, "A'nın sahibi B'nin politikasını değiştirdi");

    ownerFactor = await enrollTotp(T.A.users.owner);
    const ok = await T.A.users.owner.client.rpc('set_require_admin_mfa', { p_org: T.A.orgId, p_value: true });
    assert.ifError(ok.error);
    const org = await service.from('organizations').select('require_admin_mfa').eq('id', T.A.orgId).single();
    assert.equal(org.data.require_admin_mfa, true);
  });

  test('zorunluluk açıkken sahip/yönetici aal1 ile erişemez; diğer roller etkilenmez', async () => {
    const ownerAal1 = await freshSession(T.A.users.owner);
    assert.ok(denied(await ownerAal1.from('customers').select('id').eq('id', T.A.customerId)), 'sahip aal1 ile müşteriyi okudu');
    const agent = await freshSession(T.A.users.agent);
    assert.equal((await agent.from('customers').select('id').eq('id', T.A.customerId)).data?.length, 1, 'danışman etkilendi');
    await upgrade(ownerAal1, ownerFactor);
    assert.equal((await ownerAal1.from('customers').select('id').eq('id', T.A.customerId)).data?.length, 1);
    // Temizlik: zorunluluk kapatılır (sonraki testleri etkilemesin)
    assert.ifError((await ownerAal1.rpc('set_require_admin_mfa', { p_org: T.A.orgId, p_value: false })).error);
  });

  test('ekip MFA durumu yalnızca kullanıcı yöneticilerine ve kendi ofisine açıktır', async () => {
    const status = await T.A.users.owner.client.rpc('org_member_mfa_status', { p_org: T.A.orgId });
    assert.ifError(status.error);
    assert.equal(status.data.find((r) => r.user_id === T.A.users.admin.id)?.mfa_enabled, true);
    assert.equal(status.data.find((r) => r.user_id === T.A.users.agent.id)?.mfa_enabled, false);
    assert.ok((await T.A.users.agent.client.rpc('org_member_mfa_status', { p_org: T.A.orgId })).error, 'danışman ekip MFA durumunu okudu');
    assert.ok((await T.A.users.owner.client.rpc('org_member_mfa_status', { p_org: T.B.orgId })).error, "A, B'nin ekip durumunu okudu");
    assert.ok((await anon.rpc('org_member_mfa_status', { p_org: T.A.orgId })).error, 'anonim okudu');
  });
});

// -----------------------------------------------------------------------------
describe('Bildirim ayarları ve kayıtları (kiracı izolasyonu)', { skip }, () => {
  before(async () => {
    if (missing) return;
    for (const key of ['A', 'B']) {
      assert.ifError((await service.from('organization_notification_settings').upsert({ organization_id: T[key].orgId, emails: [`ofis-${key.toLowerCase()}@example.test`] })).error);
      assert.ifError((await service.from('notification_deliveries').insert({ organization_id: T[key].orgId, channel: 'email', event: 'lead.created', lead_id: T[key].leadId, recipients: [`ofis-${key.toLowerCase()}@example.test`], status: 'sent', provider: 'test' })).error);
    }
  });

  test('anonim ziyaretçi bildirim adreslerini ve kayıtlarını göremez', async () => {
    assert.ok(denied(await anon.from('organization_notification_settings').select('emails')));
    assert.ok(denied(await anon.from('notification_deliveries').select('id')));
    // Herkese açık şirket ayarlarında bildirim adresi yoktur
    const pub = await anon.from('organization_settings').select('*').eq('organization_id', T.A.orgId).single();
    assert.ok(!JSON.stringify(pub.data ?? {}).includes('ofis-a@example.test'));
  });

  test("A'nın sahibi kendi ayarını görür, B'ninkini göremez ve değiştiremez", async () => {
    const a = await freshSession(T.A.users.owner);
    if (T.A.users.owner.factor) await upgrade(a, T.A.users.owner.factor);
    const own = await a.from('organization_notification_settings').select('emails').eq('organization_id', T.A.orgId);
    assert.deepEqual(own.data?.[0]?.emails, ['ofis-a@example.test']);
    assert.ok(denied(await a.from('organization_notification_settings').select('emails').eq('organization_id', T.B.orgId)), 'B adresleri görüldü');
    assert.ok(denied(await a.from('organization_notification_settings').update({ emails: ['saldirgan@example.test'] }).eq('organization_id', T.B.orgId).select('organization_id')), 'B adresleri değiştirildi');
    const ins = await a.from('organization_notification_settings').insert({ organization_id: T.B.orgId, emails: ['saldirgan@example.test'] }).select('organization_id');
    assert.ok(ins.error || denied(ins), 'B için ayar eklendi');
    assert.ok(denied(await a.from('notification_deliveries').select('id').eq('organization_id', T.B.orgId)), 'B bildirim kayıtları görüldü');
  });

  test('ayar yetkisi olmayan roller adresleri göremez; kimse bildirim kaydı ekleyemez', async () => {
    assert.ok(denied(await T.A.users.agent.client.from('organization_notification_settings').select('emails').eq('organization_id', T.A.orgId)), 'danışman adresleri gördü');
    const fake = await T.A.users.agent.client.from('notification_deliveries').insert({ organization_id: T.A.orgId, channel: 'email', event: 'test', status: 'sent', provider: 'x' }).select('id');
    assert.ok(fake.error || denied(fake), 'kullanıcı sahte bildirim kaydı ekledi');
  });
});

// -----------------------------------------------------------------------------
// Platform sahibi (KARAY, süper admin) ↔ kiracılar (emlak ofisleri)
// -----------------------------------------------------------------------------
describe('Platform sahibi ↔ kiracı ayrımı', { skip }, () => {
  let platformAdmin;
  before(async () => {
    if (missing) return;
    platformAdmin = await makeUser('platform');
    assert.ifError((await service.from('profiles').update({ is_super_admin: true }).eq('id', platformAdmin.id)).error);
  });

  test('herkese açık anahtarla kiracı listesi, ayarları ve alan adları toplu çekilemez', async () => {
    for (const table of ['organizations', 'organization_settings', 'organization_domains']) {
      const res = await anon.from(table).select('*');
      assert.ok(denied(res), `${table} anonim kullanıcıya liste döndürdü`);
    }
  });
  test('herkese açık site kiracısını yalnızca adresiyle (tekil) bulur; askıdaki kiracı bulunmaz', async () => {
    const found = await anon.rpc('public_tenant', { p_slug: T.A.slug });
    assert.ifError(found.error);
    assert.equal(found.data.length, 1);
    assert.equal(found.data[0].id, T.A.orgId);
    const settings = await anon.rpc('public_tenant_settings', { p_org: T.A.orgId });
    assert.ifError(settings.error);
    assert.equal(settings.data[0].display_name, 'RLS Test A');
    assert.equal(settings.data[0].updated_by, null, 'son değiştiren kullanıcı herkese açık dönmemeli');
    assert.ok(denied(await anon.rpc('public_tenant', { p_slug: 'olmayan-ofis-xyz' })));
    assert.ifError((await service.from('organizations').update({ status: 'suspended' }).eq('id', T.B.orgId)).error);
    const suspended = await anon.rpc('public_tenant', { p_slug: T.B.slug });
    const suspendedSettings = await anon.rpc('public_tenant_settings', { p_org: T.B.orgId });
    await service.from('organizations').update({ status: 'active' }).eq('id', T.B.orgId);
    assert.ok(denied(suspended), 'askıdaki kiracı çözümlendi');
    assert.ok(denied(suspendedSettings), 'askıdaki kiracının ayarları döndü');
  });
  test("kiracı kullanıcısı yalnızca kendi ofisini görür (B'yi, B'nin ayarlarını, aboneliğini göremez)", async () => {
    for (const role of ROLES) {
      const c = T.A.users[role].client;
      const orgs = await c.from('organizations').select('id');
      assert.ifError(orgs.error);
      assert.deepEqual(orgs.data.map((o) => o.id), [T.A.orgId], `${role}: başka kiracı göründü`);
      const settings = await c.from('organization_settings').select('organization_id');
      assert.deepEqual(settings.data.map((s) => s.organization_id), [T.A.orgId], `${role}: başka kiracının ayarı göründü`);
      assert.ok(denied(await c.from('subscriptions').select('id').eq('organization_id', T.B.orgId)));
    }
  });
  test("kiracı sahibi başka kiracının markasını değiştiremez; kendi markasını yalnızca taslak + yayınla değiştirir", async () => {
    const ow = T.A.users.owner.client;
    assert.ok(denied(await ow.from('organization_settings').update({ primary_color: '#123456' }).eq('organization_id', T.B.orgId).select('organization_id')));
    // P0.2: doğrudan yazım reddedilir (tek yayın noktası)
    const direct = await ow.from('organization_settings').update({ primary_color: '#654321' }).eq('organization_id', T.A.orgId).select('primary_color');
    assert.ok(direct.error, 'marka doğrudan değişti');
    assert.match(direct.error.message, /brand_requires_publish/);
    assert.ifError((await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'brand', p_value: { primary_color: '#654321' } })).error);
    assert.ifError((await ow.rpc('site_publish', { p_org: T.A.orgId, p_note: 'rls marka rengi' })).error);
    const own = await service.from('organization_settings').select('primary_color').eq('organization_id', T.A.orgId).single();
    assert.equal(own.data.primary_color, '#654321');
    const b = await service.from('organization_settings').select('primary_color').eq('organization_id', T.B.orgId).single();
    assert.notEqual(b.data.primary_color, '#123456');
  });
  test('kiracı sahibi platform planlarını, kiracı durumunu ve süper admin bayrağını değiştiremez', async () => {
    const ow = T.A.users.owner.client;
    assert.ok(denied(await ow.from('plans').update({ max_users: 999 }).eq('id', 'baslangic').select('id')));
    assert.ok(denied(await ow.from('organizations').update({ status: 'suspended' }).eq('id', T.B.orgId).select('id')));
    assert.ok((await ow.from('organizations').insert({ slug: `hack-${RUN}`, name: 'Hack', reference_prefix: 'HCK' })).error);
    assert.ok((await ow.rpc('platform_update_plan', { p_id: 'baslangic', p_name: 'Hack', p_max_users: 1, p_max_properties: 1, p_max_storage_mb: 1, p_crm: false, p_analytics: false, p_pdf: false, p_custom_domain: false, p_price: 0 })).error);
    assert.ok((await ow.rpc('platform_add_domain', { p_org: T.A.orgId, p_hostname: `hack-${RUN}.example.com`, p_primary: false })).error);
    assert.ok(denied(await ow.from('profiles').update({ is_super_admin: true }).eq('id', T.A.users.admin.id).select('id')));
    assert.ok((await ow.from('organization_members').insert({ organization_id: T.B.orgId, user_id: T.A.users.agent.id, role: 'owner', status: 'active' })).error);
    assert.ok(denied(await ow.from('audit_logs').select('id').is('organization_id', null)), 'platform kayıtları kiracıya göründü');
  });
  test('süper admin (platform) tüm kiracıları ve ayarlarını görür, kiracıyı yönetebilir', async () => {
    const pa = platformAdmin.client;
    const orgs = await pa.from('organizations').select('id').in('id', [T.A.orgId, T.B.orgId]);
    assert.ifError(orgs.error);
    assert.equal(orgs.data.length, 2);
    const settings = await pa.from('organization_settings').select('organization_id').in('organization_id', [T.A.orgId, T.B.orgId]);
    assert.equal(settings.data.length, 2);
    const list = await pa.rpc('platform_organizations');
    assert.ifError(list.error);
    assert.ok(list.data.some((o) => o.id === T.B.orgId));
    assert.ifError((await pa.rpc('platform_set_org_plan', { p_org: T.B.orgId, p_plan: 'profesyonel', p_status: 'active' })).error);
    const sub = await service.from('subscriptions').select('plan_id').eq('organization_id', T.B.orgId).eq('status', 'active').single();
    assert.equal(sub.data.plan_id, 'profesyonel');
  });
  test('süper admin üyesi olmadığı kiracının CRM verisini doğrudan okuyamaz (yalnızca platform işlemleri)', async () => {
    const pa = platformAdmin.client;
    assert.ok(denied(await pa.from('customers').select('id').eq('organization_id', T.B.orgId)));
    assert.ok(denied(await pa.from('leads').select('id').eq('organization_id', T.B.orgId)));
  });
});

describe('Web sitesi yapılandırması (site_configs) ve oturum bağlamı', { skip }, () => {
  let platformAdmin;
  before(async () => {
    if (missing) return;
    platformAdmin = await makeUser('siteadmin');
    assert.ifError((await service.from('profiles').update({ is_super_admin: true }).eq('id', platformAdmin.id)).error);
  });

  test('her yeni kiracı için site kaydı otomatik oluşur', async () => {
    const rows = await service.from('site_configs').select('organization_id, site_status, published_version').in('organization_id', [T.A.orgId, T.B.orgId]);
    assert.ifError(rows.error);
    assert.equal(rows.data.length, 2);
    for (const r of rows.data) assert.equal(r.site_status, 'active');
  });

  test('anonim ziyaretçi taslağı ve sürüm geçmişini okuyamaz; yalnızca yayındaki sürüm (public_site_config) açıktır', async () => {
    assert.ok(denied(await anon.from('site_configs').select('draft')));
    assert.ok(denied(await anon.from('site_config_revisions').select('config')));
    const pub = await anon.rpc('public_site_config', { p_org: T.A.orgId });
    assert.ifError(pub.error);
    assert.equal(pub.data.length, 1);
    assert.ok(!('draft' in pub.data[0]), 'taslak herkese açık çıktıda');
    // Askıdaki kiracının yapılandırması dönmez
    await service.from('organizations').update({ status: 'suspended' }).eq('id', T.B.orgId);
    const suspended = await anon.rpc('public_site_config', { p_org: T.B.orgId });
    await service.from('organizations').update({ status: 'active' }).eq('id', T.B.orgId);
    assert.deepEqual(suspended.data ?? [], []);
  });

  test('kiracı kullanıcıları başka kiracının site kaydını göremez; hiçbir rol doğrudan yazamaz', async () => {
    for (const role of ROLES) {
      const c = T.A.users[role].client;
      const rows = await c.from('site_configs').select('organization_id');
      assert.ifError(rows.error);
      assert.deepEqual(rows.data.map((r) => r.organization_id), [T.A.orgId], `${role}: başka kiracının site kaydı göründü`);
      assert.ok(denied(await c.from('site_configs').update({ site_status: 'maintenance' }).eq('organization_id', T.A.orgId).select('organization_id')), `${role}: doğrudan yazabildi`);
      // Sürüm geçmişi: yalnızca site ayarı yetkisi olan roller (sahip, yönetici) ve yalnızca kendi ofisi
      const rev = await c.from('site_config_revisions').select('organization_id');
      if (role === 'owner' || role === 'admin') assert.ok(!rev.error && rev.data.every((r) => r.organization_id === T.A.orgId), `${role}: başka kiracının sürümü göründü`);
      else assert.ok(denied(rev), `${role}: sürüm geçmişi göründü`);
    }
  });

  // P0.1: taslak/yayın/geri alma ofise (settings.manage) açıldı — yalnızca KENDİ sitesi için; ayrıntı
  // "P0.1: ofis site yönetimi" bölümünde. Durum, özellikler ve platform işlemleri KARAY'a aittir.
  test('kiracı sahibi KARAY işlemlerini (durum, özellik, platform) ve başka kiracının taslak/yayın işlemlerini çağıramaz', async () => {
    const ow = T.A.users.owner.client;
    for (const [fn, args] of [
      ['site_save_draft', { p_org: T.B.orgId, p_section: 'theme', p_value: 'atlas' }],
      ['site_publish', { p_org: T.B.orgId }],
      ['site_rollback', { p_org: T.B.orgId, p_version: 1 }],
      ['site_discard_draft', { p_org: T.B.orgId }],
      ['site_set_status', { p_org: T.A.orgId, p_status: 'maintenance' }],
      ['site_set_features', { p_org: T.A.orgId, p_overrides: { crm: true } }],
      ['platform_sites', {}],
    ]) {
      assert.ok((await ow.rpc(fn, args)).error, `${fn} kiracıya açık`);
    }
    const row = await service.from('site_configs').select('site_status, feature_overrides').eq('organization_id', T.A.orgId).single();
    assert.equal(row.data.site_status, 'active');
    assert.deepEqual(row.data.feature_overrides, {});
  });

  test('süper admin taslak kaydeder, yayınlar, geri alır; geçersiz bölüm reddedilir; işlemler denetime yazılır', async () => {
    const pa = platformAdmin.client;
    assert.ifError((await pa.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'theme', p_value: 'atlas' })).error);
    assert.ok((await pa.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'hack', p_value: {} })).error, 'geçersiz bölüm kabul edildi');
    const v1 = await pa.rpc('site_publish', { p_org: T.B.orgId, p_note: 'rls v1' });
    assert.ifError(v1.error);
    assert.ifError((await pa.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'theme', p_value: 'marble' })).error);
    const v2 = await pa.rpc('site_publish', { p_org: T.B.orgId });
    assert.ifError(v2.error);
    assert.ifError((await pa.rpc('site_rollback', { p_org: T.B.orgId, p_version: v1.data })).error);
    const row = await service.from('site_configs').select('published, published_version, has_unpublished_changes').eq('organization_id', T.B.orgId).single();
    assert.equal(row.data.published.theme, 'atlas');
    assert.equal(row.data.published_version, v2.data + 1);
    assert.equal(row.data.has_unpublished_changes, false);
    const logs = await service.from('audit_logs').select('action').eq('organization_id', T.B.orgId).like('action', 'site.%');
    const actions = new Set(logs.data.map((l) => l.action));
    for (const a of ['site.draft_saved', 'site.published', 'site.rolled_back']) assert.ok(actions.has(a), `${a} denetimde yok`);
  });

  test('marka taslağı: yalnızca beyaz listedeki alanlar; yayında ofis ayarlarına uygulanır, geri almada eski marka döner', async () => {
    const pa = platformAdmin.client;
    const before = (await service.from('organization_settings').select('display_name, primary_color').eq('organization_id', T.B.orgId).single()).data;
    // Beyaz liste dışı sütun (ör. updated_by, organization_id) reddedilir
    assert.ok((await pa.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'brand', p_value: { organization_id: T.A.orgId } })).error, 'beyaz liste dışı alan kabul edildi');
    assert.ok((await pa.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'brand', p_value: { seo_title: 'x' } })).error);
    // Yardımcı fonksiyonlar doğrudan çağrılamaz
    assert.ok((await pa.rpc('site_apply_brand', { p_org: T.B.orgId, p_brand: { display_name: 'Hack' } })).error);
    assert.ok((await T.A.users.owner.client.rpc('site_brand_snapshot', { p_org: T.B.orgId })).error);
    // Taslak: canlı değişmez
    assert.ifError((await pa.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'brand', p_value: { display_name: 'RLS Yeni Ad', primary_color: '#23466e' } })).error);
    const mid = (await service.from('organization_settings').select('display_name').eq('organization_id', T.B.orgId).single()).data;
    assert.equal(mid.display_name, before.display_name);
    // A ofisi B'nin taslağını okuyamaz
    assert.ok(denied(await T.A.users.owner.client.from('site_configs').select('draft').eq('organization_id', T.B.orgId)));
    const v = await pa.rpc('site_publish', { p_org: T.B.orgId, p_note: 'rls marka' });
    assert.ifError(v.error);
    const after = (await service.from('organization_settings').select('display_name, primary_color').eq('organization_id', T.B.orgId).single()).data;
    assert.equal(after.display_name, 'RLS Yeni Ad');
    assert.equal(after.primary_color, '#23466e');
    const rev = (await service.from('site_config_revisions').select('config').eq('organization_id', T.B.orgId).eq('version', v.data).single()).data;
    assert.equal(rev.config.brand.display_name, 'RLS Yeni Ad');
    const cfg = (await service.from('site_configs').select('draft, published').eq('organization_id', T.B.orgId).single()).data;
    assert.ok(!('brand' in cfg.draft) && !('brand' in cfg.published), 'yayından sonra bekleyen marka kalmamalı');
    // Önceki sürüme dönüş (marka anlık görüntüsü olan) eski adı geri getirir
    assert.ifError((await pa.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'brand', p_value: { display_name: 'RLS İkinci Ad' } })).error);
    assert.ifError((await pa.rpc('site_publish', { p_org: T.B.orgId })).error);
    assert.ifError((await pa.rpc('site_rollback', { p_org: T.B.orgId, p_version: v.data })).error);
    const back = (await service.from('organization_settings').select('display_name').eq('organization_id', T.B.orgId).single()).data;
    assert.equal(back.display_name, 'RLS Yeni Ad');
    // Kiracı B'nin marka ayarı A tarafından değiştirilemez
    assert.ok(denied(await T.A.users.owner.client.from('organization_settings').update({ display_name: 'Hack' }).eq('organization_id', T.B.orgId).select('organization_id')));
  });

  test('özellik geçersiz kılması plan kontrolüne (org_plan) yansır', async () => {
    const pa = platformAdmin.client;
    assert.ifError((await pa.rpc('site_set_features', { p_org: T.B.orgId, p_overrides: { crm: false } })).error);
    const plan = await service.rpc('org_plan', { p_org: T.B.orgId });
    assert.equal(plan.data[0].crm_enabled, false);
    assert.ifError((await pa.rpc('site_set_features', { p_org: T.B.orgId, p_overrides: {} })).error);
    const back = await service.rpc('org_plan', { p_org: T.B.orgId });
    assert.equal(back.data[0].crm_enabled, true);
  });

  test('session_context yalnızca oturum sahibinin verisini döner; anonim çağıramaz', async () => {
    const c = T.A.users.agent.client;
    const ctx = await c.rpc('session_context', { p_preferred_org: T.B.orgId, p_host_key: null });
    assert.ifError(ctx.error);
    assert.equal(ctx.data.org?.id, T.A.orgId, 'başka kiracı seçilebildi');
    assert.deepEqual(ctx.data.memberships.map((m) => m.org_id), [T.A.orgId], 'başka kiracının üyeliği döndü');
    const a = await anon.rpc('session_context', { p_preferred_org: T.A.orgId, p_host_key: null });
    assert.ok(a.error || a.data === null || a.data?.profile == null, 'anonim oturum bağlamı aldı');
  });
});

describe('KARAY şirket bilgileri ve KARAY talepleri (platform_settings, platform_leads)', { skip }, () => {
  let platformAdmin;
  const leadArgs = (over = {}) => ({
    p_kind: 'demo',
    p_full_name: `RLS KARAY Aday ${RUN}`,
    p_email: `rls-karay-${RUN}@example.test`,
    p_phone: '',
    p_company: 'RLS Emlak',
    p_city: '',
    p_message: '',
    p_kvkk_consent: true,
    p_ip_hash: `rls-${RUN}`,
    p_user_agent: 'node-test',
    ...over,
  });
  before(async () => {
    if (missing) return;
    platformAdmin = await makeUser('karay');
    assert.ifError((await service.from('profiles').update({ is_super_admin: true }).eq('id', platformAdmin.id)).error);
  });
  after(async () => {
    if (missing) return;
    await service.from('platform_leads').delete().like('ip_hash', `rls-${RUN}%`);
  });

  test('anonim ziyaretçi KARAY taleplerini ve ayar tablosunu okuyamaz; herkese açık profil bildirim adreslerini içermez', async () => {
    assert.ok(denied(await anon.from('platform_leads').select('id')));
    assert.ok(denied(await anon.from('platform_settings').select('*')));
    const profile = await anon.rpc('public_platform_profile');
    assert.ifError(profile.error);
    const row = Array.isArray(profile.data) ? profile.data[0] : profile.data;
    assert.ok(row && row.company_name, 'KARAY profili dönmedi');
    assert.equal('lead_notify_emails' in row, false, 'bildirim adresleri herkese açık');
    assert.equal('updated_by' in row, false);
  });

  test('talep yalnızca sunucu üzerinden eklenir: herkese açık anahtar ve kiracı kullanıcısı doğrudan ekleyemez', async () => {
    assert.ok((await anon.rpc('submit_platform_lead', leadArgs())).error, 'anonim RPC ile talep eklendi');
    assert.ok((await T.A.users.owner.client.rpc('submit_platform_lead', leadArgs())).error, 'kiracı sahibi RPC ile talep ekledi');
    assert.ok((await anon.from('platform_leads').insert({ kind: 'info', full_name: 'x', email: 'x@example.test', kvkk_consent: true })).error);
    assert.ok((await T.A.users.owner.client.from('platform_leads').insert({ kind: 'info', full_name: 'x', email: 'x@example.test', kvkk_consent: true })).error);
  });

  test('sunucu ekleme kuralları: onay, iletişim bilgisi ve IP özeti zorunlu; IP başına hız sınırı uygulanır', async () => {
    assert.match((await service.rpc('submit_platform_lead', leadArgs({ p_kvkk_consent: false }))).error?.message ?? '', /consent_required/);
    assert.match((await service.rpc('submit_platform_lead', leadArgs({ p_email: '', p_phone: '' }))).error?.message ?? '', /contact_required/);
    assert.match((await service.rpc('submit_platform_lead', leadArgs({ p_ip_hash: '' }))).error?.message ?? '', /ip_required/);
    const ip = `rls-${RUN}-limit`;
    for (let i = 0; i < 3; i++) assert.ifError((await service.rpc('submit_platform_lead', leadArgs({ p_ip_hash: ip }))).error);
    assert.match((await service.rpc('submit_platform_lead', leadArgs({ p_ip_hash: ip }))).error?.message ?? '', /rate_limited/);
    const rows = await service.from('platform_leads').select('kind, status, kvkk_consent').eq('ip_hash', ip);
    assert.equal(rows.data.length, 3);
    assert.ok(rows.data.every((r) => r.kind === 'demo' && r.status === 'new' && r.kvkk_consent === true));
  });

  test('KARAY talebi hiçbir kiracının CRM kaydına düşmez', async () => {
    const id = (await service.rpc('submit_platform_lead', leadArgs({ p_ip_hash: `rls-${RUN}-crm`, p_full_name: `RLS CRM Ayrım ${RUN}` }))).data;
    assert.ok(id);
    assert.equal((await service.from('customers').select('id').eq('full_name', `RLS CRM Ayrım ${RUN}`)).data.length, 0);
    assert.equal((await service.from('leads').select('id').eq('id', id)).data.length, 0);
  });

  test('kiracı sahibi KARAY taleplerini ve ayarlarını göremez, değiştiremez; durum işlevini çağıramaz', async () => {
    const id = (await service.rpc('submit_platform_lead', leadArgs({ p_ip_hash: `rls-${RUN}-own` }))).data;
    const owner = T.A.users.owner.client;
    assert.ok(denied(await owner.from('platform_leads').select('id').eq('id', id)));
    assert.ok(denied(await owner.from('platform_settings').select('*')));
    const upd = await owner.from('platform_settings').update({ company_name: 'Ele geçirildi' }).eq('id', true).select('id');
    assert.ok(denied(upd));
    assert.ok((await owner.rpc('platform_update_lead', { p_id: id, p_status: 'closed', p_note: 'x' })).error);
    const leadUpd = await owner.from('platform_leads').update({ status: 'closed' }).eq('id', id).select('id');
    assert.ok(denied(leadUpd));
    assert.equal((await service.from('platform_leads').select('status').eq('id', id).single()).data.status, 'new');
    assert.notEqual((await service.from('platform_settings').select('company_name').eq('id', true).single()).data.company_name, 'Ele geçirildi');
  });

  test('süper admin talepleri görür ve durumunu günceller; işlem denetim kaydına yazılır; geçersiz durum reddedilir', async () => {
    const id = (await service.rpc('submit_platform_lead', leadArgs({ p_ip_hash: `rls-${RUN}-pa` }))).data;
    const pa = platformAdmin.client;
    const seen = await pa.from('platform_leads').select('id').eq('id', id);
    assert.ifError(seen.error);
    assert.equal(seen.data.length, 1);
    assert.ifError((await pa.rpc('platform_update_lead', { p_id: id, p_status: 'qualified', p_note: 'RLS notu' })).error);
    const row = (await service.from('platform_leads').select('status, note, handled_by').eq('id', id).single()).data;
    assert.deepEqual({ status: row.status, note: row.note, handled_by: row.handled_by }, { status: 'qualified', note: 'RLS notu', handled_by: platformAdmin.id });
    assert.ok((await pa.rpc('platform_update_lead', { p_id: id, p_status: 'hacked', p_note: '' })).error);
    const audit = await service.from('audit_logs').select('action, organization_id').eq('action', 'platform.lead_updated').eq('actor_id', platformAdmin.id);
    assert.ok(audit.data.length >= 1, 'denetim kaydı yok');
    assert.ok(audit.data.every((a) => a.organization_id === null), 'KARAY işlemi bir kiracıya yazıldı');
  });
});

describe('PERMISSION: tasarım ailesi yetkileri (design_family_settings, organization_design_families, site_apply_design)', { skip }, () => {
  let platformAdmin;
  const sections = (family, theme = 'rezidans') => ({
    theme,
    colors: { mode: 'preset', preset: 'premium-gold', scheme: 'light' },
    typography: {},
    style: { hero: 'cinematic', origin: { siteType: 'real-estate-office', family, homepage: 'family' } },
    home: { sections: [{ id: 'hero', type: 'hero', enabled: true }, { id: 'contact', type: 'contact', enabled: true }] },
  });
  before(async () => {
    if (missing) return;
    platformAdmin = await makeUser('designadmin');
    assert.ifError((await service.from('profiles').update({ is_super_admin: true }).eq('id', platformAdmin.id)).error);
  });
  after(async () => {
    if (missing) return;
    await service.from('design_family_settings').delete().in('family_id', ['sinematik-vitrin', 'editoryal-luks']);
  });

  test('anonim ziyaretçi ve kiracı kullanıcıları izin kayıtlarını yazamaz; platform işlemlerini çağıramaz', async () => {
    assert.ok(denied(await anon.from('design_family_settings').select('family_id')));
    assert.ok(denied(await anon.from('organization_design_families').select('family_id')));
    assert.ok((await anon.rpc('org_design_family_access', { p_org: T.A.orgId })).error || denied(await anon.rpc('org_design_family_access', { p_org: T.A.orgId })));
    for (const role of ROLES) {
      const c = T.A.users[role].client;
      assert.ok(denied(await c.from('organization_design_families').insert({ organization_id: T.A.orgId, family_id: 'sinematik-vitrin' }).select('family_id')), `${role}: doğrudan izin ekledi`);
      assert.ok(denied(await c.from('design_family_settings').insert({ family_id: 'sinematik-vitrin', enabled: false }).select('family_id')), `${role}: global ayarı yazdı`);
      assert.ok((await c.rpc('platform_set_org_design_families', { p_org: T.A.orgId, p_families: ['sinematik-vitrin'] })).error, `${role}: kendine aile izni verdi`);
      assert.ok((await c.rpc('platform_set_design_family', { p_family: 'sinematik-vitrin', p_enabled: false })).error, `${role}: aileyi global kapattı`);
    }
  });

  test('KARAY admini tüm aileleri yönetir: kiracıya izin verir, global kapatır; denetime yazılır', async () => {
    const pa = platformAdmin.client;
    assert.ifError((await pa.rpc('platform_set_org_design_families', { p_org: T.A.orgId, p_families: ['sinematik-vitrin', 'editoryal-luks'] })).error);
    assert.ifError((await pa.rpc('platform_set_org_design_families', { p_org: T.B.orgId, p_families: ['kurumsal-portfoy'] })).error);
    assert.ok((await pa.rpc('platform_set_org_design_families', { p_org: T.A.orgId, p_families: ['<script>'] })).error, 'geçersiz kimlik kabul edildi');
    const a = await pa.rpc('org_design_family_access', { p_org: T.A.orgId });
    assert.deepEqual(a.data.map((r) => r.family_id), ['editoryal-luks', 'sinematik-vitrin']);
    const logs = await service.from('audit_logs').select('action').eq('organization_id', T.A.orgId).eq('action', 'site.design_families_changed');
    assert.ok(logs.data.length >= 1);
  });

  test('kiracı yalnızca KENDİ izinli ailelerini görür; global kapatılan aile listeden düşer', async () => {
    const ow = T.A.users.owner.client;
    assert.deepEqual((await ow.rpc('org_design_family_access', { p_org: T.A.orgId })).data.map((r) => r.family_id), ['editoryal-luks', 'sinematik-vitrin']);
    assert.deepEqual((await ow.rpc('org_design_family_access', { p_org: T.B.orgId })).data ?? [], [], 'başka kiracının izinleri göründü');
    const rows = await ow.from('organization_design_families').select('organization_id');
    assert.ok(rows.data.every((r) => r.organization_id === T.A.orgId), 'başka kiracının izin satırı göründü');
    assert.ifError((await platformAdmin.client.rpc('platform_set_design_family', { p_family: 'editoryal-luks', p_enabled: false })).error);
    assert.deepEqual((await ow.rpc('org_design_family_access', { p_org: T.A.orgId })).data.map((r) => r.family_id), ['sinematik-vitrin']);
  });

  test('ofis yöneticisi izinli aileyle kendi sitesini değiştirir; izinsiz/kapalı aile, yetkisiz rol, başka kiracı ve sahte içerik reddedilir', async () => {
    // Bekleyen KARAY taslağı (SEO) ofis işlemiyle yayınlanmamalı
    assert.ifError((await platformAdmin.client.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'seo', p_value: { title: 'Bekleyen KARAY taslağı', robots: 'index', schemaType: 'RealEstateAgent' } })).error);
    const before = (await service.from('site_configs').select('published_version, published').eq('organization_id', T.A.orgId).single()).data;
    for (const role of ['agent', 'editor', 'viewer']) {
      assert.ok((await T.A.users[role].client.rpc('site_apply_design', { p_org: T.A.orgId, p_family: 'sinematik-vitrin', p_sections: sections('sinematik-vitrin') })).error, `${role}: tasarım değiştirdi`);
    }
    const ow = T.A.users.owner.client;
    assert.ok((await ow.rpc('site_apply_design', { p_org: T.A.orgId, p_family: 'kurumsal-portfoy', p_sections: sections('kurumsal-portfoy') })).error, 'izinsiz aile');
    assert.ok((await ow.rpc('site_apply_design', { p_org: T.A.orgId, p_family: 'editoryal-luks', p_sections: sections('editoryal-luks') })).error, 'global kapalı aile');
    assert.ok((await ow.rpc('site_apply_design', { p_org: T.A.orgId, p_family: 'sinematik-vitrin', p_sections: sections('kurumsal-portfoy') })).error, 'kaynak ailesi uyuşmuyor');
    assert.ok((await ow.rpc('site_apply_design', { p_org: T.A.orgId, p_family: 'sinematik-vitrin', p_sections: { ...sections('sinematik-vitrin'), brand: { display_name: 'Ele geçirildi' } } })).error, 'marka bölümü yazıldı');
    assert.ok((await ow.rpc('site_apply_design', { p_org: T.A.orgId, p_family: 'sinematik-vitrin', p_sections: { theme: 'atlas' } })).error, 'eksik bölümler kabul edildi');
    assert.ok((await ow.rpc('site_apply_design', { p_org: T.B.orgId, p_family: 'kurumsal-portfoy', p_sections: sections('kurumsal-portfoy') })).error, 'başka kiracının sitesi');
    assert.equal((await service.from('site_configs').select('published_version').eq('organization_id', T.A.orgId).single()).data.published_version, before.published_version, 'reddedilen işlem sürüm üretti');

    const ok = await T.A.users.admin.client.rpc('site_apply_design', { p_org: T.A.orgId, p_family: 'sinematik-vitrin', p_sections: sections('sinematik-vitrin') });
    assert.ifError(ok.error);
    const row = (await service.from('site_configs').select('published, draft, published_version, has_unpublished_changes').eq('organization_id', T.A.orgId).single()).data;
    assert.equal(row.published_version, before.published_version + 1);
    assert.equal(row.published.theme, 'rezidans');
    assert.equal(row.published.style.origin.family, 'sinematik-vitrin');
    assert.equal(row.published.seo?.title ?? null, before.published.seo?.title ?? null, 'bekleyen KARAY taslağı yayınlandı');
    assert.equal(row.draft.seo.title, 'Bekleyen KARAY taslağı', 'taslağın diğer bölümleri kayboldu');
    assert.equal(row.has_unpublished_changes, true);
    const rev = await service.from('site_config_revisions').select('version, note').eq('organization_id', T.A.orgId).eq('version', row.published_version).single();
    assert.match(rev.data.note, /sinematik-vitrin/);
    const audit = await service.from('audit_logs').select('action, actor_id').eq('organization_id', T.A.orgId).eq('action', 'site.design_applied');
    assert.ok(audit.data.some((a) => a.actor_id === T.A.users.admin.id));
    // B kiracısının yayını etkilenmedi
    const b = (await service.from('site_configs').select('published').eq('organization_id', T.B.orgId).single()).data;
    assert.notEqual(b.published?.style?.origin?.family, 'sinematik-vitrin');
  });
});

describe('P0.1: ofis site yönetimi (taslak → yayın → geri alma, kendi sitesi)', { skip }, () => {
  let platformAdmin;
  const site = async (org) => (await service.from('site_configs').select('draft, published, published_version, has_unpublished_changes').eq('organization_id', org).single()).data;
  const style = (family) => ({ hero: 'cinematic', origin: { siteType: 'real-estate-office', family, homepage: 'family' } });
  before(async () => {
    if (missing) return;
    platformAdmin = await makeUser('officesiteadmin');
    assert.ifError((await service.from('profiles').update({ is_super_admin: true }).eq('id', platformAdmin.id)).error);
    assert.ifError((await platformAdmin.client.rpc('platform_set_org_design_families', { p_org: T.A.orgId, p_families: ['sinematik-vitrin', 'editoryal-luks'] })).error);
  });

  test('settings.manage (sahip/yönetici) kendi sitesinin taslağını kaydeder; canlı site yayına kadar değişmez; yayınlar ve geri alır', async () => {
    const ow = T.A.users.owner.client;
    // Önce bekleyen başka değişiklik kalmasın
    assert.ifError((await ow.rpc('site_discard_draft', { p_org: T.A.orgId })).error);
    const before = await site(T.A.orgId);
    const nav = [{ id: 'p01', label: 'P01 Menü', href: '/ilanlar', visible: true, children: [] }];
    assert.ifError((await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'navigation', p_value: nav })).error);
    let row = await site(T.A.orgId);
    assert.deepEqual(row.draft.navigation, nav);
    assert.deepEqual(row.published, before.published, 'taslak kaydı canlıyı değiştirdi');
    assert.equal(row.has_unpublished_changes, true);
    // Herkese açık yapılandırma hâlâ eski (yalnızca yayınlanan)
    const pub = await anon.rpc('public_site_config', { p_org: T.A.orgId });
    assert.notDeepEqual(pub.data[0].published?.navigation ?? null, nav, 'taslak herkese açık yapılandırmaya sızdı');
    const v = await T.A.users.admin.client.rpc('site_publish', { p_org: T.A.orgId, p_note: 'ofis yayını' });
    assert.ifError(v.error);
    row = await site(T.A.orgId);
    assert.equal(row.published_version, before.published_version + 1);
    assert.deepEqual(row.published.navigation, nav);
    // Sürüm geçmişi okunur ve geri alınır
    const revs = await ow.from('site_config_revisions').select('version').eq('organization_id', T.A.orgId);
    assert.ok(revs.data.some((r) => r.version === v.data));
    if (before.published_version > 0) {
      assert.ifError((await ow.rpc('site_rollback', { p_org: T.A.orgId, p_version: before.published_version })).error);
      row = await site(T.A.orgId);
      assert.deepEqual(row.published.navigation ?? null, before.published.navigation ?? null, 'geri alma eski menüyü getirmedi');
    }
    const logs = await service.from('audit_logs').select('action, actor_id').eq('organization_id', T.A.orgId).in('action', ['site.draft_saved', 'site.published']);
    assert.ok(logs.data.some((l) => l.action === 'site.published' && l.actor_id === T.A.users.admin.id), 'ofis yayını denetime yazılmadı');
  });

  test('site ayarı yetkisi olmayan roller (danışman, editör, izleyici) taslak/yayın/geri alma yapamaz', async () => {
    const before = await site(T.A.orgId);
    for (const role of ['agent', 'editor', 'viewer']) {
      const c = T.A.users[role].client;
      assert.ok((await c.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'theme', p_value: 'atlas' })).error, `${role}: taslak yazdı`);
      assert.ok((await c.rpc('site_publish', { p_org: T.A.orgId })).error, `${role}: yayınladı`);
      assert.ok((await c.rpc('site_rollback', { p_org: T.A.orgId, p_version: 1 })).error, `${role}: geri aldı`);
      assert.ok((await c.rpc('site_discard_draft', { p_org: T.A.orgId })).error, `${role}: taslağı sildi`);
    }
    const after = await site(T.A.orgId);
    assert.deepEqual(after, before);
  });

  test('başka kiracının sitesi: kimlik değiştirilerek (organization_id manipülasyonu) okunamaz ve yazılamaz', async () => {
    const before = await site(T.B.orgId);
    for (const role of ['owner', 'admin']) {
      const c = T.A.users[role].client;
      assert.ok((await c.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'theme', p_value: 'atlas' })).error, `${role}: B'ye taslak yazdı`);
      assert.ok((await c.rpc('site_publish', { p_org: T.B.orgId })).error, `${role}: B'yi yayınladı`);
      assert.ok((await c.rpc('site_rollback', { p_org: T.B.orgId, p_version: 1 })).error, `${role}: B'yi geri aldı`);
      assert.ok((await c.rpc('site_discard_draft', { p_org: T.B.orgId })).error, `${role}: B'nin taslağını sildi`);
      assert.ok(denied(await c.from('site_configs').select('draft').eq('organization_id', T.B.orgId)), `${role}: B'nin taslağını okudu`);
      assert.ok(denied(await c.from('site_config_revisions').select('version').eq('organization_id', T.B.orgId)), `${role}: B'nin sürümlerini okudu`);
    }
    // Üyeliği olmayan kullanıcı hiçbir siteyi düzenleyemez
    assert.ok((await outsider.client.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'theme', p_value: 'atlas' })).error, 'üye olmayan taslak yazdı');
    assert.ok((await anon.rpc('site_publish', { p_org: T.A.orgId })).error, 'anonim yayınladı');
    assert.deepEqual(await site(T.B.orgId), before);
  });

  test('tasarım ailesi: ofis yalnızca izinli aileyi taslağa yazabilir; mevcut (KARAY atadığı) aile korunarak düzenlenebilir; KARAY her aileyi yazar', async () => {
    const ow = T.A.users.owner.client;
    assert.ifError((await ow.rpc('site_discard_draft', { p_org: T.A.orgId })).error);
    const r1 = await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'style', p_value: style('kurumsal-portfoy') });
    assert.ok(r1.error, 'izinsiz aile taslağa yazıldı');
    assert.equal(r1.error.message, 'family_not_allowed');
    assert.ifError((await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'style', p_value: style('sinematik-vitrin') })).error);
    // Ailesiz görünüm ayarı serbesttir
    assert.ifError((await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'style', p_value: { hero: 'split' } })).error);
    // KARAY izinsiz bir aileyi atayabilir; ofis o aileyi koruyarak varyant değiştirebilir
    assert.ifError((await platformAdmin.client.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'style', p_value: style('kurumsal-portfoy') })).error);
    assert.ifError((await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'style', p_value: { ...style('kurumsal-portfoy'), hero: 'split' } })).error);
    // İzinli ama global kapatılan aile de reddedilir (sitenin mevcut ailesi değilse)
    assert.ifError((await ow.rpc('site_discard_draft', { p_org: T.A.orgId })).error);
    const row = await site(T.A.orgId);
    assert.notEqual(row.published?.style?.origin?.family, 'editoryal-luks');
    assert.ifError((await platformAdmin.client.rpc('platform_set_design_family', { p_family: 'editoryal-luks', p_enabled: false })).error);
    try {
      const r2 = await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'style', p_value: style('editoryal-luks') });
      assert.ok(r2.error, 'global kapalı aile taslağa yazıldı');
    } finally {
      await service.from('design_family_settings').delete().eq('family_id', 'editoryal-luks');
    }
    // Açılınca yazılabilir
    assert.ifError((await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'style', p_value: style('editoryal-luks') })).error);
    assert.ifError((await ow.rpc('site_discard_draft', { p_org: T.A.orgId })).error);
  });

  test('ofis KARAY platform işlemlerini çağıramaz: durum, özellikler, aile izinleri, global katalog, plan, süper admin', async () => {
    for (const role of ['owner', 'admin']) {
      const c = T.A.users[role].client;
      assert.ok((await c.rpc('site_set_status', { p_org: T.A.orgId, p_status: 'maintenance' })).error, `${role}: durum değiştirdi`);
      assert.ok((await c.rpc('site_set_features', { p_org: T.A.orgId, p_overrides: { crm: true } })).error, `${role}: özellik açtı`);
      assert.ok((await c.rpc('platform_set_org_design_families', { p_org: T.A.orgId, p_families: ['kurumsal-portfoy'] })).error, `${role}: kendine aile izni verdi`);
      assert.ok((await c.rpc('platform_set_design_family', { p_family: 'kurumsal-portfoy', p_enabled: false })).error, `${role}: global kataloğu değiştirdi`);
      assert.ok(denied(await c.from('profiles').update({ is_super_admin: true }).eq('id', T.A.users[role].id).select('id')) || (await service.from('profiles').select('is_super_admin').eq('id', T.A.users[role].id).single()).data.is_super_admin === false, `${role}: süper admin oldu`);
    }
    const row = await service.from('site_configs').select('site_status, feature_overrides').eq('organization_id', T.A.orgId).single();
    assert.equal(row.data.site_status, 'active');
  });
});

describe('P0.2: marka ve site içeriği taslağı (tek yayın noktası, görsel, saatler, eşzamanlılık)', { skip }, () => {
  const site = async (org) => (await service.from('site_configs').select('draft, published, published_version, draft_updated_at').eq('organization_id', org).single()).data;
  const settings = async (org) => (await service.from('organization_settings').select('*').eq('organization_id', org).single()).data;
  const HOURS = [{ days: ['mon', 'tue'], opens: '09:00', closes: '18:00' }];

  test('marka + iletişim + saatler + konum + ana sayfa metni taslağa yazılır; canlı ayar ve yayın değişmez', async () => {
    const ow = T.A.users.owner.client;
    assert.ifError((await ow.rpc('site_discard_draft', { p_org: T.A.orgId })).error);
    const before = await settings(T.A.orgId);
    const sBefore = await site(T.A.orgId);
    const draft = {
      display_name: 'P02 Taslak Ofis',
      phone: '+90 312 000 00 02',
      logo_url: `organizations/${T.A.orgId}/branding/logo-p02-taslak-200x80.png`,
      opening_hours: HOURS,
      office_latitude: 39.92,
      office_longitude: 32.85,
      postal_code: '06100',
      hero_title: 'P02 başlık',
    };
    const token = await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'brand', p_value: draft });
    assert.ifError(token.error);
    assert.ok(typeof token.data === 'string' && token.data.length > 10, 'yeni eşzamanlılık belirteci dönmedi');
    const after = await settings(T.A.orgId);
    for (const k of Object.keys(draft)) assert.deepEqual(after[k], before[k], `${k} canlıya yazıldı`);
    const s1 = await site(T.A.orgId);
    assert.deepEqual(s1.published, sBefore.published, 'yayın değişti');
    assert.equal(s1.published_version, sBefore.published_version);
    assert.equal(s1.draft.brand.display_name, 'P02 Taslak Ofis');
  });

  test('yayın tipli alanları (sayı, JSON, metin) canlıya uygular; geri alma eskisini getirir', async () => {
    const ow = T.A.users.owner.client;
    const before = (await site(T.A.orgId)).published_version;
    const old = await settings(T.A.orgId);
    const v = await ow.rpc('site_publish', { p_org: T.A.orgId, p_note: 'P0.2 marka' });
    assert.ifError(v.error);
    const live = await settings(T.A.orgId);
    assert.equal(live.display_name, 'P02 Taslak Ofis');
    assert.equal(live.phone, '+90 312 000 00 02');
    assert.equal(live.logo_url, `organizations/${T.A.orgId}/branding/logo-p02-taslak-200x80.png`);
    assert.deepEqual(live.opening_hours, HOURS);
    assert.equal(Number(live.office_latitude), 39.92);
    assert.equal(live.postal_code, '06100');
    assert.equal(live.hero_title, 'P02 başlık');
    if (before > 0) {
      assert.ifError((await ow.rpc('site_rollback', { p_org: T.A.orgId, p_version: before })).error);
      const back = await settings(T.A.orgId);
      assert.equal(back.display_name, old.display_name);
      assert.equal(back.logo_url, old.logo_url);
      assert.deepEqual(back.opening_hours, old.opening_hours);
      assert.equal(back.hero_title, old.hero_title);
    }
  });

  test('tek yayın noktası: hiçbir ofis rolü marka/iletişim/saat/görsel sütununu doğrudan değiştiremez; SEO ve ilan ayarı serbest', async () => {
    for (const role of ROLES) {
      const c = T.A.users[role].client;
      for (const patch of [{ display_name: 'Doğrudan' }, { phone: '000' }, { logo_url: 'x.png' }, { opening_hours: [{ days: ['sun'], opens: '07:00', closes: '08:00' }] }, { hero_title: 'x' }, { office_latitude: 1 }]) {
        const r = await c.from('organization_settings').update(patch).eq('organization_id', T.A.orgId).select('organization_id');
        assert.ok(r.error || denied(r), `${role}: ${Object.keys(patch)[0]} doğrudan yazıldı`);
      }
    }
    const seo = await T.A.users.owner.client.from('organization_settings').update({ seo_title: 'P02 SEO' }).eq('organization_id', T.A.orgId).select('organization_id');
    assert.ifError(seo.error);
    assert.equal(seo.data.length, 1);
    // Yardımcı (bayraklı) uygulama fonksiyonu doğrudan çağrılamaz
    assert.ok((await T.A.users.owner.client.rpc('site_apply_brand', { p_org: T.A.orgId, p_brand: { display_name: 'Hack' } })).error);
  });

  test('başka kiracı: A, B\'nin markasını/iletişimini/logosunu ne taslakta ne canlıda değiştiremez', async () => {
    const before = await settings(T.B.orgId);
    const sBefore = await site(T.B.orgId);
    for (const role of ['owner', 'admin']) {
      const c = T.A.users[role].client;
      assert.ok((await c.rpc('site_save_draft', { p_org: T.B.orgId, p_section: 'brand', p_value: { display_name: 'Ele geçirildi', logo_url: 'x.png' } })).error);
      assert.ok(denied(await c.from('organization_settings').update({ phone: '1' }).eq('organization_id', T.B.orgId).select('organization_id')));
      assert.ok((await c.rpc('site_publish', { p_org: T.B.orgId })).error);
    }
    assert.deepEqual(await settings(T.B.orgId), before);
    assert.deepEqual((await site(T.B.orgId)).draft, sBefore.draft);
  });

  test('eşzamanlılık: eski belirteçle kayıt reddedilir (stale_draft); güncel belirteçle kabul edilir', async () => {
    const ow = T.A.users.owner.client;
    const t0 = (await site(T.A.orgId)).draft_updated_at;
    // Başka kullanıcı (yönetici) bu arada taslağı değiştirir
    const t1 = await T.A.users.admin.client.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'brand', p_value: { tagline: 'Yönetici değişikliği' } });
    assert.ifError(t1.error);
    const stale = await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'brand', p_value: { tagline: 'Sahibin eski formu' }, p_expected_updated_at: t0 });
    assert.ok(stale.error, 'eski taslak üzerine yazıldı');
    assert.match(stale.error.message, /stale_draft/);
    assert.equal((await site(T.A.orgId)).draft.brand.tagline, 'Yönetici değişikliği');
    const fresh = await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'brand', p_value: { tagline: 'Güncel' }, p_expected_updated_at: t1.data });
    assert.ifError(fresh.error);
    // Art arda kayıt: dönen belirteç bir sonrakinde geçerlidir
    assert.ifError((await ow.rpc('site_save_draft', { p_org: T.A.orgId, p_section: 'theme', p_value: 'atlas', p_expected_updated_at: fresh.data })).error);
    assert.ifError((await ow.rpc('site_discard_draft', { p_org: T.A.orgId })).error);
  });
});
