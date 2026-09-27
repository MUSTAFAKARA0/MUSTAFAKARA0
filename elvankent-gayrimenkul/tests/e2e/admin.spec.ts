import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';

/**
 * Yönetici senaryoları (V2): giriş ve yetki, ilan sihirbazı (konum, fotoğraf
 * yükleme ve işleme, fiyat, açıklama, yayın), sitede görünme, fiyat
 * değişikliği, çöp kutusu, talepler, blog yazısı ve yönetim sayfaları.
 *
 * Gerekli: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD (organizasyonda owner/admin rolü)
 * Not: Test, sonunda çöp kutusuna taşıdığı bir test ilanı ve kalıcı sildiği bir
 * test yazısı oluşturur.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const fixtureDir = path.join(__dirname, '.fixtures');
const images = ['bir', 'iki'].map((n) => path.join(fixtureDir, `foto-${n}.jpg`));

test.describe.configure({ mode: 'serial' });
test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil');

const stamp = Date.now().toString(36);
const title = `E2E test ilanı ${stamp} – Elvankent 3+1 daire`;
let editorUrl = '';
let publicPath = '';

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
});

async function login(page: Page) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email!);
  await page.getByLabel('Şifre', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw new Error(`Sayfa hatası: ${e.message}`);
  });
});

test('Yetkisiz erişim girişe yönlenir, hatalı şifre reddedilir', async ({ page }) => {
  await page.goto('/admin/ilanlar');
  await expect(page).toHaveURL(/\/admin\/giris\?next=%2Fadmin%2Filanlar/);
  await page.getByLabel('E-posta').fill(email!);
  await page.getByLabel('Şifre', { exact: true }).fill('yanlis-sifre-123');
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByText('E-posta veya şifre hatalı.')).toBeVisible();
});

test('İlan sihirbazı: taslak, konum, fotoğraflar, fiyat, açıklama ve yayın', async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  await page.goto('/admin/ilanlar/yeni');
  await page.locator('#property_type_id').selectOption({ label: 'Daire' });
  await page.locator('#title').fill(title);
  await page.getByRole('button', { name: /Taslağı oluştur/ }).click();
  await expect(page).toHaveURL(/\/admin\/ilanlar\/[0-9a-f-]{36}/, { timeout: 60_000 });
  editorUrl = page.url().split('?')[0];

  // Konum (otomatik kaydedilir)
  await page.getByLabel(/^İl\*?$/).selectOption({ label: 'Ankara' });
  await page.getByLabel(/^İlçe\*?$/).selectOption({ label: 'Etimesgut' });
  await page.getByLabel(/^Mahalle$/).selectOption({ label: 'Elvankent' });
  await expect(page.getByText(/Kaydedildi/).first()).toBeVisible({ timeout: 30_000 });

  // Fotoğraflar: doğrudan depolamaya yükleme + sunucuda WebP boyutları
  await page.getByRole('button', { name: /Fotoğraflar/ }).first().click();
  await page.locator('input[type=file][multiple]').setInputFiles(images);
  await page.waitForFunction(() => document.querySelectorAll('li[draggable="true"]').length >= 2, null, { timeout: 120_000 });
  await expect(page.getByText('Kapak').first()).toBeVisible();

  // Fiyat, özellikler, açıklama
  await page.getByRole('button', { name: /Temel bilgiler/ }).first().click();
  await page.getByLabel('Satış fiyatı').fill('4500000');
  await page.getByRole('button', { name: /Özellikler/ }).first().click();
  await page.getByLabel('Brüt alan').fill('145');
  await page.getByLabel('Oda sayısı').fill('3');
  await page.getByLabel('Salon sayısı').fill('1');
  await page.getByRole('button', { name: /Açıklama/ }).first().click();
  await page
    .getByLabel('İlan açıklaması')
    .fill('Güney cepheli, gün boyu güneş alan geniş salon. Site içinde kapalı otopark bulunmaktadır. Bu ilan otomatik uçtan uca test için oluşturulmuştur.');
  await expect(page.getByText(/Kaydedildi/).first()).toBeVisible({ timeout: 30_000 });

  // Yayın
  await page.getByRole('button', { name: /Yayınlama/ }).first().click();
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.getByText('İlan yayınlandı.')).toBeVisible({ timeout: 30_000 });
  publicPath = (await page.locator('a[href^="/ilan/"]').first().getAttribute('href')) ?? '';
  expect(publicPath).toMatch(/^\/ilan\/[a-z0-9-]+$/);
});

test('Yayındaki ilan sitede görünür; fiyat değişikliği yansır', async ({ page }) => {
  test.skip(!publicPath, 'Önceki test ilanı yayınlamadı');
  await page.goto(publicPath);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByText(/4\.500\.000/).first()).toBeVisible();

  await login(page);
  await page.goto(`${editorUrl}?adim=temel`);
  await page.getByLabel('Satış fiyatı').fill('4250000');
  await expect(page.getByText(/Kaydedildi/).first()).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await page.goto(publicPath);
    await expect(page.getByText(/4\.250\.000/).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
});

test('Talepler listesi ve yönetim sayfaları hatasız açılır', async ({ page }) => {
  await login(page);
  for (const [url, heading] of [
    ['/admin', /Merhaba|Dashboard/],
    ['/admin/ilanlar', 'İlanlar'],
    ['/admin/talepler', 'Talepler'],
    ['/admin/medya', 'Medya kütüphanesi'],
    ['/admin/icerikler', 'Blog ve içerikler'],
    ['/admin/bolgeler', 'Bölge sayfaları'],
    ['/admin/seo', 'SEO'],
    ['/admin/ayarlar', 'Ayarlar'],
    ['/admin/sirket', 'Şirket ayarları'],
    ['/admin/kullanicilar', 'Kullanıcılar'],
    ['/admin/guvenlik', 'Güvenlik ve işlem kayıtları'],
  ] as const) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
});

test('Blog yazısı yayınlanır, sitede görünür ve kalıcı silinir', async ({ page, request }) => {
  await login(page);
  await page.goto('/admin/icerikler/yeni');
  const postTitle = `E2E test yazısı ${stamp}`;
  await page.getByRole('textbox', { name: /^Başlık/ }).fill(postTitle);
  await page
    .locator('textarea[id^="md-"]')
    .fill(
      '## Giriş\n\nBu yazı otomatik uçtan uca test için oluşturulmuştur. Kira sözleşmesinde tarafların bilgileri, kira bedeli, artış koşulları ve depozito açıkça yazılmalıdır.\n\n- Teslim tutanağı hazırlayın\n- Demirbaşları listeleyin\n\nTest sonunda bu yazı kalıcı olarak silinir.',
    );
  await page.getByRole('button', { name: 'Yayınla' }).click();
  await expect(page.getByText('Yazı yayınlandı.')).toBeVisible({ timeout: 20_000 });
  const slug = await page.locator('#post-slug').inputValue();
  expect((await request.get(`/blog/${slug}`)).status()).toBe(200);

  await page.getByRole('button', { name: 'Çöp kutusuna taşı' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Taşı' }).click();
  await expect(page).toHaveURL(/\/admin\/icerikler$/);
  await page.goto('/admin/icerikler?durum=cop');
  await page.locator('li', { hasText: postTitle }).getByRole('button', { name: 'Kalıcı sil' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Kalıcı sil' }).click();
  await expect(page.getByText(/kalıcı olarak silindi/)).toBeVisible({ timeout: 20_000 });
});

test('Test ilanı çöp kutusuna taşınır ve sitede artık görünmez', async ({ page, request }) => {
  test.skip(!editorUrl, 'Test ilanı oluşturulmadı');
  await login(page);
  await page.goto('/admin/ilanlar');
  await page.getByRole('button', { name: `${title} için işlemler` }).filter({ visible: true }).first().click();
  await page.getByRole('menuitem', { name: 'Çöpe taşı' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Çöpe taşı' }).click();
  await expect(page.getByText('1 ilan çöp kutusuna taşındı.')).toBeVisible({ timeout: 20_000 });
  await expect(async () => {
    const res = await request.get(publicPath, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  }).toPass({ timeout: 30_000 });
});
