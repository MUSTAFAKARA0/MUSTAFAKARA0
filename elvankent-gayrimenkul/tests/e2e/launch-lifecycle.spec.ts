import { randomBytes } from 'node:crypto';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * FAZ 0 — Ticari yayın provası: yeni müşterinin KARAY'a girişinden yayındaki sitesine kadar TEK zincir
 * (gerçek uygulama + yerel veritabanı + sahte e-posta (Resend) ve sahte DNS (DoH) sunucuları).
 *
 *  LC-1  KARAY yöneticisi yeni müşteri açar (kurumsal plan) → sahip daveti e-postası
 *  LC-2  Hata yolu: bozuk davet bağlantısı reddedilir → geçerli bağlantıyla aktivasyon → /admin
 *  LC-3  Özel alan adı: ekle (bekliyor, site kapalı) → TXT → doğrulandı → CNAME → aktif → site açılır
 *  LC-4  Özel alan adında /admin oturumu: taslak → ziyaretçi ESKİYİ görür → önizleme YENİYİ → yayın → geri alma
 *  LC-5  Eşzamanlılık: aynı taslak iki oturumdan → eski sürümle kaydeden reddedilir (stale_draft)
 *  LC-6  Güvenlik: A'nın sahibi B'nin (varsayılan ofis) verisini okuyamaz/değiştiremez; Host / x-tenant-key sahteciliği
 *  LC-7  Şifre sıfırlama (FAZ 0 yolu): KARAY e-posta sağlayıcısı → bağlantı → yeni şifre → giriş; hız sınırı
 *  LC-8  Askıya alınan ofis: site 404, panel kapalı; yeniden açılınca döner
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

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const DOMAIN = `lc-${RUN}.e2e.test`;
const SITE = `http://${DOMAIN}:${PORT}`;
const NAME = `Yayin Ofisi ${RUN}`;
const NEW_NAME = `${NAME} Yeni`;
const SLUG = `yayin-${RUN}`;
const OWNER = `yayin-sahip-${RUN}@example.test`;
const PASSWORD = `Yayin-${RUN}-Sifre9x`;
const PASSWORD2 = `Yayin-${RUN}-Yeni7k`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const S: { orgId?: string; link?: string } = {};

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${DOMAIN} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE}`],
  },
});

// --- Sahte e-posta (Resend) ve DNS (DoH) -----------------------------------------
type Mail = { to: string[]; subject: string; html: string; text: string; key: string | null };
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
  await listen(
    createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          mails.push({ ...(JSON.parse(body || '{}') as Mail), key: (req.headers['idempotency-key'] as string) ?? null });
        } catch {
          // geçersiz gövde yok sayılır
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: `lc-${mails.length}` }));
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
  if (!service) return;
  if (S.orgId) await service.from('organizations').delete().eq('id', S.orgId);
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email === OWNER) await service.auth.admin.deleteUser(u.id);
});

// --- Yardımcılar ---------------------------------------------------------------
async function freshContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    ...test.info().project.use,
    extraHTTPHeaders: { 'x-forwarded-for': `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}` },
  });
}

async function mailFor(email: string, after: number, re: RegExp): Promise<{ mail: Mail; link: string }> {
  await expect.poll(() => mails.slice(after).filter((m) => m.to?.includes(email)).length, { timeout: 20_000 }).toBeGreaterThan(0);
  const mail = mails.slice(after).filter((m) => m.to.includes(email)).at(-1)!;
  const link = re.exec(mail.text)?.[0];
  expect(link, 'e-postada bağlantı').toBeTruthy();
  return { mail, link: link! };
}

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL(/\/platform$/);
}

async function loginOffice(page: Page, origin: string, password = PASSWORD) {
  await page.goto(`${origin}/admin/giris`);
  await page.getByLabel('E-posta').fill(OWNER);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((u) => u.pathname === '/admin', { timeout: 30_000 });
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

async function publish(page: Page, note: string) {
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByLabel('Sürüm notu').fill(note);
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible({ timeout: 20_000 });
}

const row = (page: Page) => page.locator(`[data-testid="domain-row"][data-hostname="${DOMAIN}"]`);

// --- Zincir ------------------------------------------------------------------------
test('LC-1: KARAY yöneticisi yeni müşteri açar ve sahip davetini gönderir', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/organizasyonlar/yeni');
  await page.getByLabel('Organizasyon adı').fill(NAME);
  await page.getByLabel('Kısa ad (alt alan adı)').fill(SLUG);
  await page.getByLabel('İlan no öneki').fill(`Y${String.fromCharCode(65 + (parseInt(RUN.slice(0, 2), 16) % 26))}${String.fromCharCode(65 + (parseInt(RUN.slice(2, 4), 16) % 26))}`);
  await page.getByLabel('Sahip adı soyadı').fill('Yayin Sahibi');
  await page.getByLabel('Sahip e-postası').fill(OWNER);
  await page.locator('#co-plan').selectOption('kurumsal');
  await page.getByRole('button', { name: 'Organizasyonu oluştur' }).click();
  await expect(page.getByText('Organizasyon oluşturuldu.')).toBeVisible({ timeout: 30_000 });
  const { data: org } = await service!.from('organizations').select('id, status').eq('slug', SLUG).single();
  S.orgId = org!.id;
  expect(org!.status).toBe('active');
  const { data: sub } = await service!.from('subscriptions').select('plan_id, status').eq('organization_id', S.orgId).single();
  expect(sub).toMatchObject({ plan_id: 'kurumsal', status: 'trialing' });
  const { data: site } = await service!.from('site_configs').select('organization_id').eq('organization_id', S.orgId).single();
  expect(site!.organization_id).toBe(S.orgId);

  const before = mails.length;
  await page.getByTestId('owner-invitation').getByRole('button', { name: 'Davet gönder' }).click();
  const { mail, link } = await mailFor(OWNER, before, /https?:\/\/[^\s"<>]+\/admin\/davet#t=[A-Za-z0-9_-]{43}/);
  S.link = link;
  // Bağlantı ofisin kendi adresi yokken panel köküne gider (yerelde NEXT_PUBLIC_SITE_URL); token konu satırında yok
  expect(new URL(link).origin).toBe(new URL(baseURL).origin);
  expect(mail.subject).not.toContain(link.split('#t=')[1]);
  // Aynı token için yeniden deneme çift e-posta göndermesin diye tekrar-gönderim anahtarı iletilir
  expect(mail.key).toMatch(/^invitation\/[0-9a-f-]{36}\/[0-9a-f]{24}$/);
});

test('LC-2: bozuk davet reddedilir; geçerli davetle aktivasyon → ofis paneli', async ({ browser }) => {
  const token = S.link!.split('#t=')[1];
  const badCtx = await freshContext(browser);
  const bad = await badCtx.newPage();
  await bad.goto(`${baseURL}/admin/davet#t=${token.slice(0, -2)}xx`);
  await expect(bad.getByTestId('invitation-invalid')).toBeVisible({ timeout: 15_000 });
  await badCtx.close();

  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await page.goto(S.link!);
  await expect(page.getByTestId('activation-form')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Yeni şifre', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Yeni şifre (tekrar)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Hesabımı etkinleştir' }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/davet'), { timeout: 30_000 });
  await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 15_000 });
  // Aynı bağlantı ikinci kez çalışmaz
  const again = await ctx.newPage();
  await again.goto(S.link!);
  await expect(again.getByTestId('invitation-invalid')).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test('LC-3: özel alan adı bekliyor → doğrulandı → aktif; site yalnızca aktifken açılır', async ({ browser }) => {
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await loginOffice(page, baseURL);
  await page.goto('/admin/site/alan-adi');
  await page.getByLabel('Alan adı ekle').fill(DOMAIN);
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(row(page)).toHaveAttribute('data-status', 'pending', { timeout: 15_000 });
  expect((await rawGet(DOMAIN, '/')).status).toBe(404);

  await row(page).getByRole('button', { name: 'Göster' }).click();
  const value = (await row(page).getByTestId('dns-value').innerText()).trim();
  setRecord(`_karay-verification.${DOMAIN}`, 'TXT', value);
  await row(page).getByRole('button', { name: 'Doğrula' }).click();
  await expect(row(page)).toHaveAttribute('data-status', 'verified', { timeout: 15_000 });
  expect((await rawGet(DOMAIN, '/')).status).toBe(404);

  setRecord(DOMAIN, 'CNAME', `${TARGET_CNAME}.`);
  await row(page).getByRole('button', { name: 'Bağlantıyı kontrol et' }).click();
  await expect(row(page)).toHaveAttribute('data-status', 'active', { timeout: 15_000 });
  await expect(row(page)).toHaveAttribute('data-primary', 'true');
  const home = await rawGet(DOMAIN, '/');
  expect(home.status).toBe(200);
  expect(home.body).toContain(NAME);
  await ctx.close();
});

