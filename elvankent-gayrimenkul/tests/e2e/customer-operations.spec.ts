import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * FAZ 1 — Müşteri operasyonları (gerçek uygulama + yerel veritabanı + sahte e-posta sunucusu).
 *
 *  CO-1  KARAY: yeni müşteri → listede "Dikkat: sahip daveti gönderilmedi"; arama + durum filtresi;
 *        detayda müşteri durumu paneli; site taslak; "Siteyi aç" başka müşterinin adresine gitmez
 *  CO-2  Kendi adresi olmayan sitede önizleme açık hatayla reddedilir (başka müşterinin adresine gitmez)
 *  CO-3  KARAY notları: ekleme → listede ve sayı; ofis paneli notları görmez
 *  CO-4  Davet → aktivasyon → ofis panelinde kurulum listesi (ilerleme, adım bağlantıları)
 *  CO-5  Ekip daveti: sahip danışman ekler → geçici şifre YOK → e-posta → "Davet bekliyor" → tekrar gönder
 *        (eski bağlantı geçersiz) → aktivasyon → danışman kurulum listesini görmez, kullanıcı ekranına giremez
 *  CO-6  KARAY genel bakış: müşteri operasyon metrikleri
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
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const SLUG = `musteri-${RUN}`;
const NAME = `Musteri Ofisi ${RUN}`;
const OWNER = `musteri-sahip-${RUN}@example.test`;
const AGENT = `musteri-danisman-${RUN}@example.test`;
const PASSWORD = `Musteri-${RUN}-Sifre9x`;
const NOTE = `Satış görüşmesi yapıldı ${RUN}`;
const S: { orgId?: string; ownerLink?: string; agentLink?: string } = {};

type Mail = { to: string[]; subject: string; text: string };
const mails: Mail[] = [];
let mailServer: Server | null = null;

test.beforeAll(async () => {
  mailServer = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        mails.push(JSON.parse(body || '{}') as Mail);
      } catch {
        // geçersiz gövde yok sayılır
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: `co-${mails.length}` }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    mailServer!.once('error', reject);
    mailServer!.listen(4010, '127.0.0.1', () => resolve());
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (mailServer ? mailServer.close(() => resolve()) : resolve()));
  if (!service) return;
  if (S.orgId) await service.from('organizations').delete().eq('id', S.orgId);
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email === OWNER || u.email === AGENT) await service.auth.admin.deleteUser(u.id);
});

async function freshContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    ...test.info().project.use,
    extraHTTPHeaders: { 'x-forwarded-for': `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}` },
  });
}

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL(/\/platform$/);
}

