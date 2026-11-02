import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

/**
 * KARAY şirket sayfası (/karay), KARAY talepleri ve 10 tema — KARAY-01…18; platform giriş logosu (KARAY-19);
 * KARAYS görsel paketi: paylaşım görseli ve simgeler (KARAY-20), maskotlar ve KARO animasyonu (KARAY-21…22).
 *
 *   KARAY (platform sahibi) ── /karay (kendi markası, kendi talep tablosu: platform_leads)
 *     ├─ Elvankent (varsayılan kiracı; görünümü DEĞİŞTİRİLMEZ, yalnızca okunur)
 *     └─ Kiracı B (geçici; kendi test alan adı ks-<run>.e2e.test)
 *
 * Elvankent'e süper admin olmayan geçici bir sahip (E) eklenir. Test sonunda B kiracısı,
 * geçici hesap, testte oluşan KARAY talebi silinir ve KARAY ayarları eski hâline döner.
 * Yalnızca yerel/demo veritabanı.
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
const HOST = `ks-${RUN}.e2e.test`;
const PORT = new URL(baseURL).port || '80';
const SITE_B = `http://${HOST}:${PORT}`;
const PASSWORD = `Ksite-${randomBytes(6).toString('hex')}-4b`;
const B_NAME = `E2E KARAY Kiracı ${RUN}`;
const LEAD_NAME = `E2E KARAY Aday ${RUN}`;
const LEAD_EMAIL = `aday-${RUN}@example.test`;
const TENANT_LEAD_NAME = `E2E Kiracı Müşterisi ${RUN}`;
const KARAY_MAIL = `iletisim-${RUN}@example.test`;
// Hız sınırı IP özetine göre çalışır; her koşu ayrı bir (belgelere ayrılmış) adres kullanır
const FAKE_IP = `198.51.100.${(parseInt(RUN.slice(0, 2), 16) % 250) + 1}`;

test.use({
  extraHTTPHeaders: { 'x-forwarded-for': FAKE_IP },
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE_B}`],
  },
});

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const S: {
  elvId?: string;
  elvName?: string;
  elvTheme?: string | null;
  bId?: string;
  e?: { id: string; email: string };
  eClient?: SupabaseClient;
  settings?: Record<string, unknown>;
} = {};

test.beforeAll(async () => {
  if (!service) return;
  const elv = await service.from('organizations').select('id, name').eq('is_default', true).single();
  if (elv.error) throw elv.error;
  S.elvId = elv.data.id;
  S.elvName = elv.data.name;
  const cfg = await service.from('site_configs').select('published').eq('organization_id', S.elvId).maybeSingle();
  S.elvTheme = ((cfg.data?.published as { theme?: string } | null)?.theme ?? null) || 'klasik';
  const st = await service.from('platform_settings').select('*').eq('id', true).single();
  if (st.error) throw st.error;
  S.settings = st.data;

  const org = await service
    .from('organizations')
    .insert({ slug: `e2eks-${RUN}`, name: B_NAME, reference_prefix: `Y${RUN.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' })
    .select('id')
    .single();
  if (org.error) throw org.error;
  S.bId = org.data.id;
  await service.from('organization_settings').insert({ organization_id: S.bId, display_name: B_NAME, primary_color: '#7a1f5c', accent_color: '#1f7a5c' });
  await service.from('subscriptions').insert({ organization_id: S.bId, plan_id: 'baslangic', status: 'active' });
  const dom = await service.from('organization_domains').insert({ organization_id: S.bId, hostname: HOST, is_primary: true, verified_at: new Date().toISOString(), status: 'active', activated_at: new Date().toISOString() });
  if (dom.error) throw dom.error;
  // B'nin kendi (kiracı) müşteri talebi: KARAY tarafında görünmemeli
  const customer = await service.from('customers').insert({ organization_id: S.bId, full_name: TENANT_LEAD_NAME, phone: '05320000000' }).select('id').single();
  if (customer.error) throw customer.error;
  const lead = await service.from('leads').insert({ organization_id: S.bId, customer_id: customer.data.id, status: 'new', source: 'website', intent: 'buy' });
  if (lead.error) throw lead.error;

  const email = `ksite-${RUN}@example.test`;
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
  if (S.settings) {
    // Kimlik ve denetim sütunları geri yazılmaz (KI-18: kullanılmayan değişken bırakmadan ayıklanır)
    const rest = Object.fromEntries(Object.entries(S.settings).filter(([key]) => !['id', 'updated_at', 'updated_by'].includes(key)));
    await service.from('platform_settings').update(rest).eq('id', true);
  }
  await service.from('platform_leads').delete().in('email', [LEAD_EMAIL]);
  if (S.bId) await service.from('organizations').delete().eq('id', S.bId);
  if (S.e) await service.auth.admin.deleteUser(S.e.id);
});

test.beforeEach(async ({ context }) => {
  await prepare(context);
});

async function prepare(context: BrowserContext) {
  await context.addInitScript(() => localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() })));
  await context.route(new RegExp(`^https://${HOST.replace(/\./g, '\\.')}/`), (route) =>
    route.fulfill({ status: 302, headers: { location: route.request().url().replace(`https://${HOST}/`, `${SITE_B}/`) } }),
  );
}

async function newContext(browser: Browser, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ ...test.info().project.use, viewport, extraHTTPHeaders: { 'x-forwarded-for': FAKE_IP } });
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

const tabB = (p = '') => `/platform/siteler/${S.bId}${p ? `/${p}` : ''}`;
const siteTheme = (page: Page) => page.locator('[data-site-theme]').first().getAttribute('data-site-theme');
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

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

/** Önizleme çerezi olmayan ayrı bağlamda bir sayfa */
async function open(browser: Browser, target: string, viewport?: { width: number; height: number }) {
  const ctx = await newContext(browser, viewport);
  const page = await ctx.newPage();
  const res = await page.goto(target);
  return { page, res, close: () => ctx.close() };
}

