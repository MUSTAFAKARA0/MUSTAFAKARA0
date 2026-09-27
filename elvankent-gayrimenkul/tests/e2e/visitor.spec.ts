import { expect, test, type Page } from '@playwright/test';

/**
 * Ziyaretçi senaryoları (üyelik gerektirmez): arama, filtreler, ilan detayı ve
 * galeri, favoriler, karşılaştırma, paylaşım, çerez tercihi, iletişim formu,
 * SEO etiketleri ve hata sayfası.
 * Not: İletişim formu testi veritabanına bir test talebi yazar.
 */

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'yatay kaydırma olmamalı').toBeLessThanOrEqual(0);
}

const cards = (page: Page) => page.getByRole('region', { name: 'Arama sonuçları' }).getByRole('heading', { level: 3 });

test.describe('Ziyaretçi', () => {
  test.beforeEach(async ({ page }) => {
    // Çerez tercihi önceden verilmiş sayılır (bildirimin kendisi ayrı testte doğrulanır)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-consent-test')) {
        localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() }));
      }
    });
    page.on('pageerror', (e) => {
      throw new Error(`Sayfa hatası: ${e.message}`);
    });
  });

  test('Ana sayfa açılır ve arama ile satılık ilanlara gidilir', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
    const search = page.getByRole('search', { name: 'Gayrimenkul ara' });
    await search.getByRole('radio', { name: 'Satılık' }).click();
    await search.getByRole('button', { name: 'Ara' }).click();
    await expect(page).toHaveURL(/\/satilik/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Satılık');
    await expect(cards(page).first()).toBeVisible();
  });

  test('Oda filtresi uygulanır; sonuçsuz aramada filtreler temizlenir', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Mobilde filtreler tam ekran panelde açılır; masaüstünde doğrulanır');
    await page.goto('/satilik');
    await page.getByRole('button', { name: 'Oda', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '3+1', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Uygula' }).click();
    await expect(page).toHaveURL(/oda=3%2B1|oda=3\+1/);
    await expect(cards(page).first()).toBeVisible();
    for (const title of await cards(page).allInnerTexts()) {
      if (/\d\+\d/.test(title)) expect(title).toContain('3+1');
    }
    await page.goto('/satilik?fiyat_min=999999999999');
    await expect(page.getByRole('heading', { name: 'Hiç ilan bulunamadı' })).toBeVisible();
    await page.getByRole('link', { name: 'Filtreleri temizle' }).click();
    await expect(page).toHaveURL(/\/satilik$/);
    await expect(cards(page).first()).toBeVisible();
  });

  test('İlan detayı: başlık, galeri (klavye), iletişim bağlantıları', async ({ page }) => {
    await page.goto('/satilik');
    const first = cards(page).first();
    const title = (await first.innerText()).trim();
    await first.getByRole('link').click();
    await expect(page).toHaveURL(/\/ilan\/[a-z0-9-]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await noHorizontalOverflow(page);

    // Masaüstü: "Fotoğraf 1 – tam ekran aç", mobil kaydırmalı galeri: "Fotoğraf 1 / N – tam ekran aç"
    await page.getByRole('button', { name: /^Fotoğraf 1( \/ \d+)? – tam ekran aç$/ }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible();
    const total = Number((await dialog.getByText(/^1 \/ \d+$/).innerText()).split('/')[1]);
    if (total > 1) {
      await page.keyboard.press('ArrowRight');
      await expect(dialog.getByText(new RegExp(`^2 / ${total}$`))).toBeVisible();
      await page.keyboard.press('ArrowLeft');
      await expect(dialog.getByText(new RegExp(`^1 / ${total}$`))).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    const wa = page.locator('a[href^="https://wa.me/90"]').first();
    if (await wa.count()) {
      const href = await wa.getAttribute('href');
      expect(href).toMatch(/^https:\/\/wa\.me\/90\d{10}\?text=/);
      await expect(page.locator('a[href^="tel:+90"]').first()).toHaveAttribute('href', /^tel:\+90\d{10}$/);
    }
    // Bilgi talebi formu ilan sayfasında
    await expect(page.getByRole('button', { name: 'Bilgi al' }).last()).toBeVisible();
  });

  test('Favorilere ekleme ve favoriler sayfası', async ({ page }) => {
    await page.goto('/satilik');
    const card = page.getByRole('region', { name: 'Arama sonuçları' }).locator('article').first();
    const title = (await card.getByRole('heading', { level: 3 }).innerText()).trim();
    await card.getByRole('button', { name: 'Favorilere ekle' }).click();
    await expect(card.getByRole('button', { name: 'Favorilerden çıkar' })).toBeVisible();
    await page.goto('/favoriler');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Favorilerden çıkar' }).first().click();
    await expect(page.getByRole('heading', { name: 'Henüz favori ilanınız yok' })).toBeVisible();
  });

  test('Karşılaştırma: iki ilan eklenir ve karşılaştırma sayfasında görünür', async ({ page }) => {
    await page.goto('/satilik');
    const list = page.getByRole('region', { name: 'Arama sonuçları' }).locator('article');
    const titles: string[] = [];
    for (const i of [0, 1]) {
      const card = list.nth(i);
      titles.push((await card.getByRole('heading', { level: 3 }).innerText()).trim());
      await card.getByRole('button', { name: 'Karşılaştır' }).click();
    }
    await page.getByRole('link', { name: 'Karşılaştır', exact: true }).last().click();
    await expect(page).toHaveURL(/\/karsilastir/);
    for (const t of titles) await expect(page.getByText(t).first()).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test('Paylaşım menüsü ve bağlantı kopyalama', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'Mobilde cihazın yerel paylaşım menüsü açılır');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/satilik');
    await cards(page).first().getByRole('link').click();
    await page.getByRole('button', { name: 'İlanı paylaş' }).first().click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/\?text=/);
    await expect(menu.getByRole('menuitem', { name: 'Facebook' })).toHaveAttribute('href', /facebook\.com\/sharer/);
    await expect(menu.getByRole('menuitem', { name: 'X' })).toHaveAttribute('href', /x\.com\/intent/);
    await menu.getByRole('menuitem', { name: 'Bağlantıyı kopyala' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/ilan/');
  });

  test('Çerez bildirimi: tercih kaydedilir ve tekrar sorulmaz', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('e2e-consent-test', '1');
      if (!sessionStorage.getItem('e2e-cleared')) {
        localStorage.removeItem('eg:consent');
        sessionStorage.setItem('e2e-cleared', '1');
      }
    });
    await page.goto('/');
    const notice = page.getByRole('region', { name: 'Çerez bildirimi' });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Yalnızca zorunlu' }).click();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(notice).toBeHidden();
  });

  test('İletişim formu: doğrulama ve gönderim', async ({ page }) => {
    await page.goto('/iletisim');
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Mesajı gönder' }) });
    await page.waitForTimeout(3000); // bot korumasının en kısa doldurma süresi
    await form.getByRole('button', { name: 'Mesajı gönder' }).click();
    await expect(form.getByText(/Adınızı ve soyadınızı yazın/)).toBeVisible();
    await form.getByLabel(/^Ad soyad/).fill('E2E Test Ziyaretçi');
    await form.getByLabel(/^Telefon/).fill('0532 000 00 00');
    await form.getByLabel(/^Mesajınız/).fill('Elvankent bölgesinde 3+1 daire arıyorum, bilgi rica ederim. (E2E test)');
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Mesajı gönder' }).click();
    // Aynı IP'den kısa sürede tekrarlanan gönderimde spam koruması devreye girer; bu da beklenen bir sonuçtur
    await expect(page.getByText('Teşekkürler!').first().or(page.getByText(/Kısa süre içinde çok sayıda talep/))).toBeVisible({ timeout: 20_000 });
  });

  test('SEO: canonical, Open Graph, yapılandırılmış veri, robots, site haritası ve 404', async ({ page, request }) => {
    await page.goto('/satilik');
    const href = await cards(page).first().getByRole('link').getAttribute('href');
    await page.goto(href!);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ilan\//);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /\/og/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const ld = await page.locator('script[type="application/ld+json"]').allInnerTexts();
    expect(ld.some((s) => s.includes('"RealEstateListing"'))).toBe(true);
    expect(ld.some((s) => s.includes('"BreadcrumbList"'))).toBe(true);
    expect(ld.some((s) => s.includes('aggregateRating'))).toBe(false);
    const robotsRes = await request.get('/robots.txt');
    const robots = await robotsRes.text();
    expect(robots).toContain('Disallow: /admin');
    // Demo / önizleme ortamı (SITE_ENV≠production): her yanıt noindex, robots.txt site haritası vermez
    const indexable = !/noindex/.test(robotsRes.headers()['x-robots-tag'] ?? '');
    if (indexable) {
      expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    } else {
      expect(robots).not.toMatch(/Sitemap:/);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.getByText('DEMO ORTAMI')).toBeVisible();
    }
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain('<urlset');
    expect(xml).toMatch(/\/satilik<\/loc>/);
    expect((await request.get('/ilan/bu-ilan-yok-123456')).status()).toBe(404);
    expect((await request.get('/admin/ilanlar', { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);
  });
});
