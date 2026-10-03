import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Yüzey ayrımı (KARAY ↔ kiracı alan adı) — SURF-01…10.
 *
 * Kiracı (müşteri) alan adında yalnızca kiracı sitesi ve ofis paneli (/admin) vardır;
 * KARAY konsolu (/platform, /api/platform) ve KARAY sayfası (/karay) 404'tür ve KARAY
 * platform oturumu/çerezi oluşturulamaz. KARAY adreslerinde (burada localhost) konsol
 * ve KARAY sayfası çalışır.
 *
 * Geçici bir kiracı ve test alan adı (sf-<run>.e2e.test) oluşturulur, sonunda silinir.
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
const HOST = `sf-${RUN}.e2e.test`;
const PORT = Number(new URL(baseURL).port || '80');
const SITE = `http://${HOST}:${PORT}`;
const NAME = `E2E Yüzey Ofisi ${RUN}`;
const PASSWORD = `Surf-${randomBytes(6).toString('hex')}-3c`;

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE}`],
  },
});

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const S: { orgId?: string; user?: { id: string; email: string } } = {};

test.beforeAll(async () => {
  if (!service) return;
  const org = await service
    .from('organizations')
    .insert({ slug: `e2esf-${RUN}`, name: NAME, reference_prefix: `F${RUN.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' })
    .select('id')
    .single();
  if (org.error) throw org.error;
  S.orgId = org.data.id;
  await service.from('organization_settings').insert({ organization_id: S.orgId, display_name: NAME, primary_color: '#2c5f2d', accent_color: '#97bc62' });
  await service.from('subscriptions').insert({ organization_id: S.orgId, plan_id: 'baslangic', status: 'active' });
  const dom = await service.from('organization_domains').insert({ organization_id: S.orgId, hostname: HOST, is_primary: true, verified_at: new Date().toISOString() });
  if (dom.error) throw dom.error;
  const email = `surf-${RUN}@example.test`;
  const created = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Test Ofis Sahibi' } });
  if (created.error) throw created.error;
  S.user = { id: created.data.user.id, email };
  const m = await service.from('organization_members').insert({ organization_id: S.orgId, user_id: S.user.id, role: 'owner', status: 'active' });
  if (m.error) throw m.error;
});

test.afterAll(async () => {
  if (!service) return;
  if (S.orgId) await service.from('organizations').delete().eq('id', S.orgId);
  if (S.user) await service.auth.admin.deleteUser(S.user.id);
});

async function prepare(context: BrowserContext) {
  await context.addInitScript(() => localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() })));
  // Kiracının kanonik adresi https'tir; yerel test sunucusu http olduğundan yönlendirilir
  await context.route(new RegExp(`^https://${HOST.replace(/\./g, '\\.')}/`), (route) =>
    route.fulfill({ status: 302, headers: { location: route.request().url().replace(`https://${HOST}/`, `${SITE}/`) } }),
  );
}
test.beforeEach(async ({ context }) => prepare(context));

/** Ham HTTP isteği: Host başlığı serbestçe verilir (tarayıcı/fetch Host'u değiştiremez) */
function raw(host: string, path: string, init: { method?: string; headers?: Record<string, string>; body?: Buffer } = {}) {
  return new Promise<{ status: number; cookies: string[]; location?: string; body: string }>((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path, method: init.method ?? 'GET', headers: { Host: host, ...init.headers, ...(init.body ? { 'Content-Length': String(init.body.length) } : {}) } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, cookies: res.headers['set-cookie'] ?? [], location: res.headers.location, body }));
      },
    );
    req.on('error', reject);
    req.end(init.body);
  });
}

const tenantHost = () => `${HOST}:${PORT}`;
const PLATFORM_PATHS = ['/platform', '/platform/giris', '/platform/sifremi-unuttum', '/platform/talepler', '/platform/ayarlar', '/platform/organizasyonlar', '/platform/siteler'];

test('SURF-01: kiracı alan adında kiracı sitesi ve ofis paneli çalışır', async () => {
  for (const p of ['/', '/satilik', '/iletisim']) {
    const res = await raw(tenantHost(), p);
    expect(res.status, p).toBe(200);
    expect(res.body, p).toContain(NAME);
  }
  const admin = await raw(tenantHost(), '/admin');
  expect(admin.status).toBe(307);
  expect(admin.location).toMatch(/\/admin\/giris$/);
  const login = await raw(tenantHost(), '/admin/giris');
  expect(login.status).toBe(200);
  expect(login.body).not.toContain('Platform yönetimi');
});

