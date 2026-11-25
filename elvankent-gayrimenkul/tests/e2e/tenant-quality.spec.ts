import { expect, test } from '@playwright/test';

/**
 * Faz 2 — kiracı sitesi sayfa kalitesi (demo kiracı, production build).
 *  TQ-01  320–1440 px: ana sayfa, liste, detay, bölgeler, blog, iletişim yatay taşmaz
 *  TQ-02  Detay: bölüm gezintisi, galeri tam ekran (klavye: ok, Esc, odak tetikleyiciye döner)
 *  TQ-03  Bağlama duyarlı boş durum: filtreli liste, öneri ve "Filtreleri temizle"
 *  TQ-04  Masaüstü yapışkan iletişim çubuğu sayfa sonunda belirir
 *  TQ-05  Mobil galeri: önceki/sonraki slayt düğmeleri sayacı değiştirir
 *  TQ-06  Hareketi azalt: animasyon çalışmaz; CLS < 0.05
 *  TQ-07  Bilinmeyen adres 404 döner (loading.tsx yumuşak 404 üretmez)
 */
const PAGES = ['/', '/ilanlar', '/bolgeler', '/blog', '/iletisim'];
const DETAIL = '/ilan/elvankent-site-icinde-satilik-3-1-daire';

test('TQ-01 yatay taşma yok', async ({ page }) => {
  for (const w of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const p of [...PAGES, DETAIL]) {
      await page.goto(p);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${p} @${w}`).toBeLessThanOrEqual(0);
    }
  }
});

test('TQ-02 detay gezintisi ve tam ekran galeri klavye akışı', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(DETAIL);
  const nav = page.getByRole('navigation', { name: 'İlan bölümleri' });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Özellikler' }).click();
  await expect(page).toHaveURL(/#ozellikler$/);
  await page.evaluate(() => window.scrollTo(0, 0));
  const trigger = page.getByRole('button', { name: /Fotoğraf 1 – tam ekran aç/ }).and(page.locator(':visible'));
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('Fotoğraf 1 /');
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('status')).toContainText('Fotoğraf 2 /');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('TQ-03 filtreli boş durum öneri ve temizleme sunar', async ({ page }) => {
  await page.goto('/ilanlar?fiyat_min=999999999999');
  await expect(page.getByRole('heading', { name: 'Hiç ilan bulunamadı' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Öneriler' })).toContainText('Fiyat aralığını genişletin');
  await page.getByRole('link', { name: 'Filtreleri temizle' }).click();
  await expect(page).toHaveURL(/\/ilanlar$/);
});

test('TQ-04 masaüstü yapışkan iletişim çubuğu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(DETAIL);
  await expect(page.getByRole('region', { name: 'Hızlı iletişim' })).toHaveCount(0);
  // Yapışkan iletişim kutusu klasik düzende hep görünürdür; kutu görünümden çıkmış gibi gizleyip kuralı sınarız
  await page.evaluate(() => {
    window.scrollTo(0, 900);
    (document.getElementById('iletisim-kutusu') as HTMLElement).style.display = 'none';
  });
  await expect(page.getByRole('region', { name: 'Hızlı iletişim' })).toBeVisible();
  // Alt bilgi görününce yasal bağlantıların üstünü örtmemesi için gizlenir
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole('region', { name: 'Hızlı iletişim' })).toHaveCount(0);
});

test('TQ-05 mobil galeri slayt düğmeleri', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(DETAIL);
  const counter = page.getByText(/^1 \/ \d+$/).first();
  await expect(counter).toBeVisible();
  await page.getByRole('button', { name: 'Sonraki slayt' }).click();
  await expect(page.getByText(/^2 \/ \d+$/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Önceki slayt' }).click();
  await expect(page.getByText(/^1 \/ \d+$/).first()).toBeVisible();
});

test('TQ-06 hareketi azalt ve CLS', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  for (const p of ['/ilanlar', DETAIL]) {
    await page.goto(p, { waitUntil: 'networkidle' });
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && !(a instanceof CSSTransition)).length)).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
  }
});

test('TQ-07 bilinmeyen adresler 404 döner', async ({ request }) => {
  for (const p of ['/bu-adres-yok', '/bolgeler/bu-bolge-yok', '/bolgeler/bu/yok', '/kiralik-yok', '/blog?sayfa=999', '/ilan/bu-ilan-yok']) {
    expect((await request.get(p)).status(), p).toBe(404);
  }
});

const FAMILIES = [
  'klasik-guven', 'sinematik-vitrin', 'editoryal-luks', 'kurumsal-portfoy', 'yalin-galeri', 'dogal-yasam', 'luxury', 'architectural', 'map-first',
  'deniz-kiyisi', 'proje-lansman', 'plaza-ofis', 'arsa-tarla', 'kurumsal-zincir', 'butik-ofis', 'kiralik-merkezi', 'miras-konak', 'gece-premium',
];

test('TQ-08 18 ailede kart rozeti, tür çipi ve favori kalbi okunur (hesaplanmış renkler)', async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, 'E2E_ADMIN_* tanımlı değil');
  test.setTimeout(480_000);
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(process.env.E2E_ADMIN_EMAIL as string);
  await page.getByLabel('Şifre', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((u) => !/giris/.test(u.pathname));
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const failures: string[] = [];
  for (const fam of FAMILIES) {
    const p = enc({ manifest: { siteType: 'real-estate-office', designFamily: fam, variants: {} }, info: { siteName: 'Örnek Emlak', address: { city: 'Ankara' }, social: {}, seo: {} } });
    await page.goto(`/site-onizleme?p=${p}&s=ilanlar`);
    await page.locator('.property-card, main article').first().waitFor();
    const rows = await page.evaluate(() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const cx = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      const rgba = (c: string): [number, number, number, number] => {
        cx.clearRect(0, 0, 1, 1);
        cx.fillStyle = '#000';
        cx.fillStyle = c;
        cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      };
      const lum = (c: number[]) => {
        const f = c.slice(0, 3).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
      };
      const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      // Kartın altındaki yüzey: kart görseli değil, tema yüzeyi (rozetler yarı saydam yüzey zeminlidir)
      const surface = rgba(getComputedStyle(document.querySelector('main') as Element).getPropertyValue('--surface') || '#fff');
      const over = (fg: number[], bg: number[]) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
      const out: { kind: string; ratio: number; need: number }[] = [];
      for (const card of Array.from(document.querySelectorAll('.property-card, main article')).slice(0, 4)) {
        for (const el of Array.from(card.querySelectorAll('span.rounded-full, button[aria-pressed]'))) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (!r.width || cs.display === 'none' || el.classList.contains('pc-count')) continue;
          const bg = rgba(cs.backgroundColor);
          if (bg[3] < 0.85) continue; // zemini olmayan düğmeler (metinli Karşılaştır) ve görsel üstü koyu perde (sayaç) kapsam dışı
          const base = over(bg, surface);
          if (el.matches('button')) {
            const svg = el.querySelector('svg');
            out.push({ kind: 'kalp', ratio: ratio(rgba(svg ? getComputedStyle(svg).color : cs.color), [...base, 1]), need: 3 });
          } else {
            out.push({ kind: `rozet:${(el.textContent || '').trim()}`, ratio: ratio(rgba(cs.color), [...base, 1]), need: 4.5 });
          }
        }
      }
      return out;
    });
    expect(rows.length, `${fam}: kart öğesi bulunamadı`).toBeGreaterThan(0);
    for (const r of rows) if (r.ratio < r.need) failures.push(`${fam} ${r.kind} ${r.ratio.toFixed(2)} < ${r.need}`);
  }
  expect(failures).toEqual([]);
});
