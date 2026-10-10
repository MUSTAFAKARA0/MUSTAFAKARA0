import { expect, test, type Page } from '@playwright/test';

/**
 * Oturum akışları: hesap menüsünden çıkış (menü içindeki form DOM'dan kalkınca
 * gönderilmeyen hataya karşı), girişliyken giriş sayfasının `next` hedefine dönmesi.
 *
 * Gerekli: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil');

async function login(page: Page) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email!);
  await page.getByLabel('Şifre', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
}

test('Hesap menüsünden çıkış yapılır; panel yeniden giriş ister', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Hesap menüsü' }).first().click();
  await page.getByRole('menuitem', { name: /Çıkış yap/ }).click();
  await expect(page).toHaveURL(/\/admin\/giris/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/giris/);
});

test('Girişliyken giriş sayfası next hedefine döner, dış adrese dönmez', async ({ page }) => {
  await login(page);
  await page.goto('/admin/giris?next=/admin/ilanlar');
  await expect(page).toHaveURL(/\/admin\/ilanlar/);
  await page.goto('/admin/giris?next=//evil.example.com');
  await expect(page).toHaveURL(/\/admin(\?|$)/);
});
