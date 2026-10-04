import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { PATTERN_REGISTRY } from '../../src/components/patterns/registry';
import { compileManifest } from '../../src/site-factory/manifest';
import { parseSiteConfig } from '../../src/site-config/schema';

/**
 * D7.3 TASARIM AİLELERİ uçtan uca (gerçek kiracılar, gerçek sayfa istekleri, production build).
 *
 *  FAM-01  Her aile (Luxury, Architectural, Map First) ve ailesiz (standart) kiracı: ana sayfa,
 *          arama/ilanlar ve ilan detayında YALNIZCA kendi desenleri çizilir (HTML işaretleri);
 *          indirilen JS'te başka ailenin interaktif desen kodu yoktur.
 *  FAM-02  Map First: liste ↔ harita (masaüstü yan yana, fiyat işaretleri, karta gelince vurgu;
 *          telefonda Liste/Harita geçişi, harita yalnızca istenince yüklenir).
 *  FAM-03  Önizleme eşliği: KARAY önizlemesi aynı manifestle aynı yüzeylerde aynı desenleri çizer.
 *  FAM-04  360 px'te yatay taşma yok (her aile × her yüzey).
 *  Ekran görüntüleri: SHOT_DIR tanımlıysa oraya (masaüstü + telefon).
 *
 * Geçici kiracılar ve test ilanları test sonunda silinir. Yalnızca yerel/demo veritabanı.
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR;

test.describe.configure({ mode: 'serial' });
test.skip(!adminEmail || !adminPassword || !url || !serviceKey, 'E2E_ADMIN_* ve Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const FAMILIES = ['luxury', 'architectural', 'map-first', null] as const;
type Fam = (typeof FAMILIES)[number];
const key = (f: Fam) => f ?? 'standart';
const SITES = FAMILIES.map((f, i) => ({ family: f, host: `fam${i}-${RUN}.e2e.test`, orgId: '', slug: '' }));
/** Ailenin beklenen yüzey desenleri (sayfa → işaretler) */
const EXPECT: Record<string, Record<'home' | 'list' | 'detail', string[]>> = {
  luxury: { home: ['hero/immersive'], list: ['listing/gallery-wide'], detail: ['property-detail/immersive', 'gallery/fullscreen'] },
  architectural: { home: ['hero/blueprint'], list: ['listing/ruled-index'], detail: ['property-detail/information-first', 'gallery/grid'] },
  'map-first': { home: ['hero/map-search'], list: ['search/map-first', 'listing/map-results'], detail: ['property-detail/map-first', 'gallery/carousel', 'map/map-first'] },
  standart: { home: [], list: [], detail: [] },
};
const INTERACTIVE = PATTERN_REGISTRY.filter((p) => p.interactive && p.kind !== 'interaction');

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=${SITES.map((s) => `MAP ${s.host} 127.0.0.1`).join(', ')}`],
  },
});

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const letters = (n: number) => [...randomBytes(n)].map((b) => String.fromCharCode(65 + (b % 26))).join('');
// Ankara merkezinde örnek test konumları (gerçek ilan değil; test sonunda silinir)
const SPOTS: [number, number, 'exact' | 'approximate'][] = [
  [39.9208, 32.8541, 'exact'],
  [39.9105, 32.8622, 'approximate'],
  [39.9031, 32.8397, 'exact'],
  [39.8913, 32.8558, 'exact'],
  [39.9334, 32.8712, 'approximate'],
  [39.9168, 32.8289, 'exact'],
];
const FOLDERS = ['villa', 'apartment-facade', 'living-room', 'house-garden', 'duplex-facade', 'kitchen'];

test.beforeAll(async () => {
  const type = await service!.from('property_types').select('id').eq('slug', 'daire').single();
  const district = await service!.from('districts').select('id, city_id').limit(1).single();
  if (type.error || district.error) throw type.error ?? district.error;
  for (const [i, s] of SITES.entries()) {
    const org = await service!.from('organizations').insert({ slug: `fam${i}-${RUN}`, name: `E2E Aile ${key(s.family)} ${RUN}`, reference_prefix: `F${letters(2)}`, status: 'active' }).select('id').single();
    if (org.error) throw org.error;
    s.orgId = org.data.id;
    await service!.from('organization_settings').insert({ organization_id: s.orgId, display_name: `Aile Testi ${key(s.family)}`, address_city: 'Ankara', address_district: 'Çankaya', service_area: 'Ankara' });
    await service!.from('subscriptions').insert({ organization_id: s.orgId, plan_id: 'kurumsal', status: 'active' });
    const dom = await service!.from('organization_domains').insert({ organization_id: s.orgId, hostname: s.host, is_primary: true, verified_at: new Date().toISOString() });
    if (dom.error) throw dom.error;
    const published = s.family ? compileManifest({ siteType: 'real-estate-office', designFamily: s.family, variants: {} }, parseSiteConfig({})).design : { theme: 'klasik' };
    const sc = await service!.from('site_configs').upsert({ organization_id: s.orgId, published, draft: published, published_version: 1 });
    if (sc.error) throw sc.error;
    for (const [n, [lat, lng, precision]] of SPOTS.entries()) {
      const prop = await service!
        .from('properties')
        .insert({
          organization_id: s.orgId,
          title: `Aile testi ilanı ${n + 1}`,
          description: 'Bu ilan yalnızca otomatik tasarım ailesi testleri için oluşturulur ve test sonunda silinir.',
          listing_type: n % 3 === 2 ? 'rent' : 'sale',
          category: 'konut',
          property_type_id: type.data.id,
          city_id: district.data.city_id,
          district_id: district.data.id,
          price: n % 3 === 2 ? 30000 + n * 1000 : 4_500_000 + n * 1_250_000,
          currency: 'TRY',
          room_count: 2 + (n % 3),
          living_room_count: 1,
          gross_m2: 110 + n * 20,
          status: 'draft',
          slug: '',
          reference_no: '',
        })
        .select('id, slug')
        .single();
      if (prop.error) throw prop.error;
      for (const [j, folder] of [FOLDERS[n], 'living-room', 'kitchen', 'bedroom'].entries()) {
        const m = await service!.from('media_assets').insert({ organization_id: s.orgId, property_id: prop.data.id, kind: 'property_photo', status: 'ready', public_base: `/demo/${folder}`, variant_widths: [320, 640, 960, 1440, 1920], width: 1920, height: 1280, sort_order: j, is_cover: j === 0 });
        if (m.error) throw m.error;
      }
      const loc = await service!.from('property_locations').upsert({ property_id: prop.data.id, latitude: lat, longitude: lng, precision });
      if (loc.error) throw loc.error;
      const pub = await service!.from('properties').update({ status: 'published' }).eq('id', prop.data.id).select('slug').single();
      if (pub.error) throw pub.error;
      if (n === 0) s.slug = pub.data.slug;
    }
  }
});

test.afterAll(async () => {
  for (const s of SITES) if (s.orgId) await service!.from('organizations').delete().eq('id', s.orgId);
});

const PAGES = (s: (typeof SITES)[number]) => ({ home: '/', list: '/ilanlar', detail: `/ilan/${s.slug}` });
const markersIn = (html: string) => [...new Set([...html.matchAll(/data-pattern="karay-pattern:([a-z-]+\/[a-z-]+)"/g)].map((m) => m[1]))].sort();

async function visit(page: Page, href: string, scripts?: string[]) {
  if (scripts) page.on('response', async (r) => void (new URL(r.url()).pathname.endsWith('.js') && scripts.push(await r.text().catch(() => ''))));
  const res = await page.goto(href, { waitUntil: 'networkidle' });
  expect(res?.status(), href).toBe(200);
  await page.waitForTimeout(400);
  return page.content();
}

async function shoot(browser: Browser, s: (typeof SITES)[number]) {
  if (!SHOT_DIR) return;
  mkdirSync(SHOT_DIR, { recursive: true });
  for (const [w, tag] of [[1440, 'd'], [390, 'm']] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 800, hasTouch: w < 800, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    for (const [name, path] of Object.entries(PAGES(s))) {
      await p.goto(`http://${s.host}:${PORT}${path}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${SHOT_DIR}/${key(s.family)}-${name}-${tag}.png`, fullPage: true });
    }
    await ctx.close();
  }
}

