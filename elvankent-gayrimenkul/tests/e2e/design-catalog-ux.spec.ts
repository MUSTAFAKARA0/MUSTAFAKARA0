import { expect, test, type Page } from '@playwright/test';

/**
 * Faz 1 · aile kataloğu arayüzü (KARAY › site › Tema sekmesi). Yalnızca okuma: hiçbir aile uygulanmaz.
 *  UX-01  filtre çubuğu: segment çipi, sayaç (aria-live), adres satırı (?segment=), temizleme, boş durum
 *  UX-02  klavye: çiplere Tab/Enter, büyük önizleme diyaloğu açılır, Esc kapatır ve odak düğmeye döner
 *  UX-03  375 px: yatay taşma yok, çip dokunma hedefi >= 44 px; hareketi azalt emülasyonunda sayfa çalışır
 *  UX-04  tembel önizleme: aynı anda en fazla 18 canlı önizleme
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_* tanımlı değil');

async function openTema(page: Page, query = '') {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/siteler');
  const href = await page.locator('a[href^="/platform/siteler/"]').evaluateAll((els) => (els as HTMLAnchorElement[]).map((a) => a.getAttribute('href')!).find((h) => /^\/platform\/siteler\/[0-9a-f-]{36}$/.test(h)));
  test.skip(!href, 'Platformda site yok');
  await page.goto(`${href}/tema${query}`);
  await expect(page.getByRole('group', { name: 'Tasarım ailesi filtreleri' })).toBeVisible();
}

test('UX-01: segment filtresi, sayaç, adres satırı, temizleme ve boş durum', async ({ page }) => {
  await openTema(page);
  const count = page.getByTestId('family-result-count');
  await expect(count).toContainText(/\d+ aile gösteriliyor/);
  const total = Number((await count.innerText()).match(/\d+/)![0]);
  expect(total).toBeGreaterThanOrEqual(17);
  await page.getByRole('button', { name: /^Ticari/ }).click();
  await expect(page.getByRole('button', { name: /^Ticari/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/segment=ticari/);
  await expect(count).toContainText(`${total} aileden`);
  await expect(page.getByRole('heading', { level: 3, name: 'Plaza Ofis' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Deniz Kıyısı' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtreleri temizle' }).first().click();
  await expect(page).not.toHaveURL(/segment=/);
  await expect(count).toContainText(/aile gösteriliyor/);
  await page.getByLabel('Tasarım ailelerinde ara').fill('zzzyok');
  await expect(page.getByTestId('family-empty')).toBeVisible();
  await expect(count).toHaveText('Eşleşen aile yok');
  await page.getByTestId('family-empty').getByRole('button', { name: 'Filtreleri temizle' }).click();
  await expect(page.getByTestId('family-empty')).toHaveCount(0);
  // Doğrudan bağlantı
  await page.goto(page.url().split('?')[0] + '?segment=arsa');
  await expect(page.getByRole('button', { name: /^Arsa ve tarla/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 3, name: 'Arsa & Tarla' })).toBeVisible();
});

test('UX-02: klavye ile filtre ve büyük önizleme diyaloğu (Esc odağı geri verir)', async ({ page }) => {
  await openTema(page);
  const chip = page.getByRole('button', { name: /^Kiralık \d/ });
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  const open = page.getByRole('button', { name: /için büyük önizleme$/ }).first();
  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Bu aileyi seç|Taslakta/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('UX-03: 375 px taşmaz, çipler >= 44 px; hareketi azalt emülasyonu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTema(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const chips = page.getByRole('group', { name: 'Segment' }).getByRole('button');
  const n = await chips.count();
  expect(n).toBeGreaterThan(8);
  for (let i = 0; i < n; i++) expect((await chips.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
});

test('UX-04: canlı önizleme sayısı sınırlı', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTema(page);
  for (let y = 0; y < 6000; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(150);
  }
  const live = await page.locator('[data-preview-state="live"]').count();
  expect(live).toBeLessThanOrEqual(18);
  expect(live).toBeGreaterThan(0);
});
