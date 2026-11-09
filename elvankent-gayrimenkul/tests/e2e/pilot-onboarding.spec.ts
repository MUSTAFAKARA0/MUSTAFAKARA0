import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';

/**
 * PILOT READY · Yeni ofisin ilk kurulumu (bekleyen migration I: supabase/pending/20261108000005_org_setup.sql).
 * pilot-journey.spec.ts ile aynı desen: sahte e-posta (Resend, 127.0.0.1:4010), yalnız sahte veri, sonda silinir.
 *
 *  PO-1  KARAY yeni ofisi açar → davet e-postası KENDİLİĞİNDEN doğru adrese gider ("e-posta sağlayıcısı tarafından kabul edildi"); kurulum
 *        bekler; KARAY ofisin seçebileceği aileleri daraltır (mevcut Site › Tema izin ekranı)
 *  PO-2  Aynı açılış tekrar gönderilirse ikinci davet / e-posta yok; konsolda "Daveti tekrar gönder" çalışır
 *  PO-3  Aktivasyon → ilk giriş /admin/kurulum; /admin de oraya yönlenir; yalnız izinli aileler (diğerleri HTML'de yok);
 *        seçim sunucuya kaydedilir, oturum kapanınca kalınan adımdan devam; masaüstü + telefon önizlemesi gerçek çerçevede
 *  PO-4  390 px: kurulum akışının her adımı yatay taşmaz
 *  PO-5  Onay: seçim DOĞRU ofise yazılır (yayın yapılandırması + önizleme), site ziyaretçiye kapalı kalır (taslak);
 *        aynı sunucu işleminin tekrarı reddedilir (setup_completed), yapılandırma değişmez
 *  PO-6  Sonraki girişte kurulum yok; eski kurulum adresi /admin'e döner; Tasarım sekmesi menüde yok, adres kilit
 *        bildirimi gösterir, aile önizlemesi kapalı
 *  PO-7  Kilit dışı düzenlemeler çalışır: şirket bilgisi (slogan), header, yayınla; tasarım değişmez
 *  PO-8  KARAY seçimi yeniden açar (denetim kaydı) → sahip tasarım adımına döner, başka aile seçer → yayında
 *  PO-9  E-posta sağlayıcısı hata verirse ofis açılmış kalır, konsol uyarır (data-status="failed"); "Davet gönder" ile
 *        yeniden gönderim çalışır ve tek e-posta gider
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const MAIL_PORT = 4010;

test.describe.configure({ mode: 'serial' });
test.skip(!adminEmail || !adminPassword || !url || !anonKey || !serviceKey, 'E2E_ADMIN_* ve Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');
test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'Kurulum yolculuğu yalnızca masaüstü projesinde koşar (telefon görünümü PO-4 içinde)');
});

const RUN = randomBytes(3).toString('hex');
const NAME = `Kurulum Ofisi ${RUN}`;
const SLUG = `kurulum-${RUN}`;
const PREFIX = [...randomBytes(5)].map((b) => String.fromCharCode(65 + (b % 26))).join('');
const OWNER = `kurulum-sahip-${RUN}@example.test`;
const PASSWORD = `Kurulum-${RUN}-Sifre9x`;
const ALLOWED = ['Klasik Güven', 'Sinematik Vitrin'];
const OTHERS = ['Editoryal Lüks', 'Kurumsal Portföy', 'Yalın Galeri', 'Doğal Yaşam'];
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const S: { orgId?: string; ownerLink?: string; version?: number; failOrgId?: string } = {};
// PO-9: davet gönderimi başarısız olan ikinci ofis
const FAIL_SLUG = `kurulum-hata-${RUN}`;
const FAIL_OWNER = `kurulum-hata-sahip-${RUN}@example.test`;
const FAIL_PREFIX = [...randomBytes(5)].map((b) => String.fromCharCode(65 + (b % 26))).join('');

type Mail = { to: string[]; subject: string; html: string; text: string };
const mails: Mail[] = [];
let mailServer: Server | null = null;
let mailFailing = false;
let failedRequests = 0;

test.beforeAll(async () => {
  mailServer = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      // PO-9: sağlayıcı hatası (5xx; uygulama yeniden dener, hepsi başarısız) — e-posta kabul edilmez
      if (mailFailing) {
        failedRequests += 1;
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: 'internal_server_error' }));
        return;
      }
      try {
        mails.push(JSON.parse(body || '{}') as Mail);
      } catch {
        // geçersiz gövde yok sayılır
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: `po-${mails.length}` }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    mailServer!.once('error', reject);
    mailServer!.listen(MAIL_PORT, '127.0.0.1', () => resolve());
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (mailServer ? mailServer.close(() => resolve()) : resolve()));
  if (!service) return;
  for (const id of [S.orgId, S.failOrgId]) if (id) await service.from('organizations').delete().eq('id', id);
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email === OWNER || u.email === FAIL_OWNER) await service.auth.admin.deleteUser(u.id);
});

// --- Yardımcılar (pilot-journey.spec.ts ile aynı) ---------------------------------------
async function freshContext(browser: Browser, extra: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
  return browser.newContext({
    ...test.info().project.use,
    ...extra,
    extraHTTPHeaders: { 'x-forwarded-for': `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}` },
  });
}

const mailsTo = (email: string, after: number) => mails.slice(after).filter((m) => m.to?.includes(email));

async function mailFor(email: string, after: number): Promise<string> {
  await expect.poll(() => mailsTo(email, after).length, { timeout: 20_000 }).toBeGreaterThan(0);
  const mail = mailsTo(email, after).at(-1)!;
  const link = /https?:\/\/[^\s"<>]+\/admin\/davet#t=[A-Za-z0-9_-]{43}/.exec(mail.text)?.[0];
  expect(link, 'e-postada aktivasyon bağlantısı').toBeTruthy();
  expect(mail.text).not.toMatch(/geçici şifre|şifreniz:/i);
  return link!;
}

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL(/\/platform$/);
}

async function loginOffice(page: Page, landing: '/admin' | '/admin/kurulum') {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(OWNER);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((u) => u.pathname === landing, { timeout: 30_000 });
}

const flow = (page: Page) => page.getByTestId('setup-flow');
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const setupRow = async () => (await service!.from('organization_setup').select('state, origin, step, selected_family').eq('organization_id', S.orgId!).single()).data!;
const siteRow = async () =>
  (await service!.from('site_configs').select('published, draft, published_version, site_status').eq('organization_id', S.orgId!).single()).data as {
    published: { theme?: string; style?: { origin?: { family?: string } } };
    draft: { theme?: string };
    published_version: number;
    site_status: string;
  };

async function next(page: Page, step: string) {
  await page.getByRole('button', { name: 'Devam' }).click();
  await expect(flow(page)).toHaveAttribute('data-step', step, { timeout: 15_000 });
}

// --- Yolculuk ------------------------------------------------------------------------
test('PO-1: yeni ofis açılır; davet kendiliğinden gider; kurulum bekler; izinli aileler daraltılır', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/organizasyonlar/yeni');
  await page.getByLabel('Organizasyon adı').fill(NAME);
  await page.getByLabel('Kısa ad (alt alan adı)').fill(SLUG);
  await page.getByLabel('İlan no öneki').fill(PREFIX);
  await page.getByLabel('Sahip adı soyadı').fill('Kurulum Sahibi');
  await page.getByLabel('Sahip e-postası').fill(OWNER);
  const before = mails.length;
  await page.getByRole('button', { name: 'Organizasyonu oluştur' }).click();
  await expect(page.getByText('Organizasyon oluşturuldu.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('initial-invitation')).toHaveAttribute('data-status', 'sent');
  await expect(page.getByTestId('initial-invitation')).toContainText('e-posta sağlayıcısı tarafından kabul edildi');
  await expect(page.getByTestId('initial-invitation')).not.toContainText('ulaştı');
  S.ownerLink = await mailFor(OWNER, before);
  // Yalnız sahibin adresine, tek e-posta
  expect(mails.slice(before)).toHaveLength(1);
  expect(mails[before].to).toEqual([OWNER]);

  const { data: org } = await service!.from('organizations').select('id').eq('slug', SLUG).single();
  S.orgId = org!.id;
  expect(await setupRow()).toMatchObject({ state: 'setup_pending', origin: 'onboarding', step: 0 });
  const { data: inv } = await service!.from('organization_invitations').select('status, last_sent_at').eq('organization_id', S.orgId!);
  expect(inv).toHaveLength(1);
  expect(inv![0].status).toBe('pending');
  expect(inv![0].last_sent_at).not.toBeNull();
  // Site taslak açılır (ziyaretçiye kapalı)
  expect((await siteRow()).site_status).toBe('draft');

  // KARAY: ofisin seçebileceği aileler (mevcut izin ekranı) — iki aile
  await page.goto(`/platform/siteler/${S.orgId}/tema`);
  const section = page.getByRole('region', { name: 'Ofisin seçebileceği tasarımlar' });
  const boxes = section.getByRole('checkbox');
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = boxes.nth(i);
    const label = await box.evaluate((el) => el.closest('label')?.textContent ?? '');
    await box.setChecked(ALLOWED.some((a) => label.includes(a)));
  }
  await section.getByRole('button', { name: 'İzinleri kaydet' }).click();
  await expect(page.getByText('Ofisin seçebileceği aileler güncellendi.')).toBeVisible();
  const { data: granted } = await service!.from('organization_design_families').select('family_id').eq('organization_id', S.orgId!);
  expect((granted ?? []).map((r) => r.family_id).sort()).toEqual(['klasik-guven', 'sinematik-vitrin']);

  // Konsolda kurulum durumu görünür
  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  await expect(page.getByTestId('org-setup')).toHaveAttribute('data-state', 'setup_pending');
});

test('PO-2: tekrar açılış yinelenen davet üretmez; konsoldan tekrar gönder çalışır', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/organizasyonlar/yeni');
  await page.getByLabel('Organizasyon adı').fill(NAME);
  await page.getByLabel('Kısa ad (alt alan adı)').fill(SLUG);
  await page.getByLabel('İlan no öneki').fill(PREFIX);
  await page.getByLabel('Sahip adı soyadı').fill('Kurulum Sahibi');
  await page.getByLabel('Sahip e-postası').fill(OWNER);
  const before = mails.length;
  await page.getByRole('button', { name: 'Organizasyonu oluştur' }).click();
  await expect(page.getByText('Bu kısa ad veya önek başka bir organizasyonda kullanılıyor.')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  expect(mailsTo(OWNER, before)).toHaveLength(0);
  const { data: inv } = await service!.from('organization_invitations').select('id').eq('organization_id', S.orgId!);
  expect(inv).toHaveLength(1);
  const { data: orgs } = await service!.from('organizations').select('id').eq('slug', SLUG);
  expect(orgs).toHaveLength(1);

  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  const card = page.getByTestId('owner-invitation');
  await expect(card).toContainText('e-posta sağlayıcısı tarafından kabul edildi');
  const resent = mails.length;
  await card.getByRole('button', { name: 'Daveti tekrar gönder' }).click();
  const link = await mailFor(OWNER, resent);
  expect(link).not.toBe(S.ownerLink);
  S.ownerLink = link;
});

test('PO-3: aktivasyon → ilk giriş kurulum akışı; yalnız izinli aileler; seçim kaydedilir ve devam edilir; önizleme', async ({ browser }) => {
  test.setTimeout(120_000);
  const scripts: string[] = [];
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    if (new URL(r.url()).pathname.endsWith('.js')) scripts.push(await r.text().catch(() => ''));
  });
  await page.goto(S.ownerLink!);
  await expect(page.getByTestId('activation-form')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Yeni şifre', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Yeni şifre (tekrar)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Hesabımı etkinleştir' }).click();
  await page.waitForURL((u) => u.pathname === '/admin/kurulum', { timeout: 30_000 });
  await expect(flow(page)).toHaveAttribute('data-step', 'welcome');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hoş geldiniz');
  // Panelin herhangi bir sayfası kuruluma yönlenir
  await page.goto('/admin/ilanlar');
  await expect(page).toHaveURL(/\/admin\/kurulum$/);

  await next(page, 'office');
  await expect(page.getByTestId('setup-office')).toContainText(NAME);
  await page.getByRole('button', { name: 'Geri' }).click();
  await expect(flow(page)).toHaveAttribute('data-step', 'welcome');
  await next(page, 'office');
  await next(page, 'design');
  expect((await setupRow()).state).toBe('theme_selection_pending');

  // Yalnız izinli iki aile; diğerlerinin adı sayfada da betiklerde de yok
  const radios = page.getByRole('radiogroup', { name: 'Tasarım aileleri' }).getByRole('radio');
  await expect(radios).toHaveCount(2);
  for (const name of ALLOWED) await expect(page.getByRole('radio', { name })).toBeVisible();
  const html = await page.content();
  for (const name of OTHERS) {
    expect(html, name).not.toMatch(new RegExp(`${name}(?! \\()`));
    expect(scripts.join('\n'), name).not.toMatch(new RegExp(`${name}(?! \\()`));
  }
  await page.getByRole('radio', { name: 'Sinematik Vitrin' }).click();
  await expect(page.getByRole('radio', { name: 'Sinematik Vitrin' })).toHaveAttribute('aria-checked', 'true');
  await next(page, 'preview');
  expect(await setupRow()).toMatchObject({ state: 'theme_selected', step: 3, selected_family: 'sinematik-vitrin' });
  await ctx.close();

  // Oturum kapanır; yeniden girişte kalınan adımdan ve seçimle devam (sunucu kaydı, tarayıcı belleği değil)
  const ctx2 = await freshContext(browser);
  const p2 = await ctx2.newPage();
  await loginOffice(p2, '/admin/kurulum');
  await expect(flow(p2)).toHaveAttribute('data-step', 'preview');
  // Gerçek önizleme çerçevesi (Site yönetimi › Tasarım önizlemesiyle aynı): masaüstü ve telefon
  const preview = p2.getByTestId('setup-preview');
  await expect(preview).toHaveAttribute('data-device', 'masaustu');
  await expect(p2.frameLocator('[data-testid="setup-preview"]').locator('[data-site-preview]')).toHaveAttribute('data-preview-family', 'sinematik-vitrin', { timeout: 30_000 });
  await p2.getByRole('button', { name: 'Telefon' }).click();
  await expect(preview).toHaveAttribute('data-device', 'mobil');
  expect(await preview.evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBeLessThanOrEqual(390);
  await expect(p2.frameLocator('[data-testid="setup-preview"]').locator('[data-site-preview]')).toHaveAttribute('data-preview-family', 'sinematik-vitrin', { timeout: 30_000 });
  // Geri: seçim korunur
  await p2.getByRole('button', { name: 'Geri' }).click();
  await expect(flow(p2)).toHaveAttribute('data-step', 'design');
  await expect(p2.getByRole('radio', { name: 'Sinematik Vitrin' })).toHaveAttribute('aria-checked', 'true');
  await next(p2, 'preview');
  await ctx2.close();
});

test('PO-4: 390 px telefonda kurulum akışı yatay taşmaz', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await freshContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await loginOffice(page, '/admin/kurulum');
  await expect(flow(page)).toHaveAttribute('data-step', 'preview');
  expect(await overflow(page), 'önizleme').toBeLessThanOrEqual(0);
  for (const step of ['design', 'office', 'welcome']) {
    await page.getByRole('button', { name: 'Geri' }).click();
    await expect(flow(page)).toHaveAttribute('data-step', step, { timeout: 15_000 });
    expect(await overflow(page), step).toBeLessThanOrEqual(0);
  }
  for (const step of ['office', 'design', 'preview', 'confirm']) {
    await next(page, step);
    expect(await overflow(page), step).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test('PO-5: onay seçimi doğru ofise yazar; site taslak kalır; sunucu işleminin tekrarı reddedilir', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await loginOffice(page, '/admin/kurulum');
  await expect(flow(page)).toHaveAttribute('data-step', 'confirm');
  await expect(page.getByTestId('setup-summary')).toContainText('Sinematik Vitrin');
  const { data: def } = await service!.from('organizations').select('id').eq('is_default', true).single();
  const defBefore = (await service!.from('site_configs').select('published_version').eq('organization_id', def!.id).single()).data!;
  const before = await siteRow();

  const [action] = await Promise.all([
    page.waitForRequest((r: Request) => r.method() === 'POST' && !!r.headers()['next-action']),
    page.getByRole('button', { name: 'Kurulumu tamamla' }).click(),
  ]);
  await page.waitForURL((u) => u.pathname === '/admin', { timeout: 30_000 });
  await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 15_000 });

  expect(await setupRow()).toMatchObject({ state: 'setup_completed', selected_family: 'sinematik-vitrin' });
  const after = await siteRow();
  expect(after.published.style?.origin?.family).toBe('sinematik-vitrin');
  expect(after.published.theme).toBe('rezidans');
  expect(after.published_version).toBe(before.published_version + 1);
  // Ziyaretçiye açma KARAY'ın teslim adımı: kurulum siteyi yayına açmaz
  expect(after.site_status).toBe('draft');
  // Başka ofis (varsayılan kiracı) etkilenmedi
  expect((await service!.from('site_configs').select('published_version').eq('organization_id', def!.id).single()).data!.published_version).toBe(defBefore.published_version);
  const { data: audit } = await service!.from('audit_logs').select('action').eq('organization_id', S.orgId!).eq('action', 'site.setup_completed');
  expect(audit).toHaveLength(1);
  S.version = after.published_version;

  // Önizleme çerçevesi seçilen tasarımı gösterir
  const pv = await ctx.newPage();
  await pv.goto('/site-onizleme/ofis?aile=sinematik-vitrin&s=ana-sayfa');
  await expect(pv.locator('[data-site-preview]')).toHaveAttribute('data-preview-family', 'sinematik-vitrin');
  await pv.close();

  // Aynı sunucu işlemi (ör. eski sekme / tekrar gönderim) yeniden oynatılır → reddedilir, yapılandırma değişmez
  const headers = action.headers();
  const replay = await page.request.fetch(action.url(), {
    method: 'POST',
    headers: {
      'next-action': headers['next-action'],
      'content-type': headers['content-type'] ?? 'text/plain;charset=UTF-8',
      accept: 'text/x-component',
      origin: new URL(baseURL).origin,
      ...(headers['next-router-state-tree'] ? { 'next-router-state-tree': headers['next-router-state-tree'] } : {}),
    },
    data: action.postDataBuffer() ?? undefined,
  });
  expect(await replay.text()).toContain('setup_completed');
  const replayed = await siteRow();
  expect(replayed.published_version).toBe(S.version);
  expect(replayed.published.style?.origin?.family).toBe('sinematik-vitrin');
  await ctx.close();
});

test('PO-6: sonraki girişte kurulum yok; eski adres döner; tasarım sekmesi kilitli', async ({ browser }) => {
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await loginOffice(page, '/admin');
  await page.goto('/admin/kurulum');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/site');
  await expect(page.getByRole('heading', { name: 'Site yönetimi', level: 1 })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Site ayarları' });
  await expect(tabs.getByRole('link', { name: 'Header' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Tasarım' })).toHaveCount(0);
  await page.goto('/admin/site/tasarim');
  await expect(page.getByTestId('design-locked')).toContainText('Sinematik Vitrin');
  await expect(page.getByRole('button', { name: 'Bu aileyi seç' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /temasını seç$/ })).toHaveCount(0);
  await page.goto('/admin/tasarim/onizleme?aile=klasik-guven');
  await expect(page).toHaveURL(/\/admin\/site\/tasarim$/);
  await ctx.close();
});

test('PO-7: kilit dışı düzenlemeler çalışır (şirket bilgisi, header, yayın); tasarım değişmez', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await loginOffice(page, '/admin');
  await page.goto('/admin/sirket');
  await page.getByLabel('Slogan').fill(`Kurulum sonrası ${RUN}`);
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
  await page.goto('/admin/site/header');
  await page.locator('#h-style').selectOption('dark');
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible({ timeout: 20_000 });
  const { data: settings } = await service!.from('organization_settings').select('tagline').eq('organization_id', S.orgId!).single();
  expect(settings!.tagline).toBe(`Kurulum sonrası ${RUN}`);
  const site = await siteRow();
  expect(site.published_version).toBe(S.version! + 1);
  expect(site.published.style?.origin?.family).toBe('sinematik-vitrin');
  expect(site.published.theme).toBe('rezidans');
  await ctx.close();
});

test('PO-8: KARAY seçimi yeniden açar (denetim kaydı); sahip yeniden seçer', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await loginPlatform(page);
  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  const card = page.getByTestId('org-setup');
  await expect(card).toHaveAttribute('data-state', 'setup_completed');
  await card.getByRole('button', { name: 'Tasarım seçimini yeniden aç' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yeniden aç' }).click();
  await expect(card).toHaveAttribute('data-state', 'reopened_by_platform', { timeout: 15_000 });
  const { data: audit } = await service!.from('audit_logs').select('action, actor_id').eq('organization_id', S.orgId!).eq('action', 'site.setup_reopened');
  expect(audit).toHaveLength(1);
  expect(audit![0].actor_id).not.toBeNull();

  const ctx = await freshContext(browser);
  const owner = await ctx.newPage();
  await loginOffice(owner, '/admin/kurulum');
  await expect(flow(owner)).toHaveAttribute('data-step', 'design');
  await owner.getByRole('radio', { name: 'Klasik Güven' }).click();
  await next(owner, 'preview');
  await next(owner, 'confirm');
  await owner.getByRole('button', { name: 'Kurulumu tamamla' }).click();
  await owner.waitForURL((u) => u.pathname === '/admin', { timeout: 30_000 });
  expect(await setupRow()).toMatchObject({ state: 'setup_completed', selected_family: 'klasik-guven' });
  expect((await siteRow()).published.style?.origin?.family).toBe('klasik-guven');
  await ctx.close();
});

test('PO-9: davet gönderilemezse ofis kalır, konsol uyarır; yeniden gönderim tek e-posta gönderir', async ({ page }) => {
  test.setTimeout(120_000);
  await loginPlatform(page);
  await page.goto('/platform/organizasyonlar/yeni');
  await page.getByLabel('Organizasyon adı').fill(`${NAME} Hata`);
  await page.getByLabel('Kısa ad (alt alan adı)').fill(FAIL_SLUG);
  await page.getByLabel('İlan no öneki').fill(FAIL_PREFIX);
  await page.getByLabel('Sahip adı soyadı').fill('Hata Sahibi');
  await page.getByLabel('Sahip e-postası').fill(FAIL_OWNER);
  const before = mails.length;
  mailFailing = true;
  try {
    await page.getByRole('button', { name: 'Organizasyonu oluştur' }).click();
    await expect(page.getByText('Organizasyon oluşturuldu.')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('initial-invitation')).toHaveAttribute('data-status', 'failed');
    await expect(page.getByTestId('initial-invitation')).toContainText('davet e-postası gönderilemedi');
  } finally {
    mailFailing = false;
  }
  expect(failedRequests).toBeGreaterThan(0);
  expect(mailsTo(FAIL_OWNER, before)).toHaveLength(0);

  // Ofis ve bekleyen davet duruyor (gönderilmedi işaretli)
  const { data: org } = await service!.from('organizations').select('id, status').eq('slug', FAIL_SLUG).single();
  S.failOrgId = org!.id;
  expect(org!.status).toBe('active');
  const { data: inv } = await service!.from('organization_invitations').select('status, last_sent_at').eq('organization_id', S.failOrgId!);
  expect(inv).toEqual([{ status: 'pending', last_sent_at: null }]);

  // Konsoldan yeniden gönder: tek e-posta, doğru adres, davet satırı tek
  const card = page.getByTestId('owner-invitation');
  await card.getByRole('button', { name: 'Davet gönder' }).click();
  await mailFor(FAIL_OWNER, before);
  await page.waitForTimeout(1_000);
  expect(mailsTo(FAIL_OWNER, before)).toHaveLength(1);
  const { data: after } = await service!.from('organization_invitations').select('status, last_sent_at').eq('organization_id', S.failOrgId!);
  expect(after).toHaveLength(1);
  expect(after![0].last_sent_at).not.toBeNull();
  await page.goto(`/platform/organizasyonlar/${S.failOrgId}`);
  await expect(page.getByTestId('owner-invitation')).toContainText('e-posta sağlayıcısı tarafından kabul edildi');
});
