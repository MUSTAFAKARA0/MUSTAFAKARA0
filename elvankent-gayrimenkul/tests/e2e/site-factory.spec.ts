import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * SITE FACTORY — SF-01…07 (SITE-FACTORY-ISOLATION + DESIGN-ISOLATION).
 *
 * Geçici iki kiracı: A (gerçek ilanlarla; tasarım ailesi uygulanır) ve B (varsayılan görünüm).
 * Tarayıcı test alan adlarını yerel sunucuya yönlendirir. Elvankent'in görünümü ve verisi
 * DEĞİŞTİRİLMEZ; test sonunda kiracılar ve ilanlar silinir. Yalnızca yerel/demo veritabanı.
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
const PORT = new URL(baseURL).port || '80';
const HOST_A = `sfa-${RUN}.e2e.test`;
const HOST_B = `sfb-${RUN}.e2e.test`;
const SITE_A = `http://${HOST_A}:${PORT}`;
const SITE_B = `http://${HOST_B}:${PORT}`;

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST_A} 127.0.0.1, MAP ${HOST_B} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE_A},${SITE_B}`],
  },
});

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const letters = (n: number) => [...randomBytes(n)].map((b) => String.fromCharCode(65 + (b % 26))).join('');
const S: { a?: string; b?: string } = {};

/** Site Factory kataloğunun hiçbir parçası (aile adları/açıklamaları) müşteri sitesine gitmemeli */
const CATALOG_STRINGS = ['Sinematik Vitrin', 'Editoryal Lüks', 'Kurumsal Portföy', 'Yalın Galeri', 'Doğal Yaşam', 'Klasik Güven', 'Kenardan kenara fotoğraf', 'Dergi düzeni: asimetrik hero'];
const FAMILIES = ['Klasik Güven', 'Sinematik Vitrin', 'Editoryal Lüks', 'Kurumsal Portföy', 'Yalın Galeri', 'Doğal Yaşam'];

async function makeOrg(key: 'a' | 'b', host: string, withListings: boolean) {
  const org = await service!
    .from('organizations')
    .insert({ slug: `sf${key}-${RUN}`, name: `E2E Site Factory ${key.toUpperCase()} ${RUN}`, reference_prefix: `F${letters(3)}`, status: 'active' })
    .select('id')
    .single();
  if (org.error) throw org.error;
  const id = org.data.id;
  await service!.from('organization_settings').insert({ organization_id: id, display_name: `Örnek Ofis ${key.toUpperCase()}`, primary_color: '#2c4a3e', accent_color: '#b98a3e', phone: '+905550000000', whatsapp: '+905550000000', email: `ofis-${key}@example.test`, address_city: 'Ankara', address_district: 'Çankaya', service_area: 'Ankara' });
  await service!.from('subscriptions').insert({ organization_id: id, plan_id: 'kurumsal', status: 'active' });
  const dom = await service!.from('organization_domains').insert({ organization_id: id, hostname: host, is_primary: true, verified_at: new Date().toISOString(), status: 'active', activated_at: new Date().toISOString() });
  if (dom.error) throw dom.error;
  if (withListings) {
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const type = await anon.from('property_types').select('id').eq('slug', 'daire').single();
    const district = await anon.from('districts').select('id, city_id').limit(1).single();
    if (type.error || district.error) throw type.error ?? district.error;
    const photos = ['/demo/villa', '/demo/living-room', '/demo/apartment-facade', '/demo/house-garden'];
    for (const [i, photo] of photos.entries()) {
      const p = await service!
        .from('properties')
        .insert({
          organization_id: id,
          listing_type: i === 3 ? 'rent' : 'sale',
          property_type_id: type.data.id,
          category: 'konut',
          city_id: district.data.city_id,
          district_id: district.data.id,
          slug: '',
          reference_no: '',
          title: `Site Factory test ilanı ${i + 1}`,
          description: 'Bu ilan yalnızca otomatik tasarım testleri için oluşturulmuştur ve test sonunda silinir.',
          price: 4250000 + i * 500000,
          currency: 'TRY',
          room_count: 3,
          living_room_count: 1,
          gross_m2: 140 + i * 10,
          status: 'draft',
          is_featured: i === 0,
        })
        .select('id')
        .single();
      if (p.error) throw p.error;
      const m = await service!.from('media_assets').insert({ organization_id: id, property_id: p.data.id, kind: 'property_photo', status: 'ready', public_base: photo, variant_widths: [320, 640, 960, 1440, 1920], width: 1920, height: 1280, is_cover: true });
      if (m.error) throw m.error;
      const up = await service!.from('properties').update({ status: 'published' }).eq('id', p.data.id);
      if (up.error) throw up.error;
    }
  }
  if (key === 'b') {
    // Elle bozulmuş manifest (ör. veritabanına doğrudan yazılmış): bilinmeyen tema, CSS/bileşen
    // enjeksiyonu denemeleri. Site Engine bunları kapalı listelere karşı doğrular ve varsayılana düşer.
    const evil = "x'] {} body{display:none} [a='";
    const sc = await service!.from('site_configs').upsert({
      organization_id: id,
      published: { theme: '../../etc/passwd', style: { hero: '../hero-variants', cardLayout: evil, headerLayout: '<script>alert(1)</script>', motion: evil, card: evil } },
      published_version: 1,
    });
    if (sc.error) throw sc.error;
  }
  S[key] = id;
}

test.beforeAll(async () => {
  if (!service) return;
  await makeOrg('a', HOST_A, true);
  await makeOrg('b', HOST_B, false);
});

test.afterAll(async () => {
  if (!service) return;
  for (const id of [S.a, S.b]) if (id) await service.from('organizations').delete().eq('id', id);
});

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() })));
  for (const [host, site] of [
    [HOST_A, SITE_A],
    [HOST_B, SITE_B],
  ])
    await context.route(new RegExp(`^https://${host.replace(/\./g, '\\.')}/`), (route) =>
      route.fulfill({ status: 302, headers: { location: route.request().url().replace(`https://${host}/`, `${site}/`) } }),
    );
});

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
}

