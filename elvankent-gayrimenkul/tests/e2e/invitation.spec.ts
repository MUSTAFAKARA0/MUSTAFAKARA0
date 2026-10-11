import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * P0.4 — Müşteri daveti ve güvenli hesap aktivasyonu (gerçek uygulama + yerel veritabanı).
 *
 *  INV-1  Yeni müşteri: platform → organizasyon oluştur → sahip daveti "bekliyor", geçici şifre YOK
 *  INV-5  Tekrar gönder: eski bağlantı geçersiz, yeni bağlantı çalışır
 *  INV-2  Aktivasyon: bağlantı → şifre → oturum → /admin → doğru ofis, doğru rol; normal giriş çalışır
 *  INV-6  Tekrar kullanım: kabul edilmiş bağlantı ikinci kez çalışmaz
 *  INV-8  Rol / kiracı manipülasyonu: forma eklenen organization_id / role / redirect yok sayılır
 *  INV-3  Süresi dolmuş davet ile hesap etkinleştirilemez
 *  INV-4  İptal: bekleyen davet iptal edilir, eski bağlantı çalışmaz; hesap ve ofis silinmez
 *  INV-7  Kiracı izolasyonu: A'nın daveti B'yi etkilemez, A'nın sahibi B'yi göremez
 *
 * E-posta: uygulama EMAIL_PROVIDER=resend + RESEND_API_BASE=http://127.0.0.1:4010 ile başlatılır;
 * bu dosya o adreste sahte bir Resend sunucusu açar ve gönderilen bağlantıyı yakalar (gerçek
 * e-posta gönderilmez). Oluşturulan organizasyonlar ve hesaplar test sonunda silinir.
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

const RUN = randomBytes(3).toString('hex');
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = url && serviceKey ? createClient(url, serviceKey, opts) : null;
const ORG = { slug: `davet-${RUN}`, name: `Davet Ofisi ${RUN}`, owner: `davet-sahip-${RUN}@example.test` };
const PASSWORD = `Davet-${RUN}-Sifre9x`;
const created = { orgs: [] as string[], emails: [ORG.owner] as string[] };
const S: { orgId?: string; link1?: string; link2?: string } = {};

type Mail = { to: string[]; subject: string; html: string; text: string };
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
      res.end(JSON.stringify({ id: `e2e-${mails.length}` }));
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
  for (const id of created.orgs) await service.from('organizations').delete().eq('id', id);
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email && created.emails.includes(u.email)) await service.auth.admin.deleteUser(u.id);
});

const tokenOf = (link: string) => /\/admin\/davet#t=([A-Za-z0-9_-]{43})$/.exec(link)?.[1] ?? null;
const activationUrl = (token: string, query = '') => `${baseURL}/admin/davet${query}#t=${token}`;

async function lastLinkFor(email: string, after: number): Promise<string> {
  await expect.poll(() => mails.slice(after).filter((m) => m.to?.includes(email)).length, { timeout: 15_000 }).toBeGreaterThan(0);
  const mail = mails.slice(after).filter((m) => m.to.includes(email)).at(-1)!;
  const link = /https?:\/\/[^\s"<>]+\/admin\/davet#t=[A-Za-z0-9_-]{43}/.exec(mail.text)?.[0];
  expect(link, 'e-postada aktivasyon bağlantısı').toBeTruthy();
  // Konu satırında token / bağlantı yok; e-postada şifre yok
  expect(mail.subject).not.toContain(tokenOf(link!)!);
  expect(mail.text).not.toMatch(/şifreniz:|geçici şifre/i);
  return link!;
}

/** Her bağlam ayrı istemci IP'si (deneme sınırı testler arasında birikmesin) */
async function freshPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    ...test.info().project.use,
    extraHTTPHeaders: { 'x-forwarded-for': `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}` },
  });
  return ctx.newPage();
}

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL(/\/platform$/);
}

