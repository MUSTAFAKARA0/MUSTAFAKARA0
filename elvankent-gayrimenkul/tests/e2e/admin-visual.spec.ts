import { expect, test, type Page } from '@playwright/test';

/**
 * Faz 3 (panel tasarım sistemi): yetkisiz istekler yönlendirilir (loading.tsx akışı 200'e çevirmez),
 * panel sayfalarında ortak başlık/tablo/menü desenleri ve taşma yok.
 * Gerekli: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD (ofis sahibi)
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email!);
  await page.getByLabel('Şifre', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
}

test('AV-1: oturumsuz istek izin kontrolü olan panel/konsol sayfalarında 3xx yönlendirme alır, 200 değil', async ({ request }) => {
  for (const path of ['/admin/ayarlar', '/admin/seo', '/admin/sirket', '/admin/analitik', '/admin/kullanicilar', '/platform/kayitlar', '/platform/organizasyonlar']) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBeGreaterThanOrEqual(300);
    expect(res.status(), path).toBeLessThan(400);
    expect(res.headers().location, path).toMatch(/giris/);
  }
});

test('AV-2: var olmayan ilan 404 verir (akış 200 ile başlamaz)', async ({ page }) => {
  test.skip(!email || !password, 'E2E_ADMIN_* tanımlı değil');
  await login(page);
  const res = await page.goto('/admin/ilanlar/00000000-0000-4000-8000-000000000000');
  expect(res?.status()).toBe(404);
});

test('AV-3: panel desenleri: ortak başlık + kırıntı, tek "Yeni ilan", talepler tablosu, yan menü alt öğeleri kapalı', async ({ page }) => {
  test.skip(!email || !password, 'E2E_ADMIN_* tanımlı değil');
  await login(page);
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;

  await page.goto('/admin/ilanlar');
  await expect(page.getByRole('heading', { name: 'İlanlar', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sayfa yolu' })).toBeVisible();
  // Başlık eylemlerinde ikinci bir "Yeni ilan" yok: üst çubuktaki tek bağlantı
  await expect(page.getByRole('main').getByRole('link', { name: 'Yeni ilan' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Yeni ilan' })).toHaveCount(1);
  if (desktop) await expect(page.getByRole('button', { name: 'İlanlar alt menüsü' })).toHaveAttribute('aria-expanded', 'false');

  await page.goto('/admin/talepler');
  const table = page.getByRole('table', { name: 'Talepler' });
  if ((await table.count()) > 0) {
    await expect(table.getByRole('columnheader', { name: 'Durum' })).toHaveCount(1);
    await expect(table.getByRole('row').nth(1)).toBeVisible();
  }

  await page.goto('/admin/ayarlar');
  await expect(page.getByRole('navigation', { name: 'Bu sayfadaki bölümler' })).toBeVisible();
  await page.goto('/admin');
  await expect(page.locator('[data-hero-kpis]')).toBeVisible();
});

test('AV-4: panel sayfalarında yatay taşma yok', async ({ page }) => {
  test.skip(!email || !password, 'E2E_ADMIN_* tanımlı değil');
  await login(page);
  for (const path of ['/admin', '/admin/ilanlar', '/admin/ilanlar/yeni', '/admin/talepler', '/admin/randevular', '/admin/ayarlar', '/admin/site']) {
    await page.goto(path);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, path).toBeLessThanOrEqual(0);
  }
});