const tab = (p = '') => `/platform/siteler/${S.a}${p ? `/${p}` : ''}`;
const familyCard = (page: Page, name: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });

async function applyFamily(page: Page, name: string) {
  await page.goto(tab('tema'));
  const card = familyCard(page, name);
  await card.getByRole('button', { name: 'Bu aileyi seç' }).click();
  await card.getByRole('button', { name: 'Taslağa uygula' }).click();
  await expect(page.getByText('Tasarım ailesi taslağa uygulandı', { exact: false }).first()).toBeVisible();
  await expect(card.getByText('Taslakta')).toBeVisible();
}

async function openPreview(page: Page, context: BrowserContext) {
  await page.goto(tab());
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Önizle' }).first().click()]);
  await popup.waitForURL(new RegExp(`^${SITE_A}/`));
  await expect(popup.getByText('ÖNİZLEME', { exact: false }).first()).toBeVisible();
  await popup.waitForLoadState('networkidle');
  return popup;
}

/** Sayfanın taşıdığı tüm tasarım metni: HTML + satır içi stiller + yüklenen CSS/JS dosyaları */
async function runtimeText(page: Page): Promise<{ html: string; css: string; js: string }> {
  const html = await page.content();
  const css = await page.evaluate(() => [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n'));
  // İstemci kodu tarayıcının içinden okunur (test alan adları yalnızca tarayıcıda çözülür)
  const js = await page.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\/_next\/static\/.+\.js(\?|$)/.test(n));
    return (await Promise.all(urls.map((u) => fetch(u).then((r) => r.text())))).join('\n');
  });
  return { html, css, js };
}

const ids = (css: string, attr: string) => [...new Set([...css.matchAll(new RegExp(`data-site-${attr}="?'?([a-z]+)`, 'g'))].map((m) => m[1]))];

