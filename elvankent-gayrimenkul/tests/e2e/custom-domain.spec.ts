import { randomBytes } from 'node:crypto';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * P0.5 — Özel alan adı: gerçek uygulama + yerel veritabanı + sahte DNS (DoH) sunucusu.
 *
 *  E1   Ofis A kendi alan adını ekler (bekliyor; TXT kaydı maskeli gösterilir)
 *  E9   Bekleyen ve doğrulanmış-ama-bağlanmamış alan adı public siteyi AÇMAZ
 *  E2   TXT doğrulaması (yanlış/eksik kayıt reddedilir)
 *  E3   Bağlantı: yönlendirme yokken aktif olmaz; CNAME KARAY hedefine yönlenince aktif
 *  E4   Özel alan adı doğru kiracıyı açar (önbellek beklemeden)
 *  E5   Metadata: kanonik adres özel alan adı
 *  E6   Sitemap / robots: özel alan adı
 *  E7   /og, manifest, site-icon: doğru kiracı
 *  E11  www + kök: ikinci alan adı aynı siteyi açar, kanonik birincil alan adı
 *  E12  Host manipülasyonu: X-Forwarded-Host / x-tenant-key kiracı değiştirmez
 *  E8   Ofis B aynı alan adını alamaz
 *  E13  Yetkisiz erişim: B, A'nın alan adını görmez; settings.manage olmayan rol yönetemez;
 *       özel alan adında /platform 404
 *  E14  Platform / iç / IP / URL girdileri reddedilir
 *  E15  KARAY: ofis B için kök alan adı ekler, doğrular, bağlantıyı elle onaylar; A ↔ B karışmaz
 *  E10  Kaldırınca çözümleme düşer
 *
 * Uygulama DOMAIN_DNS_RESOLVER_URL=http://127.0.0.1:4011/dns-query, DOMAIN_TARGET_CNAME ve
 * DOMAIN_TARGET_A ile başlatılır; bu dosya o adreste sahte DoH sunucusu açar (gerçek DNS yok).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const DNS_PORT = 4011;
const TARGET_CNAME = 'sites.karay.test';
const TARGET_A = '203.0.113.10';

