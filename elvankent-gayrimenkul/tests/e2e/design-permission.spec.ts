import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * PERMISSION (Aşama D5): tasarım ailesi yetkileri arayüzden uçtan uca.
 *
 *  DP-01  KARAY admini kataloğun TÜM ailelerini görür; bir aileyi global kapatır.
 *  DP-02  KARAY admini kiracıya aile izni verir (Site › Tema › Ofisin seçebileceği tasarımlar).
 *  DP-03  Ofis yöneticisi yalnızca izinli VE global açık aileleri görür (diğer ailelerin adı
 *         sayfanın HTML'inde ve JS'inde bile yok); birini uygular → sitesi yalnızca o paketi taşır.
 *  DP-04  settings.manage yetkisi olmayan rol (danışman) Tasarım sayfasını açamaz.
 *
 * Geçici kiracı ve kullanıcılar test sonunda silinir; global ayar eski hâline döner. Yalnızca yerel DB.
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
const HOST = `dp-${RUN}.e2e.test`;
const SITE = `http://${HOST}:${PORT}`;
const PASSWORD = `Design-${randomBytes(6).toString('hex')}-7b`;
const ALL = ['Klasik Güven', 'Sinematik Vitrin', 'Editoryal Lüks', 'Kurumsal Portföy', 'Yalın Galeri', 'Doğal Yaşam'];

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] } });

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const S: { orgId?: string; users: { id: string; email: string }[]; yalinBefore?: boolean | null } = { users: [] };