test('SF-01: Site Builder tasarım ailelerini gösterir; aile taslağa derlenir, canlı site değişmez', async ({ page, browser }) => {
  await loginPlatform(page);
  await page.goto(tab('tema'));
  await expect(page.getByRole('heading', { name: 'Tasarım aileleri' })).toBeVisible();
  for (const name of FAMILIES) await expect(familyCard(page, name)).toBeVisible();
  await applyFamily(page, 'Sinematik Vitrin');
  const { data } = await service!.from('site_configs').select('draft, published').eq('organization_id', S.a!).single();
  const draft = data!.draft as Record<string, { hero?: string; sections?: { type: string }[] }>;
  expect(draft.style.hero).toBe('cinematic');
  expect(draft.home.sections!.map((s) => s.type)).toEqual(['hero', 'stats', 'showcase', 'categories', 'spotlight', 'latest', 'owner_cta', 'contact']);
  expect((data!.published as Record<string, unknown>).style).toBeUndefined();
  // Canlı site (önizlemesiz ayrı bağlam) hâlâ varsayılan görünümde
  const ctx = await browser.newContext();
  const live = await ctx.newPage();
  await live.goto(`${SITE_A}/`);
  await expect(live.locator('[data-site-theme]').first()).toHaveAttribute('data-site-theme', 'klasik');
  await expect(live.locator('[data-site-motion]')).toHaveCount(0);
  await ctx.close();
});

