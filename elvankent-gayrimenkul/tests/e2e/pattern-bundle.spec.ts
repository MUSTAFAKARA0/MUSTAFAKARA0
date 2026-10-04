import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { PATTERN_REGISTRY } from '../../src/components/patterns/registry';
import { INTERACTION_CSS } from '../../src/components/patterns/interaction/styles';

/**
 * BUNDLE REGRESYON TESTİ (D7 resmi testi): PRODUCTION BUILD → SERVE → GERÇEK SAYFA İSTEĞİ →
 * İNDİRİLEN JS PARÇALARI → SEÇİLİ / SEÇİLMEYEN İŞARETLER.
 *
 *  PB-01  Her kiracı yalnızca SEÇTİĞİ interaktif desenlerin kodunu indirir; seçmediği desenin
 *         işareti indirilen JavaScript'te yoktur. Seçili desenin işaretinin bulunması, taramanın
 *         tembel yüklenen parçaları gerçekten gördüğünü de kanıtlar.
 *  PB-02  Hiç desen seçmeyen site (ve Elvankent) hiçbir D7 desen kodu, CSS'i veya izi taşımaz.
 *  PB-03  Seçilen ada gerçekten çalışır (ör. kaydırınca header belirginleşir).
 *
 * İşaretler desen kaydından gelir (patterns/registry.ts); yeni interaktif desen eklendiğinde test
 * kendiliğinden genişler. Geçici kiracılar test sonunda silinir. Yalnızca yerel/demo veritabanı.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe.configure({ mode: 'serial' });
test.skip(!url || !serviceKey, 'Supabase anahtarları tanımlı değil');
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL), 'Yalnızca yerel sunucuya karşı çalışır');

const RUN = randomBytes(3).toString('hex');
const PORT = new URL(baseURL).port || '80';
const INTERACTIVE = PATTERN_REGISTRY.filter((p) => p.interactive);
/** Her interaktif desen için onu tek başına seçen bir kiracı + hiç seçmeyen bir kiracı */
const SITES = [
  ...INTERACTIVE.map((p, i) => ({ key: `p${i}`, host: `pb${i}-${RUN}.e2e.test`, interactions: [p.id] })),
  { key: 'none', host: `pbn-${RUN}.e2e.test`, interactions: [] as string[] },
];

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: [`--host-resolver-rules=${SITES.map((s) => `MAP ${s.host} 127.0.0.1`).join(', ')}`],
  },
});

const service = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const letters = (n: number) => [...randomBytes(n)].map((b) => String.fromCharCode(65 + (b % 26))).join('');
const orgs: string[] = [];

test.beforeAll(async () => {
  for (const s of SITES) {
    const org = await service!.from('organizations').insert({ slug: `pb${s.key}-${RUN}`, name: `E2E Desen ${s.key} ${RUN}`, reference_prefix: `Q${letters(3)}`, status: 'active' }).select('id').single();
    if (org.error) throw org.error;
    orgs.push(org.data.id);
    await service!.from('organization_settings').insert({ organization_id: org.data.id, display_name: `Desen Testi ${s.key}`, address_city: 'Ankara', service_area: 'Ankara' });
    await service!.from('subscriptions').insert({ organization_id: org.data.id, plan_id: 'baslangic', status: 'active' });
    const dom = await service!.from('organization_domains').insert({ organization_id: org.data.id, hostname: s.host, is_primary: true, verified_at: new Date().toISOString() });
    if (dom.error) throw dom.error;
    const published = { theme: 'rezidans', colors: { mode: 'preset', preset: 'premium-gold', scheme: 'light' }, style: s.interactions.length ? { slots: { interactions: s.interactions } } : {} };
    const sc = await service!.from('site_configs').upsert({ organization_id: org.data.id, published, draft: published, published_version: 1 });
    if (sc.error) throw sc.error;
  }
});

test.afterAll(async () => {
  for (const id of orgs) await service!.from('organizations').delete().eq('id', id);
});

/** Gerçek sayfa isteği: indirilen bütün JS parçalarının içeriği + sayfa HTML'i */
async function load(page: Page, siteUrl: string) {
  const scripts: string[] = [];
  page.on('response', async (r) => {
    if (new URL(r.url()).pathname.endsWith('.js')) scripts.push(await r.text().catch(() => ''));
  });
  const res = await page.goto(siteUrl, { waitUntil: 'networkidle' });
  expect(res?.status()).toBe(200);
  await page.waitForTimeout(500);
  return { js: scripts.join('\n'), html: await res!.text(), chunks: scripts.length };
}

for (const s of SITES) {
  test(`PB-01/02 (${s.key}: ${s.interactions.join(', ') || 'desen yok'}): yalnızca seçilen interaktif kod indirilir`, async ({ page }) => {
    const { js, html, chunks } = await load(page, `http://${s.host}:${PORT}/`);
    expect(chunks).toBeGreaterThan(0);
    for (const p of INTERACTIVE) {
      const selected = s.interactions.includes(p.id);
      expect(js.includes(p.marker!), `${p.id} ${selected ? 'seçili ama indirilmedi' : 'seçilmediği hâlde indirildi'}`).toBe(selected);
      expect(html.includes(INTERACTION_CSS[p.id as keyof typeof INTERACTION_CSS]), `${p.id} CSS'i`).toBe(selected);
    }
    const marked = await page.evaluate(() => document.documentElement.getAttribute('data-site-patterns'));
    expect(marked ?? '').toBe(INTERACTIVE.filter((p) => s.interactions.includes(p.id)).map((p) => p.marker).join(' '));
    if (!s.interactions.length) expect(html).not.toContain('site-patterns-');
  });
}

test('PB-02 (Elvankent): hiçbir D7 desen kodu, CSS’i veya izi yok', async ({ page }) => {
  const { js, html } = await load(page, `${baseURL}/`);
  for (const p of INTERACTIVE) {
    expect(js).not.toContain(p.marker!);
    expect(html).not.toContain(INTERACTION_CSS[p.id as keyof typeof INTERACTION_CSS]);
  }
  expect(html).not.toContain('site-patterns-');
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-site-patterns'))).toBe(false);
});

test('PB-03: seçilen ada çalışır (scroll-header: kaydırınca header belirginleşir)', async ({ page }) => {
  const s = SITES.find((x) => x.interactions[0] === 'scroll-header');
  test.skip(!s, 'scroll-header kayıtlı değil');
  await page.goto(`http://${s!.host}:${PORT}/`, { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-site-patterns', /scroll-header/);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-site-scrolled'))).toBe(false);
  await page.mouse.wheel(0, 900);
  await expect(page.locator('html')).toHaveAttribute('data-site-scrolled', '');
});
