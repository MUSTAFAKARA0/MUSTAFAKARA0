import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * GERÇEK ÖNİZLEME (D7.2): ANA SAYFA + ARAMA + İLAN DETAYI, kiracı sitesinin aynı bileşenleriyle.
 *
 *  PV-01  KARAY önizlemesi (/site-onizleme?s=): üç yüzey; örnek içerik açıkça örnek; manifestin
 *         galeri seçimi ilan detayında aynı desenle çizilir; bilinmeyen yüzey ana sayfaya düşer.
 *  PV-02  Ofis önizlemesi (/admin/tasarim/onizleme): yalnızca izinli aileler; çerçeve ofisin
 *         KENDİ gerçek verisiyle (ilanı, adı) üç yüzeyi çizer; başka ofisin verisi yok.
 *  PV-03  Ofis önizlemesi yetki: izinsiz/bilinmeyen aile 404, settings.manage yoksa yetkisiz,
 *         oturumsuz giriş sayfası, KARAY (platform) oturumu ofis bağlamı alamaz; kiracı alan
 *         adında KARAY önizlemesi 404.
 *  PV-04  Önizleme hiçbir şey yayınlamaz/yazmaz (site_configs değişmez).
 *  PV-05  Önizleme yüzeyleri dar ekranda (360 px) yatay taşma yapmaz.
 *
 * Geçici kiracılar, kullanıcılar ve test ilanları test sonunda silinir. Yalnızca yerel DB.
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });
test.skip(!adminEmail || !adminPassword || !url || !serviceKey, 'E2E_ADMIN_* ve Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const HOST = `pv-${RUN}.e2e.test`;
const PASSWORD = `Preview-${randomBytes(6).toString('hex')}-7b`;
const OWN_TITLE = `Önizleme ofisi ilanı ${RUN}`;
const OTHER_TITLE = `Başka ofisin ilanı ${RUN}`;

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] } });

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const S: { orgs: string[]; users: { id: string; email: string }[] } = { orgs: [], users: [] };

async function makeOrg(key: string, title: string, families: string[]) {
  const org = await service!
    .from('organizations')
    .insert({ slug: `pv${key}-${RUN}`, name: `Önizleme ${key} ${RUN}`, reference_prefix: `V${key.toUpperCase()}${RUN.slice(0, 1).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' })
    .select('id')
    .single();
  if (org.error) throw org.error;
  const id = org.data.id;
  S.orgs.push(id);
  await service!.from('organization_settings').insert({ organization_id: id, display_name: `Önizleme Ofisi ${key} ${RUN}`, address_city: 'Ankara', service_area: 'Ankara' });
  await service!.from('subscriptions').insert({ organization_id: id, plan_id: 'kurumsal', status: 'active' });
  const published = { theme: 'klasik', colors: { mode: 'preset', preset: 'premium-gold', scheme: 'light' }, style: {} };
  const sc = await service!.from('site_configs').upsert({ organization_id: id, published, draft: published, published_version: 1 });
  if (sc.error) throw sc.error;
  if (families.length) {
    const g = await service!.from('organization_design_families').insert(families.map((family_id) => ({ organization_id: id, family_id })));
    if (g.error) throw g.error;
  }
  // Yayında bir ilan (uygulamanın demo görselleriyle) — önizleme gerçek veriyi göstermeli
  const type = await service!.from('property_types').select('id').eq('slug', 'daire').single();
  const district = await service!.from('districts').select('id, city_id').limit(1).single();
  const prop = await service!
    .from('properties')
    .insert({
      organization_id: id,
      title,
      description: 'Bu ilan yalnızca otomatik önizleme testleri için oluşturulur ve test sonunda silinir.',
      listing_type: 'sale',
      category: 'konut',
      property_type_id: type.data!.id,
      city_id: district.data!.city_id,
      district_id: district.data!.id,
      price: 2500000,
      currency: 'TRY',
      status: 'draft',
      slug: '',
      reference_no: '',
    })
    .select('id')
    .single();
  if (prop.error) throw prop.error;
  for (const [i, folder] of ['villa', 'living-room', 'kitchen'].entries()) {
    const m = await service!.from('media_assets').insert({ organization_id: id, property_id: prop.data.id, kind: 'property_photo', status: 'ready', public_base: `/demo/${folder}`, variant_widths: [320, 640, 960, 1440, 1920], width: 1920, height: 1280, sort_order: i, is_cover: i === 0 });
    if (m.error) throw m.error;
  }
  const pub = await service!.from('properties').update({ status: 'published' }).eq('id', prop.data.id);
  if (pub.error) throw pub.error;
  return id;
}

async function makeMember(orgId: string, role: 'owner' | 'agent') {
  const email = `pv-${RUN}-${role}@example.test`;
  const { data, error } = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Önizleme ${role}` } });
  if (error) throw error;
  S.users.push({ id: data.user.id, email });
  const m = await service!.from('organization_members').insert({ organization_id: orgId, user_id: data.user.id, role, status: 'active' });
  if (m.error) throw m.error;
  return email;
}