/** Sayfanın simgeleri (favicon, apple-touch) yönlendirmesiz görsel olarak sunulur */
async function expectIconsServed(page: Page) {
  const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  expect(icons.length).toBeGreaterThan(0);
  for (const href of icons) {
    const res = await page.request.get(href, { maxRedirects: 0 });
    expect(res.status(), href).toBe(200);
    expect(res.headers()['content-type'] ?? '', href).toMatch(/^image\//);
  }
}

async function scrollThrough(page: Page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) await page.evaluate((v) => window.scrollTo(0, v), y);
}

test('KARAY-01: KARAY şirket sayfası açılır (kendi header, menü, bölümler, footer)', async ({ page }) => {
  const res = await page.goto('/karay');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/KARAYS/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Emlak ofisinizin');
  const nav = page.getByRole('navigation', { name: 'KARAYS menüsü' });
  for (const name of ['Platform', 'Özellikler', 'Temalar', 'Nasıl çalışır?', 'Hakkımızda', 'İletişim']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  for (const id of ['platform', 'ozellikler', 'temalar', 'nasil-calisir', 'hakkimizda', 'iletisim']) await expect(page.locator(`#${id}`), id).toBeAttached();
  await expect(page.getByRole('contentinfo')).toContainText('KARAYS');
  // Gerçek ürün ekran görüntüleri, header/footer logoları ve simgeler oturumsuz ziyaretçide yüklenir
  // (kırık görsel yok; K-15: logolar /platform altındayken giriş sayfasına yönleniyordu)
  await scrollThrough(page);
  const broken = await page.locator('img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.alt));
  expect(broken).toEqual([]);
  await expectIconsServed(page);
  // Kiracı (Elvankent) markası ve demo bandı KARAY sayfasında yok
  await expect(page.locator('main')).not.toContainText(S.elvName!);
  await expect(page.locator('.demo-notice')).toBeHidden();
  // Sahte istatistik / yorum yok; iletişim bilgisi girilmediyse gösterilmez
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(S.settings!.contact_email ? 2 : 0);
});

test('KARAY-23: platform yüzeylerinde eski marka adı (KARAY) görünmez; metin, başlık, meta, JSON-LD ve erişilebilir adlar', async ({ page }) => {
  // KARAYS (ve ekleri: KARAYS'in) kabul; KARAY'ın / "KARAY " gibi eski ad reddedilir. Teknik adlar (/karay yolu) görünür metin değildir.
  for (const path of ['/karay', '/platform/giris']) {
    await page.goto(path);
    const texts = await page.evaluate(() => [
      document.title,
      document.body.innerText,
      ...[...document.querySelectorAll('meta[content]')].map((m) => m.getAttribute('content') ?? ''),
      ...[...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ''),
      ...[...document.querySelectorAll('[alt], [aria-label], [title]')].flatMap((e) => [e.getAttribute('alt'), e.getAttribute('aria-label'), e.getAttribute('title')]).filter((v): v is string => Boolean(v)),
    ]);
    const old = texts.flatMap((t) => t.match(/\bKARAY(?![A-Za-zÇĞİÖŞÜçğıöşü])[^\n]{0,30}/g) ?? []);
    expect(old, `${path}: eski marka adı`).toEqual([]);
  }
});

test('KARAY-02: KARAY sayfası indekslenebilir; demo kiracının noindex kuralı korunur', async ({ page, request }) => {
  const res = await request.get('/karay');
  expect(res.headers()['x-robots-tag'] ?? '').not.toContain('noindex');
  await page.goto('/karay');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/karay$|^https?:\/\/[^/]+\/?$/);
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  const sitemap = await request.get('/karay/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain('/karay');
  const robots = await request.get('/karay/robots.txt');
  expect(await robots.text()).toMatch(/Allow: \//);
  // Kiracı sayfaları: ortamın (demo) robots kuralı aynen devam eder; yasal taslaklar noindex
  const home = await request.get('/');
  const tenantRobots = home.headers()['x-robots-tag'] ?? '';
  if (process.env.SITE_ENV === 'demo') expect(tenantRobots).toContain('noindex');
  await page.goto('/karay/yasal/kvkk');
  await expect(page.getByText('TASLAK', { exact: false }).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('KARAY-03: iletişim formu doğrular ve talebi KARAY talep kaydına yazar', async ({ page }) => {
  await page.goto('/karay#demo');
  const form = page.locator('#iletisim form');
  await expect(form.getByLabel('Demo talep et')).toBeChecked();
  // Boş gönderim: doğrulama hataları
  await page.waitForTimeout(2600);
  await form.getByRole('button', { name: 'Demo talebini gönder' }).click();
  await expect(form.getByRole('alert').filter({ hasText: 'işaretli alanları' })).toBeVisible();
  await expect(form.getByText('Adınızı ve soyadınızı yazın.')).toBeVisible();

  await form.getByLabel('Ad soyad').fill(LEAD_NAME);
  await form.getByLabel('Emlak ofisi').fill('E2E Emlak');
  await form.getByLabel('E-posta').fill(LEAD_EMAIL);
  await form.getByLabel('Mesajınız').fill('E2E test talebi');
  await form.getByRole('checkbox').check();
  await page.waitForTimeout(2600);
  await form.getByRole('button', { name: 'Demo talebini gönder' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Demo talebiniz alındı' })).toBeVisible();

  const { data } = await service!.from('platform_leads').select('kind, full_name, company, kvkk_consent, ip_hash, status').eq('email', LEAD_EMAIL);
  expect(data).toHaveLength(1);
  expect(data![0]).toMatchObject({ kind: 'demo', full_name: LEAD_NAME, company: 'E2E Emlak', kvkk_consent: true, status: 'new' });
  expect(data![0].ip_hash).toBeTruthy();
  expect(data![0].ip_hash).not.toContain(FAKE_IP);
});

test('KARAY-04: KARAY talebi ile kiracı talebi birbirine karışmaz', async ({ page, browser }) => {
  // KARAY talebi hiçbir kiracının CRM'ine düşmez
  const tenantLeads = await service!.from('customers').select('id').eq('full_name', LEAD_NAME);
  expect(tenantLeads.data).toHaveLength(0);
  // Ofis sahibi KARAY taleplerini okuyamaz, güncelleyemez
  const read = await S.eClient!.from('platform_leads').select('id').eq('email', LEAD_EMAIL);
  expect(read.data ?? []).toHaveLength(0);
  const lead = await service!.from('platform_leads').select('id').eq('email', LEAD_EMAIL).single();
  const upd = await S.eClient!.rpc('platform_update_lead', { p_id: lead.data!.id, p_status: 'closed', p_note: 'x' });
  expect(upd.error).not.toBeNull();

  // KARAY talepleri ekranı: KARAY talebi var, kiracının müşteri talebi yok
  await loginPlatform(page);
  await page.goto('/platform/talepler');
  await expect(page.getByText(LEAD_NAME)).toBeVisible();
  await expect(page.getByText(TENANT_LEAD_NAME)).toHaveCount(0);
  // Durum güncellenir ve işlem kaydına yazılır
  const item = page.locator('li', { hasText: LEAD_NAME });
  await item.getByLabel('Durum').selectOption('contacted');
  await item.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('güncellendi', { exact: false }).first()).toBeVisible();
  const after = await service!.from('platform_leads').select('status, handled_by').eq('id', lead.data!.id).single();
  expect(after.data!.status).toBe('contacted');
  expect(after.data!.handled_by).toBeTruthy();

  // Elvankent ofis paneli KARAY talebini göstermez
  const ctx = await newContext(browser);
  const office = await ctx.newPage();
  await office.goto('/admin/giris');
  await office.getByLabel('E-posta').fill(S.e!.email);
  await office.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await office.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(office).not.toHaveURL(/\/giris/);
  await office.goto('/admin/talepler');
  await expect(office.getByText(LEAD_NAME)).toHaveCount(0);
  await ctx.close();
});

test('KARAY-05: 10 tema listelenir (Site Kontrol Merkezi ve KARAY sayfası)', async ({ page }) => {
  await loginPlatform(page);
  await page.goto(tabB('tema'));
  const select = page.getByRole('button', { name: /temasını seç$/ });
  await expect(select).toHaveCount(10);
  for (const name of ['Klasik', 'Marble', 'Atlas', 'Prestij', 'Kent', 'Yalın', 'Rezidans', 'Doğa', 'Dergi', 'Grafit']) {
    await expect(page.getByRole('button', { name: `${name} temasını seç` })).toBeVisible();
    await expect(page.getByRole('button', { name: `${name} temasını önizle` })).toBeVisible();
  }
  await page.goto('/karay#temalar');
  await expect(page.getByRole('radiogroup', { name: 'Tema seçin' }).getByRole('radio')).toHaveCount(10);
});

test('KARAY-06: tema önizlemesi gerçek tema motoruyla çizilir; temalar birbirinden farklıdır', async ({ page }) => {
  await loginPlatform(page);
  await page.goto(tabB('tema'));
  await page.getByRole('button', { name: 'Prestij temasını önizle' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const preview = dialog.locator('[data-site-theme]').first();
  await expect(preview).toHaveAttribute('data-site-theme', 'prestij');
  for (const text of ['Size uygun', 'İlan detayı', 'Değerleme talebi']) await expect(dialog.getByText(text, { exact: false }).first()).toBeVisible();
  const prestij = await preview.evaluate((el) => {
    const h = el.querySelector('h1, h2, h3') as HTMLElement;
    return { font: getComputedStyle(h).fontFamily, card: el.getAttribute('data-site-card'), image: el.getAttribute('data-site-image') };
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Kent temasını önizle' }).click();
  const kent = await page
    .getByRole('dialog')
    .locator('[data-site-theme]')
    .first()
    .evaluate((el) => {
      const h = el.querySelector('h1, h2, h3') as HTMLElement;
      return { theme: el.getAttribute('data-site-theme'), font: getComputedStyle(h).fontFamily, card: el.getAttribute('data-site-card'), image: el.getAttribute('data-site-image') };
    });
  expect(kent.theme).toBe('kent');
  expect([kent.font !== prestij.font, kent.card !== prestij.card, kent.image !== prestij.image].filter(Boolean).length).toBeGreaterThanOrEqual(2);
  // Önizleme diyaloğundan seçim yapılabilir
  await page.getByRole('dialog').getByRole('button', { name: 'Bu temayı seç' }).click();
  await expect(page.getByRole('button', { name: 'Kent temasını seç' })).toHaveAttribute('aria-pressed', 'true');

  // KARAY sayfasındaki tema vitrini
  await page.goto('/karay#temalar');
  await page.getByRole('radio', { name: /^Grafit/ }).click();
  await expect(page.locator('#temalar [data-site-theme]').first()).toHaveAttribute('data-site-theme', 'grafit');
});

test('KARAY-07: tema taslağa kaydedilir; canlı site değişmez', async ({ page, browser }) => {
  await loginPlatform(page);
  await page.goto(tabB('tema'));
  await page.getByRole('button', { name: 'Kent temasını seç' }).click();
  await saveDraft(page);
  const { data } = await service!.from('site_configs').select('draft, published').eq('organization_id', S.bId!).single();
  expect((data!.draft as { theme: string }).theme).toBe('kent');
  const live = await open(browser, `${SITE_B}/`);
  expect(live.res?.status()).toBe(200);
  expect(await siteTheme(live.page)).toBe('klasik');
  await live.close();
});

test('KARAY-08: tema yayınlanınca canlı siteye geçer', async ({ page, browser }) => {
  await loginPlatform(page);
  await publish(page, 'E2E tema Kent');
  const live = await open(browser, `${SITE_B}/`);
  expect(await siteTheme(live.page)).toBe('kent');
  await live.close();
});

test('KARAY-09: tema geri alınır (önceki sürüme dönülür)', async ({ page, browser }) => {
  await loginPlatform(page);
  await page.goto(tabB('tema'));
  await page.getByRole('button', { name: 'Dergi temasını seç' }).click();
  await saveDraft(page);
  await publish(page, 'E2E tema Dergi');
  let live = await open(browser, `${SITE_B}/`);
  expect(await siteTheme(live.page)).toBe('dergi');
  await live.close();

  await page.goto(tabB('gecmis'));
  await page.locator('li', { hasText: 'E2E tema Kent' }).getByRole('button', { name: 'Geri yükle' }).click();
  await page.getByRole('button', { name: 'Geri yükle', exact: true }).last().click();
  await expect(page.getByText('geri yüklendi', { exact: false }).first()).toBeVisible();
  live = await open(browser, `${SITE_B}/`);
  expect(await siteTheme(live.page)).toBe('kent');
  await live.close();
});

test('KARAY-10: kiracı B tema değişikliği Elvankent\'i etkilemez', async ({ browser }) => {
  const elv = await open(browser, '/');
  expect(await siteTheme(elv.page)).toBe(S.elvTheme);
  await elv.close();
  const { data } = await service!.from('site_configs').select('published').eq('organization_id', S.elvId!).maybeSingle();
  expect(((data?.published as { theme?: string } | null)?.theme ?? null) || 'klasik').toBe(S.elvTheme);
});

test('KARAY-11: kiracı markası KARAY markasını değiştirmez', async ({ browser }) => {
  const k = await open(browser, '/karay');
  await expect(k.page.getByRole('link', { name: 'KARAYS ana sayfa' })).toBeVisible();
  const html = await k.page.content();
  expect(html).not.toContain(B_NAME);
  expect(html.toLowerCase()).not.toContain('#7a1f5c');
  await expect(k.page.locator('main')).not.toContainText(S.elvName!);
  // KARAY sayfası kiracı tema kökünü kullanmaz (tema yalnızca vitrindeki önizlemede)
  expect(await k.page.locator('body > [data-site-theme], [data-site-theme]:not(#temalar [data-site-theme])').count()).toBe(0);
  await k.close();
});

test('KARAY-12: KARAY marka/iletişim ayarı kiracı sitelerine sızmaz', async ({ page, browser }) => {
  await loginPlatform(page);
  await page.goto('/platform/ayarlar');
  await page.getByLabel('E-posta').fill(KARAY_MAIL);
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('kaydedildi', { exact: false }).first()).toBeVisible();

  const k = await open(browser, '/karay');
  await expect(k.page.locator(`a[href="mailto:${KARAY_MAIL}"]`).first()).toBeVisible();
  await k.close();
  for (const target of [`${SITE_B}/`, `${SITE_B}/iletisim`, '/', '/iletisim']) {
    const t = await open(browser, target);
    expect(t.res?.status(), target).toBe(200);
    expect(await t.page.content(), target).not.toContain(KARAY_MAIL);
    await t.close();
  }
  const b = await service!.from('organization_settings').select('email, display_name').eq('organization_id', S.bId!).single();
  expect(b.data!.email ?? '').not.toBe(KARAY_MAIL);
  expect(b.data!.display_name).toBe(B_NAME);

  // Eski hâline (arayüzden: önbellek etiketi de yenilenir)
  await page.getByLabel('E-posta').fill(String(S.settings!.contact_email ?? ''));
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('kaydedildi', { exact: false }).first()).toBeVisible();
  await expect.poll(async () => (await page.request.get('/karay')).text(), { timeout: 15000 }).not.toContain(KARAY_MAIL);
});

test('KARAY-13: KARAY sayfası telefonda çalışır (menü, form, taşma yok)', async ({ browser }) => {
  const m = await open(browser, '/karay', { width: 390, height: 844 });
  await expect(m.page.getByRole('heading', { level: 1 })).toBeVisible();
  await m.page.getByRole('button', { name: 'Menüyü aç' }).click();
  const menu = m.page.getByRole('navigation', { name: 'KARAYS mobil menü' });
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: 'İletişim' }).click();
  await expect(menu).toBeHidden();
  await expect(m.page.locator('#iletisim form')).toBeInViewport();
  await scrollThrough(m.page);
  expect(await overflow(m.page)).toBeLessThanOrEqual(0);
  // Dokunma hedefleri en az 44 px
  const small = await m.page.locator('#iletisim form button[type=submit], header button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  expect(small).toBe(0);
  await m.close();
});

for (const [id, width] of [
  ['KARAY-14', 320],
  ['KARAY-15', 360],
] as const) {
  test(`${id}: ${width} px genişlikte yatay taşma yok (KARAY sayfası, yasal metin, tema vitrini)`, async ({ browser }) => {
    for (const p of ['/karay', '/karay/yasal/kvkk']) {
      const m = await open(browser, p, { width, height: 740 });
      await scrollThrough(m.page);
      expect(await overflow(m.page), p).toBeLessThanOrEqual(0);
      if (p === '/karay') {
        await m.page.getByRole('radio', { name: /^Dergi/ }).click();
        expect(await overflow(m.page), 'tema vitrini').toBeLessThanOrEqual(0);
      }
      await m.close();
    }
  });
}

test('KARAY-16: KARAY rotası kiracı rotalarıyla karışmaz', async ({ browser, request }) => {
  // Kiracının kendi alan adında /karay yoktur (kiracı sitesine yeniden yazılır → 404)
  const b = await open(browser, `${SITE_B}/karay`);
  expect(b.res?.status()).toBe(404);
  await expect(b.page.getByRole('link', { name: 'KARAYS ana sayfa' })).toHaveCount(0);
  await b.close();
  const bLead = await open(browser, `${SITE_B}/karay/yasal/kvkk`);
  expect(bLead.res?.status()).toBe(404);
  await bLead.close();
  // Platform alanında /karay KARAY'dır; kiracı ana sayfası kiracıdır
  const k = await request.get('/karay');
  const karayHtml = await k.text();
  expect(karayHtml).not.toContain(S.elvName!);
  expect(karayHtml).not.toContain(B_NAME);
  const home = await open(browser, '/');
  await expect(home.page.getByRole('link', { name: 'KARAYS ana sayfa' })).toHaveCount(0);
  expect(await siteTheme(home.page)).toBe(S.elvTheme);
  await home.close();
  // Kiracı yolu /t/<slug>/karay dışarıdan açılamaz
  expect((await request.get(`/t/e2eks-${RUN}/karay`)).status()).toBe(404);
});

test('KARAY-17: kiracı kullanıcısı platforma (KARAY talepleri/ayarları dahil) erişemez', async ({ page }) => {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(S.e!.email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
  for (const p of ['/platform', '/platform/talepler', '/platform/ayarlar', `/platform/siteler/${S.bId}/tema`]) {
    // Ofis oturumuna platform alanı hiç yokmuş gibi davranır (404; varlığı da sızdırılmaz)
    const res = await page.goto(p);
    expect(res?.status(), p).toBe(404);
    await expect(page.getByText('KARAYS talepleri'), p).toHaveCount(0);
  }
  const settings = await S.eClient!.from('platform_settings').select('*');
  expect(settings.data ?? []).toHaveLength(0);
  const upd = await S.eClient!.from('platform_settings').update({ company_name: 'Hacked' }).eq('id', true).select('id');
  expect(upd.data ?? []).toHaveLength(0);
  const { data } = await service!.from('platform_settings').select('company_name').eq('id', true).single();
  expect(data!.company_name).toBe(S.settings!.company_name);
});

test('KARAY-18: platform kullanıcısı yetkisiz olarak kiracı verisine erişemez', async ({ page }) => {
  // Süper admin B'nin üyesi değildir: veritabanı B'nin müşteri/talep kayıtlarını vermez
  const admin = createClient(url!, anonKey!, opts);
  const signIn = await admin.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! });
  expect(signIn.error).toBeNull();
  const member = await service!.from('organization_members').select('user_id').eq('organization_id', S.bId!).eq('user_id', signIn.data.user!.id);
  expect(member.error).toBeNull();
  expect(member.data).toHaveLength(0);
  expect((await admin.from('leads').select('id').eq('organization_id', S.bId!)).data ?? []).toHaveLength(0);
  expect((await admin.from('customers').select('id').eq('organization_id', S.bId!)).data ?? []).toHaveLength(0);
  // Platform oturumu ofis paneline ve ofis API'sine girmez
  await loginPlatform(page);
  await page.goto('/admin/talepler');
  await expect(page).toHaveURL(/\/admin\/giris/);
  await expect(page.getByText(TENANT_LEAD_NAME)).toHaveCount(0);
  const api = await page.request.post('/api/admin/branding', { multipart: { kind: 'logo' } });
  expect(api.status()).toBeGreaterThanOrEqual(400);
  // KARAY talepleri ekranı kiracı talebini listelemez
  await page.goto('/platform/talepler?durum=tumu');
  await expect(page.getByText(TENANT_LEAD_NAME)).toHaveCount(0);
});

test('KARAY-19: platform giriş sayfasının logosu ve simgeleri oturumsuz ziyaretçide yüklenir', async ({ page }) => {
  // K-15: logo ve simgeler /platform altındayken proxy onları da konsol rotası sayıp girişe yönlendiriyordu
  await page.goto('/platform/giris');
  const logo = page.getByRole('img', { name: 'KARAYS', exact: true });
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0))).toBeGreaterThan(0);
  await expectIconsServed(page);
});

test('KARAY-20: paylaşım görseli, simgeler ve yapılandırılmış veri KARAYS paketinden; eski KARAY görselleri sunulmaz', async ({ page, request }) => {
  await page.goto('/karay');
  for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    expect(new URL((await page.locator(sel).getAttribute('content'))!).pathname, sel).toBe('/karay/og-karays.png');
  }
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  const og = await request.get('/karay/og-karays.png', { maxRedirects: 0 });
  expect(og.status()).toBe(200);
  expect(og.headers()['content-type']).toBe('image/png');
  const org = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t)).find((d) => d['@type'] === 'Organization');
  expect(new URL(org.logo).pathname).toBe('/brand/karays/karays-icon-512.png');
  // K-16 öncesi KARAY dosyaları kaldırıldı (yönlendirme veya yedek kopya yok)
  for (const old of ['/karay/og-karay.png', '/brand/karay/favicon.ico', '/brand/karay/karay-logo-yatay.svg', '/brand/karay/uygulama-ikonu-512.png']) {
    expect((await request.get(old, { maxRedirects: 0 })).status(), old).toBe(404);
  }
});

const loaded = (img: Locator) => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0));