async function expectInvalid(page: Page, token: string) {
  await page.goto(activationUrl(token));
  await expect(page.getByTestId('invitation-invalid')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Bu davet artık geçerli değil.', { exact: false })).toBeVisible();
  await expect(page.getByTestId('activation-form')).toHaveCount(0);
}

/** Süper admin oturumuyla (yetkili yol) bilinen tokenlı bekleyen davetli organizasyon açar */
async function orgWithKnownToken(label: string): Promise<{ orgId: string; token: string; email: string; userId: string }> {
  const email = `davet-${label}-${RUN}@example.test`;
  created.emails.push(email);
  const { data: user, error: userError } = await service!.auth.admin.createUser({ email, email_confirm: false });
  expect(userError).toBeNull();
  const admin = createClient(url!, anonKey!, opts);
  expect((await admin.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! })).error).toBeNull();
  const token = randomBytes(32).toString('base64url');
  const { data: orgId, error } = await admin.rpc('platform_create_organization', {
    p_slug: `davet-${label}-${RUN}`,
    p_name: `Davet ${label.toUpperCase()} ${RUN}`,
    p_prefix: `D${label.toUpperCase().slice(0, 1)}${String.fromCharCode(65 + (randomBytes(1)[0] % 26))}`,
    p_plan: 'baslangic',
    p_owner: user.user!.id,
    p_invite_token_hash: createHash('sha256').update(token).digest('hex'),
  });
  expect(error).toBeNull();
  created.orgs.push(orgId as string);
  return { orgId: orgId as string, token, email, userId: user.user!.id };
}

test('INV-1: yeni müşteri — davet bekliyor, geçici şifre gösterilmez', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/organizasyonlar/yeni');
  await page.getByLabel('Organizasyon adı').fill(ORG.name);
  await page.getByLabel('Kısa ad (alt alan adı)').fill(ORG.slug);
  await page.getByLabel('İlan no öneki').fill(`V${String.fromCharCode(65 + (parseInt(RUN.slice(0, 2), 16) % 26))}${String.fromCharCode(65 + (parseInt(RUN.slice(2, 4), 16) % 26))}`);
  await page.getByLabel('Sahip adı soyadı').fill('Davet Sahibi');
  await page.getByLabel('Sahip e-postası').fill(ORG.owner);
  await page.getByRole('button', { name: 'Organizasyonu oluştur' }).click();
  await expect(page.getByText('Organizasyon oluşturuldu.')).toBeVisible({ timeout: 30_000 });

  const card = page.getByTestId('owner-invitation');
  await expect(card).toHaveAttribute('data-status', 'pending');
  await expect(card).toContainText(ORG.owner);
  await expect(card).toContainText('Davet bekliyor');
  await expect(card).toContainText('Davet gönderilmeye hazır.');
  // Geçici şifre / kopyalanacak kod yok
  await expect(page.locator('code')).toHaveCount(0);
  await expect(page.getByText(/geçici şifre/i)).toHaveCount(0);

  const { data: org } = await service!.from('organizations').select('id').eq('slug', ORG.slug).single();
  S.orgId = org!.id;
  created.orgs.push(org!.id);
  const { data: inv } = await service!.from('organization_invitations').select('status, email, role, token_hash, expires_at, last_sent_at').eq('organization_id', S.orgId).single();
  expect(inv).toMatchObject({ status: 'pending', email: ORG.owner, role: 'owner', last_sent_at: null });
  expect(inv!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  // Süre politikası: 72 saat (± birkaç dakika)
  const hours = (new Date(inv!.expires_at).getTime() - Date.now()) / 3_600_000;
  expect(hours).toBeGreaterThan(71.5);
  expect(hours).toBeLessThanOrEqual(72);
  // Hesap şifresiz ve doğrulanmamış: giriş yapılamaz
  const { data: users } = await service!.auth.admin.listUsers({ perPage: 1000 });
  const owner = users.users.find((u) => u.email === ORG.owner)!;
  expect(owner.email_confirmed_at ?? null).toBeNull();
  const { data: profile } = await service!.from('profiles').select('password_change_required, is_super_admin').eq('id', owner.id).single();
  expect(profile).toMatchObject({ password_change_required: false, is_super_admin: false });

  // Davet gönder → e-posta (sahte sunucu) → bağlantı
  const before = mails.length;
  await card.getByRole('button', { name: 'Davet gönder' }).click();
  S.link1 = await lastLinkFor(ORG.owner, before);
  await expect(card.getByRole('button', { name: 'Daveti tekrar gönder' })).toBeVisible();
  const { data: sent } = await service!.from('organization_invitations').select('token_hash, last_sent_at').eq('organization_id', S.orgId).single();
  // Veritabanında ham token değil, özeti var
  expect(sent!.token_hash).toBe(createHash('sha256').update(tokenOf(S.link1)!).digest('hex'));
  expect(sent!.token_hash).not.toContain(tokenOf(S.link1)!);
  expect(sent!.last_sent_at).not.toBeNull();
});