for (const s of SITES) {
  test(`FAM-01 (${key(s.family)}): yalnızca kendi yüzey desenleri; başka ailenin kodu inmez`, async ({ page, browser }) => {
    const scripts: string[] = [];
    const exp = EXPECT[key(s.family)];
    const all = new Set<string>();
    for (const [name, path] of Object.entries(PAGES(s)) as ['home' | 'list' | 'detail', string][]) {
      const html = await visit(page, `http://${s.host}:${PORT}${path}`, name === 'home' ? scripts : undefined);
      const found = markersIn(html);
      for (const m of exp[name]) expect(found, `${key(s.family)} ${name}`).toContain(m);
      found.forEach((m) => all.add(m));
    }
    const own = new Set(Object.values(exp).flat());
    expect([...all].filter((m) => !own.has(m)), 'başka desen çizildi').toEqual([]);
    const js = scripts.join('\n');
    for (const p of INTERACTIVE) expect(js.includes(p.marker!), `${p.kind}/${p.id} kodu`).toBe(own.has(`${p.kind}/${p.id}`));
    if (!s.family) expect(all.size).toBe(0);
    await shoot(browser, s);
  });
}

test('FAM-02: Map First liste ↔ harita (masaüstü yan yana, vurgu; telefonda geçiş)', async ({ browser }) => {
  const s = SITES.find((x) => x.family === 'map-first')!;
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await desk.newPage();
  await p.goto(`http://${s.host}:${PORT}/ilanlar`, { waitUntil: 'networkidle' });
  const root = p.locator('[data-pattern="karay-pattern:listing/map-results"]');
  await expect(root.getByRole('application', { name: 'İlanların haritası' })).toBeVisible();
  await expect(root.locator('.kp-pin')).toHaveCount(SPOTS.length);
  await expect(root.locator('.kp-pin-approx')).toHaveCount(SPOTS.filter((x) => x[2] !== 'exact').length);
  await root.locator('article').first().hover();
  await expect(root.locator('.kp-pin-active')).toHaveCount(1);
  // İlçe kısayolları (gerçek sayılarla)
  await expect(p.getByRole('navigation', { name: 'Bölgeler' })).toBeVisible();
  await desk.close();

  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await mob.newPage();
  const leaflet: string[] = [];
  m.on('request', (r) => r.url().includes('/api/tiles/') && leaflet.push(r.url()));
  await m.goto(`http://${s.host}:${PORT}/ilanlar`, { waitUntil: 'networkidle' });
  const mroot = m.locator('[data-pattern="karay-pattern:listing/map-results"]');
  await expect(mroot.getByRole('application')).toHaveCount(0);
  expect(leaflet.length, 'telefonda harita istenmeden döşeme indirildi').toBe(0);
  await mroot.getByRole('radio', { name: /Harita/ }).click();
  await expect(mroot.getByRole('application', { name: 'İlanların haritası' })).toBeVisible();
  await expect(mroot.locator('.kp-pin')).toHaveCount(SPOTS.length);
  await expect(mroot.getByRole('list', { name: 'Sonuçlar' })).toBeHidden();
  await mob.close();
});