test('SURF-02: kiracı alan adında KARAY konsolu, KARAY API ve KARAY sayfası 404; çerez yazılmaz', async () => {
  for (const p of [...PLATFORM_PATHS, '/karay', '/karay/yasal/kvkk', '/karay/sitemap.xml']) {
    const res = await raw(tenantHost(), p);
    expect(res.status, p).toBe(404);
    expect(res.cookies, p).toEqual([]);
    expect(res.body, p).not.toMatch(/KARAY|Platform yönetimi/);
  }
  const api = await raw(tenantHost(), '/api/platform/branding', { method: 'POST' });
  expect(api.status).toBe(404);
});

test('SURF-03: sahte başlıklarla (x-request-surface, x-forwarded-host) KARAY konsolu açılamaz', async () => {
  const spoofed: Record<string, string>[] = [{ 'x-request-surface': 'karay' }, { 'x-request-surface': 'shared' }, { 'x-forwarded-host': 'localhost' }, { 'x-tenant-key': 'localhost' }];
  for (const headers of spoofed) {
    const res = await raw(tenantHost(), '/platform/giris', { headers });
    expect(res.status, JSON.stringify(headers)).toBe(404);
  }
});

test('SURF-04: platform giriş işlemi kiracı alan adına gönderilse bile KARAY oturumu ve çerezi oluşmaz', async () => {
  // Gerçek platform giriş formunun gizli işlem alanları KARAY adresinden alınır
  const html = await (await raw(`localhost:${PORT}`, '/platform/giris')).body;
  const fields = [...html.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g)].map(([, n, v]) => [n, (v ?? '').replace(/&quot;/g, '"')] as const);
  expect(fields.some(([n]) => n.startsWith('$ACTION'))).toBe(true);
  expect(fields).toContainEqual(['scope', 'platform']);
  const form = new FormData();
  for (const [n, v] of fields) form.append(n, v);
  form.append('email', adminEmail!);
  form.append('password', adminPassword!);
  const encoded = new Response(form);
  const body = Buffer.from(await encoded.arrayBuffer());
  const contentType = encoded.headers.get('content-type')!;

  for (const path of ['/admin/giris', '/', '/iletisim']) {
    const res = await raw(tenantHost(), path, { method: 'POST', headers: { 'Content-Type': contentType }, body });
    expect(res.cookies.map((c) => c.split('=')[0]), path).toEqual([]);
    expect(res.location ?? '', path).not.toMatch(/\/platform/);
    // İşlem sunucuda reddedildi (giriş sayfasında form yanıtı görünür)
    if (path === '/admin/giris') expect(res.body).toContain('Bu adreste platform girişi yapılamaz.');
  }

  // Kontrol: aynı gönderim KARAY adresinde oturum açar (koruma yalnızca kiracı alan adında)
  const ok = await raw(`localhost:${PORT}`, '/platform/giris', { method: 'POST', headers: { 'Content-Type': contentType }, body });
  expect(ok.status).toBe(303);
  expect(ok.cookies.map((c) => c.split('=')[0])).toContain('eg_scope');
});

test('SURF-05: KARAY adresinde konsol ve KARAY sayfası çalışır', async () => {
  const host = `localhost:${PORT}`;
  const consoleRes = await raw(host, '/platform');
  expect(consoleRes.status).toBe(307);
  expect(consoleRes.location).toMatch(/\/platform\/giris$/);
  const login = await raw(host, '/platform/giris');
  expect(login.status).toBe(200);
  expect(login.body).toContain('Platform yönetimi');
  expect((await raw(host, '/karay')).status).toBe(200);
});

