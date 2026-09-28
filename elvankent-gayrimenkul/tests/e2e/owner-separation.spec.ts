import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { PLATFORM_BRAND } from '../../src/platform/branding/platform-brand';

/**
 * Platform sahibi (KARAY) ↔ kiracı (emlak ofisi) ayrımı — TEST-OWNER-01…08.
 *
 *   KARAY (süper admin, /platform)  →  Kiracı 1: Elvankent Gayrimenkul (varsayılan ofis)
 *                                   →  Kiracı 2: bu test için geçici "B" ofisi
 *
 * Elvankent kullanıcısı olarak süper admin OLMAYAN geçici bir ofis sahibi hesabı
 * oluşturulur (E). B ofisine de geçici bir sahip (BO) eklenir. Test sonunda B ofisi
 * ve geçici hesaplar silinir, Elvankent'in renkleri eski hâline döndürülür.
 *
 * Gerekli: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (süper admin), NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Yalnızca yerel/demo veritabanı.
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe.configure({ mode: 'serial' });
test.skip(!adminEmail || !adminPassword || !url || !anonKey || !serviceKey, 'E2E_ADMIN_* ve Supabase anahtarları tanımlı değil');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const RUN = randomBytes(3).toString('hex');
const PASSWORD = `Owner-${randomBytes(6).toString('hex')}-9a`;
const PLATFORM_PRIMARY = PLATFORM_BRAND.primaryColor;
const B_PRIMARY = '#7a1f5c';
const E_NEW_PRIMARY = '#8b2e16';

const S: {
  elvankentId?: string;
  elvankentPrimary?: string;
  bId?: string;
  bName: string;
  e?: { id: string; email: string };
  bo?: { id: string; email: string };
  eClient?: SupabaseClient;
} = { bName: `E2E Müşteri B ${RUN}` };

async function makeUser(label: string, orgId: string) {
  const email = `owner-${RUN}-${label}@example.test`;
  const { data, error } = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Test ${label}` } });
  if (error) throw error;
  const { error: mErr } = await service!.from('organization_members').insert({ organization_id: orgId, user_id: data.user.id, role: 'owner', status: 'active' });
  if (mErr) throw mErr;
  return { id: data.user.id, email };
}

test.beforeAll(async () => {
  if (!service) return;
  const elv = await service.from('organizations').select('id').eq('slug', 'elvankent').single();
  if (elv.error) throw elv.error;
  S.elvankentId = elv.data.id;
  S.elvankentPrimary = (await service.from('organization_settings').select('primary_color').eq('organization_id', elv.data.id).single()).data?.primary_color;

  const org = await service
    .from('organizations')
    .insert({ slug: `e2eown-${RUN}`, name: S.bName, reference_prefix: `Y${RUN.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' })
    .select('id')
    .single();
  if (org.error) throw org.error;
  S.bId = org.data.id;
  await service.from('organization_settings').insert({ organization_id: S.bId, display_name: S.bName, primary_color: B_PRIMARY, accent_color: '#1f7a5c' });
  await service.from('subscriptions').insert({ organization_id: S.bId, plan_id: 'baslangic', status: 'active' });

  S.e = await makeUser('elvankent', S.elvankentId!);
  S.bo = await makeUser('b', S.bId!);
  S.eClient = createClient(url!, anonKey!, opts);
  const signIn = await S.eClient.auth.signInWithPassword({ email: S.e.email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
});

test.afterAll(async () => {
  if (!service) return;
  if (S.elvankentId && S.elvankentPrimary) {
    await service.from('organization_settings').update({ primary_color: S.elvankentPrimary }).eq('organization_id', S.elvankentId);
  }
  if (S.bId) await service.from('organizations').delete().eq('id', S.bId);
  for (const u of [S.e, S.bo]) if (u) await service.auth.admin.deleteUser(u.id);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() })));
});

async function loginOffice(page: Page, email: string, password: string) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
}

const cssVar = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.body).getPropertyValue(n).trim().toLowerCase(), name);

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ ...test.info().project.use });
  await ctx.addInitScript(() => localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() })));
  return { ctx, page: await ctx.newPage() };
}

test('TEST-OWNER-01: Elvankent kullanıcısı KARAY platform alanına erişemez (URL elle yazılsa bile)', async ({ page, browser }) => {
  await loginOffice(page, S.e!.email, PASSWORD);
  await expect(page.getByRole('link', { name: /platform yönetimi/i })).toHaveCount(0);
  for (const path of [
    '/platform',
    '/platform/organizasyonlar',
    '/platform/organizasyonlar/yeni',
    '/platform/kullanicilar',
    '/platform/planlar',
    '/platform/kayitlar',
    '/platform/ayarlar',
    '/platform/organizations',
    '/platform/users',
    '/platform/settings',
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole('img', { name: 'KARAY' }), path).toHaveCount(0);
    await expect(page.getByText(S.bName), path).toHaveCount(0);
  }
  // Platform giriş sayfası oturumu açık ofis kullanıcısına yalnızca bilgi gösterir
  await page.goto('/platform/giris');
  await expect(page.getByText('Bu alan yalnızca platform yöneticileri içindir.')).toBeVisible();

  // Platform girişinden ofis hesabıyla giriş reddedilir
  const { ctx, page: p } = await newPage(browser);
  await p.goto('/platform/giris');
  await p.getByLabel('E-posta').fill(S.e!.email);
  await p.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await p.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(p.getByText('Bu hesap platform yöneticisi değil.', { exact: false })).toBeVisible();
  await expect(p).toHaveURL(/\/platform\/giris/);
  await ctx.close();
});

test('TEST-OWNER-02: Elvankent kullanıcısı başka kiracıyı (ve kiracı listesini) göremez', async ({ request }) => {
  const e = S.eClient!;
  const orgs = await e.from('organizations').select('id, name');
  expect(orgs.error).toBeNull();
  expect(orgs.data!.map((o) => o.id)).toEqual([S.elvankentId]);
  expect((await e.from('organization_domains').select('hostname').neq('organization_id', S.elvankentId!)).data ?? []).toEqual([]);
  expect((await e.from('subscriptions').select('id').eq('organization_id', S.bId!)).data ?? []).toEqual([]);
  expect((await e.from('organization_members').select('user_id').eq('organization_id', S.bId!)).data ?? []).toEqual([]);
  expect((await e.rpc('platform_organizations')).error).not.toBeNull();
  // Herkese açık anahtarla da kiracı listesi çekilemez
  for (const table of ['organizations', 'organization_settings', 'organization_domains']) {
    const res = await request.get(`${url}/rest/v1/${table}?select=*`, { headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey}` } });
    expect(res.status(), table).toBe(200);
    expect(await res.json(), table).toEqual([]);
  }
});

test('TEST-OWNER-03: URL / çerez manipülasyonu ile başka kiracıya geçilemez', async ({ page, context }) => {
  await loginOffice(page, S.e!.email, PASSWORD);
  const res = await page.goto(`/platform/organizasyonlar/${S.bId}`);
  expect(res?.status()).toBe(404);
  // Aktif ofis çerezine B'nin kimliği yazılsa bile üyelik yoksa yok sayılır
  const host = new URL(page.url()).hostname;
  await context.addCookies([{ name: 'eg_active_org', value: S.bId!, domain: host, path: '/' }]);
  await page.goto('/admin');
  await expect(page.getByText(S.bName)).toHaveCount(0);
  await expect(page.getByText('Elvankent Gayrimenkul').first()).toBeVisible();
  await page.goto('/admin/sirket');
  await expect(page.getByLabel('Şirket adı')).toHaveValue(/Elvankent/);
});

test("TEST-OWNER-04: Elvankent başka kiracının marka/ayar kaydını okuyamaz", async () => {
  const e = S.eClient!;
  const other = await e.from('organization_settings').select('display_name, primary_color, logo_url').eq('organization_id', S.bId!);
  expect(other.data ?? []).toEqual([]);
  const all = await e.from('organization_settings').select('organization_id');
  expect((all.data ?? []).map((r) => r.organization_id)).toEqual([S.elvankentId]);
  expect((await e.from('organization_notification_settings').select('emails').eq('organization_id', S.bId!)).data ?? []).toEqual([]);
  // Askıya alınan kiracının herkese açık site ayarları da kapanır
  await service!.from('organizations').update({ status: 'suspended' }).eq('id', S.bId!);
  const suspended = await e.rpc('public_tenant_settings', { p_org: S.bId! });
  await service!.from('organizations').update({ status: 'active' }).eq('id', S.bId!);
  expect(suspended.data ?? []).toEqual([]);
});

test('TEST-OWNER-05: Elvankent KARAY platform ayarlarını (plan, durum, alan adı) değiştiremez', async () => {
  const e = S.eClient!;
  expect((await e.rpc('platform_update_plan', { p_id: 'baslangic', p_name: 'Hack', p_max_users: 999, p_max_properties: 999, p_max_storage_mb: 99999, p_crm: true, p_analytics: true, p_pdf: true, p_custom_domain: true, p_price: 0 })).error).not.toBeNull();
  expect((await e.rpc('platform_set_org_plan', { p_org: S.elvankentId!, p_plan: 'kurumsal', p_status: 'active' })).error).not.toBeNull();
  expect((await e.rpc('platform_set_org_status', { p_org: S.bId!, p_status: 'suspended' })).error).not.toBeNull();
  expect((await e.rpc('platform_add_domain', { p_org: S.elvankentId!, p_hostname: `hack-${RUN}.example.com`, p_primary: false })).error).not.toBeNull();
  expect((await e.from('plans').update({ max_users: 999 }).eq('id', 'baslangic').select('id')).data ?? []).toEqual([]);
  expect((await e.from('organizations').update({ status: 'suspended' }).eq('id', S.bId!).select('id')).data ?? []).toEqual([]);
  expect((await e.from('organizations').insert({ slug: `hack-${RUN}`, name: 'Hack', reference_prefix: 'HCK' })).error).not.toBeNull();
  const plan = await service!.from('plans').select('name, max_users').eq('id', 'baslangic').single();
  expect(plan.data!.name).not.toBe('Hack');
  expect(plan.data!.max_users).not.toBe(999);
});

test('TEST-OWNER-06: Elvankent süper admin oluşturamaz, başka kiracıya kullanıcı ekleyemez', async ({ page }) => {
  const e = S.eClient!;
  expect((await e.from('profiles').update({ is_super_admin: true }).eq('id', S.e!.id).select('id')).data ?? []).toEqual([]);
  expect((await e.from('organization_members').insert({ organization_id: S.bId!, user_id: S.e!.id, role: 'owner', status: 'active' })).error).not.toBeNull();
  const profile = await service!.from('profiles').select('is_super_admin').eq('id', S.e!.id).single();
  expect(profile.data!.is_super_admin).toBe(false);
  // Kullanıcı ekleme formunda platform rolü yoktur
  await loginOffice(page, S.e!.email, PASSWORD);
  await page.goto('/admin/kullanicilar');
  await page.getByRole('button', { name: 'Yeni kullanıcı' }).click();
  const options = await page.getByRole('dialog', { name: 'Yeni kullanıcı' }).getByLabel('Rol').locator('option').allInnerTexts();
  expect(options.length).toBeGreaterThan(0);
  expect(options.join(' ')).not.toMatch(/süper|platform|super/i);
});

test('TEST-OWNER-07: Süper admin (KARAY) kiracıları yönetebilir', async ({ page }) => {
  await loginPlatform(page);
  await expect(page.getByRole('banner').getByRole('img', { name: 'KARAY' })).toBeVisible();
  await page.goto('/platform/organizasyonlar');
  await expect(page.getByRole('link', { name: 'Elvankent Gayrimenkul' }).first()).toBeVisible();
  await page.getByRole('link', { name: S.bName }).click();
  await expect(page.getByRole('heading', { level: 1, name: S.bName })).toBeVisible();
  await page.getByLabel('Plan').selectOption('profesyonel');
  await page.getByRole('button', { name: 'Uygula' }).click();
  await expect
    .poll(async () => (await service!.from('subscriptions').select('plan_id').eq('organization_id', S.bId!).in('status', ['active', 'trialing', 'past_due']).maybeSingle()).data?.plan_id)
    .toBe('profesyonel');
  // Elvankent de yönetilebilir bir kiracıdır (ayrıntı sayfası açılır)
  await page.goto(`/platform/organizasyonlar/${S.elvankentId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Elvankent Gayrimenkul' })).toBeVisible();
  // Platform çıkışı platform girişine döner
  await page.getByRole('button', { name: /Çıkış/ }).click();
  await expect(page).toHaveURL(/\/platform\/giris/);
});

test("TEST-OWNER-08: Elvankent kendi markasını değiştirir; tema yalnızca o kiracıyı etkiler", async ({ page, browser }) => {
  // B ofisinin sahibi, Elvankent'in alan adından girse bile panelde KENDİ rengini görür
  const b = await newPage(browser);
  await loginOffice(b.page, S.bo!.email, PASSWORD);
  await expect(b.page.getByText(S.bName).first()).toBeVisible();
  expect(await cssVar(b.page, '--primary')).toBe(B_PRIMARY);
  await b.ctx.close();

  // Elvankent sahibi kendi ana rengini değiştirir
  await loginOffice(page, S.e!.email, PASSWORD);
  await page.goto('/admin/sirket');
  await page.getByLabel('Ana renk', { exact: true }).fill(E_NEW_PRIMARY);
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect
    .poll(async () => (await service!.from('organization_settings').select('primary_color').eq('organization_id', S.elvankentId!).single()).data?.primary_color)
    .toBe(E_NEW_PRIMARY);
  await page.goto('/admin');
  expect(await cssVar(page, '--primary')).toBe(E_NEW_PRIMARY);

  // KARAY platformunun teması değişmez; Elvankent logosu/simgesi platformda yoktur
  const k = await newPage(browser);
  await loginPlatform(k.page);
  expect(await cssVar(k.page, '--primary')).toBe(PLATFORM_PRIMARY);
  await expect(k.page.locator('img[src*="/branding/"]')).toHaveCount(0);
  const icons = await k.page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  expect(icons.length).toBeGreaterThan(0);
  for (const href of icons) expect(href, 'platform simgesi').toMatch(/^\/platform\//);
  await expect(k.page.getByRole('img', { name: 'KARAY' }).first()).toBeVisible();
  await k.ctx.close();

  // B ofisinin kaydı Elvankent'in değişikliğinden etkilenmez
  const bSettings = await service!.from('organization_settings').select('primary_color').eq('organization_id', S.bId!).single();
  expect(bSettings.data!.primary_color).toBe(B_PRIMARY);
});

test('TEST-OWNER-09: aynı kişi hem süper admin hem ofis sahibi olsa bile iki alan arasında geçiş yoktur', async ({ page, context }) => {
  // Ofis girişi → menüde platform bağlantısı yok; /platform şifre ister; platform işlemleri reddedilir
  await loginOffice(page, adminEmail!, adminPassword!);
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole('link', { name: /platform/i })).toHaveCount(0);
  for (const path of ['/platform', '/platform/organizasyonlar', `/platform/organizasyonlar/${S.bId}`, '/platform/kullanicilar', '/platform/planlar', '/platform/kayitlar']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/platform\/giris$/);
    await expect(page.getByRole('heading', { name: 'Genel bakış' })).toHaveCount(0);
  }
  // Ofis girişi platforma yönlendirme kabul etmez (next=/platform yok sayılır)
  const { ctx: c2, page: p2 } = await newPage(page.context().browser()!);
  await p2.goto('/admin/giris?next=/platform');
  await p2.getByLabel('E-posta').fill(adminEmail!);
  await p2.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await p2.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(p2).toHaveURL(/\/admin(\?|$)/);
  await c2.close();

  // Elle yazılmış / sahte alan çerezi platformu açmaz
  const host = new URL(page.url()).hostname;
  for (const value of ['platform', 'platform.x', 'platform.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']) {
    await context.addCookies([{ name: 'eg_scope', value, domain: host, path: '/' }]);
    await page.goto('/platform');
    await expect(page, value).toHaveURL(/\/platform\/giris$/);
  }

  // Platform girişi → konsol; ofis paneli ve ofis API'si kapalı
  await loginPlatform(page);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/giris\?alan=platform/);
  await page.goto('/admin/ilanlar');
  await expect(page).toHaveURL(/\/admin\/giris/);
  const api = await page.request.post('/api/admin/branding', { multipart: { kind: 'logo' } });
  expect(api.status()).toBeGreaterThanOrEqual(400);
  // Platform oturum çerezi başka bir girişe taşınamaz: ofis girişi yapılınca platform yeniden şifre ister
  await loginOffice(page, adminEmail!, adminPassword!);
  await page.goto('/platform');
  await expect(page).toHaveURL(/\/platform\/giris$/);
});

test('TEST-OWNER-10: KARAY şifre yenileme KARAY sayfalarında kalır; ofis paneline veya konsola oturum açmaz', async ({ page }) => {
  // Geçici süper admin (ofis üyeliği YOK)
  const email = `owner-${RUN}-karay@example.test`;
  const created = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  expect(created.error).toBeNull();
  const userId = created.data.user!.id;
  try {
    await service!.from('profiles').upsert({ id: userId, is_super_admin: true });
    // Platform girişindeki "Şifremi unuttum" → KARAY markalı istek sayfası
    await page.goto('/platform/giris');
    await page.getByRole('link', { name: 'Şifremi unuttum' }).click();
    await expect(page).toHaveURL(/\/platform\/sifremi-unuttum$/);
    await expect(page.getByRole('img', { name: 'KARAY' })).toBeVisible();
    await expect(page.getByText('Elvankent')).toHaveCount(0);
    // Geçersiz bağlantı → KARAY sayfasına döner
    await page.goto('/admin/auth/callback?token_hash=gecersiz&type=recovery&next=/platform/sifre-yenile');
    await expect(page).toHaveURL(/\/platform\/sifremi-unuttum\?hata=gecersiz/);
    // Geri dönüş adresi yalnızca şifre sayfası olabilir; konsol adresi yok sayılır
    await page.goto('/admin/auth/callback?token_hash=gecersiz&type=recovery&next=/platform');
    await expect(page).toHaveURL(/\/admin\/sifremi-unuttum\?hata=gecersiz/);

    // Geçerli sıfırlama bağlantısı (e-postadaki ile aynı belirteç)
    const link = await service!.auth.admin.generateLink({ type: 'recovery', email });
    expect(link.error).toBeNull();
    await page.goto(`/admin/auth/callback?token_hash=${link.data.properties!.hashed_token}&type=recovery&next=/platform/sifre-yenile`);
    await expect(page).toHaveURL(/\/platform\/sifre-yenile$/);
    await expect(page.getByRole('img', { name: 'KARAY' })).toBeVisible();
    const newPassword = `Karay-${Date.now()}-Yeni9`;
    await page.getByLabel('Yeni şifre', { exact: true }).fill(newPassword);
    await page.getByLabel('Yeni şifre (tekrar)').fill(newPassword);
    await page.getByRole('button', { name: /Şifreyi kaydet/ }).click();
    await expect(page.getByRole('link', { name: 'Platform girişine git' })).toBeVisible();
    // Sıfırlama oturumu konsolu açmaz; ofis paneli de açılmaz (üyelik yok)
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/platform\/giris$/);
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin$/);
    // Yeni şifreyle platform girişi çalışır
    await page.goto('/platform/giris');
    await page.getByLabel('E-posta').fill(email);
    await page.getByLabel('Şifre', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page).toHaveURL(/\/platform$/);
  } finally {
    await service!.auth.admin.deleteUser(userId);
  }
});

