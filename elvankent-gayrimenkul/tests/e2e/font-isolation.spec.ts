import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

/**
 * FONT-ISOLATION — FONT-01…04.
 *
 * Geçici iki kiracı, iki farklı tipografi paketiyle: A = Atlas (yalnızca DM Sans), B = Dergi
 * (Newsreader + Inter). Her kiracı yalnızca KENDİ yazı tiplerinin @font-face bildirimlerini,
 * ön yükleme bağlantılarını ve dosyalarını almalı; katalogdaki diğer yazı tipleri (ve diğer
 * kiracının yazı tipleri) HTML'de, CSS'te, JS'te ve ağ isteklerinde bulunmamalı.
 * Elvankent'e dokunulmaz; kiracılar test sonunda silinir. Yalnızca yerel/demo veritabanı.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });
test.skip(!url || !serviceKey, 'Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const HOST_A = `fia-${RUN}.e2e.test`;
const HOST_B = `fib-${RUN}.e2e.test`;

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=MAP ${HOST_A} 127.0.0.1, MAP ${HOST_B} 127.0.0.1`],
  },
});

/** Katalogdaki bütün yazı tipleri: [kimlik (dosya klasörü), aile adı] */
const CATALOG: [string, string][] = [
  ['manrope', 'Manrope'],
  ['fraunces', 'Fraunces'],
  ['inter', 'Inter'],
  ['playfair', 'Playfair Display'],
  ['dm-sans', 'DM Sans'],
  ['lora', 'Lora'],
  ['cormorant', 'Cormorant Garamond'],
  ['space-grotesk', 'Space Grotesk'],
  ['outfit', 'Outfit'],
  ['newsreader', 'Newsreader'],
];
const SITES = {
  a: { host: HOST_A, theme: 'atlas', palette: 'corporate-navy', fonts: ['dm-sans'] },
  b: { host: HOST_B, theme: 'dergi', palette: 'warm-beige', fonts: ['newsreader', 'inter'] },
} as const;

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const letters = (n: number) => [...randomBytes(n)].map((b) => String.fromCharCode(65 + (b % 26))).join('');
const orgs: string[] = [];

test.beforeAll(async () => {
  for (const [key, s] of Object.entries(SITES)) {
    const org = await service!
      .from('organizations')
      .insert({ slug: `fi${key}-${RUN}`, name: `E2E Font ${key.toUpperCase()} ${RUN}`, reference_prefix: `Y${letters(3)}`, status: 'active' })
      .select('id')
      .single();
    if (org.error) throw org.error;
    orgs.push(org.data.id);
    await service!.from('organization_settings').insert({ organization_id: org.data.id, display_name: `Örnek Ofis ${key.toUpperCase()}`, address_city: 'Ankara', service_area: 'Ankara' });
    await service!.from('subscriptions').insert({ organization_id: org.data.id, plan_id: 'baslangic', status: 'active' });
    const dom = await service!.from('organization_domains').insert({ organization_id: org.data.id, hostname: s.host, is_primary: true, verified_at: new Date().toISOString(), status: 'active', activated_at: new Date().toISOString() });
    if (dom.error) throw dom.error;
    const published = { theme: s.theme, colors: { mode: 'preset', preset: s.palette, scheme: 'light' } };
    const sc = await service!.from('site_configs').upsert({ organization_id: org.data.id, published, draft: published, published_version: 1 });
    if (sc.error) throw sc.error;
  }
});

test.afterAll(async () => {
  for (const id of orgs) await service!.from('organizations').delete().eq('id', id);
});

