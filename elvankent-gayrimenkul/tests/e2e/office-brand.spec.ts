import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * P0.2 — Marka ve site içeriği taslağı: gerçek bir kiracıda uçtan uca.
 *
 *  OBR-A  Marka (13 adım): Marka ve görünüm açılır → firma adı, telefon, logo değiştirilir → taslağa
 *         kaydedilir → canlı site ESKİ bilgileri gösterir → önizleme YENİLERİ gösterir → yayın →
 *         canlı site yenileri gösterir → geri alma → eski bilgiler geri gelir.
 *  OBR-B  Yetki: A kiracısının kullanıcısı B'nin markasını/iletişimini/logosunu/taslağını göremez ve
 *         değiştiremez; doğrudan veritabanı yazımı da reddedilir.
 *  OBR-C  Telefon genişliği: marka/site yönetimi ekranlarında yatay taşma yok; taslak/yayın durumu ve
 *         düğmeleri görünür.
 *
 * Geçici iki kiracı test sonunda silinir. Yalnızca yerel DB.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });
test.skip(!url || !serviceKey || !anonKey, 'Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const HOST_A = `obr-a-${RUN}.e2e.test`;
const HOST_B = `obr-b-${RUN}.e2e.test`;
const SITE_A = `http://${HOST_A}:${PORT}`;
const SITE_B = `http://${HOST_B}:${PORT}`;
const PASSWORD = `Brand-${randomBytes(6).toString('hex')}-4m`;
const OLD_NAME = `Eski Marka ${RUN}`;
const NEW_NAME = `Yeni Marka ${RUN}`;
const OLD_PHONE = '0312 555 10 10';
const NEW_PHONE = '0312 555 20 20';
const B_NAME = `B Marka ${RUN}`;
const logoFile = path.join(__dirname, '.fixtures', 'kabul-logo.png');

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST_A} 127.0.0.1, MAP ${HOST_B} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${SITE_A},${SITE_B}`],
  },
});

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const S: { a?: string; b?: string; users: { id: string; email: string; org: 'a' | 'b' }[] } = { users: [] };

async function makeOrg(key: 'a' | 'b', host: string, name: string) {
  const org = await service!.from('organizations').insert({ slug: `obr-${key}-${RUN}`, name, reference_prefix: `B${key.toUpperCase()}${RUN.slice(0, 1).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' }).select('id').single();
  if (org.error) throw org.error;
  const id = org.data.id;
  await service!.from('organization_settings').insert({ organization_id: id, display_name: name, phone: OLD_PHONE, address_city: 'Ankara', service_area: 'Ankara' });
  await service!.from('subscriptions').insert({ organization_id: id, plan_id: 'kurumsal', status: 'active' });
  await service!.from('organization_domains').insert({ organization_id: id, hostname: host, is_primary: true, verified_at: new Date().toISOString(), status: 'active', activated_at: new Date().toISOString() });
  return id;
}