test('LC-4: özel alan adında panel — taslak → ziyaretçi eskiyi, önizleme yeniyi görür → yayın → geri alma', async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await freshContext(browser);
  // Önizleme düğmesi https://<alan adı> açar → yerelde http://<alan adı>:PORT
  await ctx.route(new RegExp(`^https://${DOMAIN.replace(/\./g, '\\.')}/`), (route) =>
    route.fulfill({ status: 302, headers: { location: route.request().url().replace(`https://${DOMAIN}/`, `${SITE}/`) } }),
  );
  const page = await ctx.newPage();
  await loginOffice(page, SITE);
  expect(new URL(page.url()).host).toBe(`${DOMAIN}:${PORT}`);

  // Geri dönülecek ilk yayın
  await page.goto(`${SITE}/admin/sirket`);
  await page.getByLabel('Slogan').fill('Ilk surum');
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
  await publish(page, 'Ilk surum');

  // Taslak: yeni firma adı
  await page.goto(`${SITE}/admin/sirket`);
  await page.getByLabel('Şirket adı').fill(NEW_NAME);
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
  let pub = await rawGet(DOMAIN, '/iletisim');
  expect(pub.status).toBe(200);
  expect(pub.body).toContain(NAME);
  expect(pub.body).not.toContain(NEW_NAME);

  const [preview] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: 'Önizle' }).first().click()]);
  await preview.waitForURL(new RegExp(`^${SITE}/`));
  await expect(preview.getByText('ÖNİZLEME', { exact: false }).first()).toBeVisible();
  await expect(preview.getByText(NEW_NAME).first()).toBeVisible();
  await preview.close();

  await page.goto(`${SITE}/admin/sirket`);
  await publish(page, 'Yeni ad');
  await expect.poll(async () => (await rawGet(DOMAIN, '/iletisim')).body.includes(NEW_NAME), { timeout: 15_000 }).toBe(true);

  await page.goto(`${SITE}/admin/site/gecmis`);
  const rev = page.getByTestId('site-revisions').getByRole('listitem').filter({ hasText: 'Ilk surum' });
  await rev.getByRole('button', { name: 'Geri yükle' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Geri yükle' }).click();
  await expect(page.getByText('geri yüklendi', { exact: false }).first()).toBeVisible();
  await expect.poll(async () => (await rawGet(DOMAIN, '/iletisim')).body.includes(NEW_NAME), { timeout: 15_000 }).toBe(false);
  pub = await rawGet(DOMAIN, '/iletisim');
  expect(pub.body).toContain(NAME);
  await ctx.close();
});

