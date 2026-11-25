// Dev-only: KARAYS tasarım şeridi görüntülerini üretir (src/app/karay/_images/aileler/<aile>.webp, 704x440).
// Kullanım (sunucu çalışırken): E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… node scripts/capture-family-shots.mjs [aile,aile]
// Gerçek /site-onizleme (örnek içerik, "Önizleme · örnek içerik" rozetli) 1440x900 ilk ekran → 704x440 webp.
// Yeniden boyutlandırma için `cwebp` veya ImageMagick (`magick`) gerekir; yeni npm bağımlılığı yoktur.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ids = (process.argv[2] ?? 'deniz-kiyisi,proje-lansman,plaza-ofis,arsa-tarla,kurumsal-zincir,butik-ofis,kiralik-merkezi,miras-konak,gece-premium').split(',');
const info = { siteName: 'Örnek Emlak', address: { city: 'Ankara' }, social: {}, seo: {} };
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const out = path.resolve('src/app/karay/_images/aileler');
const tmp = mkdtempSync(path.join(tmpdir(), 'shots-'));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${base}/platform/giris`);
await page.getByLabel('E-posta').fill(process.env.E2E_ADMIN_EMAIL);
await page.getByLabel('Şifre', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD);
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForURL((u) => !u.pathname.includes('/giris'));
for (const id of ids) {
  await page.goto(`${base}/site-onizleme?p=${enc({ manifest: { siteType: 'real-estate-office', designFamily: id, variants: {} }, info })}&s=ana-sayfa`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const png = path.join(tmp, `${id}.png`);
  await page.screenshot({ path: png });
  execFileSync('magick', [png, '-resize', '704x440!', '-quality', '74', path.join(out, `${id}.webp`)]);
  console.log('ok', id, readFileSync(path.join(out, `${id}.webp`)).length, 'bayt');
}
await browser.close();
writeFileSync(path.join(tmp, '.done'), '');
