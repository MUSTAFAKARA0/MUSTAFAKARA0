import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * P0-9 — Pilot hazırlığı: tamamen YENİ bir emlak ofisi (varsayılan kiracı DEĞİL) kendi özel alan adında
 * günlük işini uçtan uca yürütebiliyor mu? Yalnızca sahte veri; sahte e-posta (Resend, 4010) ve sahte DNS (DoH, 4011)
 * sunucuları launch-lifecycle.spec.ts ile aynı desende kurulur (playwright.config: workers=1, fullyParallel=false →
 * spec dosyaları sırayla koşar, portlar çakışmaz).
 *
 *  PJ-1  KARAY yöneticisi konsoldan yeni ofisi açar → sahip daveti e-postası gider
 *  PJ-2  Sahip davet bağlantısıyla hesabı etkinleştirir, şifre belirler → /admin
 *  PJ-3  Özel alan adı bağlanır (TXT + CNAME) ve KARAY "Yayında" yapar → ofis sitesi kendi alan adında açılır
 *  PJ-4  Alan adı üzerinden sahip 2 fotoğraflı ilan oluşturup yayınlar → ilan sayfası ofis alan adında fotoğraflarıyla açılır
 *  PJ-5  Anonim ziyaretçi ilanda bilgi formu + randevu talebi gönderir → talep /admin/talepler, randevu /admin/randevular;
 *        iki kayıt da YENİ ofisin organization_id'sine bağlıdır (varsayılan kiracıya değil)
 *  PJ-6  Sahip 'agent' rolünde personel ekler → danışman davetle etkinleşir, alan adında girer, talebi görür,
 *        sahip-özel sayfaları (kullanıcılar, alan adı yönetimi) açamaz
 *  PJ-7  Mobil (390x844): panel (/admin, /admin/ilanlar, /admin/talepler) ve ofis sitesi (ana sayfa + ilan) yatay taşmaz
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const MAIL_PORT = 4010;
const DNS_PORT = 4011;
const TARGET_CNAME = 'sites.karay.test';

