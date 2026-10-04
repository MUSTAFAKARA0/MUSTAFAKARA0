import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * P0.1 — Ofis site yönetimi (/admin/site): gerçek bir kiracıda uçtan uca.
 *
 *  OFS-01  12 adım: /admin/site açılır → izinli aile görünür → tema görünür → header, footer ve
 *          menü değiştirilir → taslak kaydedilir → canlı site DEĞİŞMEZ → önizleme açılır → önizleme
 *          değişikliği gösterir → yayınlanır → canlı site değişikliği gösterir. Sürüm geçmişinden
 *          geri alınır.
 *  OFS-02  Kimlik manipülasyonu: başka kiracının site kimliği adreste/sorguda verilse de ofis yalnızca
 *          kendi sitesini görür; KARAY konsolu adresleri kiracıya kapalı; A'nın önizleme belirteci
 *          B'nin alan adında reddedilir; B'nin sahibi A'nın taslağını görmez.
 *  OFS-03  Yetkisiz rol (danışman) site yönetimini açamaz; menüde görünmez.
 *  OFS-04  Telefon genişliğinde site yönetimi sayfaları yatay taşmaz.
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
const HOST_A = `ofs-a-${RUN}.e2e.test`;
const HOST_B = `ofs-b-${RUN}.e2e.test`;
const SITE_A = `http://${HOST_A}:${PORT}`;
const SITE_B = `http://${HOST_B}:${PORT}`;
const PASSWORD = `Office-${randomBytes(6).toString('hex')}-9q`;
const MENU_LABEL = `Portföy ${RUN}`;
const COPYRIGHT = `Telif ofis ${RUN}`;

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: [`--host-resolver-rules=MAP ${HOST_A} 127.0.0.1, MAP ${HOST_B} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE_A},${SITE_B}`] } });

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const S: { a?: string; b?: string; users: { id: string; email: string; role: string; org: 'a' | 'b' }[] } = { users: [] };

async function makeOrg(key: 'a' | 'b', host: string) {
  const org = await service!.from('organizations').insert({ slug: `ofs-${key}-${RUN}`, name: `Ofis Site ${key.toUpperCase()} ${RUN}`, reference_prefix: `O${key.toUpperCase()}${RUN.slice(0, 1).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' }).select('id').single();
  if (org.error) throw org.error;
  const id = org.data.id;
  await service!.from('organization_settings').insert({ organization_id: id, display_name: `Ofis Site ${key.toUpperCase()} ${RUN}`, address_city: 'Ankara', service_area: 'Ankara' });
  await service!.from('subscriptions').insert({ organization_id: id, plan_id: 'kurumsal', status: 'active' });
  await service!.from('organization_domains').insert({ organization_id: id, hostname: host, is_primary: true, verified_at: new Date().toISOString() });
  return id;
}

async function makeMember(org: 'a' | 'b', role: 'owner' | 'agent') {
  const email = `ofs-${RUN}-${org}-${role}@example.test`;
  const { data, error } = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Ofis ${role}` } });
  if (error) throw error;
  S.users.push({ id: data.user.id, email, role, org });
  const m = await service!.from('organization_members').insert({ organization_id: org === 'a' ? S.a! : S.b!, user_id: data.user.id, role, status: 'active' });
  if (m.error) throw m.error;
}

const user = (org: 'a' | 'b', role: string) => S.users.find((u) => u.org === org && u.role === role)!.email;

test.beforeAll(async () => {
  S.a = await makeOrg('a', HOST_A);
  S.b = await makeOrg('b', HOST_B);
  await makeMember('a', 'owner');
  await makeMember('a', 'agent');
  await makeMember('b', 'owner');
  // KARAY bu ofise yalnızca Sinematik Vitrin'i açar (izin modeli değişmez)
  const g = await service!.from('organization_design_families').insert({ organization_id: S.a, family_id: 'sinematik-vitrin' });
  if (g.error) throw g.error;
  await service!.from('design_family_settings').delete().eq('family_id', 'sinematik-vitrin');
});

