import { expect, test, type Page } from '@playwright/test';

/** Ziyaretçi senaryoları (üyelik gerektirmez) */

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'yatay kaydırma olmamalı').toBeLessThanOrEqual(0);
}

async function dismissCookieNotice(page: Page) {
  const btn = page.getByRole('button', { name: 'Anladım' });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

test.describe('Ziyaretçi', () => {
  test.beforeEach(async ({ page }) => {
    // Çerez bildirimini önceden kapat (bildirimin kendisi ayrı testte doğrulanır)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-notice-test')) localStorage.setItem('eg:cookie-notice', '1');
    });
    page.on('pageerror', (e) => {
      throw new Error(`Sayfa hatası: ${e.message}`);
    });
  });

  test('1-2. Ana sayfa açılır ve arama ile satılık ilanlara gidilir', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hayalinizdeki');
    await dismissCookieNotice(page);
    await noHorizontalOverflow(page);
    const search = page.getByRole('form', { name: 'İlan arama' });
    await search.getByRole('button', { name: /İlan Ara/ }).click();
    await expect(page).toHaveURL(/\/satilik/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Satılık');
    await expect(page.locator('#sonuclar article').first()).toBeVisible();
  });

  test('3. Filtre uygulanır, boş sonuçta sıfırlama çalışır', async ({ page, isMobile }) => {
    await page.goto('/satilik');
    await dismissCookieNotice(page);
    if (isMobile) await page.getByRole('button', { name: /Filtrele/ }).click();
    const form = page.getByRole('form', { name: 'İlan filtreleri' }).last();
    await form.getByRole('button', { name: '3+1', exact: true }).click();
    await form.getByRole('button', { name: 'İlanları Göster' }).click();
    await expect(page).toHaveURL(/oda=3%2B1/);
    const cards = page.locator('#sonuclar article');
    await expect(cards.first()).toBeVisible();
    for (const text of await cards.locator('li').allInnerTexts()) {
      if (/\d\+\d/.test(text)) expect(text).toContain('3+1');
    }
    await page.goto('/satilik?fiyat_min=999999999999');
    await expect(page.getByText('Aradığınız kriterlere uygun ilan bulunamadı.')).toBeVisible();
    await page.getByRole('link', { name: 'Arama kriterlerini sıfırla' }).click();
    await expect(page).toHaveURL(/\/satilik$/);
  });

  test('4-8. İlan detayı: galeri, harita, WhatsApp ve telefon bağlantıları', async ({ page, isMobile }) => {
    await page.goto('/satilik');
    await dismissCookieNotice(page);
    const firstCard = page.locator('#sonuclar article').first();
    const title = (await firstCard.locator('h3').innerText()).trim();
    await firstCard.locator('h3 a').click();
    await expect(page).toHaveURL(/\/ilan\/[a-z0-9-]+-\d{6}$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await noHorizontalOverflow(page);

    // Galeri: tam ekran, klavye ile gezinme, kapatma
    const openGallery = isMobile
      ? page.getByRole('button', { name: /Fotoğraf 1 \/ \d+ – tam ekran aç/ })
      : page.getByRole('button', { name: /Tüm fotoğraflar/ });
    await openGallery.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const counter = dialog.locator('[aria-live="polite"]');
    await expect(counter).toContainText(/^1 \/ \d+/);
    const total = Number((await counter.innerText()).split('/')[1]);
    if (total > 1) {
      await page.keyboard.press('ArrowRight');
      await expect(counter).toContainText(/^2 \//);
      await page.keyboard.press('ArrowLeft');
      await expect(counter).toContainText(/^1 \//);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Harita: görünür alana gelince yüklenir
    await page.getByRole('heading', { name: 'Konum' }).scrollIntoViewIfNeeded();
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 15_000 });

    // İletişim bağlantıları (ayarlarda telefon tanımlıysa)
    const wa = page.locator('a[href^="https://wa.me/"]').first();
    if (await wa.count()) {
      const href = await wa.getAttribute('href');
      expect(href).toMatch(/^https:\/\/wa\.me\/90\d{10}\?text=/);
      expect(decodeURIComponent(href!.split('text=')[1])).toContain('İlan No:');
      const tel = page.locator('a[href^="tel:+90"]').first();
      await expect(tel).toHaveAttribute('href', /^tel:\+90\d{10}$/);
      if (isMobile) await expect(page.getByRole('link', { name: /WhatsApp'tan Bilgi Al/ }).last()).toBeVisible();
    } else if (isMobile) {
      await expect(page.getByRole('link', { name: 'Bilgi Talep Et' })).toBeVisible();
    }
  });

  test('9. Favorilere ekleme ve favoriler sayfası', async ({ page }) => {
    await page.goto('/ilanlar');
    await dismissCookieNotice(page);
    const card = page.locator('#sonuclar article').first();
    const title = (await card.locator('h3').innerText()).trim();
    await card.getByRole('button', { name: 'Favorilere ekle' }).click();
    await expect(card.getByRole('button', { name: 'Favorilerden çıkar' })).toBeVisible();
    await page.goto('/favoriler');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Favorilerden çıkar' }).first().click();
    await expect(page.getByText('Henüz favori ilanınız bulunmuyor.')).toBeVisible();
  });

  test('10. Paylaşım menüsü ve bağlantı kopyalama', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'Mobilde cihazın yerel paylaşım menüsü açılır');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/ilanlar');
    await dismissCookieNotice(page);
    await page.locator('#sonuclar article h3 a').first().click();
    await page.getByRole('button', { name: 'İlanı paylaş' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/\?text=/);
    await expect(menu.getByRole('menuitem', { name: 'Facebook' })).toHaveAttribute('href', /facebook\.com\/sharer/);
    await expect(menu.getByRole('menuitem', { name: 'X' })).toHaveAttribute('href', /x\.com\/intent/);
    await menu.getByRole('menuitem', { name: 'Bağlantıyı kopyala' }).click();
    await expect(page.getByText('Bağlantı kopyalandı')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/ilan/');
  });

  test('Çerez bildirimi gösterilir ve kapatılınca tekrar çıkmaz', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('e2e-notice-test', '1');
      if (!sessionStorage.getItem('e2e-cleared')) {
        localStorage.removeItem('eg:cookie-notice');
        sessionStorage.setItem('e2e-cleared', '1');
      }
    });
    await page.goto('/');
    const notice = page.getByRole('region', { name: 'Çerez bildirimi' });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Anladım' }).click();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(notice).toBeHidden();
  });

  test('İletişim formu doğrulama ve gönderim', async ({ page }) => {
    await page.goto('/iletisim');
    await dismissCookieNotice(page);
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Mesaj Gönder' }) });
    await page.waitForTimeout(3000); // spam korumasının minimum doldurma süresi
    await form.getByRole('button', { name: 'Mesaj Gönder' }).click();
    await expect(form.getByText('Ad soyad en az 2 karakter olmalıdır.')).toBeVisible();
    await form.getByLabel('Ad Soyad').fill('Test Ziyaretçi');
    await form.getByLabel('Telefon').fill('0532 000 00 00');
    await form.getByLabel('Mesajınız').fill('Elvankent bölgesinde 3+1 daire arıyorum, bilgi rica ederim. (E2E test)');
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Mesaj Gönder' }).click();
    await expect(page.getByText('Mesajınız alındı.')).toBeVisible();
  });

  test('SEO: meta etiketleri, canonical ve yapılandırılmış veri', async ({ page, request }) => {
    await page.goto('/ilanlar');
    const href = await page.locator('#sonuclar article h3 a').first().getAttribute('href');
    await page.goto(href!);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ilan\//);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const ld = await page.locator('script[type="application/ld+json"]').allInnerTexts();
    expect(ld.some((s) => s.includes('"RealEstateListing"'))).toBe(true);
    expect(ld.some((s) => s.includes('"BreadcrumbList"'))).toBe(true);
    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('Disallow: /admin');
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const nf = await request.get('/bu-sayfa-yok-12345');
    expect(nf.status()).toBe(404);
  });
});