async function makeOwner(org: 'a' | 'b') {
  const email = `obr-${RUN}-${org}@example.test`;
  const { data, error } = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Marka ${org}` } });
  if (error) throw error;
  S.users.push({ id: data.user.id, email, org });
  const m = await service!.from('organization_members').insert({ organization_id: org === 'a' ? S.a! : S.b!, user_id: data.user.id, role: 'owner', status: 'active' });
  if (m.error) throw m.error;
  return email;
}

const owner = (org: 'a' | 'b') => S.users.find((u) => u.org === org)!.email;

test.beforeAll(async () => {
  S.a = await makeOrg('a', HOST_A, OLD_NAME);
  S.b = await makeOrg('b', HOST_B, B_NAME);
  await makeOwner('a');
  await makeOwner('b');
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

async function publish(page: Page, note: string) {
  await page.getByRole('button', { name: 'Değişiklikleri yayınla' }).click();
  await page.getByLabel('Sürüm notu').fill(note);
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText(/Yayınlandı \(sürüm \d+\)/)).toBeVisible();
}

const digits = (s: string) => s.replace(/\D/g, '');
const settingsOf = async (org: string) => (await service!.from('organization_settings').select('display_name, phone, logo_url').eq('organization_id', org).single()).data!;
const draftOf = async (org: string) => (await service!.from('site_configs').select('draft, published_version').eq('organization_id', org).single()).data!;

/** Sitedeki marka: başlıktaki ad, iletişim sayfasındaki telefon bağlantıları, header logosu */
async function siteBrand(p: Page, site: string) {
  await p.goto(`${site}/iletisim`, { waitUntil: 'networkidle' });
  const html = await p.content();
  const tels = await p.locator('a[href^="tel:"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  const logos = await p.getByRole('banner').locator('img[src*="branding"]').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).currentSrc || e.getAttribute('src') || ''));
  return { html, tels: tels.map(digits), logos };
}

test('OBR-A: marka değişikliği taslak → önizleme → yayın → geri alma (13 adım)', async ({ page, browser }) => {
  test.setTimeout(240_000);
  await mapHttps(page.context());
  await loginOffice(page, owner('a'));

  // Başlangıç: geri dönülecek bir yayın sürümü (ilk yayın) — slogan taslağa yazılıp yayınlanır
  await page.goto('/admin/sirket');
  await page.getByLabel('Slogan').fill('Güvenilir danışmanlık');
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
  await publish(page, 'İlk sürüm');
  const v1 = (await draftOf(S.a!)).published_version;

  // 1) Marka ve görünüm açılır (taslak durumu görünür)
  await page.goto('/admin/sirket');
  await expect(page.getByRole('heading', { name: 'Marka ve görünüm', level: 1 })).toBeVisible();
  await expect(page.getByTestId('site-status')).toContainText('Taslak canlı siteyle aynı');
  // 2) Firma adı  3) Telefon
  await page.getByLabel('Şirket adı').fill(NEW_NAME);
  await page.getByLabel('Telefon', { exact: true }).fill(NEW_PHONE);
  // 5) Taslağa kaydet
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
  // 4) Logo (görsel taslağa yüklenir)
  await page.locator('#branding-logo').setInputFiles(logoFile);
  await expect(page.getByText('Logo taslağa kaydedildi', { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId('site-status')).toContainText('Taslak değişiklikler var');
  const draft = await draftOf(S.a!);
  const newLogo = (draft.draft as { brand: { logo_url: string } }).brand.logo_url;
  expect(newLogo).toMatch(new RegExp(`^organizations/${S.a}/branding/logo-[0-9a-f]{16}-`));
  // Canlı ayar kaydı değişmedi
  const live = await settingsOf(S.a!);
  expect(live.display_name).toBe(OLD_NAME);
  expect(digits(live.phone ?? '')).toBe(digits(OLD_PHONE));
  expect(live.logo_url).toBeNull();

  // 6) Canlı site kontrol edilir  7) ESKİ bilgileri gösterir (önizleme çerezi olmayan ziyaretçi)
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  let pub = await siteBrand(v, SITE_A);
  expect(pub.html).toContain(OLD_NAME);
  expect(pub.html).not.toContain(NEW_NAME);
  expect(pub.tels.some((t) => t.endsWith(digits(OLD_PHONE).slice(1)))).toBe(true);
  expect(pub.tels.some((t) => t.endsWith(digits(NEW_PHONE).slice(1)))).toBe(false);
  expect(pub.logos).toHaveLength(0);

  // 8) Önizleme açılır  9) YENİ bilgileri gösterir (aynı Site Engine, taslak yapılandırma)
  const [preview] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: 'Önizle' }).first().click()]);
  await preview.waitForURL(new RegExp(`^${SITE_A}/`));
  await expect(preview.getByText('ÖNİZLEME', { exact: false }).first()).toBeVisible();
  const pre = await siteBrand(preview, SITE_A);
  expect(pre.html).toContain(NEW_NAME);
  expect(pre.tels.some((t) => t.endsWith(digits(NEW_PHONE).slice(1)))).toBe(true);
  expect(pre.logos.some((src) => src.includes(path.basename(newLogo)))).toBe(true);
  await preview.close();

  // 10) Yayınla
  await page.goto('/admin/sirket');
  await publish(page, 'Yeni marka');
  // 11) Canlı site yeni bilgileri gösterir
  pub = await siteBrand(v, SITE_A);
  expect(pub.html).toContain(NEW_NAME);
  expect(pub.tels.some((t) => t.endsWith(digits(NEW_PHONE).slice(1)))).toBe(true);
  expect(pub.logos.some((src) => src.includes(path.basename(newLogo)))).toBe(true);
  expect((await settingsOf(S.a!)).logo_url).toBe(newLogo);

  // 12) Geri alma (sürüm geçmişinden ilk sürüm)  13) Eski bilgiler geri gelir
  await page.goto('/admin/site/gecmis');
  const row = page.getByTestId('site-revisions').getByRole('listitem').filter({ hasText: 'İlk sürüm' });
  await row.getByRole('button', { name: 'Geri yükle' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Geri yükle' }).click();
  await expect(page.getByText('geri yüklendi', { exact: false }).first()).toBeVisible();
  const back = await settingsOf(S.a!);
  expect(back.display_name).toBe(OLD_NAME);
  expect(digits(back.phone ?? '')).toBe(digits(OLD_PHONE));
  expect(back.logo_url).toBeNull();
  expect((await draftOf(S.a!)).published_version).toBeGreaterThan(v1);
  pub = await siteBrand(v, SITE_A);
  expect(pub.html).toContain(OLD_NAME);
  expect(pub.html).not.toContain(NEW_NAME);
  expect(pub.logos).toHaveLength(0);
  // Yeni logonun dosyası silinmedi (sürüm geçmişi ona başvurur); yeniden yayınlanabilir
  const file = await service!.storage.from('branding').download(newLogo);
  expect(file.error).toBeNull();
  await visitor.close();
});

test('OBR-B: A kullanıcısı B kiracısının markasına, iletişimine, logosuna ve taslağına erişemez', async ({ page }) => {
  // B'nin bekleyen taslağı (yalnızca kurulum)
  await service!.from('site_configs').update({ draft: { brand: { display_name: `B Taslak ${RUN}` } }, has_unpublished_changes: true }).eq('organization_id', S.b!);
  await loginOffice(page, owner('a'));
  // Arayüz: kimlik adreste verilse de yalnızca kendi ofisi
  for (const p of [`/admin/sirket?org=${S.b}`, `/admin/site?organization_id=${S.b}`]) {
    await page.goto(p);
    const html = await page.content();
    expect(html).not.toContain(B_NAME);
    expect(html).not.toContain(`B Taslak ${RUN}`);
  }
  // Görsel uç noktası istemciden kurum kimliği kabul etmez: yükleme A'nın taslağına gider
  const res = await page.request.post('/api/admin/branding', {
    multipart: { kind: 'logo', orgId: S.b!, organization_id: S.b!, file: { name: 'logo.png', mimeType: 'image/png', buffer: (await import('node:fs')).readFileSync(logoFile) } },
    headers: { origin: baseURL },
  });
  expect(res.status()).toBe(201);
  const bDraft = await draftOf(S.b!);
  expect(JSON.stringify(bDraft.draft)).not.toContain('logo_url');
  expect((await settingsOf(S.b!)).logo_url).toBeNull();
  // Veritabanı (A sahibinin oturumu): B'ye taslak/yayın/doğrudan yazım reddedilir; okunamaz
  const a = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  await a.auth.signInWithPassword({ email: owner('a'), password: PASSWORD });
  expect((await a.rpc('site_save_draft', { p_org: S.b!, p_section: 'brand', p_value: { phone: '1' } })).error).not.toBeNull();
  expect((await a.rpc('site_publish', { p_org: S.b! })).error).not.toBeNull();
  expect((await a.from('organization_settings').update({ phone: '1' }).eq('organization_id', S.b!).select('organization_id')).data ?? []).toEqual([]);
  expect((await a.from('site_configs').select('draft').eq('organization_id', S.b!)).data ?? []).toEqual([]);
  expect((await a.from('organization_settings').select('phone').eq('organization_id', S.b!)).data ?? []).toEqual([]);
  // Kendi markasını da doğrudan değiştiremez (tek yayın noktası)
  const direct = await a.from('organization_settings').update({ display_name: 'Doğrudan' }).eq('organization_id', S.a!).select('organization_id');
  expect(direct.error?.message ?? '').toMatch(/brand_requires_publish/);
  expect((await settingsOf(S.b!)).display_name).toBe(B_NAME);
});

test('OBR-C: telefon genişliğinde marka ve site yönetimi taşmaz; taslak/yayın durumu görünür', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await loginOffice(page, owner('a'));
  await page.goto('/admin/sirket');
  await page.getByLabel('Slogan').fill(`Mobil ${RUN}`);
  await page.getByRole('button', { name: 'Taslağa kaydet' }).click();
  await expect(page.getByText('Taslağa kaydedildi', { exact: false }).first()).toBeVisible();
  for (const p of ['/admin/sirket', '/admin/ayarlar', '/admin/site', '/admin/site/iletisim']) {
    await page.goto(p, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('site-status').first(), p).toContainText('Taslak değişiklikler var');
    for (const name of ['Önizle', 'Değişiklikleri yayınla']) {
      const btn = page.getByRole('button', { name }).first();
      await btn.scrollIntoViewIfNeeded();
      await expect(btn, `${p} ${name}`).toBeVisible();
      const box = await btn.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 391, `${p} ${name} ekran dışında`).toBe(true);
    }
  }
  await ctx.close();
});
