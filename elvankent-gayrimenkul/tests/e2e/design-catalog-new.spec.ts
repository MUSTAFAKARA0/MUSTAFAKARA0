import { expect, test, type Page } from '@playwright/test';

/**
 * Faz 1 · 9 yeni tasarım ailesi (10–18) — gerçek site çıktısı (KARAY önizleme rotası, örnek içerik).
 *  DC-01  her aile: ana sayfa + ilan listesi + ilan detayı, 375/768/1280 genişlikte yatay taşma yok,
 *         beklenen tema öznitelikleri, konsol hatası yok
 *  DC-02  zaman tabanlı animasyonlar 5 sn içinde biter (sonsuz hareket yok); hareketi azalt tercihinde hiç animasyon yok
 *  DC-03  yeni temaların imza CSS'i yalnızca kendi sayfasında (başka yeni temanın kuralı yok)
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_* tanımlı değil');

const NEW9: [family: string, theme: string][] = [
  ['deniz-kiyisi', 'deniz'],
  ['proje-lansman', 'rezidans'],
  ['plaza-ofis', 'plaza'],
  ['arsa-tarla', 'tarla'],
  ['kurumsal-zincir', 'atlas'],
  ['butik-ofis', 'marble'],
  ['kiralik-merkezi', 'kent'],
  ['miras-konak', 'miras'],
  ['gece-premium', 'gece'],
];
const WIDTHS = [375, 768, 1280];
const info = { siteName: 'Örnek Emlak', address: { city: 'Ankara' }, social: {}, seo: {} };
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const src = (family: string, s: string) => `/site-onizleme?p=${enc({ manifest: { siteType: 'real-estate-office', designFamily: family, variants: {} }, info })}&s=${s}`;
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function login(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/platform$/);
}

test('DC-01: 9 yeni aile × 3 sayfa × 3 genişlik: taşma yok, tema doğru, konsol temiz', async ({ page }) => {
  test.setTimeout(480_000);
  await login(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // Örnek içerik görselleri bu yerel ortamda yoksa 404 verebilir; yalnızca betik/hidrasyon hataları sayılır
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  const problems: string[] = [];
  for (const [family, theme] of NEW9) {
    for (const s of ['ana-sayfa', 'ilanlar', 'ilan']) {
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        const res = await page.goto(src(family, s), { waitUntil: 'load' });
        expect(res?.status(), `${family}/${s}`).toBe(200);
        const t = await page.evaluate(() => document.querySelector('[data-site-theme]')?.getAttribute('data-site-theme'));
        if (t !== theme) problems.push(`${family}/${s}: tema ${t} ≠ ${theme}`);
        const o = await overflow(page);
        if (o > 0) problems.push(`${family}/${s} @${w}px: ${o}px taşma`);
      }
    }
  }
  expect(problems).toEqual([]);
  expect(errors).toEqual([]);
});

test('DC-02: hareket 5 sn içinde durur; hareketi azalt tercihinde animasyon yok', async ({ page, browser }) => {
  test.setTimeout(240_000);
  await login(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [family] of NEW9) {
    await page.goto(src(family, 'ana-sayfa'), { waitUntil: 'load' });
    await page.waitForTimeout(5200);
    // Kaydırma/görünüm zaman çizelgeli animasyonlar kullanıcı kaydırmasına bağlıdır; zaman tabanlı olanlar bitmiş olmalı
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.timeline instanceof DocumentTimeline && a.playState === 'running')
        .map((a) => (a as CSSAnimation).animationName ?? a.id),
    );
    expect(running, family).toEqual([]);
  }
  const ctx = await browser.newContext({ reducedMotion: 'reduce', baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000' });
  const p = await ctx.newPage();
  await login(p);
  for (const [family] of NEW9) {
    await p.goto(src(family, 'ana-sayfa'), { waitUntil: 'load' });
    await p.waitForTimeout(500);
    const names = await p.evaluate(() => document.getAnimations().filter((a) => ((a as CSSAnimation).animationName ?? '').startsWith('sig-')).length);
    expect(names, `${family}: hareketi azalt`).toBe(0);
  }
  await ctx.close();
});

test('DC-03: yeni temaların imza CSS’i yalnızca kendi sayfasında', async ({ page }) => {
  await login(page);
  const themes = ['deniz', 'plaza', 'tarla', 'miras', 'gece'];
  for (const [family, theme] of NEW9.filter(([, t]) => themes.includes(t))) {
    await page.goto(src(family, 'ana-sayfa'), { waitUntil: 'load' });
    const css = await page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n'));
    expect(css).toContain(`data-site-theme='${theme}'`);
    for (const other of themes.filter((x) => x !== theme)) expect(css, `${family}: ${other}`).not.toContain(`data-site-theme='${other}'`);
  }
});
