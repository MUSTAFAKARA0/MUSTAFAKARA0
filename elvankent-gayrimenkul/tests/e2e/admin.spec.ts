import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';

/**
 * Yönetici senaryoları: giriş, ilan oluşturma, fotoğraf yönetimi, yayın
 * durumu, fiyat değişikliği, silme ve iletişim taleplerinin görüntülenmesi.
 * Gerekli: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const fixtureDir = path.join(__dirname, '.fixtures');
const images = ['bir', 'iki', 'uc'].map((n) => path.join(fixtureDir, `foto-${n}.jpg`));

test.describe.configure({ mode: 'serial' });
test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD tanımlı değil');

let propertyUrl = '';
let adminEditUrl = '';
const title = `E2E Test İlanı ${Date.now().toString().slice(-6)} Elvankent 3+1`;

test.beforeAll(async () => {
  mkdirSync(fixtureDir, { recursive: true });
  const colors = ['#2f7c6e', '#c08a3e', '#45423d'];
  await Promise.all(
    images.map((file, i) =>
      sharp({ create: { width: 1600, height: 1067, channels: 3, background: colors[i] } })
        .composite([
          {
            input: Buffer.from(
              `<svg width="1600" height="1067"><text x="800" y="560" font-size="200" text-anchor="middle" fill="#fff" font-family="sans-serif">${i + 1}</text></svg>`,
            ),
          },
        ])
        .jpeg({ quality: 85 })
        .toFile(file),
    ),
  );
});

async function login(page: Page) {
  await page.goto('/admin/giris');
  await page.getByLabel('E-posta').fill(email!);
  await page.getByLabel('Şifre', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('heading', { name: 'Hoş geldiniz' })).toBeVisible();
}

test('Yetkisiz erişim giriş sayfasına yönlenir, hatalı şifre reddedilir', async ({ page }) => {
  await page.goto('/admin/ilanlar');
  await expect(page).toHaveURL(/\/admin\/giris\?next=%2Fadmin%2Filanlar/);
  await page.getByLabel('E-posta').fill(email!);
  await page.getByLabel('Şifre', { exact: true }).fill('yanlis-sifre-123');
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByText('E-posta veya şifre hatalı.')).toBeVisible();
});

test('1. Giriş ve işletme ayarları (telefon/WhatsApp)', async ({ page }) => {
  await login(page);
  await page.goto('/admin/ayarlar');
  await page.getByLabel('Telefon').fill('0532 123 45 67');
  await page.getByLabel('WhatsApp numarası').fill('0532 123 45 67');
  await page.getByLabel('E-posta').fill('info@ornek-emlak.test');
  await page.getByRole('button', { name: 'Ayarları kaydet' }).click();
  await expect(page.getByText('Ayarlar kaydedildi')).toBeVisible();
});

test('2-6. Yeni ilan: bilgiler, 3 fotoğraf, sıralama ve yayınlama', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Yeni İlan Ekle' }).first().click();
  await expect(page.getByRole('heading', { name: 'Yeni İlan Ekle' })).toBeVisible();

  // Önce eksik bilgiyle yayınlamayı dene → doğrulama hataları
  await page.getByRole('button', { name: 'Yayınla' }).click();
  await expect(page.getByText('Lütfen işaretli alanları kontrol edin.')).toBeVisible();

  await page.getByLabel('İlan başlığı').fill(title);
  await page.getByLabel('Emlak tipi').selectOption({ label: 'Daire' });
  await page
    .getByRole('textbox', { name: 'Açıklama', exact: true })
    .fill('Uçtan uca test için oluşturulan ilan. Güney cepheli, site içinde, asansörlü ve otoparklı 3+1 daire.');
  await page.getByRole('combobox', { name: 'İl', exact: true }).selectOption({ label: 'Ankara' });
  await page.getByRole('combobox', { name: 'İlçe', exact: true }).selectOption({ label: 'Etimesgut' });
  await page.getByRole('combobox', { name: 'Mahalle', exact: true }).selectOption({ label: 'Elvankent' });
  await page.getByLabel('Enlem').fill('39.948100');
  await page.getByLabel('Boylam').fill('32.624500');
  await page.getByRole('textbox', { name: 'Fiyat', exact: true }).fill('3950000');
  await page.getByLabel('Brüt m²').fill('140');
  await page.getByLabel('Net m²').fill('120');
  await page.getByLabel('Oda', { exact: true }).selectOption('3');
  await page.getByLabel('Salon', { exact: true }).selectOption('1');
  await page.getByLabel('Asansör').selectOption('true');
  await page.getByLabel('Krediye uygun').selectOption('true');
  await page.getByLabel('Ankastre mutfak').check();

  await page.getByLabel('Fotoğraf seç').setInputFiles(images);
  const tiles = page.locator('#fotograflar li');
  await expect(tiles).toHaveCount(3);
  // 3. fotoğrafı en başa taşı → kapak olur
  await tiles.nth(2).getByRole('button', { name: 'Sola taşı' }).click();
  await tiles.nth(1).getByRole('button', { name: 'Sola taşı' }).click();

  await page.getByRole('button', { name: 'Yayınla' }).click();
  await expect(page).toHaveURL(/\/admin\/ilan\/[0-9a-f-]{36}\?yeni=1/, { timeout: 60_000 });
  adminEditUrl = page.url().split('?')[0];
  await expect(page.getByRole('heading', { name: 'İlanı Düzenle' })).toBeVisible();
  const saved = page.locator('#fotograflar ul').first().locator('li');
  await expect(saved).toHaveCount(3);
  await expect(saved.first().getByText('Kapak')).toBeVisible();
  propertyUrl = (await page.getByRole('link', { name: 'Sitede görüntüle' }).getAttribute('href'))!;
  expect(propertyUrl).toMatch(/^\/ilan\/satilik-.*-\d{6}$/);
});

test('4-5. Fotoğraf sıralaması ve kapak değişikliği kalıcıdır', async ({ page }) => {
  await login(page);
  await page.goto(adminEditUrl);
  const list = page.locator('#fotograflar ul').first().locator('li');
  await list.nth(1).getByRole('button', { name: 'Kapak yap' }).click();
  await expect(page.getByText('Kapak fotoğrafı güncellendi')).toBeVisible();
  await list.nth(2).getByRole('button', { name: 'Sola taşı' }).click();
  await page.waitForTimeout(1000);
  await page.reload();
  const after = page.locator('#fotograflar ul').first().locator('li');
  await expect(after).toHaveCount(3);
  // Kapak işaretli fotoğraf (önceki 2. sıra) artık 3. sırada olmalı
  await expect(after.nth(2).getByText('Kapak')).toBeVisible();
});

test('6-8. Yayındaki ilan sitede görünür; fiyat düzenlenir', async ({ page }) => {
  await login(page);
  await page.goto(adminEditUrl);
  await page.getByRole('textbox', { name: 'Fiyat', exact: true }).fill('3875000');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('Değişiklikler yayında')).toBeVisible();

  await page.goto(propertyUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByText('₺3.875.000').first()).toBeVisible();
  const wa = page.locator('a[href^="https://wa.me/905321234567"]').first();
  await expect(wa).toHaveAttribute('href', /text=/);
});

test('9-10. Pasife alınan ilan sitede görünmez, tekrar aktif edilince görünür', async ({ page, request }) => {
  await login(page);
  await page.goto(`/admin/ilanlar?q=${encodeURIComponent(title.split(' ').slice(0, 4).join(' '))}`);
  const row = page.locator('tbody tr').filter({ hasText: title });
  await row.getByRole('button', { name: 'Yayından kaldır' }).click();
  await expect(page.getByText('İlan yayından kaldırıldı')).toBeVisible();
  expect((await request.get(propertyUrl)).status()).toBe(404);

  await row.getByRole('button', { name: 'Yayına al' }).click();
  await expect(page.getByText('İlan yayına alındı')).toBeVisible();
  expect((await request.get(propertyUrl)).status()).toBe(200);
});

test('12. İletişim talebi admin panelinde görünür', async ({ page, browser }) => {
  const visitor = await browser.newPage();
  await visitor.goto(propertyUrl);
  const form = visitor.locator('form').filter({ has: visitor.getByRole('button', { name: 'Mesaj Gönder' }) }).last();
  await visitor.waitForTimeout(3000);
  await form.getByLabel('Ad Soyad').fill('E2E Alıcı Adayı');
  await form.getByLabel('Telefon').fill('05329998877');
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Mesaj Gönder' }).click();
  await expect(visitor.getByText('Mesajınız alındı.').first()).toBeVisible();
  await visitor.close();

  await login(page);
  await page.goto('/admin/mesajlar');
  const msg = page.locator('li').filter({ hasText: 'E2E Alıcı Adayı' }).first();
  await expect(msg).toBeVisible();
  await expect(msg).toContainText(title);
  await msg.getByRole('button', { name: 'Yanıtlandı' }).click();
  await expect(page.getByText('Yanıtlandı olarak işaretlendi')).toBeVisible();
});

test('11. İlan silinir; eski adres kategoriye kalıcı yönlenir', async ({ page, request }) => {
  await login(page);
  await page.goto(`/admin/ilanlar?q=${encodeURIComponent(title.split(' ').slice(0, 4).join(' '))}`);
  const row = page.locator('tbody tr').filter({ hasText: title });
  await row.getByRole('button', { name: /diğer işlemler/ }).click();
  await page.getByRole('menuitem', { name: 'İlanı sil' }).click();
  await page.getByRole('button', { name: 'Kalıcı olarak sil' }).click();
  await expect(page.getByText('İlan silindi')).toBeVisible();
  const res = await request.get(propertyUrl, { maxRedirects: 0 });
  expect([301, 308]).toContain(res.status());
  expect(res.headers()['location']).toMatch(/\/satilik$/);
});
