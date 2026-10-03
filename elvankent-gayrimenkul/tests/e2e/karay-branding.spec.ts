import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PLATFORM_BRAND } from '../../src/platform/branding/platform-brand';

/**
 * KARAY (platform sahibi) ↔ Elvankent ve diğer kiracılar (müşteri) — TEST-KARAY-01…15.
 *
 *   KARAY (süper admin, /platform)
 *     ├─ Elvankent Gayrimenkul (ilk müşteri; localhost'ta açılan varsayılan kiracı)
 *     └─ Kiracı B (bu test için geçici; kendi test alan adı: kb-<run>.e2e.test)
 *
 * Elvankent'e süper admin OLMAYAN geçici bir sahip hesabı (E) eklenir. Elvankent'in
 * yayındaki görünümü değiştirilmez (yalnızca 05'te renk değişip geri alınır). Test sonunda
 * B kiracısı ve geçici hesap silinir. Yalnızca yerel/demo veritabanı.
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });
test.skip(!adminEmail || !adminPassword || !url || !anonKey || !serviceKey, 'E2E_ADMIN_* ve Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const HOST = `kb-${RUN}.e2e.test`;
const PORT = new URL(baseURL).port || '80';
const SITE_B = `http://${HOST}:${PORT}`;
const PASSWORD = `Karay-${randomBytes(6).toString('hex')}-7a`;
const B_NAME = `E2E Kiracı B ${RUN}`;
const B_NEW_NAME = `Kiracı B Yeni Marka Adı ${RUN}`;
const B_PRIMARY = '#7a1f5c';
const B_NEW_PRIMARY = '#23466e';
const E_NEW_PRIMARY = '#8b2e16';

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE_B}`],
  },
});

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const S: { elvId?: string; elvPrimary?: string; bId?: string; e?: { id: string; email: string }; eClient?: SupabaseClient } = {};

test.beforeAll(async () => {
  if (!service) return;
  const elv = await service.from('organizations').select('id').eq('is_default', true).single();
  if (elv.error) throw elv.error;
  S.elvId = elv.data.id;
  S.elvPrimary = (await service.from('organization_settings').select('primary_color').eq('organization_id', S.elvId).single()).data?.primary_color;

  const org = await service
    .from('organizations')
    .insert({ slug: `e2ekb-${RUN}`, name: B_NAME, reference_prefix: `K${RUN.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' })
    .select('id')
    .single();
  if (org.error) throw org.error;
  S.bId = org.data.id;
  await service.from('organization_settings').insert({ organization_id: S.bId, display_name: B_NAME, primary_color: B_PRIMARY, accent_color: '#1f7a5c' });
  await service.from('subscriptions').insert({ organization_id: S.bId, plan_id: 'baslangic', status: 'active' });
  const dom = await service.from('organization_domains').insert({ organization_id: S.bId, hostname: HOST, is_primary: true, verified_at: new Date().toISOString() });
  if (dom.error) throw dom.error;

  const email = `karay-${RUN}@example.test`;
  const created = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Test Elvankent Sahibi' } });
  if (created.error) throw created.error;
  S.e = { id: created.data.user.id, email };
  const m = await service.from('organization_members').insert({ organization_id: S.elvId, user_id: S.e.id, role: 'owner', status: 'active' });
  if (m.error) throw m.error;
  S.eClient = createClient(url!, anonKey!, opts);
  const signIn = await S.eClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
});

test.afterAll(async () => {
  if (!service) return;
  if (S.elvId && S.elvPrimary) await service.from('organization_settings').update({ primary_color: S.elvPrimary }).eq('organization_id', S.elvId);
  if (S.bId) await service.from('organizations').delete().eq('id', S.bId);
  if (S.e) await service.auth.admin.deleteUser(S.e.id);
});

test.beforeEach(async ({ context }) => {
  await prepare(context);
});

async function prepare(context: BrowserContext) {
  await context.addInitScript(() => localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() })));
  // Kiracının kanonik adresi https'tir; yerel test sunucusu http olduğundan yönlendirilir
  await context.route(new RegExp(`^https://${HOST.replace(/\./g, '\\.')}/`), (route) =>
    route.fulfill({ status: 302, headers: { location: route.request().url().replace(`https://${HOST}/`, `${SITE_B}/`) } }),
  );
}

async function newContext(browser: Browser, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ ...test.info().project.use, viewport });
  await prepare(ctx);
  return ctx;
}

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
}

async function loginOffice(page: Page) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(S.e!.email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

const tabB = (p = '') => `/platform/siteler/${S.bId}${p ? `/${p}` : ''}`;
const cssVar = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase(), name);
const bodyVar = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.body).getPropertyValue(n).trim().toLowerCase(), name);

async function saveDraft(page: Page) {
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('taslağa kaydedildi', { exact: false }).first()).toBeVisible();
}

async function publish(page: Page, note: string) {
  await page.goto(tabB());
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByLabel('Sürüm notu').fill(note);
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible();
}

/** Önizleme çerezi olmayan ayrı bağlamda kiracı B'nin canlı sitesi */
async function liveB(browser: Browser, p = '/', viewport?: { width: number; height: number }) {
  const ctx = await newContext(browser, viewport);
  const page = await ctx.newPage();
  const res = await page.goto(`${SITE_B}${p}`);
  return { page, res, close: () => ctx.close() };
}