let OWNER = '';
let AGENT = '';
test.beforeAll(async () => {
  const own = await makeOrg('a', OWN_TITLE, ['sinematik-vitrin', 'klasik-guven']);
  await makeOrg('b', OTHER_TITLE, []);
  const dom = await service!.from('organization_domains').insert({ organization_id: own, hostname: HOST, is_primary: true, verified_at: new Date().toISOString(), status: 'active', activated_at: new Date().toISOString() });
  if (dom.error) throw dom.error;
  OWNER = await makeMember(own, 'owner');
  AGENT = await makeMember(own, 'agent');
});

test.afterAll(async () => {
  if (!service) return;
  for (const id of S.orgs) await service.from('organizations').delete().eq('id', id);
  for (const u of S.users) await service.auth.admin.deleteUser(u.id);
});

async function login(page: Page, area: 'admin' | 'platform', email: string, password: string) {
  await page.goto(`/${area}/giris`);
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const info = { siteName: 'Önizleme Örnek Emlak', address: { city: 'Ankara' }, social: {}, seo: {} };
const karay = (s: string, variants: Record<string, unknown> = {}) => `/site-onizleme?p=${enc({ manifest: { siteType: 'real-estate-office', designFamily: 'klasik-guven', variants }, info })}&s=${s}`;

test('PV-01: KARAY önizlemesi ana sayfa + arama + ilan detayını aynı bileşenlerle, örnek içerikle çizer', async ({ page }) => {
  await login(page, 'platform', adminEmail!, adminPassword!);
  await page.goto(karay('ilanlar'));
  const root = page.locator('[data-site-preview]');
  await expect(root).toHaveAttribute('data-preview-surface', 'ilanlar');
  await expect(page.getByRole('heading', { name: 'Tüm ilanlar', level: 1 })).toBeVisible();
  await expect(page.getByText('Örnek ilan · Havuzlu villa').first()).toBeVisible();
  await expect(page.getByText('Önizleme · örnek içerik')).toBeVisible();

  await page.goto(karay('ilan'));
  await expect(root).toHaveAttribute('data-preview-surface', 'ilan');
  await expect(page.getByRole('heading', { name: 'Örnek ilan · Havuzlu villa', level: 1 })).toBeVisible();
  await expect(page.getByText('Demo ilan:', { exact: false })).toBeVisible();
  await expect(root).toHaveAttribute('data-preview-patterns', /gallery:standard/);
  await expect(page.locator('[data-pattern^="karay-pattern:gallery/"]')).toHaveCount(0);

  // Manifestin galeri seçimi: önizleme = kiracı (aynı desen)
  await page.goto(karay('ilan', { gallery: 'carousel' }));
  await expect(root).toHaveAttribute('data-preview-patterns', /gallery:carousel/);
  await expect(page.locator('[data-pattern="karay-pattern:gallery/carousel"]')).toBeVisible();

  // Bilinmeyen yüzey → ana sayfa
  await page.goto(karay('<script>'));
  await expect(root).toHaveAttribute('data-preview-surface', 'ana-sayfa');
});

test('PV-02: ofis önizlemesi yalnızca izinli aileleri ve ofisin kendi gerçek verisini gösterir', async ({ page }) => {
  await login(page, 'admin', OWNER, PASSWORD);
  await page.goto('/admin/tasarim');
  await expect(page.getByRole('link', { name: 'Önizle' }).first()).toBeVisible();
  await page.goto('/admin/tasarim/onizleme?aile=sinematik-vitrin&s=ana-sayfa');
  const families = page.getByRole('navigation', { name: 'Tasarım' });
  await expect(families.getByRole('link')).toHaveText(['Klasik Güven', 'Sinematik Vitrin']);
  for (const other of ['Editoryal Lüks', 'Kurumsal Portföy', 'Yalın Galeri', 'Doğal Yaşam']) expect(await page.content()).not.toContain(other);

  const frame = page.frameLocator('iframe[title^="Sinematik Vitrin"]');
  await expect(frame.locator('[data-site-preview]')).toHaveAttribute('data-preview-family', 'sinematik-vitrin');
  await expect(frame.getByText(`Önizleme Ofisi a ${RUN}`).first()).toBeVisible();
  await expect(frame.getByText(OWN_TITLE).first()).toBeVisible();

  for (const s of ['ilanlar', 'ilan']) {
    await page.goto(`/admin/tasarim/onizleme?aile=sinematik-vitrin&s=${s}`);
    const f = page.frameLocator('iframe[title^="Sinematik Vitrin"]');
    await expect(f.locator('[data-site-preview]')).toHaveAttribute('data-preview-surface', s);
    await expect(f.getByText(OWN_TITLE).first()).toBeVisible();
    const html = await f.locator('html').innerHTML();
    expect(html).not.toContain(OTHER_TITLE);
    expect(html).not.toContain('Örnek ilan');
  }
  // Doğrudan çerçeve adresi de aynı yetkiyle açılır
  const r = await page.goto('/site-onizleme/ofis?aile=klasik-guven&s=ilan');
  expect(r?.status()).toBe(200);
  await expect(page.getByText('Önizleme · Klasik Güven · yayınlanmadı')).toBeVisible();
});

test('PV-03: ofis önizlemesi yetkisi (izinsiz aile, rol, oturum, KARAY oturumu, kiracı alan adı)', async ({ page, browser }) => {
  await login(page, 'admin', OWNER, PASSWORD);
  for (const bad of ['editoryal-luks', 'yok-boyle-aile', '']) {
    const r = await page.goto(`/site-onizleme/ofis?aile=${bad}&s=ana-sayfa`);
    expect(r?.status(), bad).toBe(404);
  }
  // Kiracı alan adında KARAY önizlemesi yok; ofis önizlemesi var
  expect((await page.goto(`http://${HOST}:${PORT}/site-onizleme?p=x`))?.status()).toBe(404);

  const agent = await browser.newPage();
  await login(agent, 'admin', AGENT, PASSWORD);
  await agent.goto('/site-onizleme/ofis?aile=sinematik-vitrin');
  await expect(agent).toHaveURL(/\/admin\/yetkisiz\?izin=settings\.manage/);
  await agent.goto('/admin/tasarim/onizleme');
  await expect(agent).toHaveURL(/\/admin\/yetkisiz\?izin=settings\.manage/);
  await agent.close();

  const anon = await browser.newPage();
  await anon.goto(`${baseURL}/site-onizleme/ofis?aile=sinematik-vitrin`);
  await expect(anon).toHaveURL(/\/admin\/giris/);
  await anon.close();

  // KARAY süper admini (platform oturumu) ofis bağlamı alamaz: hiçbir ofisin önizlemesini göremez
  const platform = await browser.newPage();
  await login(platform, 'platform', adminEmail!, adminPassword!);
  await platform.goto('/site-onizleme/ofis?aile=sinematik-vitrin');
  await expect(platform).toHaveURL(/\/admin\/giris/);
  await platform.close();
});

test('PV-04: önizleme hiçbir şey yayınlamaz veya yazmaz', async ({ page }) => {
  const before = (await service!.from('site_configs').select('published, draft, published_version').eq('organization_id', S.orgs[0]).single()).data;
  await login(page, 'admin', OWNER, PASSWORD);
  for (const s of ['ana-sayfa', 'ilanlar', 'ilan']) expect((await page.goto(`/site-onizleme/ofis?aile=sinematik-vitrin&s=${s}`))?.status()).toBe(200);
  const after = (await service!.from('site_configs').select('published, draft, published_version').eq('organization_id', S.orgs[0]).single()).data;
  expect(after).toEqual(before);
});

test('PV-05: önizleme yüzeyleri 360 px genişlikte yatay taşma yapmaz', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await login(page, 'platform', adminEmail!, adminPassword!);
  for (const s of ['ana-sayfa', 'ilanlar', 'ilan']) {
    for (const variants of [{}, { gallery: 'grid' }, { gallery: 'carousel' }]) {
      await page.goto(karay(s, variants), { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${s} ${JSON.stringify(variants)}`).toBeLessThanOrEqual(0);
    }
  }
  await ctx.close();
});
