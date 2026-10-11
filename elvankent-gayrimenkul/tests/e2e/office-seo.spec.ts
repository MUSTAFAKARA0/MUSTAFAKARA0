import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * P0.3 — Site geneli SEO ve metadata taslağı: gerçek kiracılarda uçtan uca.
 *
 *  SEO-A  Taslak akışı: /admin/seo → başlık değişir → taslağa kaydedilir → taslak durumu görünür →
 *         canlı site eski başlığı gösterir → önizleme yenisini gösterir → yayın → canlı yenisini gösterir.
 *  SEO-B  Geri alma: SEO A yayınlanır → SEO B yayınlanır → A geri yüklenir → canlı A.
 *  SEO-C  OG: taslak paylaşım görseli canlıda yok, önizlemede var; yayından sonra canlıda var.
 *         /og: önizleme çerezi olmadan herkese açık (yayın) yanıt; önizleme yanıtı önbelleğe girmez.
 *  SEO-D  Önizleme güvenliği ve kiracı izolasyonu: sahte belirteç reddedilir; A'nın önizleme çerezi
 *         B'nin sitesinde B'nin taslağını açmaz; A'nın sayfaları B'nin taslak SEO'sunu asla göstermez.
 *  SEO-E  Editör (seo.manage): SEO taslağını yazar; yayınlayamaz (Site yönetimi kapalı).
 *
 * Geçici iki kiracı ve kullanıcılar test sonunda silinir. Yalnızca yerel DB.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });
test.skip(!url || !serviceKey, 'Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const HOST_A = `seo-a-${RUN}.e2e.test`;
const HOST_B = `seo-b-${RUN}.e2e.test`;
const SITE_A = `http://${HOST_A}:${PORT}`;
const SITE_B = `http://${HOST_B}:${PORT}`;
const PASSWORD = `Seo-${randomBytes(6).toString('hex')}-8k`;
const OLD_TITLE = `Eski SEO ${RUN}`;
const NEW_TITLE = `Yeni Nesil Gayrimenkul ${RUN}`;
const B_DRAFT = `B Taslak SEO ${RUN}`;
const ogFile = path.join(__dirname, '.fixtures', 'kabul-logo.png');

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST_A} 127.0.0.1, MAP ${HOST_B} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE_A},${SITE_B}`],
  },
});

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const S: { a?: string; b?: string; users: { id: string; email: string; org: 'a' | 'b'; role: string }[] } = { users: [] };

async function makeOrg(key: 'a' | 'b', host: string) {
  const org = await service!.from('organizations').insert({ slug: `seo-${key}-${RUN}`, name: `SEO Ofis ${key.toUpperCase()} ${RUN}`, reference_prefix: `S${key.toUpperCase()}${RUN.slice(0, 1).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' }).select('id').single();
  if (org.error) throw org.error;
  const id = org.data.id;
  await service!.from('organization_settings').insert({ organization_id: id, display_name: `SEO Ofis ${key.toUpperCase()} ${RUN}`, address_city: 'Ankara', service_area: 'Ankara' });
  await service!.from('subscriptions').insert({ organization_id: id, plan_id: 'kurumsal', status: 'active' });
  await service!.from('organization_domains').insert({ organization_id: id, hostname: host, is_primary: true, verified_at: new Date().toISOString(), status: 'active', activated_at: new Date().toISOString() });
  // Başlangıç yayını: canlı SEO başlığı (geriye uyum: seo bölümü)
  await service!.from('site_configs').update({ published: { seo: { title: OLD_TITLE } }, draft: { seo: { title: OLD_TITLE } } }).eq('organization_id', id);
  return id;
}

async function makeUser(org: 'a' | 'b', role: 'owner' | 'editor') {
  const email = `seo-${RUN}-${org}-${role}@example.test`;
  const { data, error } = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `SEO ${role}` } });
  if (error) throw error;
  S.users.push({ id: data.user.id, email, org, role });
  const m = await service!.from('organization_members').insert({ organization_id: org === 'a' ? S.a! : S.b!, user_id: data.user.id, role, status: 'active' });
  if (m.error) throw m.error;
}

const user = (org: 'a' | 'b', role: string) => S.users.find((u) => u.org === org && u.role === role)!.email;

test.beforeAll(async () => {
  S.a = await makeOrg('a', HOST_A);
  S.b = await makeOrg('b', HOST_B);
  await makeUser('a', 'owner');
  await makeUser('a', 'editor');
  await makeUser('b', 'owner');
});

test.afterAll(async () => {
  if (!service) return;
  for (const id of [S.a, S.b]) if (id) await service.from('organizations').delete().eq('id', id);
  for (const u of S.users) await service.auth.admin.deleteUser(u.id);
});

async function mapHttps(context: BrowserContext) {
  for (const [host, site] of [
    [HOST_A, SITE_A],
    [HOST_B, SITE_B],
  ]) {
    await context.route(new RegExp(`^https://${host.replace(/\./g, '\\.')}/`), (route) =>
      route.fulfill({ status: 302, headers: { location: route.request().url().replace(`https://${host}/`, `${site}/`) } }),
    );
  }
}