async function linkFor(email: string, after: number): Promise<string> {
  await expect.poll(() => mails.slice(after).filter((m) => m.to?.includes(email)).length, { timeout: 20_000 }).toBeGreaterThan(0);
  const mail = mails.slice(after).filter((m) => m.to.includes(email)).at(-1)!;
  const link = /https?:\/\/[^\s"<>]+\/admin\/davet#t=[A-Za-z0-9_-]{43}/.exec(mail.text)?.[0];
  expect(link, 'e-postada aktivasyon bağlantısı').toBeTruthy();
  expect(mail.text).not.toMatch(/geçici şifre/i);
  return link!;
}

/** Bağlantıyı yerel sunucuda açar (kendi adresi olmayan ofiste panel kökü yerelde NEXT_PUBLIC_SITE_URL) */
const local = (link: string) => link.replace(/^https?:\/\/[^/]+/, '');

async function activate(page: Page, link: string) {
  await page.goto(local(link));
  await expect(page.getByTestId('activation-form')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Yeni şifre', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Yeni şifre (tekrar)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Hesabımı etkinleştir' }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/davet'), { timeout: 30_000 });
}

test('CO-1: yeni müşteri listede "Dikkat"; arama ve filtre; detayda durum paneli; site taslak', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/organizasyonlar/yeni');
  await page.getByLabel('Organizasyon adı').fill(NAME);
  await page.getByLabel('Kısa ad (alt alan adı)').fill(SLUG);
  await page.getByLabel('İlan no öneki').fill(`M${String.fromCharCode(65 + (parseInt(RUN.slice(0, 2), 16) % 26))}${String.fromCharCode(65 + (parseInt(RUN.slice(2, 4), 16) % 26))}`);
  await page.getByLabel('Sahip adı soyadı').fill('Musteri Sahibi');
  await page.getByLabel('Sahip e-postası').fill(OWNER);
  await page.getByRole('button', { name: 'Organizasyonu oluştur' }).click();
  await expect(page.getByText('Organizasyon oluşturuldu.')).toBeVisible({ timeout: 30_000 });
  const { data: org } = await service!.from('organizations').select('id').eq('slug', SLUG).single();
  S.orgId = org!.id;
  const { data: site } = await service!.from('site_configs').select('site_status').eq('organization_id', S.orgId).single();
  expect(site!.site_status).toBe('draft');

  // Detay: müşteri durumu paneli; davet gönderilmedi → Dikkat; kurulum adımları
  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  const status = page.locator('[data-customer-status]').first();
  await expect(status).toHaveAttribute('data-customer-status', 'attention');
  await expect(page.getByText('Sahip daveti gönderilmedi').first()).toBeVisible();
  await expect(page.locator('[data-step="company"]')).toBeVisible();
  // Kendi adresi olmayan sitede "Siteyi aç" yok (başka müşterinin adresine gitmez)
  await expect(page.getByRole('link', { name: 'Siteyi aç' })).toHaveCount(0);

  // Liste: arama + filtre
  await page.goto(`/platform/organizasyonlar?q=${encodeURIComponent(SLUG)}`);
  const row = page.locator('tr[data-customer-status]').filter({ hasText: NAME });
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('data-customer-status', 'attention');
  await expect(row).toContainText('Taslak (kapalı)');
  await expect(row).toContainText('davet gönderilmedi');
  await page.goto(`/platform/organizasyonlar?q=${encodeURIComponent(SLUG)}&durum=live`);
  await expect(page.locator('tr[data-customer-status]').filter({ hasText: NAME })).toHaveCount(0);
  await page.goto(`/platform/organizasyonlar?q=${encodeURIComponent(SLUG)}&durum=attention`);
  await expect(page.locator('tr[data-customer-status]').filter({ hasText: NAME })).toHaveCount(1);
  // Geçersiz filtre yok sayılır
  await page.goto(`/platform/organizasyonlar?q=${encodeURIComponent(SLUG)}&durum=%27%3Bdrop`);
  await expect(page.locator('tr[data-customer-status]').filter({ hasText: NAME })).toHaveCount(1);

  // Davet gönderilince durum "Davet bekliyor"
  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  const before = mails.length;
  await page.getByTestId('owner-invitation').getByRole('button', { name: 'Davet gönder' }).click();
  S.ownerLink = await linkFor(OWNER, before);
  await page.reload();
  await expect(page.locator('[data-customer-status]').first()).toHaveAttribute('data-customer-status', 'invited');
});

