import { expect, test } from '@playwright/test';

/** Tüm hedef genişliklerde taşma / yatay kaydırma kontrolü */
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const PAGES = ['/', '/satilik', '/iletisim', '/hakkimizda', '/favoriler'];

test.describe('Responsive', () => {
  test('hedef genişliklerde yatay taşma yok', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Genişlikler bu testte tek tek ayarlanır');
    test.setTimeout(240_000);
    // İlk ilanın detay sayfasını da kontrol listesine ekle
    await page.goto('/ilanlar');
    const detail = await page.locator('#sonuclar article h3 a').first().getAttribute('href');
    const paths = detail ? [...PAGES, detail] : PAGES;

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of paths) {
        await page.goto(path, { waitUntil: 'load' });
        await page.waitForTimeout(300);
        const result = await page.evaluate(() => {
          const doc = document.documentElement;
          const offenders: string[] = [];
          for (const el of Array.from(document.querySelectorAll('body *'))) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed') {
              // overflow:hidden ebeveyn içinde kalanları sayma
              let p = el.parentElement;
              let clipped = false;
              while (p) {
                const s = getComputedStyle(p);
                if (s.overflowX === 'hidden' || s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflow === 'hidden') {
                  clipped = true;
                  break;
                }
                p = p.parentElement;
              }
              if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
            }
          }
          return { overflow: doc.scrollWidth - doc.clientWidth, offenders: offenders.slice(0, 5) };
        });
        expect(result.overflow, `${path} @ ${width}px taşan öğeler: ${result.offenders.join(', ')}`).toBeLessThanOrEqual(0);
      }
    }
  });
});