test.describe.configure({ mode: 'serial' });
test.skip(!url || !serviceKey || !adminEmail || !adminPassword, 'Supabase anahtarları / E2E_ADMIN_* tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const DOM_A = `cd-a-${RUN}.e2e.test`;
const WWW_A = `www.cd-a-${RUN}.e2e.test`;
const DOM_B = `cdb${RUN}.test`;
const PASSWORD = `Dom-${randomBytes(6).toString('hex')}-7q`;
const NAME = { a: `Alan Ofis A ${RUN}`, b: `Alan Ofis B ${RUN}` };
const site = (host: string) => `http://${host}:${PORT}`;

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${DOM_A} 127.0.0.1, MAP ${WWW_A} 127.0.0.1, MAP ${DOM_B} 127.0.0.1`],
  },
});

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const S: { a?: string; b?: string; users: { id: string; email: string; org: 'a' | 'b'; role: string }[] } = { users: [] };

// --- Sahte DNS (DoH JSON) --------------------------------------------------
const dns = new Map<string, { type: number; data: string }[]>();
let dnsServer: Server | null = null;
function setRecord(name: string, type: 'TXT' | 'CNAME' | 'A', data: string) {
  const key = `${name.toLowerCase()}|${type}`;
  const code = { A: 1, CNAME: 5, TXT: 16 }[type];
  dns.set(key, [...(dns.get(key) ?? []), { type: code, data: type === 'TXT' ? `"${data}"` : data }]);
}

async function makeOrg(key: 'a' | 'b') {
  const org = await service!.from('organizations').insert({ slug: `cd-${key}-${RUN}`, name: NAME[key], reference_prefix: `C${key.toUpperCase()}${String.fromCharCode(65 + (randomBytes(1)[0] % 26))}`, status: 'active' }).select('id').single();
  if (org.error) throw org.error;
  await service!.from('organization_settings').insert({ organization_id: org.data.id, display_name: NAME[key], address_city: 'Ankara' });
  await service!.from('subscriptions').insert({ organization_id: org.data.id, plan_id: 'kurumsal', status: 'active' });
  await service!.from('site_configs').update({ published: { seo: { title: `${NAME[key]} SEO` } }, draft: { seo: { title: `${NAME[key]} SEO` } } }).eq('organization_id', org.data.id);
  return org.data.id as string;
}

async function makeUser(org: 'a' | 'b', role: 'owner' | 'agent') {
  const email = `cd-${RUN}-${org}-${role}@example.test`;
  const { data, error } = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  S.users.push({ id: data.user.id, email, org, role });
  const m = await service!.from('organization_members').insert({ organization_id: org === 'a' ? S.a! : S.b!, user_id: data.user.id, role, status: 'active' });
  if (m.error) throw m.error;
}
const user = (org: 'a' | 'b', role: string) => S.users.find((u) => u.org === org && u.role === role)!.email;

test.beforeAll(async () => {
  dnsServer = createServer((req, res) => {
    const q = new URL(req.url ?? '/', 'http://x').searchParams;
    const answer = dns.get(`${(q.get('name') ?? '').toLowerCase()}|${q.get('type')}`) ?? [];
    res.writeHead(200, { 'Content-Type': 'application/dns-json' });
    res.end(JSON.stringify({ Status: answer.length ? 0 : 3, Answer: answer }));
  });
  await new Promise<void>((resolve, reject) => {
    dnsServer!.once('error', reject);
    dnsServer!.listen(DNS_PORT, '127.0.0.1', () => resolve());
  });
  S.a = await makeOrg('a');
  S.b = await makeOrg('b');
  await makeUser('a', 'owner');
  await makeUser('a', 'agent');
  await makeUser('b', 'owner');
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (dnsServer ? dnsServer.close(() => resolve()) : resolve()));
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

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL(/\/platform$/);
}

const row = (page: Page, host: string) => page.locator(`[data-testid="domain-row"][data-hostname="${host}"]`);

async function addDomain(page: Page, host: string) {
  await page.getByLabel('Alan adı ekle').fill(host);
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(row(page, host)).toHaveAttribute('data-status', 'pending', { timeout: 15_000 });
}

/** TXT değerini ekrandan okur (maskeli → Göster) */
async function txtValue(page: Page, host: string): Promise<string> {
  const r = row(page, host);
  await expect(r.getByTestId('dns-value')).toHaveText('••••••••••••');
  await r.getByRole('button', { name: 'Göster' }).click();
  const value = (await r.getByTestId('dns-value').innerText()).trim();
  expect(value).toMatch(/^karay-site-verification=[A-Za-z0-9_-]{43}$/);
  return value;
}

async function status(host: string, path = '/'): Promise<number> {
  return new Promise((resolve) => {
    const req = httpRequest({ host: '127.0.0.1', port: Number(PORT), path, headers: { Host: `${host}:${PORT}` } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

function rawGet(host: string, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const req = httpRequest({ host: '127.0.0.1', port: Number(PORT), path, headers: { Host: `${host}:${PORT}`, ...headers } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', () => resolve({ status: 0, body: '' }));
    req.end();
  });
}

test('E1 + E9 + E2 + E3 + E4: ofis A alan adını ekler → bekliyor (site açılmaz) → TXT → bağlantı → aktif', async ({ page }) => {
  await loginOffice(page, user('a', 'owner'));
  await page.goto('/admin/site/alan-adi');
  await expect(page.getByTestId('no-domains')).toBeVisible();
  await addDomain(page, DOM_A);
  const r = row(page, DOM_A);
  await expect(r).toContainText('Doğrulama bekleniyor');
  await expect(r.getByTestId('dns-txt')).toContainText(`_karay-verification.${DOM_A}`);
  const value = await txtValue(page, DOM_A);
  // Veritabanında ham kod yok
  const { data: dbRow } = await service!.from('organization_domains').select('*').eq('hostname', DOM_A).single();
  expect(JSON.stringify(dbRow)).not.toContain(value);
  expect(dbRow!.organization_id).toBe(S.a);

  // E9: bekleyen alan adı public siteyi açmaz
  expect(await status(DOM_A)).toBe(404);

  // E2: kayıt yokken / yanlış kayıtla doğrulama başarısız
  // Her denemede sunucu işleminin bitmesi beklenir (aksi halde önceki bildirim görünürken DNS değiştirilir
  // ve uçuştaki doğrulama yeni kaydı okur — test yarışı)
  const verify = r.getByRole('button', { name: 'Doğrula' });
  await verify.click();
  await expect(page.getByText('Doğrulama kaydı bulunamadı', { exact: false }).first()).toBeVisible();
  await expect(verify).toBeEnabled();
  setRecord(`_karay-verification.${DOM_A}`, 'TXT', 'karay-site-verification=yanlis-deger');
  const toasts = await page.getByText('Doğrulama kaydı bulunamadı', { exact: false }).count();
  await verify.click();
  await expect.poll(() => page.getByText('Doğrulama kaydı bulunamadı', { exact: false }).count()).toBeGreaterThan(toasts);
  await expect(verify).toBeEnabled();
  await expect(r).toHaveAttribute('data-status', 'pending');
  setRecord(`_karay-verification.${DOM_A}`, 'TXT', value);
  await r.getByRole('button', { name: 'Doğrula' }).click();
  await expect(r).toHaveAttribute('data-status', 'verified', { timeout: 15_000 });
  await expect(r).toContainText('DNS doğrulandı');
  await expect(r.getByTestId('dns-cname')).toContainText(TARGET_CNAME);
  // E9: doğrulanmış ama bağlanmamış alan adı da açılmaz
  expect(await status(DOM_A)).toBe(404);

  // E3: yönlendirme yokken aktif olmaz
  await r.getByRole('button', { name: 'Bağlantıyı kontrol et' }).click();
  await expect(page.getByText('henüz KARAY', { exact: false }).first()).toBeVisible();
  await expect(r).toHaveAttribute('data-status', 'verified');
  setRecord(DOM_A, 'CNAME', `${TARGET_CNAME}.`);
  await r.getByRole('button', { name: 'Bağlantıyı kontrol et' }).click();
  await expect(r).toHaveAttribute('data-status', 'active', { timeout: 15_000 });
  await expect(r).toHaveAttribute('data-primary', 'true');
  await expect(r.getByRole('link', { name: 'Siteyi aç' })).toHaveAttribute('href', `https://${DOM_A}`);

  // E4: özel alan adı doğru kiracıyı açar — bekleyen hâldeki 404 önbellekte kalmaz
  const pub = await page.context().newPage();
  const res = await pub.goto(`${site(DOM_A)}/`);
  expect(res?.status()).toBe(200);
  await expect(pub.getByText(NAME.a).first()).toBeVisible();
  await expect(pub.getByText(NAME.b)).toHaveCount(0);
  await pub.close();
});

