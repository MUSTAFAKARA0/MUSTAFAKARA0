import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Telefon kabul testi (docs/DEMO_SETUP.md) — mobil görünümde (Android + iPhone profili).
 * Demo verisiyle kurulmuş bir ortam bekler: 8 satılık + 4 kiralık DEMO ilan, SITE_ENV=demo.
 *
 * Gerekli: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (ofis sahibi + süper admin).
 * Emlakçı hesabı testi ayrıca NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ister
 * (test sonunda oluşturduğu kullanıcıyı siler). Yan etkiler: bir test ilanı oluşturur
 * ve çöp kutusuna taşır; birkaç test talebi yazar; ofis logosunu test görseliyle değiştirir.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fixtureDir = path.join(__dirname, '.fixtures');
const photos = ['kabul-1', 'kabul-2'].map((n) => path.join(fixtureDir, `${n}.jpg`));
const logoFile = path.join(fixtureDir, 'kabul-logo.png');

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  mkdirSync(fixtureDir, { recursive: true });
  await Promise.all([
    ...photos.map((file, i) =>
      sharp({ create: { width: 1600, height: 1067, channels: 3, background: i ? '#c08a3e' : '#2f7c6e' } })
        .jpeg({ quality: 80 })
        .toFile(file),
    ),
    sharp({ create: { width: 600, height: 200, channels: 4, background: { r: 16, g: 80, b: 70, alpha: 1 } } })
      .png()
      .toFile(logoFile),
  ]);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('eg:consent', JSON.stringify({ v: 1, analytics: false, at: new Date().toISOString() })));
  page.on('pageerror', (e) => {
    throw new Error(`Sayfa hatası: ${e.message}`);
  });
});