test('KARAY-21: KARO ve yardımcı maskot platform yüzeylerinde, boyutları sabit ve dekoratif', async ({ page, browser }) => {
  // K-16: KARO /karay hero'sunda karşılar; yardımcı maskot gerçek destek kanalının (iletişim formu) yanında
  await page.goto('/karay');
  const karo = page.locator('[data-platform-brand="karo"]');
  const helper = page.locator('#iletisim [data-platform-brand="helper"]');
  await expect(karo).toHaveCount(1);
  for (const img of [karo, helper]) {
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('alt', '');
    await expect(img).toHaveAttribute('width', /^\d+$/);
    await expect(img).toHaveAttribute('height', /^\d+$/);
    await expect.poll(() => loaded(img)).toBeGreaterThan(0);
  }
  // Hero overflow-hidden: KARO hiçbir genişlikte bölümün sol kenarından taşmaz (kırpılmaz)
  const hero = page.locator('section[aria-labelledby="karay-hero"]');
  for (const width of [390, 640, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const [k, h] = [await karo.boundingBox(), await hero.boundingBox()];
    expect(k!.x, `${width} px`).toBeGreaterThanOrEqual(h!.x);
  }
  // Platform girişi: geniş ekranda KARO kartın yanında; dar ekranda gösterilmez
  await page.goto('/platform/giris');
  await expect(page.locator('[data-platform-brand="karo"]')).toBeVisible();
  const narrow = await newContext(browser, { width: 390, height: 844 });
  const np = await narrow.newPage();
  await np.goto(`${baseURL}/platform/giris`);
  await expect(np.getByRole('img', { name: 'KARAYS', exact: true })).toBeVisible();
  await expect(np.locator('[data-platform-brand="karo"]')).toBeHidden();
  await narrow.close();
  // Konsol: talep listesi boşken yardımcı maskot boş durumu açıklar, doluyken görünmez
  await loginPlatform(page);
  const { count } = await service!.from('platform_leads').select('id', { count: 'exact', head: true }).eq('status', 'closed');
  await page.goto('/platform/talepler?durum=kapali');
  await expect(page.locator('main [data-platform-brand="helper"]')).toHaveCount(count === 0 ? 1 : 0);
  if (count === 0) await expect(page.getByText('Bu filtrede talep yok')).toBeVisible();
});

test('KARAY-22: KARO animasyonu bir kez oynar; "hareketi azalt" ve dar ekranda indirilmez', async ({ browser }) => {
  const animatedRequests = (p: Page) => {
    const urls: string[] = [];
    p.on('request', (r) => {
      if (r.url().includes('KARO-hareketli')) urls.push(r.url());
    });
    return urls;
  };
  // Geniş ekran, hareket serbest: sayfa yüklendikten sonra hazır animasyon bir döngü oynar, sabit poza döner
  const wide = await browser.newContext({ ...test.info().project.use, viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  await prepare(wide);
  const wp = await wide.newPage();
  const wideRequests = animatedRequests(wp);
  await wp.goto(`${baseURL}/karay`);
  const karo = wp.locator('[data-platform-brand="karo"]');
  const shown = () => karo.evaluate((img: HTMLImageElement) => img.currentSrc);
  await expect(karo).toHaveAttribute('data-karo', 'animated', { timeout: 15_000 });
  expect(await shown()).toMatch(/KARO-hareketli\.[\w-]+\.webp$/);
  await expect(karo).toHaveAttribute('data-karo', 'still', { timeout: 6_000 });
  await expect.poll(shown).not.toContain('KARO-hareketli');
  // Tekrar oynamaz (otomatik hareket 5 saniyeyi geçmez); 4,2 MB'lık dosya bir kez indirilir
  await wp.waitForTimeout(3_500);
  await expect(karo).toHaveAttribute('data-karo', 'still');
  expect(wideRequests).toHaveLength(1);
  await wide.close();

  // "Hareketi azalt" ve dar ekran: sabit poz kalır, animasyon dosyası hiç istenmez
  for (const [name, options] of [
    ['hareketi azalt', { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }],
    ['dar ekran', { viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' }],
  ] as const) {
    const ctx = await browser.newContext({ ...test.info().project.use, ...options });
    await prepare(ctx);
    const p = await ctx.newPage();
    const requests = animatedRequests(p);
    await p.goto(`${baseURL}/karay`, { waitUntil: 'load' });
    const k = p.locator('[data-platform-brand="karo"]');
    await k.scrollIntoViewIfNeeded();
    await expect.poll(() => loaded(k), name).toBeGreaterThan(0);
    await p.waitForTimeout(2_000);
    await expect(k, name).toHaveAttribute('data-karo', 'still');
    expect(await k.evaluate((img: HTMLImageElement) => img.currentSrc), name).not.toContain('KARO-hareketli');
    expect(requests, name).toEqual([]);
    await ctx.close();
  }
});