test('INV-5: tekrar gönder — eski bağlantı geçersiz, yeni bağlantı çalışır', async ({ page, browser }) => {
  await loginPlatform(page);
  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  const card = page.getByTestId('owner-invitation');
  await expect(card).toHaveAttribute('data-status', 'pending');
  const before = mails.length;
  await card.getByRole('button', { name: 'Daveti tekrar gönder' }).click();
  S.link2 = await lastLinkFor(ORG.owner, before);
  expect(tokenOf(S.link2)).not.toBe(tokenOf(S.link1!));

  const old = await freshPage(browser);
  await expectInvalid(old, tokenOf(S.link1!)!);
  await old.context().close();

  const fresh = await freshPage(browser);
  await fresh.goto(activationUrl(tokenOf(S.link2)!));
  await expect(fresh.getByTestId('activation-form')).toBeVisible({ timeout: 15_000 });
  await expect(fresh.getByTestId('invitation-email')).toHaveText(ORG.owner);
  // Token adres çubuğundan silinir
  expect(new URL(fresh.url()).hash).toBe('');
  await fresh.context().close();
});

test('INV-2 + INV-8: aktivasyon → şifre → /admin; doğru ofis ve rol, manipülasyon yok sayılır, açık yönlendirme yok', async ({ browser }) => {
  const other = await orgWithKnownToken('b');
  const page = await freshPage(browser);
  // Kullanıcının eklediği yönlendirme parametreleri dikkate alınmaz
  await page.goto(activationUrl(tokenOf(S.link2!)!, '?next=https://evil.example&redirect=//evil.example'));
  const form = page.getByTestId('activation-form');
  await expect(form).toBeVisible({ timeout: 15_000 });
  // Saldırgan form alanları: başka kiracı, platform rolü, dış yönlendirme
  await form.evaluate((el, orgB) => {
    for (const [name, value] of [
      ['organization_id', orgB],
      ['organizationId', orgB],
      ['role', 'platform_admin'],
      ['is_super_admin', 'true'],
      ['next', 'https://evil.example'],
      ['redirect', 'https://evil.example'],
    ]) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      el.appendChild(input);
    }
  }, other.orgId);
  await page.getByLabel('Yeni şifre', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Yeni şifre (tekrar)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Hesabımı etkinleştir' }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/davet'), { timeout: 30_000 });
  expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);
  await expect(page.getByText(ORG.name).first()).toBeVisible({ timeout: 15_000 });

  const { data: users } = await service!.auth.admin.listUsers({ perPage: 1000 });
  const owner = users.users.find((u) => u.email === ORG.owner)!;
  expect(owner.email_confirmed_at).toBeTruthy();
  const { data: memberships } = await service!.from('organization_members').select('organization_id, role, status').eq('user_id', owner.id);
  expect(memberships).toEqual([{ organization_id: S.orgId, role: 'owner', status: 'active' }]);
  const { data: profile } = await service!.from('profiles').select('is_super_admin').eq('id', owner.id).single();
  expect(profile!.is_super_admin).toBe(false);
  const { data: inv } = await service!.from('organization_invitations').select('status, accepted_at').eq('organization_id', S.orgId).single();
  expect(inv!.status).toBe('accepted');
  // B'nin daveti etkilenmedi
  const { data: invB } = await service!.from('organization_invitations').select('status').eq('organization_id', other.orgId).single();
  expect(invB!.status).toBe('pending');
  // Platform konsolu sahibe kapalı
  const res = await page.goto('/platform');
  expect(res?.status()).toBe(404);
  await page.context().close();

  // Normal giriş (Supabase Auth şifresi) çalışır ve ofis paneline girer
  const login = await freshPage(browser);
  await login.goto('/admin/giris');
  await login.getByLabel('E-posta').fill(ORG.owner);
  await login.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await login.getByRole('button', { name: 'Giriş yap' }).click();
  await login.waitForURL((u) => u.pathname === '/admin');
  await expect(login.getByText(ORG.name).first()).toBeVisible();
  await login.context().close();
});

