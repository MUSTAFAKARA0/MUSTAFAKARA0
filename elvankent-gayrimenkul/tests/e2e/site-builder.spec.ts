import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * KARAY Web Sitesi Yönetimi (Site Kontrol Merkezi) — TEST-SITE-01…12.
 *
 * Geçici bir "S" kiracısı ve ona bağlı test alan adı (site-<run>.e2e.test) oluşturulur;
 * tarayıcı bu alan adını yerel sunucuya yönlendirir (Chromium host-resolver-rules).
 * Elvankent'in görünümü DEĞİŞTİRİLMEZ. Test sonunda S kiracısı, alan adı ve geçici
 * hesap silinir. Yalnızca yerel/demo veritabanı.
 *
 * Gerekli: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (süper admin), NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
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
const HOST = `site-${RUN}.e2e.test`;
const PORT = new URL(baseURL).port || '80';
const SITE = `http://${HOST}:${PORT}`;

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE}`],
  },
});

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const PASSWORD = `Site-${randomBytes(6).toString('hex')}-9a`;
const S: { orgId?: string; name: string; user?: { id: string; email: string }; userClient?: SupabaseClient } = { name: `E2E Site ${RUN}` };

test.beforeAll(async () => {
  if (!service) return;
  const org = await service
    .from('organizations')
    .insert({ slug: `e2esite-${RUN}`, name: S.name, reference_prefix: `S${RUN.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' })
    .select('id')
    .single();
  if (org.error) throw org.error;
  S.orgId = org.data.id;
  await service.from('organization_settings').insert({ organization_id: S.orgId, display_name: S.name, primary_color: '#7a1f5c', accent_color: '#1f7a5c', phone: '+905550000000', whatsapp: '+905550000000' });
  await service.from('subscriptions').insert({ organization_id: S.orgId, plan_id: 'baslangic', status: 'active' });
  const dom = await service.from('organization_domains').insert({ organization_id: S.orgId, hostname: HOST, is_primary: true, verified_at: new Date().toISOString() });
  if (dom.error) throw dom.error;
  // S kiracısının sahibi (süper admin değil): platform ekranlarına ve site_* işlemlerine erişememeli
  const email = `site-${RUN}@example.test`;
  const created = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error) throw created.error;
  S.user = { id: created.data.user.id, email };
  await service.from('organization_members').insert({ organization_id: S.orgId, user_id: S.user.id, role: 'owner', status: 'active' });
  S.userClient = createClient(url!, anonKey!, opts);
  const signIn = await S.userClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
});

test.afterAll(async () => {
  if (!service) return;
  if (S.orgId) await service.from('organizations').delete().eq('id', S.orgId);
  if (S.user) await service.auth.admin.deleteUser(S.user.id);
});

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() })));
  // Kiracının kanonik adresi https'tir; yerel test sunucusu http olduğundan yönlendirilir
  await context.route(new RegExp(`^https://${HOST.replace(/\./g, '\\.')}/`), (route) =>
    route.fulfill({ status: 302, headers: { location: route.request().url().replace(`https://${HOST}/`, `${SITE}/`) } }),
  );
});

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
}

const tab = (p = '') => `/platform/siteler/${S.orgId}${p ? `/${p}` : ''}`;

async function saveDraft(page: Page) {
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
}

async function publish(page: Page, note: string) {
  await page.goto(tab());
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByLabel('Sürüm notu').fill(note);
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible();
}

/** Canlı site (önizleme çerezi olmayan ayrı tarayıcı bağlamı) */
async function live(context: BrowserContext, p = '/') {
  const browser = context.browser()!;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(`${SITE}${p}`);
  return { page, res, close: () => ctx.close() };
}

const siteTheme = (page: Page) => page.locator('[data-site-theme]').first().getAttribute('data-site-theme');

