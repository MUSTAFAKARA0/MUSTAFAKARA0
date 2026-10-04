import { expect, test, type Page } from '@playwright/test';

/**
 * RESPONSIVE (Aşama D6): 320 / 360 / 390 / 430 / 1280 px genişlikte yatay taşma yok.
 *
 *  RS-01  6 tasarım ailesinin GERÇEK site çıktısı (önizleme rotası = kiracı bileşenleri), ana sayfa
 *  RS-02  Yeni Site Oluştur sihirbazının 6 adımı (KARAY ürün arayüzü)
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_* tanımlı değil');

const WIDTHS = [320, 360, 390, 430, 1280];
const FAMILIES = ['klasik-guven', 'sinematik-vitrin', 'editoryal-luks', 'kurumsal-portfoy', 'yalin-galeri', 'dogal-yasam'];
const info = { siteName: 'Uzun Adlı Örnek Gayrimenkul Danışmanlık', companyName: 'Örnek Gayrimenkul Ltd. Şti.', phone: '+90 555 000 00 00', email: 'ofis@example.test', address: { city: 'Ankara', district: 'Çankaya' } };
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('RS-01: 6 ailenin gerçek site çıktısı 5 genişlikte taşmaz', async ({ page }) => {
  test.setTimeout(240_000);
  await loginPlatform(page);
  const problems: string[] = [];
  for (const family of FAMILIES) {
    const src = `/site-onizleme?p=${enc({ manifest: { siteType: 'real-estate-office', designFamily: family, variants: {} }, info })}`;
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      const res = await page.goto(src, { waitUntil: 'load' });
      expect(res?.status()).toBe(200);
      const o = await overflow(page);
      if (o > 0) problems.push(`${family} @${w}px: ${o}px`);
    }
  }
  expect(problems).toEqual([]);
});

test('RS-02: Yeni Site Oluştur sihirbazı her adımda 5 genişlikte taşmaz', async ({ page }) => {
  test.setTimeout(240_000);
  await loginPlatform(page);
  const problems: string[] = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('/platform/siteler/yeni');
    const check = async (step: string) => {
      const o = await overflow(page);
      if (o > 0) problems.push(`adım ${step} @${w}px: ${o}px`);
    };
    await check('1');
    await page.getByLabel('Site adı').fill(info.siteName);
    await page.getByLabel('Sahip adı soyadı').fill('Deneme Sahip');
    await page.getByLabel('Sahip e-postası').fill('sahip@example.test');
    await page.getByRole('button', { name: 'Devam' }).click();
    await check('2');
    await page.getByRole('radio', { name: 'Kurumsal Gayrimenkul' }).click();
    await page.getByRole('button', { name: 'Devam' }).click();
    await check('3');
    await page.getByRole('radio', { name: 'Kurumsal Portföy' }).click();
    await page.getByRole('button', { name: 'Devam' }).click();
    await check('4');
    await page.getByRole('button', { name: 'Önizle', exact: true }).click();
    await page.frameLocator('iframe[title="Site önizlemesi"]').locator('[data-site-preview]').waitFor();
    await check('5');
    await page.getByRole('button', { name: 'Devam' }).click();
    await check('6');
  }
  expect(problems).toEqual([]);
});