async function loginOffice(page: Page, email: string) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

async function saveSeo(page: Page, title: string) {
  await page.goto('/admin/seo');
  await page.getByLabel('Ana sayfa başlığı').fill(title);
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Kaydedildi — taslak', { exact: false }).first()).toBeVisible();
}

async function publish(page: Page, note: string) {
  await page.goto('/admin/site');
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByLabel('Sürüm notu').fill(note);
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible();
}

async function openPreview(page: Page): Promise<Page> {
  await page.goto('/admin/site');
  const [preview] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: 'Önizle' }).first().click()]);
  await preview.waitForURL(new RegExp(`^${SITE_A}/`));
  await preview.waitForLoadState('networkidle');
  return preview;
}

const meta = (p: Page, sel: string) => p.locator(sel).first().getAttribute('content');

/** Test alan adları yalnızca tarayıcıda çözülür: istek sayfanın içinden (çerezleriyle) yapılır */
async function fetchIn(p: Page, target: string): Promise<{ status: number; cache: string | null }> {
  return p.evaluate(async (u) => {
    const r = await fetch(u, { credentials: 'include', redirect: 'manual' });
    return { status: r.status, cache: r.headers.get('cache-control') };
  }, target);
}

test('SEO-A: SEO taslak → önizleme → yayın (canlı yalnızca yayından sonra değişir)', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await mapHttps(page.context());
  await loginOffice(page, user('a', 'owner'));
  await saveSeo(page, NEW_TITLE);
  // Taslak durumu: SEO ekranında ve Site yönetiminde
  await page.reload();
  await expect(page.getByTestId('site-status')).toContainText('Taslak değişiklikler var');
  await expect(page.getByTestId('seo-live-value').first()).toContainText(OLD_TITLE);
  await expect(page.getByRole('button', { name: 'Değişiklikleri yayınla' })).toHaveCount(0);
  await page.goto('/admin/site');
  await expect(page.getByTestId('site-status')).toContainText('SEO');

  // Canlı site eski başlık (önizleme çerezi olmayan ziyaretçi)
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  expect(await v.title()).toBe(OLD_TITLE);
  expect(await meta(v, 'meta[property="og:title"]')).toBe(OLD_TITLE);

  // Önizleme yeni başlık + noindex
  const preview = await openPreview(page);
  expect(await preview.title()).toBe(NEW_TITLE);
  expect(await meta(preview, 'meta[property="og:title"]')).toBe(NEW_TITLE);
  expect(await meta(preview, 'meta[name="robots"]')).toMatch(/noindex/);
  await preview.close();

  // Yayın → canlı yeni başlık
  await publish(page, 'SEO yeni');
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  expect(await v.title()).toBe(NEW_TITLE);
  expect(await meta(v, 'meta[property="og:title"]')).toBe(NEW_TITLE);
  await visitor.close();
});

test('SEO-B: geri alma SEO\'yu da geri getirir', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await mapHttps(page.context());
  await loginOffice(page, user('a', 'owner'));
  await saveSeo(page, `SEO-A ${RUN}`);
  await publish(page, 'SEO A');
  await saveSeo(page, `SEO-B ${RUN}`);
  await publish(page, 'SEO B');
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  expect(await v.title()).toBe(`SEO-B ${RUN}`);
  await page.goto('/admin/site/gecmis');
  const row = page.getByTestId('site-revisions').getByRole('listitem').filter({ hasText: 'SEO A' });
  await row.getByRole('button', { name: 'Geri yükle' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Geri yükle' }).click();
  await expect(page.getByText('geri yüklendi', { exact: false }).first()).toBeVisible();
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  expect(await v.title()).toBe(`SEO-A ${RUN}`);
  await visitor.close();
});

test('SEO-C: paylaşım görseli taslak → önizleme → yayın; /og önizleme önbelleğe girmez', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await mapHttps(page.context());
  await loginOffice(page, user('a', 'owner'));
  await page.goto('/admin/seo');
  // Paylaşım görseli en az 600×315 olmalı: test görseli bellekte üretilir (depoya ikili dosya eklenmez)
  const sharp = (await import('sharp')).default;
  const og = await sharp({ create: { width: 1200, height: 630, channels: 3, background: { r: 30, g: 70, b: 110 } } }).png().toBuffer();
  await page.locator('#branding-og').setInputFiles({ name: 'paylasim.png', mimeType: 'image/png', buffer: og });
  await expect(page.getByText('Paylaşım görseli taslağa kaydedildi', { exact: false })).toBeVisible({ timeout: 30_000 });
  const draftOg = ((await service!.from('site_configs').select('draft').eq('organization_id', S.a!).single()).data!.draft as { brand: { og_image_url: string } }).brand.og_image_url;
  expect(draftOg).toMatch(new RegExp(`^organizations/${S.a}/branding/og-`));
  expect((await service!.from('organization_settings').select('og_image_url').eq('organization_id', S.a!).single()).data!.og_image_url).toBeNull();

  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  const publicOg = (await meta(v, 'meta[property="og:image"]')) ?? '';
  expect(publicOg).not.toContain(path.basename(draftOg));
  expect(publicOg).toMatch(/\/og\?v=/);
  // Herkese açık /og: yayın yanıtı (paylaşılan önbelleğe uygun); sorgu parametresi taslak açmaz
  const pubRes = await fetchIn(v, `${SITE_A}/og?v=x&onizleme=1`);
  expect(pubRes.status).toBe(200);
  expect(pubRes.cache).toMatch(/public/);

  const preview = await openPreview(page);
  expect((await meta(preview, 'meta[property="og:image"]')) ?? '').toContain(path.basename(draftOg));
  // Önizleme çereziyle /og yanıtı önbelleğe alınmaz
  const prevRes = await fetchIn(preview, `${SITE_A}/og?v=x&onizleme=1`);
  expect(prevRes.status).toBe(200);
  expect(prevRes.cache).toBe('private, no-store');
  expect((await fetchIn(preview, `${SITE_A}/site-icon`)).cache).toBe('private, no-store');
  expect((await fetchIn(preview, `${SITE_A}/manifest.webmanifest`)).cache).toBe('private, no-store');
  await preview.close();

  await publish(page, 'Paylaşım görseli');
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  expect((await meta(v, 'meta[property="og:image"]')) ?? '').toContain(path.basename(draftOg));
  expect((await fetchIn(v, `${SITE_A}/manifest.webmanifest`)).cache).toMatch(/public/);
  await visitor.close();
});