test('CO-2: kendi adresi olmayan sitede önizleme açık hatayla reddedilir', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/siteler');
  const row = page.locator('tr').filter({ hasText: NAME });
  await expect(row).toContainText('Adres yok');
  await row.getByRole('button', { name: 'Önizle' }).click();
  await expect(page.getByText('Bu sitenin henüz bir adresi yok', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
});

test('CO-3: KARAY notu eklenir ve listelenir; düzenleme/silme yok', async ({ page }) => {
  await loginPlatform(page);
  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  await page.getByLabel('Yeni not').fill(NOTE);
  await page.getByRole('button', { name: 'Not ekle' }).click();
  await expect(page.getByText('Not eklendi.').first()).toBeVisible();
  const notes = page.locator('[data-org-notes]');
  await expect(notes).toContainText(NOTE);
  await expect(notes).toContainText(adminEmail!);
  await expect(notes.getByRole('button')).toHaveCount(0);
  const { data } = await service!.from('platform_org_notes').select('body').eq('organization_id', S.orgId!);
  expect(data!.map((n) => n.body)).toEqual([NOTE]);
});

test('CO-4: aktivasyon → ofis panelinde kurulum listesi', async ({ browser }) => {
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await activate(page, S.ownerLink!);
  await page.goto('/admin');
  const list = page.locator('[data-onboarding-checklist]');
  await expect(list).toBeVisible();
  await expect(list).toHaveAttribute('data-progress', '0');
  // Başlangıç planı: alan adı adımı isteğe bağlı; "yayına açma" KARAY'ın adımı
  await expect(list.locator('[data-step="domain"]')).toContainText('isteğe bağlı');
  await expect(list.locator('[data-step="live"]')).toContainText('KARAY');
  await list.locator('[data-step="listing"]').getByRole('link').click();
  await expect(page).toHaveURL(/\/admin\/ilanlar\/yeni$/);
  // Ofis KARAY notlarını göremez
  await page.goto('/admin');
  await expect(page.getByText(NOTE)).toHaveCount(0);
  await ctx.close();
});

test('CO-5: ekip daveti — geçici şifre yok; tekrar gönder eskiyi geçersiz kılar; danışman sınırlı', async ({ browser }) => {
  const ctx = await freshContext(browser);
  const page = await ctx.newPage();
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(OWNER);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((u) => u.pathname === '/admin', { timeout: 30_000 });

  await page.goto('/admin/kullanicilar');
  await page.getByRole('button', { name: 'Yeni kullanıcı' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yeni kullanıcı' });
  await dialog.getByLabel('Ad soyad').fill('Musteri Danisman');
  await dialog.getByLabel('E-posta').fill(AGENT);
  await dialog.getByLabel('Rol').selectOption('agent');
  let before = mails.length;
  await dialog.getByRole('button', { name: 'Kullanıcıyı ekle' }).click();
  const added = page.getByRole('dialog', { name: 'Kullanıcı eklendi' });
  await expect(added.locator('[data-member-invited]')).toContainText('davet bağlantısı gönderildi');
  await expect(added.locator('code')).toHaveCount(0);
  const first = await linkFor(AGENT, before);
  await added.getByRole('button', { name: 'Tamam' }).click();

  const { data: users } = await service!.auth.admin.listUsers({ perPage: 1000 });
  const agent = users.users.find((u) => u.email === AGENT)!;
  expect(agent.email_confirmed_at ?? null).toBeNull();
  const { data: profile } = await service!.from('profiles').select('password_change_required').eq('id', agent.id).single();
  expect(profile!.password_change_required).toBe(false);

  await page.reload();
  const row = page.getByRole('row').filter({ hasText: AGENT });
  await expect(row.getByText('Davet bekliyor')).toBeVisible();
  // Tekrar gönder: yeni bağlantı, eskisi geçersiz
  before = mails.length;
  await row.getByRole('button', { name: /için işlemler/ }).click();
  await page.getByRole('menuitem', { name: 'Daveti tekrar gönder' }).click();
  await expect(page.getByText('Davet e-postası gönderildi', { exact: false }).first()).toBeVisible();
  S.agentLink = await linkFor(AGENT, before);
  expect(S.agentLink).not.toBe(first);
  await ctx.close();

  const oldCtx = await freshContext(browser);
  const old = await oldCtx.newPage();
  await old.goto(local(first));
  await expect(old.getByTestId('invitation-invalid')).toBeVisible({ timeout: 15_000 });
  await oldCtx.close();

  const agentCtx = await freshContext(browser);
  const ap = await agentCtx.newPage();
  await activate(ap, S.agentLink!);
  await ap.goto('/admin');
  await expect(ap.getByText(NAME).first()).toBeVisible();
  // Danışman: kurulum listesi yok, kullanıcı yönetimi yok
  await expect(ap.locator('[data-onboarding-checklist]')).toHaveCount(0);
  await ap.goto('/admin/kullanicilar');
  await expect(ap).toHaveURL(/\/admin\/yetkisiz\?izin=users\.manage/);
  const { data: m } = await service!.from('organization_members').select('role, status').eq('organization_id', S.orgId!).eq('user_id', agent.id).single();
  expect(m).toMatchObject({ role: 'agent', status: 'active' });
  await agentCtx.close();
});

test('CO-6: KARAY genel bakış — müşteri operasyon metrikleri', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform');
  const metrics = page.locator('[data-customer-metrics]');
  await expect(metrics).toBeVisible();
  for (const label of ['Dikkat', 'Davet bekliyor', 'Kurulumda', 'Yayına hazır', 'Yayında', 'Alan adı bekliyor', 'Askıda']) {
    await expect(metrics.getByText(label, { exact: true })).toBeVisible();
  }
  // Etkinleşmiş, kurulumu eksik müşteri "Kurulumda" filtresinde
  await metrics.getByRole('link', { name: /Kurulumda/ }).click();
  await expect(page).toHaveURL(/durum=setup/);
  await expect(page.locator('tr[data-customer-status="setup"]').filter({ hasText: NAME })).toHaveCount(1);
});
