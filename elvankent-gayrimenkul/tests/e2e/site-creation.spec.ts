import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * SITE-CREATION + PREVIEW (Aşama D4): "Yeni Site Oluştur → site tipi → tasarım → önizle → oluştur".
 *
 *  SC-01  Sihirbaz 6 adımla gerçek bir site oluşturur; manifest, site tipi ve aile doğru kaydedilir.
 *  SC-02  Önizleme gerçek bileşenlerle seçilen varyantları gösterir; önizlemenin manifesti ile
 *         oluşturulan kiracının manifesti AYNIDIR (tema, varyant öznitelikleri, yazı tipi paketi).
 *  SC-03  Oluşturulan kiracı yalnızca seçilen paketi taşır (başka aile teması/yazı tipi yok).
 *  SC-04  Önizleme rotası: oturumsuz → giriş; kiracı alan adında 404; bozuk istek → 404.
 *
 * Yalnızca yerel/demo veritabanı; test sonunda oluşturulan organizasyon ve sahip hesabı silinir.
 */
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });
test.skip(!adminEmail || !adminPassword || !url || !serviceKey, 'E2E_ADMIN_* ve Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const HOST = `sc-${RUN}.e2e.test`;
const SITE = `http://${HOST}:${PORT}`;
const OWNER = `sc-owner-${RUN}@example.test`;
const NAME = `Deneme Yapı ${RUN}`;

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`],
  },
});

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const S: { orgId?: string; previewSrc?: string; preview?: Record<string, string | null>; previewFaces?: string[] } = {};

test.afterAll(async () => {
  if (!service) return;
  const { data: org } = await service.from('organizations').select('id').eq('slug', `deneme-yapi-${RUN}`).maybeSingle();
  if (org) await service.from('organizations').delete().eq('id', org.id);
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  const u = users?.users.find((x) => x.email === OWNER);
  if (u) await service.auth.admin.deleteUser(u.id);
});

async function loginPlatform(page: Page) {
  await page.goto('/platform/giris');
  await page.getByLabel('E-posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL(/\/platform$/);
}

/** Sayfanın görsel çalışma zamanı: tema/varyant öznitelikleri, tema kuralları ve yazı tipi paketleri */
const runtimeOf = (scope: string) => {
  const root = document.querySelector(scope) ?? document.documentElement;
  const holder = root.querySelector('[data-site-theme]') ?? root;
  const attrs: Record<string, string | null> = {};
  for (const a of ['data-site-theme', 'data-site-card', 'data-site-button', 'data-site-footer', 'data-site-image', 'data-site-card-layout', 'data-site-header-layout', 'data-site-motion']) attrs[a] = holder.getAttribute(a);
  // Hero ve footer düzeni bileşen seçimidir (öznitelik değil): çizilen yapının imzası karşılaştırılır
  const hero = root.querySelector('#hero-baslik')?.closest('section');
  const footer = root.querySelector('footer.site-footer');
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
  return {
    attrs,
    themes: [...new Set([...css.matchAll(/data-site-theme='([a-z]+)'/g)].map((m) => m[1]))],
    faces: [...new Set([...css.matchAll(/@font-face\{font-family:'([^']+)'/g)].map((m) => m[1]))].sort(),
    hero: hero ? `${hero.className}|${hero.firstElementChild?.className ?? ''}` : null,
    footer: footer ? `${footer.className}|${footer.firstElementChild?.className ?? ''}` : null,
  };
};

test('SC-01/02: sihirbaz → önizleme → oluştur; manifest kaydedilir, önizleme = kiracı', async ({ page }) => {
  test.setTimeout(120_000);
  await loginPlatform(page);
  await page.goto('/platform/siteler');
  await page.getByRole('link', { name: 'Yeni site oluştur' }).click();
  await expect(page.getByRole('heading', { name: 'Yeni site oluştur' })).toBeVisible();

  // 1 · Site bilgileri
  await page.getByLabel('Site adı').fill(NAME);
  await expect(page.getByLabel('Kısa ad (alt alan adı)')).toHaveValue(`deneme-yapi-${RUN}`);
  await page.locator('#w-company').fill(`${NAME} İnşaat Ltd. Şti.`);
  await page.getByRole('radio', { name: 'Özel alan adı' }).click();
  await page.getByLabel('Özel alan adı').fill(HOST);
  await page.locator('#w-phone').fill('+90 555 000 00 00');
  await page.locator('#w-email').fill(`ofis-${RUN}@example.test`);
  await page.locator('#w-city').fill('Ankara');
  await page.getByLabel('Sahip adı soyadı').fill('Deneme Sahip');
  await page.getByLabel('Sahip e-postası').fill(OWNER);
  await page.getByLabel('İlan no öneki').fill(`Y${String.fromCharCode(65 + (parseInt(RUN.slice(0, 2), 16) % 26))}${String.fromCharCode(65 + (parseInt(RUN.slice(2, 4), 16) % 26))}`);
  await page.getByRole('button', { name: 'Devam' }).click();

  // 2 · Site tipi
  await expect(page.getByRole('heading', { name: 'Site tipi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Devam' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Proje / Müteahhit' }).click();
  await page.getByRole('button', { name: 'Devam' }).click();

  // 3 · Tasarım ailesi (site tipine göre önerilenler işaretli)
  await expect(page.getByRole('radio', { name: 'Sinematik Vitrin' })).toContainText('Önerilen');
  await page.getByRole('radio', { name: 'Sinematik Vitrin' }).click();
  await page.getByRole('button', { name: 'Devam' }).click();

  // 4 · Tasarım seçenekleri: header ve ana sayfa kompozisyonu değiştirilir
  await page.getByRole('group', { name: 'Header' }).getByRole('button', { name: /Ortalı logo/ }).click();
  await page.getByRole('group', { name: 'Ana sayfa kompozisyonu' }).getByRole('button', { name: /Öne çıkan ilan önce/ }).click();
  await page.getByRole('button', { name: 'Önizle', exact: true }).click();

  // 5 · Gerçek önizleme (çerçeve içinde gerçek site bileşenleri)
  const frame = page.frameLocator('iframe[title="Site önizlemesi"]');
  await expect(frame.locator('[data-site-preview]')).toHaveAttribute('data-preview-family', 'sinematik-vitrin');
  await expect(frame.locator('[data-site-preview]')).toHaveAttribute('data-preview-site-type', 'project-builder');
  await expect(frame.locator('header').first()).toBeVisible();
  S.previewSrc = (await page.locator('iframe[title="Site önizlemesi"]').getAttribute('src'))!;
  const pv = await page.context().newPage();
  await pv.goto(S.previewSrc);
  const previewRuntime = await pv.evaluate(runtimeOf, '[data-site-preview]');
  await pv.close();
  expect(previewRuntime.attrs['data-site-theme']).toBe('rezidans');
  expect(previewRuntime.attrs['data-site-header-layout']).toBe('centered');
  expect(previewRuntime.hero).toContain('hero-media'); // Sinematik hero
  expect(previewRuntime.themes).toEqual(['rezidans']);
  await page.getByRole('button', { name: 'Devam' }).click();

  // 6 · Onay ve oluşturma
  await expect(page.getByText('Sinematik Vitrin').first()).toBeVisible();
  await expect(page.getByText('Ortalı logo, ayrı menü')).toBeVisible();
  await page.getByRole('button', { name: 'Siteyi oluştur' }).click();
  await expect(page.getByRole('heading', { name: 'Site oluşturuldu' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('İlk sürüm yayınlandı ve site ziyaretçiye açık.')).toBeVisible();

  // Veritabanı: organizasyon, manifest kaynağı, tasarım, site tipi özellikleri, durum, marka
  const { data: org } = await service!.from('organizations').select('id, name').eq('slug', `deneme-yapi-${RUN}`).single();
  S.orgId = org!.id;
  const { data: site } = await service!.from('site_configs').select('published, draft, site_status, published_version, feature_overrides').eq('organization_id', org!.id).single();
  const pub = site!.published as Record<string, Record<string, unknown>>;
  expect(site!.site_status).toBe('active');
  expect(site!.published_version).toBe(1);
  expect(pub.style.origin).toEqual({ siteType: 'project-builder', family: 'sinematik-vitrin', homepage: 'featured-first' });
  expect(pub.theme).toBe('rezidans');
  expect(pub.style.headerLayout).toBe('centered');
  expect(pub.style.hero).toBe('cinematic');
  expect((pub.colors as Record<string, unknown>).preset).toBe('premium-gold');
  const enabled = ((pub.home as { sections: { type: string; enabled: boolean }[] }).sections ?? []).filter((s) => s.enabled).map((s) => s.type);
  expect(enabled[0]).toBe('hero');
  expect(enabled[1]).toBe('spotlight');
  expect(enabled).not.toContain('owner_cta');
  expect((pub.pages as Record<string, { visible: boolean }>).degerleme?.visible).toBe(false);
  expect(site!.feature_overrides).toMatchObject({ valuation: false });
  const { data: settings } = await service!.from('organization_settings').select('display_name, legal_name, phone, address_city').eq('organization_id', org!.id).single();
  expect(settings).toMatchObject({ display_name: NAME, legal_name: `${NAME} İnşaat Ltd. Şti.`, phone: '+90 555 000 00 00', address_city: 'Ankara' });

  // Önizleme = kiracı: oluşturulan sitenin görsel çalışma zamanı önizlemeyle aynı
  const t = await page.context().newPage();
  const res = await t.goto(`${SITE}/`, { waitUntil: 'networkidle' });
  expect(res?.status()).toBe(200);
  const tenantRuntime = await t.evaluate(runtimeOf, 'body');
  expect(tenantRuntime.attrs).toEqual(previewRuntime.attrs);
  expect(tenantRuntime.themes).toEqual(previewRuntime.themes);
  expect(tenantRuntime.faces).toEqual(previewRuntime.faces);
  expect(tenantRuntime.hero).toEqual(previewRuntime.hero);
  expect(tenantRuntime.footer).toEqual(previewRuntime.footer);
  S.previewFaces = previewRuntime.faces;
  await t.close();
});

test('SC-03: oluşturulan kiracı yalnızca seçilen paketi taşır (katalog, diğer aileler, sihirbaz yok)', async ({ page }) => {
  test.skip(!S.orgId, 'SC-01 başarısız');
  const scripts: string[] = [];
  page.on('response', async (r) => {
    if (new URL(r.url()).pathname.endsWith('.js')) scripts.push(await r.text().catch(() => ''));
  });
  const res = await page.goto(`${SITE}/`, { waitUntil: 'networkidle' });
  const html = await res!.text();
  // Yalnızca Playfair Display + Manrope (Sinematik Vitrin tipografisi)
  expect(S.previewFaces).toEqual(['Manrope', 'Manrope Fallback', 'Playfair Display', 'Playfair Display Fallback']);
  for (const other of ['Fraunces', 'Inter', 'DM Sans', 'Lora', 'Cormorant Garamond', 'Space Grotesk', 'Outfit', 'Newsreader']) expect(html).not.toContain(`font-family:'${other}'`);
  // Katalog, site tipleri ve sihirbaz kodu kiracı sayfasında/JS'inde yok
  const js = scripts.join('\n');
  for (const s of ['Editoryal Lüks', 'Kurumsal Portföy', 'Yalın Galeri', 'Doğal Yaşam', 'Klasik Güven', 'Gayrimenkul Danışmanı', 'Tasarım seçenekleri', 'site-onizleme', 'recommendedFamilies']) {
    expect(html, s).not.toContain(s);
    expect(js, s).not.toContain(s);
  }
  for (const t of ['klasik', 'marble', 'atlas', 'prestij', 'kent', 'yalin', 'doga', 'dergi', 'grafit']) expect(html).not.toContain(`data-site-theme='${t}'`);
});

test('SC-04: önizleme rotası yalnızca KARAY yüzeyinde ve süper admin oturumuyla', async ({ page, request }) => {
  test.skip(!S.previewSrc, 'SC-01 başarısız');
  // Oturumsuz → platform girişine yönlendirme
  const anon = await request.get(S.previewSrc!, { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(anon.status());
  expect(anon.headers().location).toContain('/platform/giris');
  // Kiracı alan adında rota yok (proxy 404)
  const onTenant = await page.goto(`${SITE}${S.previewSrc}`);
  expect(onTenant?.status()).toBe(404);
  // Oturumla: bozuk / kurcalanmış istek → 404
  await loginPlatform(page);
  for (const bad of ['/site-onizleme', '/site-onizleme?p=bozuk', `/site-onizleme?p=${Buffer.from(JSON.stringify({ manifest: { siteType: 'x', designFamily: 'sinematik-vitrin' }, info: { siteName: 'A B' } })).toString('base64url')}`]) {
    const r = await page.goto(bad);
    expect(r?.status(), bad).toBe(404);
  }
  // Yalnızca aynı köken çerçeveleyebilir
  const ok = await page.goto(S.previewSrc!);
  expect(ok?.status()).toBe(200);
  expect(ok?.headers()['x-frame-options']).toBe('SAMEORIGIN');
  expect(ok?.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
  const other = await page.goto('/platform');
  expect(other?.headers()['x-frame-options']).toBe('DENY');
});