test('FAM-03: önizleme eşliği — KARAY önizlemesi aynı manifestle aynı desenleri çizer', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  for (const s of SITES.filter((x) => x.family)) {
    const p = enc({ manifest: { siteType: 'real-estate-office', designFamily: s.family, variants: {} }, info: { siteName: 'Önizleme', address: { city: 'Ankara' }, social: {}, seo: {} } });
    for (const [surface, name] of [['ana-sayfa', 'home'], ['ilanlar', 'list'], ['ilan', 'detail']] as const) {
      const preview = markersIn(await visit(page, `/site-onizleme?p=${p}&s=${surface}`));
      const live = markersIn(await visit(page, `http://${s.host}:${PORT}${PAGES(s)[name]}`));
      // Örnek ilanların konumu yok → önizlemede harita yüzeyi (map/map-first) çizilmez; geri kalan aynı
      expect(preview, `${s.family} ${surface}`).toEqual(live.filter((x) => x !== 'map/map-first'));
    }
  }
});

test('FAM-04: her aile × her yüzey 360 px’te yatay taşma yapmaz', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const s of SITES) {
    for (const path of Object.values(PAGES(s))) {
      await page.goto(`http://${s.host}:${PORT}${path}`, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${key(s.family)} ${path}`).toBeLessThanOrEqual(0);
    }
  }
  await ctx.close();
});

test('FAM-05 (ölçüm): aile başına sayfa yükü — JS/CSS aktarılan bayt (SHOT_DIR tanımlıysa yazılır)', async ({ browser }) => {
  test.skip(!SHOT_DIR, 'yalnızca ölçüm çalıştırmasında');
  test.setTimeout(240_000);
  const rows: Record<string, Record<string, { js: number; css: number; leaflet: boolean }>> = {};
  for (const s of SITES) {
    rows[key(s.family)] = {};
    for (const [name, path] of Object.entries(PAGES(s))) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await ctx.newPage();
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      const types = new Map<string, string>();
      const urls = new Map<string, string>();
      const size = { Script: 0, Stylesheet: 0 };
      let leaflet = false;
      cdp.on('Network.responseReceived', (e) => {
        types.set(e.requestId, e.type);
        urls.set(e.requestId, e.response.url);
      });
      cdp.on('Network.loadingFinished', (e) => {
        const t = types.get(e.requestId) as keyof typeof size | undefined;
        if (t && t in size) size[t] += e.encodedDataLength;
      });
      await p.goto(`http://${s.host}:${PORT}${path}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(800);
      for (const u of urls.values()) if (u.includes('/api/tiles/')) leaflet = true;
      rows[key(s.family)][name] = { js: +(size.Script / 1024).toFixed(1), css: +(size.Stylesheet / 1024).toFixed(1), leaflet };
      await ctx.close();
    }
  }
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${SHOT_DIR}/bundle.json`, JSON.stringify(rows, null, 2));
});
