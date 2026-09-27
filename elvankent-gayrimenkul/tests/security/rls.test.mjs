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
    assert.ok(!denied(await ad.from('organization_settings').update({ tagline: 'RLS test' }).eq('organization_id', T.A.orgId).select('organization_id')));
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