test('SEO-D: önizleme güvenliği ve kiracı izolasyonu', async ({ page, browser }) => {
  test.setTimeout(180_000);
  // B'nin bekleyen SEO taslağı (B sahibi kendi panelinden)
  const bctx = await browser.newContext();
  const bp = await bctx.newPage();
  await mapHttps(bctx);
  await loginOffice(bp, user('b', 'owner'));
  await saveSeo(bp, B_DRAFT);
  await bctx.close();

  // Yetkisiz: sahte belirteç reddedilir; B'nin canlı sitesi taslağı göstermez
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  await ap.goto(`${SITE_B}/`, { waitUntil: 'networkidle' });
  const forged = await fetchIn(ap, `${SITE_B}/api/site-preview?token=${encodeURIComponent(`${S.b}.9999999999.sahte`)}&to=/`);
  expect(forged.status).toBe(403);
  await ap.goto(`${SITE_B}/`, { waitUntil: 'networkidle' });
  expect(await ap.title()).not.toContain(B_DRAFT);
  expect(await ap.content()).not.toContain(B_DRAFT);
  expect((await fetchIn(ap, `${SITE_B}/og?v=1&onizleme=1`)).cache).toMatch(/public/);
  await anon.close();

  // A'nın önizlemesi: A'nın taslağı; aynı tarayıcıda B'nin sitesi B'nin CANLI hâli (B taslağı asla)
  await mapHttps(page.context());
  await loginOffice(page, user('a', 'owner'));
  await saveSeo(page, `A Taslak ${RUN}`);
  const preview = await openPreview(page);
  expect(await preview.title()).toBe(`A Taslak ${RUN}`);
  await preview.goto(`${SITE_B}/`, { waitUntil: 'networkidle' });
  expect(await preview.title()).not.toContain(B_DRAFT);
  expect(await preview.content()).not.toContain(B_DRAFT);
  expect((await fetchIn(preview, `${SITE_B}/og?v=1&onizleme=1`)).cache).toMatch(/public/);
  // A'nın SEO ekranı B'nin taslağını içermez
  await page.goto(`/admin/seo?org=${S.b}`);
  expect(await page.content()).not.toContain(B_DRAFT);
  await preview.close();
});

test('SEO-E: editör SEO taslağını yazar ama yayınlayamaz', async ({ page }) => {
  await loginOffice(page, user('a', 'editor'));
  await saveSeo(page, `Editör SEO ${RUN}`);
  const draft = (await service!.from('site_configs').select('draft').eq('organization_id', S.a!).single()).data!.draft as { seo: { title: string } };
  expect(draft.seo.title).toBe(`Editör SEO ${RUN}`);
  await expect(page.getByText('Yayınlama yetkisi ofis yöneticisindedir', { exact: false })).toBeVisible();
  await page.goto('/admin/site');
  await expect(page).toHaveURL(/\/admin\/yetkisiz\?izin=settings\.manage/);
  // Marka görseli (logo) yükleyemez; paylaşım görseli yükleyebilir
  const logo = await page.request.post('/api/admin/branding', {
    multipart: { kind: 'logo', file: { name: 'logo.png', mimeType: 'image/png', buffer: readFileSync(ogFile) } },
    headers: { origin: baseURL },
  });
  expect(logo.status()).toBe(403);
});
