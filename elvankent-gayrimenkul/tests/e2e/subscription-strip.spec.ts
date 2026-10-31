import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * KI-21 · ofis panelinde abonelik durum şeridi ve "verilerinizi indirin" bağlantısı (iskelet).
 *
 *  SUB-01  Aktif abonelikte şerit yok.
 *  SUB-02  Deneme: kalan gün; ödeme gecikmesi: uyarı. İkisinde de dışa aktarma bağlantısı yok.
 *  SUB-03  İptal: sahip "Verilerinizi indirin" ile Ayarlar › Veri dışa aktarma bölümüne gider.
 *  SUB-04  İptal: settings.manage yetkisi olmayan danışman bağlantı görmez, yöneticisine yönlendirilir.
 *
 * Metinler D-05 kararına kadar TASLAK (şerit `data-draft="D-05"` taşır); test yalnız davranışı ve taslak işaretini sınar.
 * Kendi geçici kiracısını oluşturur ve siler; paylaşılan demo kiracısının aboneliğine dokunmaz. Yalnızca yerel sunucu.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });
test.skip(!url || !serviceKey, 'Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PASSWORD = `Sub-${randomBytes(6).toString('hex')}-7c`;
const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const S: { orgId?: string; users: { id: string; email: string; role: string }[] } = { users: [] };
const emailOf = (role: string) => S.users.find((u) => u.role === role)!.email;

async function makeMember(role: 'owner' | 'agent') {
  const email = `sub-${RUN}-${role}@example.test`;
  const { data, error } = await service!.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Abonelik ${role}` } });
  if (error) throw error;
  S.users.push({ id: data.user.id, email, role });
  const m = await service!.from('organization_members').insert({ organization_id: S.orgId!, user_id: data.user.id, role, status: 'active' });
  if (m.error) throw m.error;
}

async function setSubscription(status: string, trialEndsAt: string | null = null) {
  const r = await service!.from('subscriptions').update({ status, trial_ends_at: trialEndsAt }).eq('organization_id', S.orgId!);
  if (r.error) throw r.error;
}

test.beforeAll(async () => {
  const org = await service!
    .from('organizations')
    .insert({ slug: `sub-${RUN}`, name: `Abonelik ${RUN}`, reference_prefix: `S${RUN.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'Q')}Q`, status: 'active' })
    .select('id')
    .single();
  if (org.error) throw org.error;
  S.orgId = org.data.id;
  await service!.from('organization_settings').insert({ organization_id: S.orgId, display_name: `Abonelik Ofisi ${RUN}`, address_city: 'Ankara', service_area: 'Ankara' });
  const sub = await service!.from('subscriptions').insert({ organization_id: S.orgId, plan_id: 'kurumsal', status: 'active' });
  if (sub.error) throw sub.error;
  await makeMember('owner');
  await makeMember('agent');
});

test.afterAll(async () => {
  if (!service) return;
  if (S.orgId) await service.from('organizations').delete().eq('id', S.orgId);
  for (const u of S.users) await service.auth.admin.deleteUser(u.id);
});

async function login(page: Page, email: string) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

const strip = (page: Page) => page.getByRole('region', { name: 'Abonelik durumu' });

test('SUB-01/02: aktifte şerit yok; deneme kalan gün, ödeme gecikmesi uyarı; bağlantı yok', async ({ page }) => {
  await setSubscription('active');
  await login(page, emailOf('owner'));
  await page.goto('/admin');
  await expect(page.locator('#admin-icerik')).toBeVisible();
  await expect(strip(page)).toHaveCount(0);

  await setSubscription('trialing', new Date(Date.now() + 5 * 24 * 3600e3 - 60e3).toISOString());
  await page.reload();
  await expect(strip(page)).toHaveAttribute('data-subscription-status', 'trialing');
  await expect(strip(page)).toContainText('5 gün');
  await expect(strip(page)).toHaveAttribute('data-draft', 'D-05');
  await expect(strip(page).getByText('Taslak metin · D-05')).toBeVisible();
  await expect(strip(page).getByRole('link', { name: 'Verilerinizi indirin' })).toHaveCount(0);

  await setSubscription('past_due');
  await page.reload();
  await expect(strip(page)).toHaveAttribute('data-subscription-status', 'past_due');
  await expect(strip(page)).toContainText('Ödeme bekleniyor');
  await expect(strip(page).getByRole('link', { name: 'Verilerinizi indirin' })).toHaveCount(0);
});

test('SUB-03: iptal: sahip "Verilerinizi indirin" ile dışa aktarma bölümüne gider; şerit her panel sayfasında', async ({ page }) => {
  await setSubscription('cancelled');
  await login(page, emailOf('owner'));
  await page.goto('/admin/ilanlar');
  await expect(strip(page)).toHaveAttribute('data-subscription-status', 'cancelled');
  await expect(strip(page)).toContainText('Abonelik sona erdi');
  await strip(page).getByRole('link', { name: 'Verilerinizi indirin' }).click();
  await expect(page).toHaveURL(/\/admin\/ayarlar#veri-disa-aktarma$/);
  const section = page.locator('#veri-disa-aktarma');
  await expect(section).toBeVisible();
  await expect(section.getByRole('link', { name: /CSV/ }).first()).toHaveAttribute('href', /\/api\/admin\/export\/ilanlar\?format=csv/);
});

test('SUB-04: iptal: danışman bağlantı görmez, yöneticisine yönlendirilir', async ({ page }) => {
  await setSubscription('expired');
  await login(page, emailOf('agent'));
  await page.goto('/admin');
  await expect(strip(page)).toHaveAttribute('data-subscription-status', 'expired');
  await expect(strip(page)).toContainText('ofis yöneticinizle');
  await expect(strip(page).getByRole('link', { name: 'Verilerinizi indirin' })).toHaveCount(0);
});