async function makeMember(role: 'owner' | 'agent') {
  const email = `dp-${RUN}-${role}@example.test`;
  const { data, error } = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Tasarım ${role}` } });
  if (error) throw error;
  S.users.push({ id: data.user.id, email });
  const m = await service!.from('organization_members').insert({ organization_id: S.orgId!, user_id: data.user.id, role, status: 'active' });
  if (m.error) throw m.error;
  return email;
}

test.beforeAll(async () => {
  const org = await service!.from('organizations').insert({ slug: `dp-${RUN}`, name: `Tasarım İzin ${RUN}`, reference_prefix: `Z${RUN.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'Q')}Q`, status: 'active' }).select('id').single();
  if (org.error) throw org.error;
  S.orgId = org.data.id;
  await service!.from('organization_settings').insert({ organization_id: S.orgId, display_name: `Tasarım İzin Ofisi ${RUN}`, address_city: 'Ankara', service_area: 'Ankara' });
  await service!.from('subscriptions').insert({ organization_id: S.orgId, plan_id: 'kurumsal', status: 'active' });
  await service!.from('organization_domains').insert({ organization_id: S.orgId, hostname: HOST, is_primary: true, verified_at: new Date().toISOString() });
  await makeMember('owner');
  await makeMember('agent');
  S.yalinBefore = (await service!.from('design_family_settings').select('enabled').eq('family_id', 'yalin-galeri').maybeSingle()).data?.enabled ?? null;
});

test.afterAll(async () => {
  if (!service) return;
  if (S.yalinBefore === null) await service.from('design_family_settings').delete().eq('family_id', 'yalin-galeri');
  else await service.from('design_family_settings').update({ enabled: S.yalinBefore }).eq('family_id', 'yalin-galeri');
  if (S.orgId) await service.from('organizations').delete().eq('id', S.orgId);
  for (const u of S.users) await service.auth.admin.deleteUser(u.id);
});

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
}

async function loginOffice(page: Page, email: string) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

test('DP-01/02: KARAY admini bütün aileleri görür, global kapatır ve kiracıya izin verir', async ({ page }) => {
  await loginPlatform(page);
  await page.goto('/platform/siteler/tasarim-katalogu');
  for (const name of ALL) await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
  const yalin = page.getByRole('switch', { name: /Yalın Galeri/ });
  if ((await yalin.getAttribute('aria-checked')) === 'true') await yalin.click();
  await expect(page.getByText('Aile kapatıldı', { exact: false })).toBeVisible();

  await page.goto(`/platform/siteler/${S.orgId}/tema`);
  const section = page.getByRole('region', { name: 'Ofisin seçebileceği tasarımlar' });
  await section.getByLabel('Sinematik Vitrin').check();
  await section.getByLabel('Yalın Galeri').check();
  await section.getByRole('button', { name: 'İzinleri kaydet' }).click();
  await expect(page.getByText('Ofisin seçebileceği aileler güncellendi.')).toBeVisible();
  const { data } = await service!.from('organization_design_families').select('family_id').eq('organization_id', S.orgId!);
  expect((data ?? []).map((r) => r.family_id).sort()).toEqual(['sinematik-vitrin', 'yalin-galeri']);
});

test('DP-03: ofis yöneticisi yalnızca izinli ve açık aileleri görür; uygular; site yalnızca o paketi taşır', async ({ page }) => {
  const owner = S.users[0].email;
  const scripts: string[] = [];
  page.on('response', async (r) => {
    if (new URL(r.url()).pathname.endsWith('.js')) scripts.push(await r.text().catch(() => ''));
  });
  await loginOffice(page, owner);
  const res = await page.goto('/admin/tasarim', { waitUntil: 'networkidle' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Site tasarımı', level: 1 })).toBeVisible();
  const list = page.getByRole('list', { name: 'Kullanabileceğiniz tasarımlar' });
  await expect(list.getByRole('heading', { name: 'Sinematik Vitrin' })).toBeVisible();
  // İzinli ama global kapalı (Yalın Galeri) ve izinsiz aileler görünmez — HTML ve JS'te de yok
  const html = await page.content();
  const js = scripts.join('\n');
  for (const name of ALL.filter((n) => n !== 'Sinematik Vitrin')) {
    expect(html, name).not.toContain(name);
    expect(js, name).not.toContain(name);
  }
  await list.getByRole('button', { name: 'Bu tasarımı kullan' }).click();
  await list.getByRole('button', { name: 'Uygula ve yayınla' }).click();
  await expect(page.getByText('Tasarım uygulandı ve sitenizde yayınlandı.')).toBeVisible();
  await expect(list.getByText('Kullanılıyor')).toBeVisible();

  const site = (await service!.from('site_configs').select('published, published_version').eq('organization_id', S.orgId!).single()).data!;
  const pub = site.published as { theme: string; style: { origin: { family: string } } };
  expect(pub.theme).toBe('rezidans');
  expect(pub.style.origin.family).toBe('sinematik-vitrin');
  const audit = await service!.from('audit_logs').select('action').eq('organization_id', S.orgId!).eq('action', 'site.design_applied');
  expect(audit.data?.length).toBe(1);

  // Kiracı sitesi: yalnızca seçilen paket (tema + yazı tipleri)
  const t = await page.context().newPage();
  const r = await t.goto(`${SITE}/`, { waitUntil: 'networkidle' });
  const tenantHtml = await r!.text();
  expect(await t.evaluate(() => document.querySelector('[data-site-theme]')?.getAttribute('data-site-theme'))).toBe('rezidans');
  const faces = [...new Set([...tenantHtml.matchAll(/@font-face\{font-family:'([^']+)'/g)].map((m) => m[1]))].sort();
  expect(faces).toEqual(['Manrope', 'Manrope Fallback', 'Playfair Display', 'Playfair Display Fallback']);
  for (const theme of ['klasik', 'marble', 'atlas', 'prestij', 'kent', 'yalin', 'doga', 'dergi', 'grafit']) expect(tenantHtml).not.toContain(`data-site-theme='${theme}'`);
  await t.close();
});

test('DP-04: settings.manage yetkisi olmayan rol Tasarım sayfasını açamaz', async ({ page }) => {
  await loginOffice(page, S.users[1].email);
  await page.goto('/admin/tasarim');
  // Uygulamanın yetki kuralı: izni olmayan sayfa → "yetkisiz" sayfasına yönlendirme
  await expect(page).toHaveURL(/\/admin\/yetkisiz\?izin=settings\.manage/);
  await expect(page.getByText('Sinematik Vitrin')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Site tasarımı' })).toHaveCount(0);
});