async function noOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where}: yatay kaydırma olmamalı`).toBeLessThanOrEqual(0);
}

const results = (page: Page) => page.getByRole('region', { name: 'Arama sonuçları' });
const cardTitles = (page: Page) => results(page).getByRole('heading', { level: 3 });

async function login(page: Page, user = email!, pass = password!) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(user);
  await page.getByLabel('Şifre', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/admin\/giris/);
}

async function openMenu(page: Page) {
  const burger = page.getByRole('button', { name: 'Menüyü aç' });
  if (await burger.isVisible()) await burger.click();
}

// --------------------------------------------------------------------------- Ziyaretçi
test.describe('Ziyaretçi (telefon)', () => {
  test('1–6: ana sayfa, DEMO şeridi, menü, footer, yatay kayma, noindex', async ({ page, request }) => {
    const res = await page.goto('/');
    expect(res?.headers()['x-robots-tag']).toContain('noindex');
    await expect(page.getByText('DEMO ORTAMI').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noOverflow(page, 'ana sayfa');
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    const nav = page.getByRole('navigation', { name: 'Mobil menü' });
    await expect(nav).toBeVisible();
    await nav.getByRole('link', { name: /Kiralık/ }).first().click();
    await expect(page).toHaveURL(/\/kiralik/);
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    await expect(page.getByRole('contentinfo').getByRole('link', { name: /KVKK/ }).first()).toBeVisible();
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).not.toMatch(/Sitemap:/);
  });

  test('7–9: 8 satılık + 4 kiralık DEMO ilan', async ({ page }) => {
    for (const [url, count] of [
      ['/satilik', 8],
      ['/kiralik', 4],
    ] as const) {
      await page.goto(url);
      const titles = await cardTitles(page).allInnerTexts();
      expect(titles.length, url).toBe(count);
      for (const t of titles) expect(t, url).toMatch(/^DEMO/);
      await noOverflow(page, url);
    }
  });

  test('10–14: arama, filtre, temizle, sıralama, sonuçsuz arama', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('search', { name: 'Gayrimenkul ara' });
    await search.getByRole('radio', { name: 'Satılık' }).click();
    await search.getByRole('button', { name: 'Ara' }).click();
    await expect(page).toHaveURL(/\/satilik/);
    await expect(cardTitles(page).first()).toBeVisible();

    // Mobil filtre paneli
    await page.getByRole('button', { name: /Filtreler/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filtreler' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: '3+1', exact: true }).first().click();
    await sheet.getByRole('button', { name: 'Sonuçları göster' }).click();
    await expect(page).toHaveURL(/oda=3/);
    for (const t of await cardTitles(page).allInnerTexts()) if (/\d\+\d/.test(t)) expect(t).toContain('3+1');
    await page.getByRole('button', { name: /Filtreler/ }).click();
    await page.getByRole('dialog', { name: 'Filtreler' }).getByRole('button', { name: 'Temizle' }).click();
    await page.getByRole('dialog', { name: 'Filtreler' }).getByRole('button', { name: 'Sonuçları göster' }).click();
    await expect(page).not.toHaveURL(/oda=/);

    // Sıralama: fiyat artan
    await page.locator('#tb-sort').selectOption('fiyat-artan');
    await expect(page).toHaveURL(/sirala=fiyat-artan/);
    const prices = (await results(page).locator('article').allInnerTexts())
      .map((t) => Number((t.match(/₺\s*([\d.]+)/)?.[1] ?? '').replace(/\./g, ''))) // kartta ilk ₺ tutarı güncel fiyattır
      .filter((n) => n > 0);
    expect(prices.length).toBeGreaterThan(1);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);

    await page.goto('/satilik?fiyat_min=999999999999');
    await expect(page.getByRole('heading', { name: 'Hiç ilan bulunamadı' })).toBeVisible();
    await page.getByRole('link', { name: 'Filtreleri temizle' }).click();
    await expect(cardTitles(page).first()).toBeVisible();
  });

  test('15–22: ilan detay, galeri, tam ekran, harita, WhatsApp/Ara/Paylaş', async ({ page }) => {
    await page.goto('/satilik');
    await cardTitles(page).first().getByRole('link').click();
    await expect(page).toHaveURL(/\/ilan\//);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('DEMO');
    await expect(page.getByText(/Bu bir DEMO ilandır/)).toBeVisible();
    await noOverflow(page, 'ilan detay');

    await page.getByRole('button', { name: /^Fotoğraf 1( \/ \d+)? – tam ekran aç$/ }).filter({ visible: true }).first().click();
    const lightbox = page.getByRole('dialog');
    await expect(lightbox.getByText(/^1 \/ \d+$/)).toBeVisible();
    // Telefonda oklar gizlidir; kaydırma veya küçük resimle geçilir
    const next = lightbox.getByRole('button', { name: 'Sonraki fotoğraf' });
    if (await next.isVisible()) await next.click();
    else await lightbox.getByRole('button', { name: 'Fotoğraf 2', exact: true }).click();
    await expect(lightbox.getByText(/^2 \/ \d+$/)).toBeVisible();
    await lightbox.getByRole('button', { name: 'Galeriyi kapat' }).click();
    await expect(lightbox).toBeHidden();

    // Harita, bölüm görünüme gelince yüklenir
    await page.locator('#konum').scrollIntoViewIfNeeded();
    const map = page.getByRole('application', { name: /konumu$/ });
    await expect(map).toBeVisible({ timeout: 15_000 });

    // Ofis telefonu tanımlıysa WhatsApp/Ara bağlantıları doğru biçimde (demoda şirket numarası girilmemiş olabilir)
    const wa = page.locator('a[href^="https://wa.me/90"]');
    if (await wa.count()) {
      await expect(wa.first()).toHaveAttribute('href', /^https:\/\/wa\.me\/90\d{10}\?text=/);
      await expect(page.locator('a[href^="tel:+90"]').first()).toHaveAttribute('href', /^tel:\+90\d{10}$/);
    }
    await expect(page.getByRole('button', { name: 'İlanı paylaş' }).first()).toBeVisible();
  });

  test('23–24: favoriler ve karşılaştırma', async ({ page }) => {
    await page.goto('/kiralik');
    const list = results(page).locator('article');
    const names: string[] = [];
    for (const i of [0, 1]) {
      names.push((await list.nth(i).getByRole('heading', { level: 3 }).innerText()).trim());
      await list.nth(i).getByRole('button', { name: 'Favorilere ekle' }).click();
      await list.nth(i).getByRole('button', { name: 'Karşılaştır' }).click();
    }
    await page.goto('/favoriler');
    for (const n of names) await expect(page.getByRole('heading', { name: n })).toBeVisible();
    await page.goto('/karsilastir');
    for (const n of names) await expect(page.getByText(n).first()).toBeVisible();
    await noOverflow(page, 'karşılaştır');
  });

  test('25–30: bilgi ve randevu formu (doğrulama + gönderim)', async ({ page }) => {
    await page.goto('/kiralik');
    await cardTitles(page).first().getByRole('link').click();
    const panel = page.locator('#bilgi-talep');
    await panel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000); // bot korumasının en kısa doldurma süresi
    const infoForm = panel.locator('form').first();
    await infoForm.getByRole('button', { name: /Gönder|Bilgi al/ }).last().click();
    await expect(infoForm.getByText(/Adınızı ve soyadınızı yazın/)).toBeVisible();
    await infoForm.getByLabel(/^Ad soyad/).fill('Kabul Testi Ziyaretçi');
    await infoForm.getByLabel(/^Telefon/).fill('0532 000 00 00');
    await infoForm.getByRole('checkbox').check();
    await infoForm.getByRole('button', { name: /Gönder|Bilgi al/ }).last().click();
    await expect(page.getByText('Teşekkürler!').first().or(page.getByText(/Kısa süre içinde çok sayıda talep/))).toBeVisible({ timeout: 20_000 });

    // Randevu sekmesi
    await page.reload();
    await panel.scrollIntoViewIfNeeded();
    await panel.getByRole('radio', { name: 'Randevu talep et' }).or(panel.getByRole('tab', { name: 'Randevu talep et' })).first().click();
    await page.waitForTimeout(3000);
    const apptForm = panel.locator('form').first();
    await apptForm.getByRole('button', { name: /Randevu|Gönder/ }).last().click();
    await expect(apptForm.getByText(/Adınızı ve soyadınızı yazın/)).toBeVisible();
    await noOverflow(page, 'randevu formu');
  });
});

// --------------------------------------------------------------------------- Yönetim
test.describe('Yönetim paneli (telefon)', () => {
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil');

  test('31–35, 44–50: giriş, yanlış şifre, panel sayfaları', async ({ page }) => {
    await page.goto('/admin/giris');
    await page.getByLabel('E-posta').fill(email!);
    await page.getByLabel('Şifre', { exact: true }).fill('yanlis-sifre-123');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.getByText('E-posta veya şifre hatalı.')).toBeVisible();
    await login(page);
    for (const url of ['/admin', '/admin/ilanlar', '/admin/talepler', '/admin/musteriler', '/admin/randevular', '/admin/koleksiyonlar', '/admin/sirket', '/admin/ayarlar', '/admin/kullanicilar', '/admin/guvenlik', '/admin/hesap']) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBeLessThan(400);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noOverflow(page, url);
    }
    // 44: formlardan gelen talepler listede
    await page.goto('/admin/talepler');
    await expect(page.getByText(/Kabul Testi Ziyaretçi|E2E Test Ziyaretçi/).first()).toBeVisible();
    // 51: MFA bölümü
    await page.goto('/admin/hesap');
    await expect(page.getByText(/İki adımlı doğrulama/).first()).toBeVisible();
  });

  test('36–43: telefondan ilan: fotoğraf, kapak, sıralama, yayın, Satıldı, çöpe taşıma', async ({ page, request }) => {
    test.setTimeout(240_000);
    const title = `Kabul testi ${Date.now().toString(36)} – Elvankent 2+1`;
    await login(page);
    await page.goto('/admin/ilanlar/yeni');
    await page.locator('#property_type_id').selectOption({ label: 'Daire' });
    await page.locator('#title').fill(title);
    await page.getByRole('button', { name: /Taslağı oluştur/ }).click();
    await expect(page).toHaveURL(/\/admin\/ilanlar\/[0-9a-f-]{36}/, { timeout: 60_000 });
    const editorUrl = page.url().split('?')[0];

    await page.getByLabel(/^İl\*?$/).selectOption({ label: 'Ankara' });
    await page.getByLabel(/^İlçe\*?$/).selectOption({ label: 'Etimesgut' });
    await page.getByLabel(/^Mahalle$/).selectOption({ label: 'Elvankent' });
    await expect(page.getByText(/Kaydedildi/).first()).toBeVisible({ timeout: 30_000 });

    await page.goto(`${editorUrl}?adim=fotograflar`);
    await page.locator('input[type=file][multiple]').setInputFiles(photos);
    await page.waitForFunction(() => document.querySelectorAll('li[draggable="true"]').length >= 2, null, { timeout: 120_000 });
    await noOverflow(page, 'fotoğraf adımı');
    // Kapak: 2. fotoğraf
    await page.getByRole('button', { name: 'Fotoğraf 2 işlemleri' }).click();
    await page.getByRole('menuitem', { name: 'Kapak fotoğrafı yap' }).click();
    await expect(page.getByText('Kapak fotoğrafı güncellendi.')).toBeVisible({ timeout: 20_000 });
    // Sıralama: 1. fotoğrafı arkaya al
    await page.getByRole('button', { name: 'Fotoğraf 1 işlemleri' }).click();
    await page.getByRole('menuitem', { name: 'Arkaya al' }).click();

    // Adımlar arasında kullanıcı gibi adım düğmeleriyle geçilir (sayfa yenilenmez; otomatik kayıt sürer)
    const step = (name: RegExp) => page.getByRole('button', { name }).filter({ visible: true }).first().click();
    await step(/Temel bilgiler/);
    await page.getByLabel('Satış fiyatı').fill('3100000');
    await step(/Özellikler/);
    await page.getByLabel('Brüt alan').fill('110');
    await page.getByLabel('Oda sayısı').fill('2');
    await page.getByLabel('Salon sayısı').fill('1');
    await step(/Açıklama/);
    await page.getByLabel('İlan açıklaması').fill('Kabul testi için oluşturulan örnek ilan. Test sonunda çöp kutusuna taşınır; gerçek bir mülkü temsil etmez.');
    await step(/Yayınlama/);
    await expect(page.getByText('Fiyat girildi')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yayınla', exact: true })).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
    await expect(page.getByText('İlan yayınlandı.')).toBeVisible({ timeout: 30_000 });
    const publicPath = (await page.locator('a[href^="/ilan/"]').first().getAttribute('href')) ?? '';
    expect(publicPath).toMatch(/^\/ilan\//);

    await page.getByRole('button', { name: 'Satıldı olarak işaretle' }).click();
    // Kayıt bitene kadar beklenir: durum rozeti "Satıldı" olur ve düğme listeden kalkar
    await expect(page.getByRole('button', { name: 'Satıldı olarak işaretle' })).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Satıldı', { exact: true }).first()).toBeVisible();
    await expect(async () => {
      await page.goto(publicPath);
      await expect(page.getByText('Bu gayrimenkul satıldı.')).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    // Çöpe taşı → sitede 404
    await page.goto('/admin/ilanlar');
    await page.getByRole('button', { name: `${title} için işlemler` }).filter({ visible: true }).first().click();
    await page.getByRole('menuitem', { name: 'Çöpe taşı' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Çöpe taşı' }).click();
    await expect(page.getByText('1 ilan çöp kutusuna taşındı.')).toBeVisible({ timeout: 20_000 });
    await expect(async () => expect((await request.get(publicPath, { maxRedirects: 0 })).status()).toBe(404)).toPass({ timeout: 30_000 });
  });

  test('48: logo yüklenir; site başlığı, alt bilgi, giriş sayfası ve panelde görünür', async ({ page, browser }) => {
    await login(page);
    await page.goto('/admin/sirket');
    await page.locator('#branding-logo').setInputFiles(logoFile);
    await expect(page.getByText('Logo güncellendi.')).toBeVisible({ timeout: 30_000 });
    // Panel (menüde)
    await page.reload();
    await openMenu(page);
    await expect(page.locator('img[src*="/branding/"]').filter({ visible: true }).first()).toBeVisible();
    // Site ve giriş sayfası: oturumsuz ziyaretçi
    const guest = await (browser as Browser).newContext();
    const g = await guest.newPage();
    for (const url of ['/', '/admin/giris']) {
      await expect(async () => {
        await g.goto(url);
        const img = g.locator('img[src*="/branding/"]').first();
        await expect(img).toBeVisible({ timeout: 2_000 });
        expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth), `${url} logo yüklenmeli`).toBeGreaterThan(0);
      }).toPass({ timeout: 30_000 });
    }
    await g.goto('/');
    await expect(g.getByRole('contentinfo').locator('img[src*="/branding/"]')).toHaveCount(1);
    await guest.close();
  });

  test('52–54: süper admin: KARAY platformu, müşteri ofisinin paneline geçiş; çıkış', async ({ page }) => {
    await login(page);
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/platform$/);
    // Platform başlığı KARAY markasını taşır; ofis (Elvankent) adı/logosu başlıkta yoktur
    const header = page.getByRole('banner');
    await expect(header.getByRole('img', { name: 'KARAY' })).toBeVisible();
    await expect(header.getByText(/Elvankent/)).toHaveCount(0);
    await expect(header.locator('img[src*="/branding/"]')).toHaveCount(0);
    await noOverflow(page, '/platform');
    // Ofis paneline geçiş: organizasyon ayrıntısından (üyelik varsa)
    await page.goto('/platform/organizasyonlar');
    await page.getByRole('link', { name: /Elvankent Gayrimenkul/ }).first().click();
    await page.getByRole('button', { name: 'Ofis paneline geç' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await openMenu(page);
    await page.getByRole('button', { name: 'Hesap menüsü' }).filter({ visible: true }).first().click();
    await page.getByRole('menuitem', { name: /Çıkış yap/ }).click();
    await expect(page).toHaveURL(/\/admin\/giris/);
  });

  test('Emlakçı hesabı: sahip olarak eklenir, ilk girişte şifre değiştirir, /platform açılmaz', async ({ page, browser }) => {
    test.skip(!supabaseUrl || !serviceKey, 'Temizlik için service role anahtarı gerekir');
    const agentEmail = `emlakci-kabul-${Date.now().toString(36)}@example.com`;
    const service = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
    let temp = '';
    try {
      await login(page);
      await page.goto('/admin/kullanicilar');
      await page.getByRole('button', { name: 'Yeni kullanıcı' }).click();
      const dialog = page.getByRole('dialog', { name: 'Yeni kullanıcı' });
      await dialog.getByLabel('Ad soyad').fill('Kabul Testi Emlakçı');
      await dialog.getByLabel('E-posta').fill(agentEmail);
      await dialog.getByLabel('Rol').selectOption('owner');
      await dialog.getByRole('button', { name: 'Kullanıcıyı ekle' }).click();
      const added = page.getByRole('dialog', { name: 'Kullanıcı eklendi' });
      temp = (await added.locator('code').first().innerText()).trim();
      expect(temp.length).toBeGreaterThanOrEqual(10);

      const ctx = await (browser as Browser).newContext({ ...test.info().project.use });
      const p = await ctx.newPage();
      await login(p, agentEmail, temp);
      await expect(p).toHaveURL(/\/admin\/hesap\?sifre=degistir/);
      const newPass = `Kabul-${Date.now()}-Sifre9`;
      await p.getByLabel('Yeni şifre', { exact: true }).fill(newPass);
      await p.getByLabel('Yeni şifre (tekrar)').fill(newPass);
      await p.getByRole('button', { name: 'Şifreyi kaydet' }).click();
      await expect(p.getByText(/Şifreniz (güncellendi|değiştirildi)/).first()).toBeVisible({ timeout: 20_000 });
      await p.goto('/admin');
      await openMenu(p);
      await expect(p.getByRole('link', { name: /platform yönetimi/i })).toHaveCount(0);
      const res = await p.goto('/platform');
      expect(res?.status()).toBe(404);
      await expect(p.getByRole('img', { name: 'KARAY' })).toHaveCount(0);
      await ctx.close();
    } finally {
      const { data } = await service.auth.admin.listUsers({ perPage: 200 });
      const u = data?.users.find((x) => x.email === agentEmail);
      if (u) await service.auth.admin.deleteUser(u.id);
    }
  });
});