test('E5 + E6 + E7: kanonik adres, sitemap, robots, OG, manifest ve simge özel alan adından / doğru kiracıdan', async ({ page }) => {
  await page.goto(`${site(DOM_A)}/`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`^https://${DOM_A.replace(/\./g, '\\.')}/?$`));
  await expect(page).toHaveTitle(new RegExp(`${NAME.a} SEO`));
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(ogImage).toMatch(new RegExp(`^https://${DOM_A.replace(/\./g, '\\.')}/`));

  const sitemap = await rawGet(DOM_A, '/sitemap.xml');
  expect(sitemap.status).toBe(200);
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThan(0);
  for (const loc of locs) expect(loc.startsWith(`https://${DOM_A}/`) || loc === `https://${DOM_A}`).toBe(true);
  const robots = await rawGet(DOM_A, '/robots.txt');
  expect(robots.status).toBe(200);
  // Sitemap satırı (üretimde) yalnızca özel alan adını gösterir; demo ortamında satır hiç yoktur
  for (const line of robots.body.split('\n').filter((l) => l.startsWith('Sitemap:'))) expect(line).toBe(`Sitemap: https://${DOM_A}/sitemap.xml`);
  expect(robots.body).not.toMatch(/localhost|cd-a-[0-9a-f]+\.[a-z]+\.(com|app)/);

  const og = await rawGet(DOM_A, '/og');
  expect(og.status).toBe(200);
  const manifest = await rawGet(DOM_A, '/manifest.webmanifest');
  expect(manifest.status).toBe(200);
  expect(JSON.parse(manifest.body).name).toBe(NAME.a);
  expect((await rawGet(DOM_A, '/site-icon')).status).toBe(200);
});