test('TEST-SITE-01: süper admin Web Siteleri listesini ve Site Kontrol Merkezi sekmelerini görür', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/siteler');
  await expect(page.getByRole('heading', { name: 'Web Siteleri' })).toBeVisible();
  await expect(page.getByRole('link', { name: S.name }).first()).toBeVisible();
  await page.goto(tab());
  await expect(page.getByRole('heading', { level: 1, name: S.name })).toBeVisible();
  for (const name of ['Genel', 'Marka', 'Tema', 'Renkler', 'Tipografi', 'Header', 'Ana Sayfa', 'Sayfalar', 'Menü', 'Footer', 'SEO', 'Domain', 'Özellikler', 'Geçmiş']) {
    await expect(page.getByRole('link', { name, exact: true }).first(), name).toBeVisible();
  }
  for (const name of ['Siteyi gör', 'Önizle', 'Değişiklikleri yayınla']) await expect(page.getByRole(name === 'Siteyi gör' ? 'link' : 'button', { name }).first()).toBeVisible();
});

test('TEST-SITE-02: tema taslağa kaydedilir, canlı site değişmez, önizlemede görünür, yayınlanınca canlıya geçer', async ({ page, context }) => {
  await loginPlatform(page);
  await page.goto(tab('tema'));
  await page.getByText('Marble', { exact: true }).click();
  await saveDraft(page);

  const before = await live(context);
  expect(before.res?.status()).toBe(200);
  expect(await siteTheme(before.page)).toBe('klasik');
  await before.close();

  // Önizleme: yeni sekmede, yalnızca bu tarayıcıda taslak
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Önizle' }).first().click()]);
  await popup.waitForURL(new RegExp(`^${SITE}/`));
  await expect(popup.getByText('ÖNİZLEME', { exact: false })).toBeVisible();
  expect(await siteTheme(popup)).toBe('marble');
  await expect(popup.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await popup.close();

  await publish(page, 'E2E tema Marble');
  const after = await live(context);
  expect(await siteTheme(after.page)).toBe('marble');
  await expect(after.page.getByText('ÖNİZLEME', { exact: false })).toHaveCount(0);
  await after.close();
});

test('TEST-SITE-03: renk paleti, menü, ana sayfa sırası, sayfa gizleme ve SEO yayına yansır', async ({ page, context }) => {
  await loginPlatform(page);
  // Renkler: hazır palet
  await page.goto(tab('renkler'));
  await page.getByText('Hazır palet', { exact: true }).click();
  await page.getByRole('button', { name: 'Kurumsal Lacivert' }).click();
  await saveDraft(page);
  // Menü: ilk öğenin adı değişir
  await page.goto(tab('menu'));
  await page.getByLabel('Menü yazısı').first().fill('Satılık Evler');
  await saveDraft(page);
  // Ana sayfa: İletişim bölümü en üste taşınır (mobilde de çalışan yukarı/aşağı düğmeleri)
  await page.goto(tab('ana-sayfa'));
  const up = page.getByRole('button', { name: 'İletişim: yukarı taşı' });
  for (let i = 0; i < 8; i++) await up.click();
  await saveDraft(page);
  // Sayfalar: Hakkımızda gizlenir
  await page.goto(tab('sayfalar'));
  await page.locator('li', { hasText: '/hakkimizda' }).getByLabel('Yayında').uncheck();
  await saveDraft(page);
  // SEO
  await page.goto(tab('seo'));
  await page.getByLabel('Site başlığı').fill(`E2E SEO ${RUN}`);
  await saveDraft(page);

  // Yayından önce canlı site eski hâlinde
  const before = await live(context, '/hakkimizda');
  expect(before.res?.status()).toBe(200);
  await before.close();

  await publish(page, 'E2E yapı');
  const home = await live(context);
  expect(await home.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toLowerCase())).toBe('#1d3a6b');
  await expect(home.page.locator('header').getByRole('link', { name: 'Satılık Evler' }).first()).toBeAttached();
  await expect(home.page.locator('header').getByRole('link', { name: 'Hakkımızda' })).toHaveCount(0);
  await expect(home.page).toHaveTitle(new RegExp(`E2E SEO ${RUN}`));
  const hidden = await home.page.goto(`${SITE}/hakkimizda`);
  expect(hidden?.status()).toBe(404);
  const sitemap = await home.page.goto(`${SITE}/sitemap.xml`);
  const xml = (await sitemap?.text()) ?? '';
  expect(xml).toContain('<urlset');
  expect(xml).not.toContain('/hakkimizda');
  await home.close();

  const { data } = await service!.from('site_configs').select('published, published_version').eq('organization_id', S.orgId!).single();
  const sections = (data!.published as { home: { sections: { type: string }[] } }).home.sections;
  expect(sections[0].type).toBe('contact');
  expect(data!.published_version).toBe(2);
});