test.afterAll(async () => {
  if (!service) return;
  for (const id of [S.a, S.b]) if (id) await service.from('organizations').delete().eq('id', id);
  for (const u of S.users) await service.auth.admin.deleteUser(u.id);
});

async function loginOffice(page: Page, email: string) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

async function saveDraft(page: Page) {
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
}

/** Önizleme bağlantısı kiracının birincil alan adına (https://) gider; yerelde http://alan:port'a yönlenir */
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

async function livePage(context: BrowserContext, path = '/') {
  const p = await context.newPage();
  await p.goto(`${SITE_A}${path}`, { waitUntil: 'networkidle' });
  return p;
}

const siteRow = async (org: string) => (await service!.from('site_configs').select('draft, published, published_version, has_unpublished_changes').eq('organization_id', org).single()).data!;

test('OFS-01: ofis kendi sitesini taslak → önizleme → yayın akışıyla yönetir (12 adım)', async ({ page, browser }) => {
  test.setTimeout(240_000);
  await mapHttps(page.context());
  await loginOffice(page, user('a', 'owner'));
  const before = await siteRow(S.a!);

  // 1) /admin/site açılır: başlık, canlı/taslak durumu, Önizle ve Yayınla
  await page.goto('/admin/site');
  await expect(page.getByRole('heading', { name: 'Site yönetimi', level: 1 })).toBeVisible();
  await expect(page.getByTestId('site-status')).toContainText('Taslak canlı siteyle aynı');
  await expect(page.getByRole('button', { name: 'Önizle' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Değişiklikleri yayınla' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Site yönetimi' })).toBeVisible();

  // 2) Tasarım: izinli aile görünür, izinsizler görünmez
  await page.goto('/admin/site/tasarim');
  await expect(page.getByRole('heading', { level: 3, name: 'Sinematik Vitrin', exact: true })).toBeVisible();
  const html = await page.content();
  for (const other of ['Klasik Güven', 'Editoryal Lüks', 'Kurumsal Portföy', 'Yalın Galeri', 'Doğal Yaşam']) expect(html, other).not.toContain(other);

  // 3) Tema galerisi görünür
  await expect(page.getByRole('heading', { name: /Tema/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /temasını seç$/ }).first()).toBeVisible();

  // 4) Header değişikliği (koyu header)
  await page.goto('/admin/site/header');
  await page.locator('#h-style').selectOption('dark');
  await saveDraft(page);

  // 5) Footer değişikliği (telif yazısı)
  await page.goto('/admin/site/footer');
  await page.locator('#f-copy').fill(COPYRIGHT);
  await saveDraft(page);

  // 6) Menü değişikliği (ilk menü öğesinin yazısı)
  await page.goto('/admin/site/menu');
  await page.getByLabel('Menü yazısı').first().fill(MENU_LABEL);
  await saveDraft(page);

  // 7) Taslak kaydedildi: üst durum ve veritabanı
  await page.goto('/admin/site');
  await expect(page.getByTestId('site-status')).toContainText('Taslak değişiklikler var');
  await expect(page.getByTestId('site-status')).toContainText('Header');
  await expect(page.getByTestId('site-status')).toContainText('Footer');
  await expect(page.getByTestId('site-status')).toContainText('Menü');
  const drafted = await siteRow(S.a!);
  expect(drafted.has_unpublished_changes).toBe(true);
  expect(JSON.stringify(drafted.draft)).toContain(MENU_LABEL);
  expect(drafted.published).toEqual(before.published);
  expect(drafted.published_version).toBe(before.published_version);

  // 8) Canlı site DEĞİŞMEDİ
  const live1 = await livePage(page.context());
  await expect(live1.getByText(MENU_LABEL)).toHaveCount(0);
  await expect(live1.getByText(COPYRIGHT)).toHaveCount(0);
  await expect(live1.locator('[data-header-style="dark"]')).toHaveCount(0);
  await live1.close();

  // 9) Önizleme açılır (aynı Site Engine, taslak yapılandırma)
  const [preview] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: 'Önizle' }).click()]);
  await preview.waitForURL(new RegExp(`^${SITE_A}/`));
  await preview.waitForLoadState('networkidle');
  await expect(preview.getByText('ÖNİZLEME', { exact: false }).first()).toBeVisible();

  // 10) Önizleme değişikliği gösterir
  await expect(preview.getByRole('link', { name: MENU_LABEL }).first()).toBeVisible();
  await expect(preview.getByText(COPYRIGHT).first()).toBeVisible();
  await expect(preview.locator('[data-header-style="dark"]').first()).toBeAttached();
  await preview.close();

  // Önizleme çerezi olmayan ayrı bir ziyaretçi hâlâ canlıyı görür
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  await expect(v.getByText(MENU_LABEL)).toHaveCount(0);

  // 11) Yayınla
  await page.goto('/admin/site');
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByLabel('Sürüm notu').fill('Ofis E2E yayını');
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible();
  await expect(page.getByTestId('site-status')).toContainText('Taslak canlı siteyle aynı');
  const published = await siteRow(S.a!);
  expect(published.published_version).toBe(before.published_version + 1);

  // 12) Canlı site değişikliği gösterir (önizleme çerezi olmayan ziyaretçi)
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  await expect(v.getByRole('link', { name: MENU_LABEL }).first()).toBeVisible();
  await expect(v.getByText(COPYRIGHT).first()).toBeVisible();
  await expect(v.locator('[data-header-style="dark"]').first()).toBeAttached();

  // Geri alma: ikinci bir yayından sonra sürüm geçmişinden ilk ofis sürümü geri yüklenir
  const SECOND = `İkinci ${RUN}`;
  await page.goto('/admin/site/menu');
  await page.getByLabel('Menü yazısı').first().fill(SECOND);
  await saveDraft(page);
  await page.goto('/admin/site');
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible();
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  await expect(v.getByRole('link', { name: SECOND }).first()).toBeVisible();
  await page.goto('/admin/site/gecmis');
  const list = page.getByTestId('site-revisions');
  const first = list.getByRole('listitem').filter({ hasText: 'Ofis E2E yayını' });
  await first.getByRole('button', { name: 'Geri yükle' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Geri yükle' }).click();
  await expect(page.getByText('geri yüklendi', { exact: false }).first()).toBeVisible();
  expect((await siteRow(S.a!)).published_version).toBe(before.published_version + 3);
  await v.goto(`${SITE_A}/`, { waitUntil: 'networkidle' });
  await expect(v.getByRole('link', { name: MENU_LABEL }).first()).toBeVisible();
  await expect(v.getByText(SECOND)).toHaveCount(0);
  const audit = await service!.from('audit_logs').select('action, actor_id').eq('organization_id', S.a!).in('action', ['site.draft_saved', 'site.published']);
  const ownerId = S.users.find((u) => u.org === 'a' && u.role === 'owner')!.id;
  expect(audit.data?.some((x) => x.action === 'site.published' && x.actor_id === ownerId)).toBe(true);
  const rolled = await service!.from('audit_logs').select('actor_id').eq('organization_id', S.a!).eq('action', 'site.rolled_back');
  expect(rolled.data?.some((x) => x.actor_id === ownerId)).toBe(true);
  await visitor.close();
});

