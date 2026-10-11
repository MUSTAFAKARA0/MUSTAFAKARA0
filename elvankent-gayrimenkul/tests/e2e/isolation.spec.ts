import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * Uygulama katmanında kiracı izolasyonu: A ofisinin sahibi, B ofisine ait
 * ilan / talep / müşteri / seçki sayfalarını ADRES ÇUBUĞUNA ID YAZARAK açamaz,
 * B'nin QR kodunu alamaz. Veritabanı katmanı ayrıca tests/security ile test edilir.
 *
 * Gerekli: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (A ofisinde owner/admin),
 * NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY (geçici B ofisini
 * oluşturup test sonunda silmek için). Mevcut verilere dokunmaz.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe.configure({ mode: 'serial' });
test.skip(!email || !password || !url || !serviceKey, 'E2E_ADMIN_* veya Supabase service anahtarı tanımlı değil');

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const RUN = randomBytes(3).toString('hex');
const B: { orgId?: string; propertyId?: string; customerId?: string; leadId?: string; collectionId?: string } = {};

test.beforeAll(async () => {
  if (!service) return;
  const { data: org, error } = await service
    .from('organizations')
    .insert({ slug: `e2eiso-${RUN}`, name: `E2E izolasyon ${RUN}`, reference_prefix: `Z${RUN.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'Q')}`, status: 'active' })
    .select('id')
    .single();
  if (error) throw error;
  B.orgId = org.id;
  await service.from('organization_settings').insert({ organization_id: org.id, display_name: 'E2E izolasyon' });
  await service.from('subscriptions').insert({ organization_id: org.id, plan_id: 'kurumsal', status: 'active' });
  const type = await service.from('property_types').select('id').eq('slug', 'daire').single();
  const district = await service.from('districts').select('id, city_id').limit(1).single();
  const prop = await service
    .from('properties')
    .insert({ organization_id: org.id, title: 'B ofisinin gizli taslak ilanı', listing_type: 'sale', property_type_id: type.data!.id, category: 'konut', city_id: district.data!.city_id, district_id: district.data!.id, slug: '', reference_no: '', status: 'draft' })
    .select('id')
    .single();
  if (prop.error) throw prop.error;
  B.propertyId = prop.data.id;
  const customer = await service.from('customers').insert({ organization_id: org.id, full_name: 'B Gizli Müşteri', phone: '05329990011' }).select('id').single();
  B.customerId = customer.data!.id;
  const lead = await service.from('leads').insert({ organization_id: org.id, customer_id: B.customerId, status: 'new', source: 'website' }).select('id').single();
  B.leadId = lead.data!.id;
  const col = await service.from('collections').insert({ organization_id: org.id, title: 'B gizli seçki', token: randomBytes(32).toString('base64url') }).select('id').single();
  B.collectionId = col.data!.id;
});

test.afterAll(async () => {
  if (service && B.orgId) await service.from('organizations').delete().eq('id', B.orgId);
});

async function login(page: Page) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email!);
  await page.getByLabel('Şifre', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
}

test("A ofisinin sahibi B'nin kayıtlarını URL ile açamaz", async ({ page }) => {
  await login(page);
  for (const path of [`/admin/ilanlar/${B.propertyId}`, `/admin/talepler/${B.leadId}`, `/admin/musteriler/${B.customerId}`, `/admin/koleksiyonlar/${B.collectionId}`, `/admin/ilanlar/${B.propertyId}/brosur`]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByText('B ofisinin gizli taslak ilanı')).toHaveCount(0);
    await expect(page.getByText('B Gizli Müşteri')).toHaveCount(0);
  }
  const qr = await page.request.get(`/api/admin/properties/${B.propertyId}/qr?format=png`);
  expect(qr.status()).toBeGreaterThanOrEqual(400);
});

test("B'nin taslak ilanı önizleme ve genel sitede görünmez", async ({ page, request }) => {
  await login(page);
  const preview = await page.goto(`/onizleme/ilan/${B.propertyId}`);
  expect(preview?.status()).toBe(404);
  const search = await request.get('/ilanlar?q=gizli');
  expect(await search.text()).not.toContain('B ofisinin gizli taslak ilanı');
});
