import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * KI-21 · ofis panelinde abonelik durum şeridi ve "verilerinizi indirin" bağlantısı (D-04 / D-05 metinleri).
 *
 *  SUB-01  Aktif abonelikte şerit yok.
 *  SUB-02  Deneme: kalan gün; biten deneme "bugün bitiyor" demez; ödeme gecikmesi: 7 günlük ek süre (D-04). Dışa aktarma bağlantısı yok.
 *  SUB-03  İptal bildirimi (active + cancelled_at) ve salt okunur süre (D-05): sahip "Verilerinizi indirin" ile
 *          Ayarlar › Veri dışa aktarma bölümüne gider.
 *  SUB-04  Süre dolumu: settings.manage yetkisi olmayan danışman bağlantı görmez, yöneticisine yönlendirilir.
 *
 * Müşteriye görünür "taslak" etiketi yoktur; dayanılan karar `data-policy` ile işaretlenir. Şerit yalnız gösterimdir.
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

type SubFields = { trial_ends_at?: string | null; renewal_at?: string | null; cancelled_at?: string | null };
const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 3600e3).toISOString();

// updated_at tetikleyicisi şimdiki zamanı yazar (ödeme gecikmesinin başlangıcı olarak okunur)
async function setSubscription(status: string, fields: SubFields = {}) {
  const r = await service!
    .from('subscriptions')
    .update({ status, trial_ends_at: null, renewal_at: null, cancelled_at: null, ...fields })
    .eq('organization_id', S.orgId!);
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

test('SUB-01/02: aktifte şerit yok; deneme kalan gün / biten deneme; ödeme gecikmesi 7 gün ek süre; bağlantı yok', async ({ page }) => {
  await setSubscription('active');
  await login(page, emailOf('owner'));
  await page.goto('/admin');
  await expect(page.locator('#admin-icerik')).toBeVisible();
  await expect(strip(page)).toHaveCount(0);

  await setSubscription('trialing', { trial_ends_at: daysFromNow(5) });
  await page.reload();
  await expect(strip(page)).toHaveAttribute('data-subscription-state', 'trialing');
  await expect(strip(page)).toContainText(/bitmesine [56] gün kaldı/);
  await expect(strip(page)).toHaveAttribute('data-policy', 'D-03');
  await expect(strip(page).getByText(/Taslak/)).toHaveCount(0);
  await expect(strip(page).getByRole('link', { name: 'Verilerinizi indirin' })).toHaveCount(0);

  await setSubscription('trialing', { trial_ends_at: daysFromNow(-3) });
  await page.reload();
  await expect(strip(page)).toHaveAttribute('data-subscription-state', 'trial_ended');
  await expect(strip(page)).toContainText('Deneme süreniz sona erdi.');
  await expect(strip(page)).not.toContainText('bugün bitiyor');

  await setSubscription('past_due');
  await page.reload();
  await expect(strip(page)).toHaveAttribute('data-subscription-state', 'past_due_grace');
  await expect(strip(page)).toHaveAttribute('data-policy', 'D-04');
  await expect(strip(page)).toContainText('7 gün ek süreniz var');
  await expect(strip(page)).toContainText('site ve panel çalışmaya devam eder');
  await expect(strip(page).getByRole('link', { name: 'Verilerinizi indirin' })).toHaveCount(0);
});

test('SUB-03: iptal bildirimi ve salt okunur süre: sahip "Verilerinizi indirin" ile dışa aktarma bölümüne gider', async ({ page }) => {
  await setSubscription('active', { cancelled_at: daysFromNow(-1), renewal_at: daysFromNow(10) });
  await login(page, emailOf('owner'));
  await page.goto('/admin/ilanlar');
  await expect(strip(page)).toHaveAttribute('data-subscription-state', 'cancel_scheduled');
  await expect(strip(page)).toHaveAttribute('data-policy', 'D-05');
  await expect(strip(page)).toContainText('tüm özellikler açık kalır');
  await expect(strip(page).getByRole('link', { name: 'Verilerinizi indirin' })).toBeVisible();

  await setSubscription('cancelled', { cancelled_at: daysFromNow(-2) });
  await page.reload();
  await expect(strip(page)).toHaveAttribute('data-subscription-state', 'read_only');
  await expect(strip(page)).toContainText('14 günlük salt okunur erişim süresi');
  await strip(page).getByRole('link', { name: 'Verilerinizi indirin' }).click();
  await expect(page).toHaveURL(/\/admin\/ayarlar#veri-disa-aktarma$/);
  const section = page.locator('#veri-disa-aktarma');
  await expect(section).toBeVisible();
  await expect(section.getByRole('link', { name: /CSV/ }).first()).toHaveAttribute('href', /\/api\/admin\/export\/ilanlar\?format=csv/);
});

test('SUB-04: süre dolumu: danışman bağlantı görmez, yöneticisine yönlendirilir', async ({ page }) => {
  await setSubscription('expired');
  await login(page, emailOf('agent'));
  await page.goto('/admin');
  await expect(strip(page)).toHaveAttribute('data-subscription-status', 'expired');
  await expect(strip(page)).toContainText('ofis yöneticinizle');
  await expect(strip(page).getByRole('link', { name: 'Verilerinizi indirin' })).toHaveCount(0);
});