test('E11: www + kök — ikinci alan adı aynı siteyi açar, kanonik birincil alan adı kalır', async ({ page }) => {
  await loginOffice(page, user('a', 'owner'));
  await page.goto('/admin/site/alan-adi');
  await addDomain(page, WWW_A);
  setRecord(`_karay-verification.${WWW_A}`, 'TXT', await txtValue(page, WWW_A));
  await row(page, WWW_A).getByRole('button', { name: 'Doğrula' }).click();
  await expect(row(page, WWW_A)).toHaveAttribute('data-status', 'verified', { timeout: 15_000 });
  setRecord(WWW_A, 'CNAME', TARGET_CNAME);
  await row(page, WWW_A).getByRole('button', { name: 'Bağlantıyı kontrol et' }).click();
  await expect(row(page, WWW_A)).toHaveAttribute('data-status', 'active', { timeout: 15_000 });
  await expect(row(page, WWW_A)).toHaveAttribute('data-primary', 'false');
  const pub = await page.context().newPage();
  expect((await pub.goto(`${site(WWW_A)}/`))?.status()).toBe(200);
  await expect(pub.getByText(NAME.a).first()).toBeVisible();
  // Yönlendirme döngüsü yok, kanonik birincil alan adı
  expect(new URL(pub.url()).hostname).toBe(WWW_A);
  await expect(pub.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`^https://${DOM_A.replace(/\./g, '\\.')}/?$`));
  await pub.close();
});

test('E12: Host başlığı kiracıyı belirler; X-Forwarded-Host / x-tenant-key / /t/ yolu kiracı değiştirmez', async () => {
  const forged = await rawGet(DOM_A, '/', { 'X-Forwarded-Host': DOM_B, 'X-Forwarded-Proto': 'https', 'x-tenant-key': `cd-b-${RUN}`, Forwarded: `host=${DOM_B}` });
  expect(forged.status).toBe(200);
  expect(forged.body).toContain(NAME.a);
  expect(forged.body).not.toContain(NAME.b);
  expect((await rawGet(DOM_A, `/t/cd-b-${RUN}`)).status).toBe(404);
  // Bilinmeyen alan adı kiracıya çözülmez
  expect(await status(`bilinmeyen-${RUN}.e2e.test`)).toBe(404);
});

test('E8 + E13: B aynı alan adını alamaz, A\'nın alan adlarını görmez; yetkisiz rol yönetemez; özel alan adında /platform 404', async ({ page, browser }) => {
  await loginOffice(page, user('b', 'owner'));
  await page.goto('/admin/site/alan-adi');
  await expect(row(page, DOM_A)).toHaveCount(0);
  await page.getByLabel('Alan adı ekle').fill(DOM_A);
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('başka bir sitede doğrulanmış', { exact: false }).first()).toBeVisible();
  const { data: rows } = await service!.from('organization_domains').select('organization_id').eq('hostname', DOM_A);
  expect(rows).toEqual([{ organization_id: S.a }]);

  const ctx = await browser.newContext({ ...test.info().project.use });
  const agent = await ctx.newPage();
  await loginOffice(agent, user('a', 'agent'));
  await agent.goto('/admin/site/alan-adi');
  await expect(agent.getByTestId('domain-manager')).toHaveCount(0);
  await ctx.close();

  expect(await status(DOM_A, '/platform')).toBe(404);
  expect(await status(DOM_A, '/platform/siteler')).toBe(404);
  expect(await status(DOM_A, '/karay')).toBe(404);
  // Ofis paneli özel alan adında da giriş ister (kiracı bağlamı oturumdan)
  const admin = await rawGet(DOM_A, '/admin');
  expect([302, 307, 308]).toContain(admin.status);
});