test('SF-02: önizleme seçilen tasarım paketini çizer (yapısal varyantlar), yayınla canlıya geçer', async ({ page, context, browser }) => {
  await loginPlatform(page);
  const preview = await openPreview(page, context);
  const root = preview.locator('[data-site-theme]').first();
  await expect(root).toHaveAttribute('data-site-theme', 'rezidans');
  await expect(root).toHaveAttribute('data-site-header-layout', 'floating');
  await expect(root).toHaveAttribute('data-site-card-layout', 'overlay');
  await expect(root).toHaveAttribute('data-site-motion', 'subtle');
  await expect(preview.locator('.hero-media').first()).toBeVisible();
  // Gerçek veriden rakamlar (4 yayında ilan: 3 satılık, 1 kiralık) ve seçilmiş ilan bölümü
  const stats = preview.locator('section[aria-labelledby="rakamlar"]');
  await expect(stats).toBeVisible();
  await expect(stats.getByText('yayında ilan')).toBeVisible();
  await expect(stats.locator('dd').first()).toHaveText('4');
  await expect(preview.locator('section[aria-labelledby="secilmis-ilan"]')).toBeVisible();
  // Görsel üstü kart: künye fotoğrafla aynı ızgara hücresinde (üst üste); kartın tamamı
  // tıklanabilir kalır ve karşılaştır düğmesi gizlenmez
  const card = preview.locator('.listing-grid .property-card').first();
  await expect(card.locator('.pc-body')).toHaveCSS('grid-row-start', '1');
  await expect(card.getByRole('button', { name: /Karşılaştır/ })).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  await preview.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
  await preview.waitForURL(/\/ilan\//);
  await preview.close();

  await page.goto(tab());
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByLabel('Sürüm notu').fill('Site Factory: Sinematik Vitrin');
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible();
  const ctx = await browser.newContext();
  const live = await ctx.newPage();
  await live.goto(`${SITE_A}/`);
  await expect(live.locator('[data-site-theme]').first()).toHaveAttribute('data-site-theme', 'rezidans');
  await expect(live.locator('[data-site-header-layout="floating"]')).toHaveCount(1);
  await ctx.close();
});

test('SF-03 SITE-FACTORY-ISOLATION: yayındaki site yalnızca kendi tasarım paketini taşır; katalog runtime\'a gitmez', async ({ page }) => {
  await page.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  const { html, css, js } = await runtimeText(page);
  // Tema: yalnızca kendi teması; varyantlar: yalnızca seçilenler
  expect(ids(css, 'theme').filter((t) => t !== 'rezidans')).toEqual([]);
  expect(ids(css, 'card-layout')).toEqual(['overlay']);
  expect(ids(css, 'header-layout')).toEqual(['floating']);
  expect(ids(css, 'card').filter((v) => v !== 'bezel')).toEqual([]);
  // Site Factory kataloğu (aile adları/açıklamaları) ne HTML'de ne JS'te
  for (const s of CATALOG_STRINGS) {
    expect(html.includes(s), `HTML: ${s}`).toBe(false);
    expect(js.includes(s), `JS: ${s}`).toBe(false);
  }
  // Seçilmeyen hero düzenlerinin işaretlemesi/metni sayfada ve istemci kodunda yok
  for (const s of ['Görseldeki ilan', 'Vitrindeki ilan']) {
    expect(html.includes(s), s).toBe(false);
    expect(js.includes(s), s).toBe(false);
  }
});

test('SF-04 DESIGN-ISOLATION: A\'nın tasarımı B\'yi, Elvankent\'i ve KARAY platformunu değiştirmez', async ({ page }) => {
  await page.goto(`${SITE_B}/`, { waitUntil: 'networkidle' });
  const b = await runtimeText(page);
  await expect(page.locator('[data-site-theme]').first()).toHaveAttribute('data-site-theme', 'klasik');
  expect(ids(b.css, 'theme')).toEqual([]);
  expect(ids(b.css, 'card-layout')).toEqual([]);
  expect(b.css.includes('site-reveal')).toBe(false);
  await expect(page.locator('[data-site-motion]')).toHaveCount(0);

  await page.goto('/', { waitUntil: 'networkidle' });
  const elv = await runtimeText(page);
  expect(ids(elv.css, 'card-layout')).toEqual([]);
  expect(ids(elv.css, 'header-layout')).toEqual([]);
  expect(elv.css.includes('rezidans')).toBe(false);

  for (const p of ['/platform/giris', '/karay']) {
    await page.goto(p, { waitUntil: 'networkidle' });
    const k = await runtimeText(page);
    expect(ids(k.css, 'card-layout'), p).toEqual([]);
    expect(k.css.includes("data-site-theme='rezidans'"), p).toBe(false);
    await expect(page.locator('[data-site-theme]:not([data-live-preview])'), p).toHaveCount(0);
  }
});

test('SF-05 DESIGN-ISOLATION: KARAY platformunda kiracı yazı tipi, tema CSS\'i ve katalog yok', async ({ page }) => {
  await loginPlatform(page);
  for (const p of ['/platform', '/platform/siteler']) {
    await page.goto(p, { waitUntil: 'networkidle' });
    const families = await page.evaluate(() => [...document.fonts].map((f) => f.family).join('|'));
    expect(families, p).not.toMatch(/Manrope|Fraunces|Inter|Playfair|DM Sans|Lora|Cormorant|Space Grotesk|Outfit|Newsreader/);
    const { css } = await runtimeText(page);
    expect(ids(css, 'theme'), p).toEqual([]);
  }
});

test('SF-06: her tasarım ailesi önizlemede 320/360/390/430 px\'de yatay taşma yapmaz', async ({ page, context }) => {
  test.setTimeout(240_000);
  await loginPlatform(page);
  for (const name of FAMILIES) {
    await applyFamily(page, name);
    const preview = await openPreview(page, context);
    for (const w of [320, 360, 390, 430]) {
      await preview.setViewportSize({ width: w, height: 800 });
      await preview.waitForTimeout(150);
      const overflow = await preview.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${name} @ ${w}px`).toBeLessThanOrEqual(0);
    }
    await preview.close();
  }
});

test('SF-07: elle bozulmuş manifest (bilinmeyen tema, CSS/bileşen enjeksiyonu) güvenli varsayılana düşer', async ({ page }) => {
  await page.goto(`${SITE_B}/`, { waitUntil: 'networkidle' });
  const { html, css } = await runtimeText(page);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('[data-site-theme]').first()).toHaveAttribute('data-site-theme', 'klasik');
  await expect(page.locator('[data-site-card-layout]').first()).toHaveAttribute('data-site-card-layout', 'standard');
  expect(css).not.toMatch(/body\s*\{\s*display:\s*none/);
  for (const s of ['<script>alert(1)', 'passwd', 'hero-variants']) expect(html.includes(s), `HTML: ${s}`).toBe(false);
  // Doğrudan veritabanı fonksiyonu: süper admin olmayan oturum taslak yazamaz
  const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const res = await anon.rpc('site_save_draft', { p_org: S.a!, p_section: 'style', p_value: { hero: 'cinematic' } });
  expect(res.error).toBeTruthy();
});