test.describe.configure({ mode: 'serial' });
test.skip(!adminEmail || !adminPassword || !url || !anonKey || !serviceKey, 'E2E_ADMIN_* ve Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');
test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'Pilot yolculuğu yalnızca masaüstü projesinde koşar (mobil görünüm PJ-7 içinde)');
});

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const DOMAIN = `pj-${RUN}.e2e.test`;
const SITE = `http://${DOMAIN}:${PORT}`;
const NAME = `Pilot Ofisi ${RUN}`;
const SLUG = `pilot-${RUN}`;
const PREFIX = [...randomBytes(5)].map((b) => String.fromCharCode(65 + (b % 26))).join('');
const OWNER = `pilot-sahip-${RUN}@example.test`;
const AGENT = `pilot-danisman-${RUN}@example.test`;
const VISITOR = `pilot-ziyaretci-${RUN}@example.test`;
const VISITOR_NAME = `Pilot Ziyaretci ${RUN}`;
const PASSWORD = `Pilot-${RUN}-Sifre9x`;
const TITLE = `Pilot ilani ${RUN} – Elvankent 3+1 daire`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const S: { orgId?: string; ownerLink?: string; agentLink?: string; editorUrl?: string; publicPath?: string; propertyId?: string } = {};
const fixtureDir = mkdtempSync(path.join(tmpdir(), `pj-${RUN}-`));
const images = ['bir', 'iki'].map((n) => path.join(fixtureDir, `foto-${n}.jpg`));

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${DOMAIN} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE}`],
  },
});

// --- Sahte e-posta (Resend) ve DNS (DoH) -----------------------------------------
type Mail = { to: string[]; subject: string; html: string; text: string };
const mails: Mail[] = [];
const dns = new Map<string, { type: number; data: string }[]>();
const servers: Server[] = [];
function setRecord(name: string, type: 'TXT' | 'CNAME', data: string) {
  const key = `${name.toLowerCase()}|${type}`;
  dns.set(key, [...(dns.get(key) ?? []), { type: type === 'TXT' ? 16 : 5, data: type === 'TXT' ? `"${data}"` : data }]);
}
async function listen(server: Server, port: number) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  servers.push(server);
}

test.beforeAll(async () => {
  mkdirSync(fixtureDir, { recursive: true });
  const colors = ['#2f7c6e', '#c08a3e'];
  await Promise.all(
    images.map((file, i) =>
      sharp({ create: { width: 1600, height: 1067, channels: 3, background: colors[i] } })
        .composite([{ input: Buffer.from(`<svg width="1600" height="1067"><text x="800" y="560" font-size="200" text-anchor="middle" fill="#fff" font-family="sans-serif">${i + 1}</text></svg>`) }])
        .jpeg({ quality: 85 })
        .toFile(file),
    ),
  );
  await listen(
    createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          mails.push(JSON.parse(body || '{}') as Mail);
        } catch {
          // geçersiz gövde yok sayılır
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: `pj-${mails.length}` }));
      });
    }),
    MAIL_PORT,
  );
  await listen(
    createServer((req, res) => {
      const q = new URL(req.url ?? '/', 'http://x').searchParams;
      const answer = dns.get(`${(q.get('name') ?? '').toLowerCase()}|${q.get('type')}`) ?? [];
      res.writeHead(200, { 'Content-Type': 'application/dns-json' });
      res.end(JSON.stringify({ Status: answer.length ? 0 : 3, Answer: answer }));
    }),
    DNS_PORT,
  );
});

test.afterAll(async () => {
  for (const s of servers) await new Promise<void>((resolve) => s.close(() => resolve()));
  rmSync(fixtureDir, { recursive: true, force: true });
  if (!service) return;
  if (S.orgId) await service.from('organizations').delete().eq('id', S.orgId);
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email === OWNER || u.email === AGENT) await service.auth.admin.deleteUser(u.id);
});

// --- Yardımcılar ---------------------------------------------------------------
async function freshContext(browser: Browser, extra: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
  return browser.newContext({
    ...test.info().project.use,
    ...extra,
    extraHTTPHeaders: { 'x-forwarded-for': `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}` },
  });
}

async function mailFor(email: string, after: number): Promise<string> {
  await expect.poll(() => mails.slice(after).filter((m) => m.to?.includes(email)).length, { timeout: 20_000 }).toBeGreaterThan(0);
  const mail = mails.slice(after).filter((m) => m.to.includes(email)).at(-1)!;
  const link = /https?:\/\/[^\s"<>]+\/admin\/davet#t=[A-Za-z0-9_-]{43}/.exec(mail.text)?.[0];
  expect(link, 'e-postada aktivasyon bağlantısı').toBeTruthy();
  return link!;
}

/** Davet bağlantısını ofisin alan adına çevirir (bağlantı yerelde NEXT_PUBLIC_SITE_URL ya da https://alan-adı olabilir) */
const onSite = (link: string) => link.replace(/^https?:\/\/[^/]+/, SITE);

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL(/\/platform$/);
}

async function loginOffice(page: Page, origin: string, email = OWNER) {
  await page.goto(`${origin}/admin/giris`);
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((u) => u.pathname === '/admin', { timeout: 30_000 });
}

async function activate(page: Page, link: string) {
  await page.goto(link);
  await expect(page.getByTestId('activation-form')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Yeni şifre', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Yeni şifre (tekrar)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Hesabımı etkinleştir' }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/davet'), { timeout: 30_000 });
}

function rawGet(host: string, p: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const req = httpRequest({ host: '127.0.0.1', port: Number(PORT), path: p, headers: { Host: `${host}:${PORT}` } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', () => resolve({ status: 0, body: '' }));
    req.end();
  });
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const row = (page: Page) => page.locator(`[data-testid="domain-row"][data-hostname="${DOMAIN}"]`);

// --- Yolculuk ------------------------------------------------------------------------
test('PJ-1: KARAY yöneticisi yeni ofisi açar ve sahip davetini gönderir', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/organizasyonlar/yeni');
  await page.getByLabel('Organizasyon adı').fill(NAME);
  await page.getByLabel('Kısa ad (alt alan adı)').fill(SLUG);
  await page.getByLabel('İlan no öneki').fill(PREFIX);
  await page.getByLabel('Sahip adı soyadı').fill('Pilot Sahibi');
  await page.getByLabel('Sahip e-postası').fill(OWNER);
  await page.locator('#co-plan').selectOption('kurumsal');
  await page.getByRole('button', { name: 'Organizasyonu oluştur' }).click();
  await expect(page.getByText('Organizasyon oluşturuldu.')).toBeVisible({ timeout: 30_000 });
  const { data: org } = await service!.from('organizations').select('id, status, is_default').eq('slug', SLUG).single();
  S.orgId = org!.id;
  expect(org).toMatchObject({ status: 'active', is_default: false });

  const before = mails.length;
  await page.getByTestId('owner-invitation').getByRole('button', { name: 'Davet gönder' }).click();
  S.ownerLink = await mailFor(OWNER, before);
});

test('PJ-2: sahip davetle hesabını etkinleştirir, şifre belirler ve /admin açılır', async ({ browser }) => {
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await activate(page, S.ownerLink!);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test('PJ-3: özel alan adı bağlanır, site yayına alınır ve kendi alan adında açılır', async ({ browser }) => {
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await loginOffice(page, baseURL);
  await page.goto('/admin/site/alan-adi');
  await page.getByLabel('Alan adı ekle').fill(DOMAIN);
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(row(page)).toHaveAttribute('data-status', 'pending', { timeout: 15_000 });

  await row(page).getByRole('button', { name: 'Göster' }).click();
  const value = (await row(page).getByTestId('dns-value').innerText()).trim();
  setRecord(`_karay-verification.${DOMAIN}`, 'TXT', value);
  await row(page).getByRole('button', { name: 'Doğrula' }).click();
  await expect(row(page)).toHaveAttribute('data-status', 'verified', { timeout: 15_000 });

  setRecord(DOMAIN, 'CNAME', `${TARGET_CNAME}.`);
  await row(page).getByRole('button', { name: 'Bağlantıyı kontrol et' }).click();
  await expect(row(page)).toHaveAttribute('data-status', 'active', { timeout: 15_000 });
  await ctx.close();

  // KARAY teslimi: Web siteleri › Yayın durumu › Yayında
  const kctx = await freshContext(browser);
  const karay = await kctx.newPage();
  await loginPlatform(karay);
  await karay.goto(`/platform/siteler/${S.orgId}`);
  await karay.locator('#site-status').selectOption('active');
  await karay.getByRole('button', { name: 'Durumu kaydet' }).click();
  await expect(karay.getByText('Site durumu güncellendi', { exact: false }).or(karay.getByText('Kaydedildi', { exact: false })).first()).toBeVisible({ timeout: 15_000 });
  await kctx.close();

  await expect.poll(async () => (await rawGet(DOMAIN, '/')).body.includes('Sitemiz çok yakında yayında'), { timeout: 15_000 }).toBe(false);
  const home = await rawGet(DOMAIN, '/');
  expect(home.status).toBe(200);
  expect(home.body).toContain(NAME);

  const visitor = await freshContext(browser);
  const vp = await visitor.newPage();
  const res = await vp.goto(`${SITE}/`);
  expect(res?.status()).toBe(200);
  await expect(vp.getByRole('banner').first()).toContainText(NAME);
  await visitor.close();
});

test('PJ-4: alan adında sahip 2 fotoğraflı ilan oluşturup yayınlar; ilan ofis alan adında açılır', async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await loginOffice(page, SITE);
  await page.goto(`${SITE}/admin/ilanlar/yeni`);
  await page.locator('#property_type_id').selectOption({ label: 'Daire' });
  await page.locator('#title').fill(TITLE);
  await page.getByRole('button', { name: /Taslağı oluştur/ }).click();
  await expect(page).toHaveURL(/\/admin\/ilanlar\/[0-9a-f-]{36}/, { timeout: 60_000 });
  S.editorUrl = page.url().split('?')[0];

  await page.getByLabel(/^İl\*?$/).selectOption({ label: 'Ankara' });
  await page.getByLabel(/^İlçe\*?$/).selectOption({ label: 'Etimesgut' });
  await page.getByLabel(/^Mahalle$/).selectOption({ label: 'Elvankent' });
  await expect(page.getByText(/Kaydedildi/).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Fotoğraflar/ }).first().click();
  await page.locator('input[type=file][multiple]').setInputFiles(images);
  await page.waitForFunction(() => document.querySelectorAll('li[draggable="true"]').length >= 2, null, { timeout: 120_000 });
  await expect(page.getByText('Kapak').first()).toBeVisible();

  await page.getByRole('button', { name: /Temel bilgiler/ }).first().click();
  await page.getByLabel('Satış fiyatı').fill('4500000');
  await page.getByRole('button', { name: /Özellikler/ }).first().click();
  await page.getByLabel('Brüt alan').fill('145');
  await page.getByLabel('Oda sayısı').fill('3');
  await page.getByLabel('Salon sayısı').fill('1');
  await page.getByRole('button', { name: /Açıklama/ }).first().click();
  await page
    .getByLabel('İlan açıklaması')
    .fill('Güney cepheli, gün boyu güneş alan geniş salon. Site içinde kapalı otopark bulunmaktadır. Bu ilan pilot yolculuk testi için oluşturulmuştur.');
  await expect(page.getByText(/Kaydedildi/).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Yayınlama/ }).first().click();
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText('İlan yayınlandı.')).toBeVisible({ timeout: 30_000 });
  S.publicPath = (await page.locator('a[href^="/ilan/"]').first().getAttribute('href')) ?? '';
  expect(S.publicPath).toMatch(/^\/ilan\/[a-z0-9-]+$/);
  await ctx.close();

  const { data: prop } = await service!.from('properties').select('id, organization_id').eq('organization_id', S.orgId!).eq('title', TITLE).single();
  S.propertyId = prop!.id;

  // Ziyaretçi gözüyle: ilan ofisin kendi alan adında, iki fotoğrafıyla
  const vctx = await freshContext(browser);
  const vp = await vctx.newPage();
  await expect(async () => {
    await vp.goto(`${SITE}${S.publicPath}`);
    await expect(vp.getByRole('heading', { level: 1 })).toHaveText(TITLE, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(vp.getByText(/4\.500\.000/).first()).toBeVisible();
  await expect.poll(() => vp.locator('main img').count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await vctx.close();
});

test('PJ-5: ziyaretçi bilgi formu + randevu gönderir; kayıtlar yeni ofise bağlıdır', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await page.goto(`${SITE}${S.publicPath}`);
  const panel = page.locator('#bilgi-talep');
  await panel.scrollIntoViewIfNeeded();
  // Bot korumasının en kısa doldurma süresi (sabit bekleme yerine sayfa süresi beklenir)
  await page.waitForFunction(() => performance.now() > 3500);
  const infoForm = panel.locator('form').first();
  await infoForm.getByLabel(/^Ad soyad/).fill(VISITOR_NAME);
  await infoForm.getByLabel(/^Telefon/).fill('0532 000 00 00');
  await infoForm.getByLabel(/^E-posta/).fill(VISITOR);
  await infoForm.getByRole('checkbox').check();
  await infoForm.getByRole('button', { name: /Gönder|Bilgi al/ }).last().click();
  await expect(page.getByText('Teşekkürler!').first()).toBeVisible({ timeout: 20_000 });

  // Randevu sekmesi
  await page.reload();
  await panel.scrollIntoViewIfNeeded();
  await panel.getByRole('radio', { name: 'Randevu talep et' }).or(panel.getByRole('tab', { name: 'Randevu talep et' })).first().click();
  await page.waitForFunction(() => performance.now() > 3500);
  const apptForm = panel.locator('form').first();
  const d = new Date(Date.now() + 3 * 86_400_000);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await apptForm.getByLabel(/^Ad soyad/).fill(VISITOR_NAME);
  await apptForm.getByLabel(/^Telefon/).fill('0532 000 00 00');
  await apptForm.getByLabel(/^E-posta/).fill(VISITOR);
  await apptForm.getByLabel(/^Tarih/).fill(date);
  await apptForm.getByLabel(/^Saat/).selectOption('10:00');
  await apptForm.getByRole('checkbox').check();
  await apptForm.getByRole('button', { name: /Randevu|Gönder/ }).last().click();
  await expect(page.getByText('Teşekkürler!').first()).toBeVisible({ timeout: 20_000 });
  await ctx.close();

  // Veritabanı: iki kayıt da YENİ ofiste, varsayılan kiracıda değil
  const { data: def } = await service!.from('organizations').select('id').eq('is_default', true).single();
  expect(def!.id).not.toBe(S.orgId);
  await expect
    .poll(async () => (await service!.from('leads').select('id').eq('organization_id', S.orgId!).eq('property_id', S.propertyId!)).data?.length ?? 0, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(async () => (await service!.from('appointments').select('id').eq('organization_id', S.orgId!).eq('property_id', S.propertyId!)).data?.length ?? 0, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
  const { data: customers } = await service!.from('customers').select('id, organization_id').eq('email', VISITOR);
  expect(customers?.length).toBeGreaterThanOrEqual(1);
  for (const c of customers!) expect(c.organization_id).toBe(S.orgId);
  const ids = customers!.map((c) => c.id);
  for (const table of ['leads', 'appointments'] as const) {
    const { data: rows } = await service!.from(table).select('organization_id').in('customer_id', ids);
    expect(rows?.length).toBeGreaterThanOrEqual(1);
    for (const r of rows!) expect(r.organization_id).toBe(S.orgId);
  }
  const { data: leaked } = await service!.from('leads').select('id').eq('organization_id', def!.id).eq('property_id', S.propertyId!);
  expect(leaked ?? []).toHaveLength(0);

  // Sahibin panelinde görünür
  const octx = await freshContext(browser);
  const owner = await octx.newPage();
  await loginOffice(owner, SITE);
  await owner.goto(`${SITE}/admin/talepler`);
  await expect(owner.getByText(VISITOR_NAME).first()).toBeVisible({ timeout: 15_000 });
  await owner.goto(`${SITE}/admin/randevular`);
  await expect(owner.getByText(VISITOR_NAME).first()).toBeVisible({ timeout: 15_000 });
  await octx.close();
});

test('PJ-6: sahip danışman ekler; danışman alan adında girer, talebi görür, sahip sayfalarını açamaz', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await loginOffice(page, SITE);
  await page.goto(`${SITE}/admin/kullanicilar`);
  await page.getByRole('button', { name: 'Yeni kullanıcı' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yeni kullanıcı' });
  await dialog.getByLabel('Ad soyad').fill('Pilot Danisman');
  await dialog.getByLabel('E-posta').fill(AGENT);
  await dialog.getByLabel('Rol').selectOption('agent');
  const before = mails.length;
  await dialog.getByRole('button', { name: 'Kullanıcıyı ekle' }).click();
  const added = page.getByRole('dialog', { name: 'Kullanıcı eklendi' });
  await expect(added.locator('[data-member-invited]')).toContainText('davet bağlantısı gönderildi');
  S.agentLink = await mailFor(AGENT, before);
  await added.getByRole('button', { name: 'Tamam' }).click();
  await ctx.close();

  const actx = await freshContext(browser);
  const ap = await actx.newPage();
  await activate(ap, onSite(S.agentLink!));
  expect(new URL(ap.url()).host).toBe(`${DOMAIN}:${PORT}`);
  await actx.close();

  const lctx = await freshContext(browser);
  const agent = await lctx.newPage();
  await loginOffice(agent, SITE, AGENT);
  await agent.goto(`${SITE}/admin/talepler`);
  await expect(agent.getByText(VISITOR_NAME).first()).toBeVisible({ timeout: 15_000 });
  await agent.goto(`${SITE}/admin/kullanicilar`);
  await expect(agent).toHaveURL(/\/admin\/yetkisiz\?izin=users\.manage/);
  // Alan adı yönetimi sahibe özeldir: danışman ekleme formunu göremez
  await agent.goto(`${SITE}/admin/site/alan-adi`);
  await expect(agent.getByLabel('Alan adı ekle')).toHaveCount(0);
  await lctx.close();

  const { data: users } = await service!.auth.admin.listUsers({ perPage: 1000 });
  const agentUser = users.users.find((u) => u.email === AGENT)!;
  const { data: m } = await service!.from('organization_members').select('role, status').eq('organization_id', S.orgId!).eq('user_id', agentUser.id).single();
  expect(m).toMatchObject({ role: 'agent', status: 'active' });
});

test('PJ-7: mobilde (390x844) panel ve ofis sitesi yatay taşmaz', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await freshContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await loginOffice(page, SITE);
  for (const p of ['/admin', '/admin/ilanlar', '/admin/talepler']) {
    const res = await page.goto(`${SITE}${p}`);
    expect(res?.status(), p).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await overflow(page), `panel ${p}`).toBeLessThanOrEqual(0);
  }
  await ctx.close();

  const vctx = await freshContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const vp = await vctx.newPage();
  for (const p of ['/', S.publicPath!]) {
    const res = await vp.goto(`${SITE}${p}`);
    expect(res?.status(), p).toBe(200);
    await expect(vp.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await overflow(vp), `site ${p}`).toBeLessThanOrEqual(0);
  }
  await vctx.close();
});