test('TEST-SITE-04: Geçmiş sekmesinden önceki sürüme dönülür (geri alma yeni sürüm olarak yayınlanır)', async ({ page, context }) => {
  await loginPlatform(page);
  await page.goto(tab('gecmis'));
  await expect(page.getByText('E2E yapı').first()).toBeVisible();
  await page.locator('li', { hasText: 'E2E tema Marble' }).getByRole('button', { name: 'Geri yükle' }).click();
  await page.getByRole('button', { name: 'Geri yükle', exact: true }).last().click();
  await expect(page.getByText('geri yüklendi', { exact: false }).first()).toBeVisible();

  const home = await live(context);
  expect(await siteTheme(home.page)).toBe('marble');
  await expect(home.page.locator('header').getByRole('link', { name: 'Satılık Evler' })).toHaveCount(0);
  expect((await home.page.goto(`${SITE}/hakkimizda`))?.status()).toBe(200);
  await home.close();
  const { data } = await service!.from('site_configs').select('published_version').eq('organization_id', S.orgId!).single();
  expect(data!.published_version).toBe(3);
});

test('TEST-SITE-05: özellik bayrağı (WhatsApp kapalı) ve bakım modu anında uygulanır', async ({ page, context }) => {
  await loginPlatform(page);
  const withWa = await live(context, '/iletisim');
  expect(await withWa.page.locator('a[href*="wa.me"]').count()).toBeGreaterThan(0);
  await withWa.close();

  await page.goto(tab('ozellikler'));
  await page.getByRole('radiogroup', { name: 'WhatsApp' }).getByRole('radio', { name: 'Kapalı' }).click();
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByText('Özellikler güncellendi')).toBeVisible();
  const noWa = await live(context, '/iletisim');
  await expect(noWa.page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await noWa.close();

  // Bakım modu: ziyaretçi bilgi sayfası görür, platform paneli çalışır
  await page.goto(tab());
  await page.locator('#site-status').selectOption('maintenance');
  await page.getByLabel('Ziyaretçiye gösterilecek mesaj').fill(`Bakım ${RUN}`);
  await page.getByRole('button', { name: 'Durumu kaydet' }).click();
  await expect(page.getByText('Site durumu güncellendi')).toBeVisible();
  const m = await live(context, '/ilanlar');
  await expect(m.page.getByRole('heading', { name: 'Sitemiz kısa bir bakımda' })).toBeVisible();
  await expect(m.page.getByText(`Bakım ${RUN}`)).toBeVisible();
  await expect(m.page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await m.close();
  await page.goto(tab());
  await expect(page.getByRole('heading', { level: 1, name: S.name })).toBeVisible();

  await page.locator('#site-status').selectOption('active');
  await page.getByRole('button', { name: 'Durumu kaydet' }).click();
  await expect(page.getByText('Site durumu güncellendi')).toBeVisible();
  const back = await live(context);
  await expect(back.page.getByRole('heading', { name: 'Sitemiz kısa bir bakımda' })).toHaveCount(0);
  await back.close();
});

test('TEST-SITE-06: marka ve logo (PNG, güvenli SVG) taslağa yüklenir, yayınlanınca canlıya geçer; zararlı SVG reddedilir', async ({ page, context }) => {
  await loginPlatform(page);
  await page.goto(tab('marka'));
  await page.getByLabel('Slogan').fill(`Slogan ${RUN}`);
  await saveDraft(page);

  const png = path.join(process.cwd(), 'public', 'og-default.png');
  await page.locator('#branding-logo').setInputFiles(png);
  await expect(page.getByText('Logo taslağa kaydedildi', { exact: false })).toBeVisible();
  await page.locator('#branding-logo_mobile').setInputFiles({
    name: 'amblem.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#1d3a6b"/></svg>'),
  });
  await expect(page.getByText('Mobil logo taslağa kaydedildi', { exact: false })).toBeVisible();
  await page.locator('#branding-favicon').setInputFiles({
    name: 'x.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  });
  await expect(page.getByRole('alert').filter({ hasText: /SVG/ })).toBeVisible();

  // Taslak: canlı ayar kaydı değişmedi, değişiklikler taslakta
  const before = await service!.from('organization_settings').select('tagline, logo_url').eq('organization_id', S.orgId!).single();
  expect(before.data!.tagline).not.toBe(`Slogan ${RUN}`);
  expect(before.data!.logo_url).toBeNull();
  const draft = await service!.from('site_configs').select('draft').eq('organization_id', S.orgId!).single();
  const brand = (draft.data!.draft as { brand: Record<string, string | null> }).brand;
  expect(brand.tagline).toBe(`Slogan ${RUN}`);
  expect(brand.logo_url).toMatch(new RegExp(`^organizations/${S.orgId}/branding/logo-[0-9a-f]+-\\d+x\\d+\\.png$`));
  expect(brand.logo_mobile_url).toMatch(/\.png$/);
  expect(brand.favicon_url).toBeUndefined();
  const live0 = await live(context);
  await expect(live0.page.getByText(`Slogan ${RUN}`)).toHaveCount(0);
  await live0.close();

  await publish(page, 'E2E marka');
  const { data } = await service!.from('organization_settings').select('tagline, logo_url, logo_mobile_url, favicon_url').eq('organization_id', S.orgId!).single();
  expect(data!.tagline).toBe(`Slogan ${RUN}`);
  expect(data!.logo_url).toBe(brand.logo_url);
  expect(data!.logo_mobile_url).toMatch(/\.png$/);
  expect(data!.favicon_url).toBeNull();

  const home = await live(context);
  await expect(home.page.getByText(`Slogan ${RUN}`).first()).toBeAttached();
  await home.close();
});

test('TEST-SITE-07: alan adı eklenir ve kaldırılır', async ({ page }) => {
  await loginPlatform(page);
  await page.goto(tab('alan-adi'));
  const host = `www.e2e-${RUN}.example.com`;
  await page.getByRole('textbox', { name: 'Alan adı' }).fill(host);
  await page.getByRole('button', { name: 'Alan adı ekle' }).click();
  await expect(page.getByText(host).first()).toBeVisible();
  await page.locator('li', { hasText: host }).getByRole('button', { name: 'Kaldır' }).click();
  await page.getByRole('button', { name: 'Kaldır', exact: true }).last().click();
  await expect(page.getByText(host)).toHaveCount(0);
});

test('TEST-SITE-08: önemli işlemler denetim kaydına yazılır ve Geçmiş sekmesinde görünür', async ({ page }) => {
  const { data } = await service!.from('audit_logs').select('action').eq('organization_id', S.orgId!);
  const actions = new Set((data ?? []).map((r) => r.action));
  for (const a of ['site.draft_saved', 'site.published', 'site.rolled_back', 'site.features_changed', 'site.status_changed', 'site.branding_uploaded']) {
    expect(actions.has(a), a).toBe(true);
  }
  await loginPlatform(page);
  await page.goto(tab('gecmis'));
  await expect(page.getByRole('heading', { name: 'Site işlem kaydı' })).toBeVisible();
  await expect(page.locator('ol').last().locator('li')).not.toHaveCount(0);
});

test('TEST-SITE-09: kiracı kullanıcısı Site Kontrol Merkezi’ne ve site_* işlemlerine erişemez', async ({ page }) => {
  const c = S.userClient!;
  // Sunucu (RLS + assert_super_admin): taslak yazma, yayın, durum, bayrak, geri alma reddedilir
  expect((await c.rpc('site_save_draft', { p_org: S.orgId!, p_section: 'theme', p_value: 'atlas' })).error).not.toBeNull();
  expect((await c.rpc('site_publish', { p_org: S.orgId! })).error).not.toBeNull();
  expect((await c.rpc('site_set_status', { p_org: S.orgId!, p_status: 'maintenance' })).error).not.toBeNull();
  expect((await c.rpc('site_set_features', { p_org: S.orgId!, p_overrides: { crm: true } })).error).not.toBeNull();
  expect((await c.rpc('site_rollback', { p_org: S.orgId!, p_version: 1 })).error).not.toBeNull();
  expect((await c.rpc('platform_sites')).error).not.toBeNull();
  // Sürüm geçmişi yalnızca süper admin; doğrudan tablo yazımı yok
  expect((await c.from('site_config_revisions').select('version').eq('organization_id', S.orgId!)).data ?? []).toEqual([]);
  const upd = await c.from('site_configs').update({ site_status: 'maintenance' }).eq('organization_id', S.orgId!).select('organization_id');
  expect(upd.data ?? []).toEqual([]);
  // Başka kiracının (Elvankent) site kaydı okunamaz
  const others = await c.from('site_configs').select('organization_id').neq('organization_id', S.orgId!);
  expect(others.data ?? []).toEqual([]);

  // Arayüz: ofis oturumuyla platform ekranları 404
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(S.user!.email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
  for (const p of ['/platform/siteler', tab(), tab('tema'), tab('gecmis')]) {
    expect((await page.goto(p))?.status(), p).toBe(404);
  }
  const api = await page.request.post('/api/platform/branding', { multipart: { orgId: S.orgId!, kind: 'logo', file: { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') } }, headers: { origin: baseURL } });
  expect(api.status()).toBe(403);
});

test('TEST-SITE-10: ziyaretçi (anon) taslağı okuyamaz; yalnızca yayındaki sürüm açıktır', async ({ page }) => {
  const anon = createClient(url!, anonKey!, opts);
  expect((await anon.from('site_configs').select('draft')).data ?? []).toEqual([]);
  const pub = await anon.rpc('public_site_config', { p_org: S.orgId! });
  expect(pub.error).toBeNull();
  const row = (pub.data as Record<string, unknown>[])[0];
  expect(Object.keys(row)).not.toContain('draft');
  // Sahte önizleme belirteci taslağı açmaz
  const res = await page.goto(`${SITE}/api/site-preview?token=${S.orgId}.9999999999.deadbeef&to=/`);
  expect(res?.status()).toBe(403);
  const home = await page.goto(`${SITE}/`);
  expect(home?.status()).toBe(200);
  await expect(page.getByText('ÖNİZLEME', { exact: false })).toHaveCount(0);
});

test('TEST-SITE-11: telefonda (390 px) ana sayfa bölümleri sıralanır ve kaydedilir; yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginPlatform(page);
  await page.goto(tab('ana-sayfa'));
  await page.getByRole('button', { name: 'Bölgeler: yukarı taşı' }).click();
  await page.getByRole('button', { name: 'Blog / Rehber: gizle' }).click();
  await saveDraft(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const { data } = await service!.from('site_configs').select('draft').eq('organization_id', S.orgId!).single();
  const sections = (data!.draft as { home: { sections: { type: string; enabled: boolean }[] } }).home.sections;
  const blog = sections.find((s) => s.type === 'blog');
  expect(blog?.enabled).toBe(false);
});

test('TEST-SITE-12: header masaüstü/mobil ayarları yayınlanınca uygulanır', async ({ page, context }) => {
  await loginPlatform(page);
  await page.goto(tab('header'));
  await page.locator('#h-style').selectOption('dark');
  await page.getByRole('switch', { name: 'Favoriler simgesi' }).click();
  await saveDraft(page);
  await publish(page, 'E2E header');
  const home = await live(context);
  await expect(home.page.locator('[data-header-style="dark"]').first()).toBeAttached();
  await expect(home.page.locator('header a[href="/favoriler"]')).toHaveCount(0);
  await home.close();
});