test('INV-6: kabul edilmiş bağlantı ikinci kez kullanılamaz; platformda "Aktif"', async ({ page, browser }) => {
  const replay = await freshPage(browser);
  await expectInvalid(replay, tokenOf(S.link2!)!);
  await replay.context().close();
  await loginPlatform(page);
  await page.goto(`/platform/organizasyonlar/${S.orgId}`);
  const card = page.getByTestId('owner-invitation');
  await expect(card).toHaveAttribute('data-status', 'accepted');
  await expect(card).toContainText('Aktif');
  await expect(card.getByRole('button')).toHaveCount(0);
});

test('INV-3: süresi dolmuş davetle hesap etkinleştirilemez', async ({ browser }) => {
  const c = await orgWithKnownToken('c');
  await service!.from('organization_invitations').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('organization_id', c.orgId);
  const page = await freshPage(browser);
  await expectInvalid(page, c.token);
  await page.context().close();
  const { data: inv } = await service!.from('organization_invitations').select('status').eq('organization_id', c.orgId).single();
  expect(inv!.status).toBe('pending');
  const { data: users } = await service!.auth.admin.listUsers({ perPage: 1000 });
  expect(users.users.find((u) => u.email === c.email)!.email_confirmed_at ?? null).toBeNull();
});

test('INV-4: iptal — eski bağlantı çalışmaz, hesap ve ofis silinmez', async ({ page, browser }) => {
  const d = await orgWithKnownToken('d');
  await loginPlatform(page);
  await page.goto(`/platform/organizasyonlar/${d.orgId}`);
  const card = page.getByTestId('owner-invitation');
  await expect(card).toHaveAttribute('data-status', 'pending');
  await card.getByRole('button', { name: 'Daveti iptal et' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Daveti iptal et' }).click();
  await expect(card).toHaveAttribute('data-status', 'revoked', { timeout: 15_000 });
  await expect(card).toContainText('İptal edildi');
  await expect(card.getByRole('button', { name: 'Yeni davet' })).toBeVisible();

  const link = await freshPage(browser);
  await expectInvalid(link, d.token);
  await link.context().close();
  const { data: org } = await service!.from('organizations').select('id').eq('id', d.orgId).maybeSingle();
  expect(org).not.toBeNull();
  const { data: user } = await service!.auth.admin.getUserById(d.userId);
  expect(user.user?.email).toBe(d.email);
});

test('INV-7: kiracı izolasyonu — A sahibi B ofisini göremez ve seçemez', async ({ browser }) => {
  const b = (await service!.from('organizations').select('id').eq('slug', `davet-b-${RUN}`).single()).data!;
  const page = await freshPage(browser);
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(ORG.owner);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((u) => u.pathname === '/admin');
  // Aktif ofis çerezini B'ye çevirmek erişim vermez (üyelik sunucuda doğrulanır)
  await page.context().addCookies([{ name: 'eg_active_org', value: b.id, url: baseURL }]);
  await page.goto('/admin');
  await expect(page.getByText(ORG.name).first()).toBeVisible();
  await expect(page.getByText(`Davet B ${RUN}`)).toHaveCount(0);
  // A sahibinin oturumu B'nin davet kayıtlarını okuyamaz (RLS)
  const client = createClient(url!, anonKey!, opts);
  await client.auth.signInWithPassword({ email: ORG.owner, password: PASSWORD });
  const { data: rows } = await client.from('organization_invitations').select('id, organization_id');
  expect((rows ?? []).every((r) => r.organization_id === S.orgId)).toBe(true);
  const hashRead = await client.from('organization_invitations').select('token_hash');
  expect(hashRead.error).not.toBeNull();
  await page.context().close();
});