test('LC-5: aynı taslak iki oturumdan — eski sürümle kaydeden reddedilir', async ({ browser }) => {
  const c1 = await freshContext(browser);
  const c2 = await freshContext(browser);
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();
  await loginOffice(p1, baseURL);
  await loginOffice(p2, baseURL);
  await p1.goto('/admin/sirket');
  await p2.goto('/admin/sirket');
  await p1.getByLabel('Slogan').fill('Oturum bir');
  await p1.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(p1.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
  await p2.getByLabel('Slogan').fill('Oturum iki');
  await p2.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(p2.getByText('siz açtıktan sonra değiştirildi', { exact: false }).first()).toBeVisible();
  const { data } = await service!.from('site_configs').select('draft').eq('organization_id', S.orgId!).single();
  expect((data!.draft as { brand?: { tagline?: string } }).brand?.tagline).toBe('Oturum bir');
  await c1.close();
  await c2.close();
});

test('LC-6: kiracı izolasyonu — A sahibi varsayılan ofisi okuyamaz/değiştiremez; Host ve x-tenant-key sahteciliği işe yaramaz', async () => {
  const client = createClient(url!, anonKey!, opts);
  expect((await client.auth.signInWithPassword({ email: OWNER, password: PASSWORD })).error).toBeNull();
  const { data: def } = await service!.from('organizations').select('id, slug').eq('is_default', true).single();
  const read = await client.from('organization_settings').select('organization_id').eq('organization_id', def!.id);
  expect(read.data ?? []).toHaveLength(0);
  const leads = await client.from('leads').select('id').eq('organization_id', def!.id);
  expect(leads.data ?? []).toHaveLength(0);
  const write = await client.rpc('site_save_draft', { p_org: def!.id, p_section: 'brand', p_value: { tagline: 'saldiri' } });
  expect(write.error).not.toBeNull();
  const dom = await client.rpc('domain_add', { p_actor: (await client.auth.getUser()).data.user!.id, p_org: def!.id, p_platform: true, p_id: crypto.randomUUID(), p_hostname: `ele-gecir-${RUN}.e2e.test`, p_nonce: 'a'.repeat(32), p_token_hash: 'b'.repeat(64) });
  expect(dom.error).not.toBeNull();

  // Host = A'nın alan adı, sahte x-tenant-key / X-Forwarded-Host = varsayılan ofis → yine A
  const spoof = await rawGet(DOMAIN, '/', { 'x-tenant-key': def!.slug, 'x-forwarded-host': 'localhost' });
  expect(spoof.status).toBe(200);
  expect(spoof.body).toContain(NAME);
  // Kiracı alan adında KARAY konsolu yok
  expect((await rawGet(DOMAIN, '/platform')).status).toBe(404);
});

test('LC-7: şifre sıfırlama — KARAY e-postası, güvenilir bağlantı, yeni şifreyle giriş; hız sınırı', async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  // Sahte X-Forwarded-Host ile istek: Next.js server action koruması reddeder, e-posta gitmez
  await page.setExtraHTTPHeaders({ 'x-forwarded-host': 'evil.example' });
  await page.goto('/admin/sifremi-unuttum');
  const spoofed = mails.length;
  await page.getByLabel('E-posta').fill(OWNER);
  await page.getByRole('button', { name: 'Bağlantı gönder' }).click();
  await expect(page.getByText('Bu adrese kayıtlı bir hesap varsa', { exact: false })).toHaveCount(0);
  await page.waitForTimeout(2_000);
  expect(mails.slice(spoofed).filter((m) => m.to.includes(OWNER))).toHaveLength(0);

  await page.setExtraHTTPHeaders({});

  // Ofisin kendi (aktif) alan adından istenen sıfırlama: bağlantı o alan adına (https) gider —
  // Supabase "Redirect URL" listesine alan adı eklemek gerekmez
  const fromDomain = mails.length;
  await page.goto(`${SITE}/admin/sifremi-unuttum`);
  await page.getByLabel('E-posta').fill(OWNER);
  await page.getByRole('button', { name: 'Bağlantı gönder' }).click();
  await expect(page.getByText('Bu adrese kayıtlı bir hesap varsa', { exact: false })).toBeVisible();
  const domainMail = await mailFor(OWNER, fromDomain, /https?:\/\/[^\s"<>]+\/admin\/auth\/callback\?token_hash=[^\s"<>]+/);
  expect(new URL(domainMail.link).origin).toBe(`https://${DOMAIN}`);

  await page.goto('/admin/sifremi-unuttum');
  const before = mails.length;
  await page.getByLabel('E-posta').fill(OWNER);
  await page.getByRole('button', { name: 'Bağlantı gönder' }).click();
  await expect(page.getByText('Bu adrese kayıtlı bir hesap varsa', { exact: false })).toBeVisible();
  const { mail, link } = await mailFor(OWNER, before, /https?:\/\/[^\s"<>]+\/admin\/auth\/callback\?token_hash=[^\s"<>]+/);
  expect(new URL(link).origin).toBe(new URL(baseURL).origin);
  expect(link).not.toContain('evil.example');
  expect(mail.subject).not.toMatch(/token|http/i);
  expect(mail.key).toMatch(/^password-reset\//);

  // Kayıtlı olmayan adres: aynı yanıt, e-posta yok
  const none = mails.length;
  await page.goto('/admin/sifremi-unuttum');
  await page.getByLabel('E-posta').fill(`yok-${RUN}@example.test`);
  await page.getByRole('button', { name: 'Bağlantı gönder' }).click();
  await expect(page.getByText('Bu adrese kayıtlı bir hesap varsa', { exact: false })).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(mails.slice(none).filter((m) => m.to.includes(`yok-${RUN}@example.test`))).toHaveLength(0);

  // Bağlantı → yeni şifre → giriş
  await page.goto(link);
  await page.waitForURL(/\/admin\/sifre-yenile/, { timeout: 30_000 });
  await page.getByLabel('Yeni şifre', { exact: true }).fill(PASSWORD2);
  await page.getByLabel('Yeni şifre (tekrar)').fill(PASSWORD2);
  await page.getByRole('button', { name: 'Şifreyi kaydet' }).click();
  await expect(page.getByText('Şifreniz güncellendi', { exact: false })).toBeVisible({ timeout: 15_000 });
  await ctx.close();
  const login = await (await freshContext(browser)).newPage();
  await loginOffice(login, baseURL, PASSWORD2);
  await login.context().close();

  // Hız sınırı: aynı adres için saatte 3 istek (bu testte 2 kullanıldı)
  const rl = await (await freshContext(browser)).newPage();
  for (let i = 0; i < 1; i++) {
    await rl.goto('/admin/sifremi-unuttum');
    await rl.getByLabel('E-posta').fill(OWNER);
    await rl.getByRole('button', { name: 'Bağlantı gönder' }).click();
    await expect(rl.getByText('Bu adrese kayıtlı bir hesap varsa', { exact: false })).toBeVisible();
  }
  await rl.goto('/admin/sifremi-unuttum');
  await rl.getByLabel('E-posta').fill(OWNER);
  await rl.getByRole('button', { name: 'Bağlantı gönder' }).click();
  await expect(rl.getByText('Çok fazla istek gönderildi', { exact: false })).toBeVisible();
  // Veritabanına düz e-posta yazılmadı
  const { data: logs } = await service!.from('audit_logs').select('target_type, target_id, metadata').eq('action', 'auth.password_reset_requested').order('created_at', { ascending: false }).limit(5);
  for (const l of logs ?? []) {
    expect(JSON.stringify(l)).not.toContain(OWNER);
    if (l.target_type === 'email_hash') expect(l.target_id).toMatch(/^[0-9a-f]{64}$/);
  }
  await rl.context().close();
});

test('LC-8: askıya alınan ofis (KARAY konsolundan) — site 404, panel kapalı; yeniden açılınca döner', async ({ page, browser }) => {
  test.setTimeout(150_000);
  await loginPlatform(page);
  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  await page.getByLabel('Durum').filter({ has: page.locator('option[value="suspended"]') }).selectOption('suspended');
  await expect(page.getByText('Organizasyon durumu güncellendi.', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  // Önbellek etiketi yenilendiği için beklemeden kapanır
  expect((await rawGet(DOMAIN, '/')).status).toBe(404);

  const ctx = await freshContext(browser);
  const office = await ctx.newPage();
  await office.goto(`${baseURL}/admin/giris`);
  await office.getByLabel('E-posta').fill(OWNER);
  await office.getByLabel('Şifre', { exact: true }).fill(PASSWORD2);
  await office.getByRole('button', { name: 'Giriş yap' }).click();
  await office.waitForLoadState('networkidle');
  await office.goto(`${baseURL}/admin/ilanlar`);
  await expect(office).toHaveURL(/\/admin\/(erisim-yok|yetkisiz|giris)/);
  await ctx.close();

  await page.getByLabel('Durum').filter({ has: page.locator('option[value="suspended"]') }).selectOption('active');
  await expect(page.getByText('Organizasyon durumu güncellendi.', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await rawGet(DOMAIN, '/')).status, { timeout: 20_000 }).toBe(200);
});
