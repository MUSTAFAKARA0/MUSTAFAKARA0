/**
 * KI-46 · J: kiracı izolasyonunun kalan düşük bulguları (supabase/pending/20261124000001_tenant_hardening.sql).
 * Gerçek (yerel) Supabase'e karşı çalışır; kendi geçici organizasyonlarını (thtest-*) ve kullanıcılarını oluşturur, sonunda SİLER.
 *
 *   TH-01  talep ataması: A'nın aktif üyesine atanır; B'nin sahibine, A'nın pasif üyesine ve hiçbir ofiste olmayana atanamaz
 *          (ofis oturumu ve service_role); eski atama kalır, başka alanlar güncellenebilir
 *   TH-02  randevu ataması: aynı kural, ekleme ve güncellemede
 *   TH-03  paylaşılan seçki: başka kurumun ilanı (tetikleyici atlatılarak eklenmiş olsa bile) görünmez; kendi ilanı görünür
 *   TH-04  anon organization_settings / organization_domains tablolarını okuyamaz; herkese açık site fonksiyonları çalışır;
 *          /api/health sorgusu (organizations, head) hata vermez
 *   TH-05  ofis kullanıcısı mahalle ekleyemez; mahalle listesi herkese okunur
 *   TH-06  tetikleyici fonksiyonu RPC olarak çağrılamaz
 *
 * J uygulanmamış veritabanında atlanır; CI'da (CI=true) atlanmaz, hata verir. TH-03 psql ve yerel DB_URL ister.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const execFileP = promisify(execFile);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  throw new Error(`${process.env.CI ? 'CI: ' : ''}NEXT_PUBLIC_SUPABASE_URL yerel değil; kiracı izolasyonu testleri yalnızca yerel Supabase ile çalışır`);
}
const missing = !url || !anonKey || !serviceKey;
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = missing ? null : createClient(url, serviceKey, opts);
const anon = missing ? null : createClient(url, anonKey, opts);
let skip = missing ? 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY tanımlı değil' : false;

const dbUrl = process.env.DB_URL;
const dbUrlLocal = !!dbUrl && /^postgres(ql)?:\/\/([^@/]*@)?(127\.0\.0\.1|localhost)(:\d+)?(\/\w+)?$/.test(dbUrl);
const psqlSql = async (sql) => {
  if (!dbUrl) throw new Error('DB_URL tanımlı değil (TH-03 psql ile yerel veritabanına bağlanır)');
  assert.ok(dbUrlLocal, 'DB_URL yerel değil; test yalnızca yerel veritabanında çalışır');
  const child = execFileP('psql', [dbUrl, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { maxBuffer: 1 << 24 });
  child.child.stdin.end(`${sql.trimEnd().replace(/;$/, '')};\n`);
  return (await child).stdout;
};

const RUN = randomBytes(3).toString('hex');
const prefix = (first) => first + Array.from(randomBytes(4), (b) => String.fromCharCode(65 + (b % 26))).join('');
const PASSWORD = `Th-${randomBytes(8).toString('hex')}-7a`;
const createdUsers = [];
const createdOrgs = [];
let taxonomy;
const O = {};

async function makeUser(label) {
  const email = `th-${RUN}-${label}@example.test`;
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
    .insert({ slug: `thtest-${RUN}-${label}`, name: `İzolasyon ${label}`, reference_prefix: prefix('H'), status: 'active' })
    .select('id')
    .single();
  assert.ifError(org.error);
  createdOrgs.push(org.data.id);
  assert.ifError((await service.from('organization_settings').insert({ organization_id: org.data.id, display_name: `İzolasyon ${label}` })).error);
  assert.ifError((await service.from('subscriptions').insert({ organization_id: org.data.id, plan_id: 'kurumsal', status: 'active' })).error);
  const owner = await makeUser(`${label}-owner`);
  const agent = await makeUser(`${label}-agent`);
  const former = await makeUser(`${label}-former`);
  for (const [u, role, status] of [[owner, 'owner', 'active'], [agent, 'agent', 'active'], [former, 'agent', 'disabled']]) {
    assert.ifError((await service.from('organization_members').insert({ organization_id: org.data.id, user_id: u.id, role, status })).error);
  }
  const base = {
    organization_id: org.data.id,
    listing_type: 'sale',
    property_type_id: taxonomy.typeId,
    category: 'konut',
    city_id: taxonomy.cityId,
    district_id: taxonomy.districtId,
    slug: '',
    reference_no: '',
  };
  const pub = await service
    .from('properties')
    .insert({ ...base, title: `İzolasyon ${label} yayındaki ilan`, description: 'Otomatik güvenlik testi ilanı; test sonunda silinir.', price: 1000000, currency: 'TRY', status: 'draft' })
    .select('id')
    .single();
  assert.ifError(pub.error);
  const media = await service.from('media_assets').insert({
    organization_id: org.data.id, property_id: pub.data.id, kind: 'property_photo', status: 'ready',
    public_base: '/demo/living-room', variant_widths: [320, 640], width: 1920, height: 1280,
  });
  assert.ifError(media.error);
  assert.ifError((await service.from('properties').update({ status: 'published' }).eq('id', pub.data.id)).error);
  const customer = await service.from('customers').insert({ organization_id: org.data.id, full_name: `İzolasyon ${label} Müşteri`, phone: '05320000000' }).select('id').single();
  assert.ifError(customer.error);
  const lead = await service
    .from('leads')
    .insert({ organization_id: org.data.id, customer_id: customer.data.id, status: 'new', source: 'website', intent: 'buy' })
    .select('id')
    .single();
  assert.ifError(lead.error);
  return { id: org.data.id, owner, agent, former, propertyId: pub.data.id, customerId: customer.data.id, leadId: lead.data.id };
}

const assignLead = (client, org, userId) => client.from('leads').update({ assigned_to: userId }).eq('id', org.leadId).select('id');
const denied = (res) => !!res.error && /assignee_not_member/.test(res.error.message);

before(async () => {
  if (skip) return;
  const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
  assert.ifError(type.error);
  const district = await anon.from('districts').select('id, city_id').limit(1).single();
  assert.ifError(district.error);
  taxonomy = { typeId: type.data.id, districtId: district.data.id, cityId: district.data.city_id };
  O.a = await makeOrg('a');
  O.b = await makeOrg('b');
  // J uygulanmış mı: B'nin sahibine atama kabul ediliyorsa uygulanmamıştır (deneme geri alınır)
  const probe = await assignLead(service, O.a, O.b.owner.id);
  if (!probe.error) {
    await assignLead(service, O.a, null);
    if (process.env.CI) throw new Error('CI: KI-46 bekleyen migration (J) uygulanmamış');
    skip = 'KI-46 bekleyen migration (J) bu veritabanında uygulanmamış (supabase/pending)';
  }
});

after(async () => {
  if (missing) return;
  for (const id of createdOrgs) await service.from('organizations').delete().eq('id', id);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
});

describe('TH kiracı izolasyonu kalanları (J)', () => {
  test("TH-01 talep yalnız kurumun aktif üyesine atanır", async (t) => {
    if (skip) return t.skip(skip);
    const outsider = await makeUser('outsider');
    for (const client of [O.a.owner.client, service]) {
      assert.ok(denied(await assignLead(client, O.a, O.b.owner.id)), "B'nin sahibine atandı");
      assert.ok(denied(await assignLead(client, O.a, O.a.former.id)), 'pasif üyeye atandı');
      assert.ok(denied(await assignLead(client, O.a, outsider.id)), 'ofissiz hesaba atandı');
    }
    const ok = await assignLead(O.a.owner.client, O.a, O.a.agent.id);
    assert.ifError(ok.error);
    assert.equal(ok.data?.length, 1);
    // Atanan sonradan pasifleşse de eski atama kalır ve diğer alanlar güncellenebilir
    assert.ifError((await service.from('organization_members').update({ status: 'disabled' }).eq('organization_id', O.a.id).eq('user_id', O.a.agent.id)).error);
    const other = await O.a.owner.client.from('leads').update({ status: 'contacted' }).eq('id', O.a.leadId).select('assigned_to');
    assert.ifError(other.error);
    assert.equal(other.data?.[0]?.assigned_to, O.a.agent.id);
    assert.ifError((await service.from('organization_members').update({ status: 'active' }).eq('organization_id', O.a.id).eq('user_id', O.a.agent.id)).error);
    // Atamayı kaldırmak her zaman serbest
    assert.ifError((await assignLead(O.a.owner.client, O.a, null)).error);
  });

  test('TH-02 randevu ataması aynı kurala bağlıdır (ekleme ve güncelleme)', async (t) => {
    if (skip) return t.skip(skip);
    const row = (assigned_to) => ({
      organization_id: O.a.id, customer_id: O.a.customerId, property_id: O.a.propertyId, status: 'requested',
      scheduled_at: new Date(Date.now() + 86_400_000).toISOString(), assigned_to,
    });
    assert.ok(denied(await O.a.owner.client.from('appointments').insert(row(O.b.owner.id)).select('id')), 'B sahibine randevu atandı');
    assert.ok(denied(await service.from('appointments').insert(row(O.a.former.id)).select('id')), 'pasif üyeye randevu atandı');
    const created = await O.a.owner.client.from('appointments').insert(row(O.a.agent.id)).select('id').single();
    assert.ifError(created.error);
    assert.ok(denied(await O.a.owner.client.from('appointments').update({ assigned_to: O.b.agent.id }).eq('id', created.data.id).select('id')));
    assert.ifError((await O.a.owner.client.from('appointments').update({ assigned_to: O.a.owner.id }).eq('id', created.data.id).select('id')).error);
  });

  test('TH-03 paylaşılan seçkide yalnız seçkinin kurumunun ilanı görünür', async (t) => {
    if (skip) return t.skip(skip);
    if (!dbUrl && !process.env.CI) return t.skip('DB_URL tanımlı değil');
    const token = randomBytes(32).toString('base64url');
    const col = await service.from('collections').insert({ organization_id: O.a.id, title: 'İzolasyon seçki', token }).select('id').single();
    assert.ifError(col.error);
    assert.ifError((await service.from('collection_items').insert({ collection_id: col.data.id, property_id: O.a.propertyId, sort_order: 1 })).error);
    // Tetikleyici normalde reddeder; okuma katmanını sınamak için yalnız bu işlemde atlanır (yerel veritabanı)
    await psqlSql(`begin; set local session_replication_role = replica;
      insert into public.collection_items (collection_id, organization_id, property_id, sort_order)
      values ('${col.data.id}', '${O.a.id}', '${O.b.propertyId}', 2); commit`);
    const res = await anon.rpc('get_public_collection', { p_token: token });
    assert.ifError(res.error);
    assert.equal(res.data.status, 'ok');
    assert.deepEqual(res.data.items.map((i) => i.property_id), [O.a.propertyId], 'başka kurumun ilanı seçkide göründü');
  });

  test('TH-04 anon ayar/alan adı tablolarını okuyamaz; herkese açık yollar çalışır', async (t) => {
    if (skip) return t.skip(skip);
    for (const table of ['organization_settings', 'organization_domains']) {
      const r = await anon.from(table).select('organization_id').limit(1);
      assert.ok(r.error, `${table} anon'a açık`);
      assert.equal(r.error.code, '42501');
    }
    const health = await anon.from('organizations').select('id', { head: true, count: 'exact' }).limit(1);
    assert.ifError(health.error);
    const settings = await anon.rpc('public_tenant_settings', { p_org: O.a.id }, { get: true });
    assert.ifError(settings.error);
    assert.ok(settings.data, 'herkese açık ayarlar okunamadı');
    const domains = await anon.rpc('public_tenant_domains', { p_org: O.a.id }, { get: true });
    assert.ifError(domains.error);
  });

  test('TH-05 ofis kullanıcısı mahalle ekleyemez; liste herkese okunur', async (t) => {
    if (skip) return t.skip(skip);
    const ins = await O.a.owner.client.from('neighborhoods').insert({ district_id: taxonomy.districtId, name: 'Uydurma Mahalle', slug: `uydurma-${RUN}` }).select('id');
    assert.ok(ins.error || (ins.data ?? []).length === 0, 'ofis kullanıcısı mahalle ekledi');
    const left = await service.from('neighborhoods').select('id').eq('slug', `uydurma-${RUN}`);
    assert.equal((left.data ?? []).length, 0);
    const read = await anon.from('neighborhoods').select('id').eq('district_id', taxonomy.districtId).limit(1);
    assert.ifError(read.error);
  });

  test('TH-06 tetikleyici fonksiyonu RPC olarak çağrılamaz', async (t) => {
    if (skip) return t.skip(skip);
    for (const client of [anon, O.a.owner.client, service]) {
      assert.ok((await client.rpc('crm_assignee_guard')).error);
    }
  });
});