test('E14: platform ad alanı, iç ad, IP ve URL girdileri reddedilir', async ({ page }) => {
  await loginOffice(page, user('a', 'owner'));
  await page.goto('/admin/site/alan-adi');
  for (const [input, message] of [
    ['proje.vercel.app', 'platforma ayrılmıştır'],
    ['localhost', 'iç / yerel ağ adı'],
    ['127.0.0.1', 'IP adresi'],
    [`https://${DOM_B}/yol`, 'Yalnızca alan adını yazın'],
    ['ornek.com:8080', 'port'],
  ]) {
    await page.getByLabel('Alan adı ekle').fill(input);
    await page.getByRole('button', { name: 'Ekle', exact: true }).click();
    await expect(page.getByText(message, { exact: false }).first()).toBeVisible();
  }
  const { data } = await service!.from('organization_domains').select('hostname').eq('organization_id', S.a!);
  expect((data ?? []).map((d) => d.hostname).sort()).toEqual([DOM_A, WWW_A].sort());
});

test('E15: KARAY ofis B için kök alan adı ekler, doğrular, bağlantıyı elle onaylar; A ↔ B karışmaz', async ({ page }) => {
  await loginPlatform(page);
  await page.goto(`/platform/siteler/${S.b}/alan-adi`);
  await addDomain(page, DOM_B);
  setRecord(`_karay-verification.${DOM_B}`, 'TXT', await txtValue(page, DOM_B));
  await row(page, DOM_B).getByRole('button', { name: 'Doğrula' }).click();
  await expect(row(page, DOM_B)).toHaveAttribute('data-status', 'verified', { timeout: 15_000 });
  // Kök alan adı: A kaydı hedefi gösterilir
  await expect(row(page, DOM_B).getByTestId('dns-a')).toContainText(TARGET_A);
  await row(page, DOM_B).getByRole('button', { name: 'Bağlantıyı elle onayla' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Aktif et' }).click();
  await expect(row(page, DOM_B)).toHaveAttribute('data-status', 'active', { timeout: 15_000 });

  const b = await rawGet(DOM_B, '/');
  expect(b.status).toBe(200);
  expect(b.body).toContain(NAME.b);
  expect(b.body).not.toContain(NAME.a);
  const a = await rawGet(DOM_A, '/');
  expect(a.body).toContain(NAME.a);
  expect(a.body).not.toContain(NAME.b);
  expect(JSON.parse((await rawGet(DOM_B, '/manifest.webmanifest')).body).name).toBe(NAME.b);
});

test('E10: kaldırınca çözümleme hemen düşer; site varsayılan adresinde kalır', async ({ page }) => {
  await loginOffice(page, user('a', 'owner'));
  await page.goto('/admin/site/alan-adi');
  for (const host of [WWW_A, DOM_A]) {
    await row(page, host).getByRole('button', { name: 'Kaldır' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kaldır' }).click();
    await expect(row(page, host)).toHaveCount(0, { timeout: 15_000 });
  }
  expect(await status(DOM_A)).toBe(404);
  expect(await status(WWW_A)).toBe(404);
  // Kiracı yayında kalır (slug ile çözülür)
  const { data } = await service!.rpc('public_tenant', { p_slug: `cd-a-${RUN}` });
  expect(data?.[0]?.id).toBe(S.a);
});