/** Sayfanın HTML'i, bağlı CSS dosyaları, yüklenen JS ve istenen yazı tipi dosyaları */
async function collect(page: Page, host: string) {
  const fonts: string[] = [];
  const scripts: string[] = [];
  const styles: string[] = [];
  page.on('response', async (r) => {
    const u = new URL(r.url());
    if (r.request().resourceType() === 'font') fonts.push(u.pathname);
    else if (u.pathname.endsWith('.js')) scripts.push(await r.text().catch(() => ''));
    else if (u.pathname.endsWith('.css')) styles.push(await r.text().catch(() => ''));
  });
  const res = await page.goto(`http://${host}:${PORT}/`, { waitUntil: 'networkidle' });
  expect(res?.status()).toBe(200);
  const html = await res!.text();
  return { html, fonts, js: scripts.join('\n'), css: styles.join('\n') };
}

const faceFamilies = (css: string) => [...css.matchAll(/@font-face\{font-family:'([^']+)'/g)].map((m) => m[1]);

for (const [key, s] of Object.entries(SITES)) {
  const own = CATALOG.filter(([id]) => (s.fonts as readonly string[]).includes(id));
  const others = CATALOG.filter(([id]) => !(s.fonts as readonly string[]).includes(id));

  test(`FONT-01/02 (${key.toUpperCase()}): HTML yalnızca seçili paketin @font-face ve preload'larını taşır`, async ({ page }) => {
    const { html } = await collect(page, s.host);
    const families = new Set(faceFamilies(html));
    expect([...families].sort()).toEqual(own.flatMap(([, f]) => [f, `${f} Fallback`]).sort());
    const preloads = [...html.matchAll(/<link[^>]+rel="preload"[^>]+as="font"[^>]*>/g)].map((m) => m[0].match(/href="([^"]+)"/)![1]);
    expect(preloads.length).toBeGreaterThan(0);
    for (const p of preloads) expect(own.some(([id]) => p.startsWith(`/fonts/site/${id}/`)), p).toBe(true);
    for (const [id, family] of others) {
      expect(html, `başka paketin dosyası: ${id}`).not.toContain(`/fonts/site/${id}/`);
      expect(html, `başka paketin @font-face'i: ${family}`).not.toContain(`font-family:'${family}'`);
    }
    // next/font kataloğu (eski yaklaşım) artık kök belgede değil
    expect(html).not.toMatch(/__variable_[0-9a-f]+/);
  });

  test(`FONT-03 (${key.toUpperCase()}): ağdan yalnızca kendi yazı tipi dosyaları iner; CSS/JS katalog taşımaz`, async ({ page }) => {
    const { fonts, js, css } = await collect(page, s.host);
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) expect(own.some(([id]) => f.startsWith(`/fonts/site/${id}/`)), f).toBe(true);
    expect(css.match(/@font-face/g) ?? []).toHaveLength(0);
    expect(js).not.toContain('/fonts/site/');
    for (const [, family] of CATALOG) {
      expect(js, `JS'te yazı tipi kataloğu: ${family}`).not.toMatch(new RegExp(`["']${family}["']`));
    }
  });
}

test('FONT-04: iki kiracı birbirinin yazı tipini almaz (çapraz sızıntı yok)', async ({ page, context }) => {
  // Her kiracı ayrı sekmede: dinleyiciler birbirinin isteklerini görmesin
  const pa = await context.newPage();
  const a = await collect(pa, HOST_A);
  await pa.close();
  const pb = await context.newPage();
  const b = await collect(pb, HOST_B);
  await pb.close();
  for (const id of SITES.b.fonts) expect(a.html + a.fonts.join()).not.toContain(`/fonts/site/${id}/`);
  for (const id of SITES.a.fonts) expect(b.html + b.fonts.join()).not.toContain(`/fonts/site/${id}/`);
  // Değişkenler kökte: başlık ailesi kiracının kendi yazı tipi
  const familyOf = (p: Page) => p.evaluate(() => getComputedStyle(document.body).fontFamily);
  await page.goto(`http://${HOST_A}:${PORT}/`);
  expect(await familyOf(page)).toContain('DM Sans');
  await page.goto(`http://${HOST_B}:${PORT}/`);
  expect(await familyOf(page)).toContain('Inter');
});