test('SURF-06: ofis sahibi kendi alan adında panele girer; orada KARAY konsolu yoktur', async ({ page }) => {
  await page.goto(`${SITE}/admin/giris`);
  await page.getByLabel('E-posta').fill(S.user!.email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(new RegExp(`^${SITE}/admin`));
  await expect(page.getByText(NAME).first()).toBeVisible();
  for (const p of ['/platform', '/platform/giris']) {
    const res = await page.goto(`${SITE}${p}`);
    expect(res?.status(), p).toBe(404);
  }
  const cookies = await page.context().cookies(SITE);
  expect(cookies.find((c) => c.name === 'eg_scope')?.value ?? '').not.toMatch(/^platform\./);
});

test('SURF-07: KARAY oturum çerezleri müşteri alan adına taşınsa bile konsol açılmaz', async ({ page, context }) => {
  await loginPlatform(page);
  const karayCookies = await context.cookies(baseURL);
  expect(karayCookies.find((c) => c.name === 'eg_scope')?.value).toMatch(/^platform\./);
  await context.addCookies(karayCookies.map(({ name, value }) => ({ name, value, domain: HOST, path: '/' })));
  for (const p of ['/platform', '/platform/talepler', '/platform/siteler']) {
    const res = await page.goto(`${SITE}${p}`);
    expect(res?.status(), p).toBe(404);
    await expect(page.getByText('Platform yönetimi')).toHaveCount(0);
  }
  // Aynı oturumla KARAY adresinde konsol çalışmaya devam eder
  await page.goto('/platform');
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible();
});

test('SURF-08: kiracı sitesi telefonda çalışır; KARAY bağlantısı yoktur', async ({ browser }) => {
  const ctx = await browser.newContext({ ...test.info().project.use, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await prepare(ctx);
  const page = await ctx.newPage();
  const res = await page.goto(`${SITE}/`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('banner').first()).toContainText(NAME);
  await expect(page.locator('a[href*="/platform"], a[href*="/karay"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await ctx.close();
});

test('SURF-10: dosya uzantısı hilesiyle (ör. /platform/x.png) proxy ve yüzey kontrolü atlatılamaz', async () => {
  for (const p of ['/platform/organizasyonlar/x.png', '/platform/giris.js', '/karay/yasal/x.png', '/karay/og-karay.png', '/api/platform/branding.css']) {
    for (const headers of [{}, { 'x-request-surface': 'karay' }] as Record<string, string>[]) {
      const res = await raw(tenantHost(), p, { headers });
      expect(res.status, `${p} ${JSON.stringify(headers)}`).toBe(404);
      expect(res.body, p).not.toMatch(/Platform yönetimi|KARAY ana sayfa/);
    }
  }
  // İç kiracı rotası uzantıyla da kapalı
  expect((await raw(tenantHost(), `/t/e2esf-${RUN}/x.png`)).status).toBe(404);
  // KARAY adresinde KARAY görselleri sunulmaya devam eder
  expect((await raw(`localhost:${PORT}`, '/karay/og-karay.png')).status).toBe(200);
});

test('SURF-09: white-label — müşteri sitesinde ve ofis panelinde başka müşterinin adı görünmez', async ({ page }) => {
  const { data: other } = await service!.from('organizations').select('name, slug').eq('is_default', true).single();
  const forbidden = [other!.name, other!.slug].filter((x) => x && x.length > 3);
  // Herkese açık site (iletişim formu örnek metinleri dahil)
  for (const p of ['/', '/iletisim', '/satilik', '/degerleme']) {
    const res = await raw(tenantHost(), p);
    for (const word of forbidden) expect(res.body.toLowerCase(), `${p}: ${word}`).not.toContain(word.toLowerCase());
  }
  // Ofis paneli (örnek metinler, ipuçları)
  await page.goto(`${SITE}/admin/giris`);
  await page.getByLabel('E-posta').fill(S.user!.email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(new RegExp(`^${SITE}/admin`));
  for (const p of ['/admin', '/admin/sirket', '/admin/ilanlar/yeni', '/admin/icerikler/yeni', '/admin/bolgeler/yeni', '/admin/seo']) {
    await page.goto(`${SITE}${p}`);
    const html = (await page.content()).toLowerCase();
    for (const word of forbidden) expect(html, `${p}: ${word}`).not.toContain(word.toLowerCase());
  }
});

/** Sayfadaki tema/yazı tipi varlıkları: tema CSS kuralı, yüklenen @font-face aileleri, ön yüklenen yazı tipleri */
async function surfaceAssets(page: Page) {
  return page.evaluate(() => {
    const families = new Map<string, string>();
    let themeRules = 0;
    const walk = (rules: CSSRuleList, s: CSSStyleSheet) => {
      for (const r of Array.from(rules)) {
        if (r instanceof CSSFontFaceRule) {
          const family = r.style.getPropertyValue('font-family').replace(/["']/g, '');
          for (const m of r.cssText.matchAll(/url\("?([^")]+)"?\)/g)) families.set(new URL(m[1], s.href ?? location.href).pathname, family);
        } else if ('selectorText' in r && /\[data-site-(card|button|theme)/.test((r as CSSStyleRule).selectorText)) themeRules++;
        if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules, s);
      }
    };
    for (const s of Array.from(document.styleSheets)) {
      try {
        walk(s.cssRules, s);
      } catch {}
    }
    const preloaded = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')).map((l) => families.get(new URL(l.href).pathname) ?? '?');
    const html = getComputedStyle(document.documentElement);
    return {
      themeRules,
      faces: [...new Set(families.values())],
      preloaded,
      catalogVars: ['--font-inter', '--font-playfair', '--font-lora', '--font-newsreader'].filter((v) => html.getPropertyValue(v).trim()),
      siteThemeOutsidePreview: document.querySelectorAll('[data-site-theme]:not([data-live-preview] [data-site-theme]):not([data-live-preview])').length,
    };
  });
}

test('SURF-11: kök layout ayrımı — KARAY ve ofis panelinde kiracı tema CSS\'i ve tema yazı tipleri yüklenmez', async ({ page }) => {
  const THEME_FONTS = /Manrope|Fraunces|Inter|Playfair|DM Sans|Lora|Cormorant|Space Grotesk|Outfit|Newsreader/;
  // KARAY platformu (giriş ve konsol): yalnızca Poppins
  await page.goto('/platform/giris');
  for (const where of ['giris', 'konsol']) {
    if (where === 'konsol') await loginPlatform(page);
    const a = await surfaceAssets(page);
    expect(a.themeRules, where).toBe(0);
    expect(a.catalogVars, where).toEqual([]);
    expect(a.siteThemeOutsidePreview, where).toBe(0);
    expect(a.faces.filter((f) => THEME_FONTS.test(f)), where).toEqual([]);
    expect(a.preloaded.length, where).toBeGreaterThan(0);
    for (const f of a.preloaded) expect(f, where).toMatch(/Poppins/);
  }
  // KARAY sayfası: tema vitrini önizlemesi tema CSS'ini yalnızca önizleme kapsayıcısında
  // kullanır; kiracı yazı tipleri önceden yüklenmez, sayfanın kendisi tema almaz
  await page.goto('/karay');
  const karay = await surfaceAssets(page);
  expect(karay.siteThemeOutsidePreview).toBe(0);
  expect(karay.catalogVars).toEqual([]);
  expect(karay.preloaded.length).toBeGreaterThan(0);
  for (const f of karay.preloaded) expect(f, 'karay').toMatch(/Poppins/);
  // Ofis paneli: temel yazı tipleri (Manrope, Fraunces) var; tema kataloğu ve tema CSS'i yok
  await page.goto(`${SITE}/admin/giris`);
  const office = await surfaceAssets(page);
  expect(office.themeRules).toBe(0);
  expect(office.catalogVars).toEqual([]);
  expect(office.faces.filter((f) => THEME_FONTS.test(f) && !/Manrope|Fraunces/.test(f))).toEqual([]);
  // Kiracı sitesi: yalnızca seçili tipografi paketi (FONT-ISOLATION) — Klasik için Fraunces + Manrope;
  // katalogdaki diğer yazı tiplerinin değişkenleri ve @font-face'leri yok. Tema sunum CSS'i global
  // değildir (Site Factory izolasyonu): varsayılan Klasik site için hiçbir tema/varyant kuralı yazılmaz.
  await page.goto(`${SITE}/`);
  const site = await surfaceAssets(page);
  expect(site.themeRules).toBe(0);
  expect(site.catalogVars).toEqual([]);
  expect(site.faces.filter((f) => THEME_FONTS.test(f) && !/^(Manrope|Fraunces)( Fallback)?$/.test(f))).toEqual([]);
  expect(site.siteThemeOutsidePreview).toBeGreaterThan(0);
});

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
}