const headerName = (page: Page) => page.getByRole('banner').first();

test('TEST-KARAY-01: Süper admin KARAY markasını görür; Elvankent "ilk müşteri" olarak listelenir', async ({ page }) => {
  await loginPlatform(page);
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('img', { name: PLATFORM_BRAND.name })).toBeVisible();
  await expect(banner.getByText(PLATFORM_BRAND.consoleName, { exact: false })).toBeVisible();
  await expect(banner.locator('img[src*="branding"]')).toHaveCount(0);
  await expect(banner.getByText('Elvankent')).toHaveCount(0);
  expect(await bodyVar(page, '--primary')).toBe(PLATFORM_BRAND.primaryColor);
  const structure = page.getByRole('region', { name: 'Platform yapısı' });
  await expect(structure.getByText('Platform sahibi', { exact: false })).toBeVisible();
  await expect(structure.getByRole('link', { name: /Elvankent Gayrimenkul/ })).toContainText('ilk müşteri');
  const icons = await page.locator('link[rel="icon"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  expect(icons.some((h) => h.startsWith('/platform/'))).toBe(true);
});

test('TEST-KARAY-02: Ofis kullanıcısı Elvankent markasını görür (KARAY platform menüsü yok)', async ({ page }) => {
  await loginOffice(page);
  const sidebar = page.getByRole('complementary').first();
  await expect(page.getByText('Elvankent Gayrimenkul').first()).toBeVisible();
  await expect(page.getByText('Ofis Yönetimi').first()).toBeVisible();
  await expect(page.getByRole('img', { name: PLATFORM_BRAND.name })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Web Siteleri|Organizasyonlar|Platform/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Marka ve Görünüm' })).toBeVisible();
  expect(await bodyVar(page, '--primary')).not.toBe(PLATFORM_BRAND.primaryColor);
  expect(sidebar).toBeTruthy();
});

test('TEST-KARAY-03: Elvankent kullanıcısı KARAY Super Admin alanına erişemez (URL, API, veritabanı)', async ({ page }) => {
  await loginOffice(page);
  for (const p of ['/platform', '/platform/siteler', `/platform/siteler/${S.elvId}`, `/platform/siteler/${S.elvId}/marka`, '/platform/organizasyonlar', '/platform/organizasyonlar/yeni', '/platform/kullanicilar', '/platform/planlar', '/platform/kayitlar', '/platform/ayarlar']) {
    expect((await page.goto(p))?.status(), p).toBe(404);
    await expect(page.getByRole('img', { name: PLATFORM_BRAND.name }), p).toHaveCount(0);
  }
  const api = await page.request.post('/api/platform/branding', {
    multipart: { orgId: S.elvId!, kind: 'logo', file: { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
    headers: { origin: baseURL },
  });
  expect(api.status()).toBe(403);
  const c = S.eClient!;
  for (const [fn, args] of [
    ['site_save_draft', { p_org: S.elvId!, p_section: 'brand', p_value: { display_name: 'Hack' } }],
    ['site_publish', { p_org: S.elvId! }],
    ['site_set_status', { p_org: S.elvId!, p_status: 'maintenance' }],
    ['platform_sites', {}],
    ['platform_organizations', {}],
    ['platform_set_org_status', { p_org: S.bId!, p_status: 'suspended' }],
  ] as const) {
    expect((await c.rpc(fn, args as never)).error, fn).not.toBeNull();
  }
  // Platform markası kodla gelir: veritabanında kiracının değiştirebileceği bir kayıt yoktur;
  // süper admin bayrağı da kullanıcıya kapalıdır
  expect((await c.from('profiles').update({ is_super_admin: true }).eq('id', S.e!.id).select('id')).data ?? []).toEqual([]);
});

test("TEST-KARAY-04: Elvankent başka kiracının site kaydını, taslağını, sürümlerini ve dosyalarını göremez", async () => {
  const c = S.eClient!;
  expect((await c.from('site_configs').select('draft').eq('organization_id', S.bId!)).data ?? []).toEqual([]);
  expect((await c.from('site_config_revisions').select('config').eq('organization_id', S.bId!)).data ?? []).toEqual([]);
  expect((await c.from('organization_settings').select('logo_url').eq('organization_id', S.bId!)).data ?? []).toEqual([]);
  expect((await c.from('organizations').select('id').eq('id', S.bId!)).data ?? []).toEqual([]);
  // İstemciden gelen kiracı kimliği yok sayılır: kendi site kaydı dışında satır dönmez
  const all = await c.from('site_configs').select('organization_id');
  expect((all.data ?? []).map((r) => r.organization_id)).toEqual([S.elvId]);
  // Depolamada B'nin marka klasörü listelenemez
  const list = await c.storage.from('branding').list(`organizations/${S.bId}/branding`);
  expect(list.data ?? []).toEqual([]);
});

test('TEST-KARAY-05: Elvankent tema/renk değişikliği KARAY platformunu etkilemez', async ({ page, browser }) => {
  await loginOffice(page);
  await page.goto('/admin/sirket');
  await page.getByLabel('Ana renk', { exact: true }).fill(E_NEW_PRIMARY);
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect
    .poll(async () => (await service!.from('organization_settings').select('primary_color').eq('organization_id', S.elvId!).single()).data?.primary_color)
    .toBe(E_NEW_PRIMARY);
  // Elvankent sitesi yeni rengi kullanır
  await expect.poll(async () => (await page.goto('/'), cssVar(page, '--primary')), { timeout: 20_000 }).toBe(E_NEW_PRIMARY);
  // KARAY platformu kendi renginde kalır
  const k = await newContext(browser);
  const kp = await k.newPage();
  await loginPlatform(kp);
  expect(await bodyVar(kp, '--primary')).toBe(PLATFORM_BRAND.primaryColor);
  await k.close();
  // Geri al (ofis kendi ekranından)
  await page.goto('/admin/sirket');
  await page.getByLabel('Ana renk', { exact: true }).fill(S.elvPrimary!);
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect
    .poll(async () => (await service!.from('organization_settings').select('primary_color').eq('organization_id', S.elvId!).single()).data?.primary_color)
    .toBe(S.elvPrimary);
});

test('TEST-KARAY-06: KARAY platform markası kiracı sitelerine ve ofis paneline sızmaz', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.platform-scope')).toHaveCount(0);
  await expect(page.locator('img[src^="/platform/"]')).toHaveCount(0);
  expect(await cssVar(page, '--primary')).not.toBe(PLATFORM_BRAND.primaryColor);
  const fonts = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fonts.toLowerCase()).not.toContain('poppins');
  const icons = await page.locator('link[rel="icon"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  expect(icons.some((h) => h.startsWith('/platform/'))).toBe(false);
  await expect(page.getByText(PLATFORM_BRAND.name, { exact: true })).toHaveCount(0);
});

test('TEST-KARAY-07: Kiracı B marka/renk değişikliği Elvankent\'i etkilemez (ve tersi)', async ({ page, browser }) => {
  await loginPlatform(page);
  await page.goto(tabB('renkler'));
  await page.getByText('Hazır palet', { exact: true }).click();
  await page.getByRole('button', { name: /Lüks Konut/ }).click();
  await saveDraft(page);
  await publish(page, 'KARAY-07 palet');
  const b = await liveB(browser);
  expect(await cssVar(b.page, '--primary')).toBe('#5b1f2e');
  await b.close();
  const elv = await newContext(browser);
  const ep = await elv.newPage();
  await ep.goto('/');
  expect(await cssVar(ep, '--primary')).not.toBe('#5b1f2e');
  expect(await cssVar(ep, '--primary')).toBe(S.elvPrimary);
  await elv.close();
  // Tersi: 05'teki Elvankent renk değişikliği B'ye yansımadı
  const b2 = await liveB(browser);
  expect(await cssVar(b2.page, '--primary')).not.toBe(E_NEW_PRIMARY);
  await b2.close();
});

test('TEST-KARAY-08: Taslaktaki marka (ad, renk, logo) canlı siteyi değiştirmez', async ({ page, browser }) => {
  await loginPlatform(page);
  await page.goto(tabB('marka'));
  await page.getByLabel('Firma adı').fill(B_NEW_NAME);
  await page.getByLabel('Ana renk', { exact: true }).fill(B_NEW_PRIMARY);
  await saveDraft(page);
  await page.locator('#branding-logo').setInputFiles(path.join(process.cwd(), 'public', 'og-default.png'));
  await expect(page.getByText('Logo taslağa kaydedildi', { exact: false })).toBeVisible();
  // Header: logo + ad (logoda ad yazmıyor)
  await page.goto(tabB('header'));
  await page.locator('#h-brand').selectOption('logo-name');
  await saveDraft(page);
  // Renkler: ofisin marka renkleri (ana renk marka taslağından gelir)
  await page.goto(tabB('renkler'));
  await page.getByText('Ofisin marka renkleri', { exact: true }).click();
  await saveDraft(page);
  // Kontrol merkezi: yayınlanmamış değişiklik ve bölümleri görünür
  await page.goto(tabB());
  await expect(page.getByText('Taslakta yayınlanmamış değişiklikler var')).toBeVisible();
  await expect(page.getByText('Marka, Renkler, Header · önizleyip yayınlayın')).toBeVisible();

  const b = await liveB(browser);
  await expect(headerName(b.page)).toContainText(B_NAME);
  await expect(headerName(b.page)).not.toContainText(B_NEW_NAME);
  await expect(b.page.getByRole('banner').locator('img[src*="branding"]')).toHaveCount(0);
  const settings = await service!.from('organization_settings').select('display_name, logo_url').eq('organization_id', S.bId!).single();
  expect(settings.data!.display_name).toBe(B_NAME);
  expect(settings.data!.logo_url).toBeNull();
  await b.close();
});

test('TEST-KARAY-09: Önizleme taslak markayı gösterir (yalnızca önizleyen tarayıcıda)', async ({ page, context, browser }) => {
  await loginPlatform(page);
  await page.goto(tabB());
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Önizle' }).first().click()]);
  await popup.waitForURL(new RegExp(`^${SITE_B}/`));
  await expect(popup.getByText('ÖNİZLEME', { exact: false })).toBeVisible();
  await expect(headerName(popup)).toContainText(B_NEW_NAME);
  await expect(popup.getByRole('banner').locator('img[src*="branding"]').first()).toBeVisible();
  expect(await cssVar(popup, '--primary')).toBe(B_NEW_PRIMARY);
  // Önizlemede sayfa gövdesi de taslak markayı kullanır (iletişim sayfası)
  await popup.goto(`${SITE_B}/iletisim`);
  await expect(popup.getByText(B_NEW_NAME).first()).toBeVisible();
  await popup.close();
  // Başka tarayıcı canlıyı görür
  const b = await liveB(browser);
  await expect(headerName(b.page)).not.toContainText(B_NEW_NAME);
  expect(await cssVar(b.page, '--primary')).toBe('#5b1f2e');
  await b.close();
});

test('TEST-KARAY-10: Yayınlama taslak markayı canlıya geçirir', async ({ page, browser }) => {
  await loginPlatform(page);
  await publish(page, 'KARAY-10 marka');
  const b = await liveB(browser);
  await expect(headerName(b.page)).toContainText(B_NEW_NAME);
  await expect(b.page.getByRole('banner').locator('img[src*="branding"]').first()).toBeVisible();
  expect(await cssVar(b.page, '--primary')).toBe(B_NEW_PRIMARY);
  const s = await service!.from('organization_settings').select('display_name, primary_color, logo_url').eq('organization_id', S.bId!).single();
  expect(s.data!.display_name).toBe(B_NEW_NAME);
  expect(s.data!.primary_color).toBe(B_NEW_PRIMARY);
  expect(s.data!.logo_url).toMatch(/-\d+x\d+\.png$/);
  await b.close();
  await page.goto(tabB());
  await expect(page.getByText('Taslak canlı siteyle aynı')).toBeVisible();
});

test('TEST-KARAY-11: Geri alma eski markaya döner', async ({ page, browser }) => {
  await loginPlatform(page);
  await page.goto(tabB('gecmis'));
  await page.locator('li', { hasText: 'KARAY-07 palet' }).getByRole('button', { name: 'Geri yükle' }).click();
  await page.getByRole('button', { name: 'Geri yükle', exact: true }).last().click();
  await expect(page.getByText('geri yüklendi', { exact: false }).first()).toBeVisible();
  const s = await service!.from('organization_settings').select('display_name, primary_color, logo_url').eq('organization_id', S.bId!).single();
  expect(s.data!.display_name).toBe(B_NAME);
  expect(s.data!.primary_color).toBe(B_PRIMARY);
  expect(s.data!.logo_url).toBeNull();
  const b = await liveB(browser);
  await expect(headerName(b.page)).toContainText(B_NAME);
  await expect(headerName(b.page)).not.toContainText(B_NEW_NAME);
  expect(await cssVar(b.page, '--primary')).toBe('#5b1f2e');
  await b.close();
  // Tekrar yayınlanmış markaya dön (sonraki testler logo + uzun ad ile)
  await page.goto(tabB('gecmis'));
  await page.locator('li', { hasText: 'KARAY-10 marka' }).getByRole('button', { name: 'Geri yükle' }).click();
  await page.getByRole('button', { name: 'Geri yükle', exact: true }).last().click();
  await expect(page.getByText('geri yüklendi', { exact: false }).first()).toBeVisible();
});

test('TEST-KARAY-12: Logo sayfa kaymasına (CLS) yol açmaz; en-boy oranı korunur', async ({ browser }) => {
  const ctx = await newContext(browser, { width: 1280, height: 800 });
  await ctx.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const page = await ctx.newPage();
  await page.goto(`${SITE_B}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const logo = page.getByRole('banner').locator('img[src*="branding"]').first();
  await expect(logo).toBeVisible();
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.02);
  const m = await logo.evaluate((img: HTMLImageElement) => ({ w: img.clientWidth, h: img.clientHeight, nw: img.naturalWidth, nh: img.naturalHeight, ar: getComputedStyle(img).aspectRatio }));
  expect(m.ar).not.toBe('auto');
  // Kutu, görselin gerçek oranında (kırpma/bozulma yok)
  expect(Math.abs(m.w / m.h - m.nw / m.nh)).toBeLessThan(0.05);
  await ctx.close();
});

for (const [id, width] of [
  ['13', 320],
  ['14', 360],
] as const) {
  test(`TEST-KARAY-${id}: ${width}px'de header taşmaz (logo + uzun ad)`, async ({ browser }) => {
    const b = await liveB(browser, '/', { width, height: 740 });
    const r = await b.page.evaluate(() => {
      const header = document.querySelector('header')!.getBoundingClientRect();
      const kids = [...document.querySelectorAll('header *')].map((el) => el.getBoundingClientRect()).filter((x) => x.width > 0);
      const wide = [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 5)
        .map((e) => `${e.tagName}.${String(e.className).slice(0, 80)}`);
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, right: Math.max(...kids.map((k) => k.right)), hw: header.width, wide };
    });
    expect(r.wide, 'taşan öğeler').toEqual([]);
    expect(r.sw).toBeLessThanOrEqual(r.cw);
    expect(r.right).toBeLessThanOrEqual(width + 0.5);
    await expect(b.page.getByRole('button', { name: /menü/i }).first()).toBeVisible();
    await b.close();
  });
}

test('TEST-KARAY-15: Mobil menü açılır, bağlantılar çalışır, kapanır', async ({ browser }) => {
  const ctx = await newContext(browser, { width: 390, height: 844 });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: /menü/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Satılık' })).toBeVisible();
  const box = await dialog.getByRole('link', { name: 'Satılık' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
  await dialog.getByRole('link', { name: 'Satılık' }).click();
  await expect(page).toHaveURL(/\/satilik/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await ctx.close();
});