test('OFS-02: başka kiracı kimliği ile manipülasyon ve yetkisiz organizasyon erişimi reddedilir', async ({ page, browser }) => {
  // B'nin taslağına benzersiz bir menü yazısı (KARAY yerine servis anahtarıyla, yalnızca kurulum)
  const B_MENU = `B gizli ${RUN}`;
  await service!.from('site_configs').update({ draft: { navigation: [{ id: 'b1', label: B_MENU, href: '/ilanlar', visible: true, children: [] }] }, has_unpublished_changes: true }).eq('organization_id', S.b!);

  await mapHttps(page.context());
  await loginOffice(page, user('a', 'owner'));
  // Adreste / sorguda B'nin kimliği: ofis yine yalnızca kendi sitesini görür
  for (const path of [`/admin/site?org=${S.b}`, `/admin/site/menu?organization_id=${S.b}`, `/admin/site/gecmis?orgId=${S.b}`]) {
    await page.goto(path);
    await expect(page.getByText(B_MENU)).toHaveCount(0);
    // Sorgudaki kimlik yalnızca adres olarak yankılanır; B'nin verisi (adı, taslağı) sayfaya girmez
    const html = await page.content();
    expect(html).not.toContain(`Ofis Site B ${RUN}`);
    expect(html).not.toContain(B_MENU);
  }
  await page.goto(`/admin/site/menu?organization_id=${S.b}`);
  await expect(page.getByLabel('Menü yazısı').first()).toHaveValue(MENU_LABEL);
  // KARAY konsolu adresleri kiracı oturumuna kapalı (404 / platform girişi)
  const res = await page.goto(`/platform/siteler/${S.b}/menu`);
  expect([404, 200]).toContain(res?.status() ?? 0);
  await expect(page.getByText(B_MENU)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Taslağa kaydet' })).toHaveCount(0);

  // A'nın önizleme belirteci B'nin alan adında geçersiz (kiracı ↔ belirteç eşleşmesi sunucuda)
  await page.goto('/admin/site');
  const previewRequests: string[] = [];
  page.context().on('request', (r) => {
    if (r.url().includes('/api/site-preview?token=')) previewRequests.push(r.url());
  });
  const [popup] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: 'Önizle' }).click()]);
  await popup.waitForURL(new RegExp(`^${SITE_A}/`));
  await popup.close();
  expect(previewRequests.length).toBeGreaterThan(0);
  const stolen = new URL(previewRequests[0]);
  expect(stolen.hostname).toBe(HOST_A);
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const r = await p.goto(`${SITE_B}${stolen.pathname}${stolen.search}`);
  expect(r?.status()).toBe(403);
  await p.goto(`${SITE_B}/`, { waitUntil: 'networkidle' });
  await expect(p.getByText(B_MENU)).toHaveCount(0);
  await expect(p.getByText('ÖNİZLEME', { exact: false })).toHaveCount(0);
  await ctx.close();

  // B'nin sahibi kendi panelinde yalnızca kendi taslağını görür; A'nın yayınladığı değişiklikler yok
  const other = await browser.newContext();
  const bp = await other.newPage();
  await loginOffice(bp, user('b', 'owner'));
  await bp.goto('/admin/site/menu');
  await expect(bp.getByLabel('Menü yazısı').first()).toHaveValue(B_MENU);
  expect(await bp.content()).not.toContain(MENU_LABEL);
  await other.close();
  // B'nin canlı sitesi B'nin taslağını göstermez
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  await ap.goto(`${SITE_B}/`, { waitUntil: 'networkidle' });
  await expect(ap.getByText(B_MENU)).toHaveCount(0);
  await anon.close();
});

test('OFS-03: settings.manage yetkisi olmayan rol site yönetimini açamaz', async ({ page }) => {
  await loginOffice(page, user('a', 'agent'));
  for (const path of ['/admin/site', '/admin/site/menu', '/admin/site/gecmis', '/admin/site/alan-adi']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/yetkisiz\?izin=settings\.manage/);
  }
  await expect(page.getByRole('link', { name: 'Site yönetimi' })).toHaveCount(0);
});

test('OFS-04: telefon genişliğinde site yönetimi yatay taşmaz', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await loginOffice(page, user('a', 'owner'));
  for (const path of ['/admin/site', '/admin/site/tasarim', '/admin/site/header', '/admin/site/menu', '/admin/site/footer', '/admin/site/alan-adi', '/admin/site/gecmis']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await ctx.close();
});
