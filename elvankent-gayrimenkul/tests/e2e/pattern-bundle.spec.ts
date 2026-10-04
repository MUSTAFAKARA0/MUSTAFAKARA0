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
type Pattern = (typeof INTERACTIVE)[number];
/** Desen türü → manifestteki yeri (yeni interaktif desen türü eklenince buraya bir satır) */
const SELECT: Record<string, (id: string) => Record<string, unknown>> = {
  interaction: (id) => ({ interactions: [id] }),
  gallery: (id) => ({ gallery: id }),
};
/** Her interaktif desen için onu tek başına seçen bir kiracı + hiç seçmeyen bir kiracı */
const SITES = [
  ...INTERACTIVE.map((p, i) => ({ key: `p${i}`, host: `pb${i}-${RUN}.e2e.test`, selected: [p] as Pattern[] })),
  { key: 'none', host: `pbn-${RUN}.e2e.test`, selected: [] as Pattern[] },
];
const slotsFor = (selected: Pattern[]) => Object.assign({}, ...selected.map((p) => SELECT[p.kind]!(p.id)));
const LISTING_SLUG = `pb-ornek-${RUN}`;

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
    const published = { theme: 'rezidans', colors: { mode: 'preset', preset: 'premium-gold', scheme: 'light' }, style: s.selected.length ? { slots: slotsFor(s.selected) } : {} };
    const sc = await service!.from('site_configs').upsert({ organization_id: org.data.id, published, draft: published, published_version: 1 });
    if (sc.error) throw sc.error;
    await publishListing(org.data.id);
  }
});

/** Galeri desenlerinin çizildiği ilan detayı için yayında bir test ilanı (3 fotoğraf; uygulamanın demo görselleri) */
async function publishListing(orgId: string) {
  const type = await service!.from('property_types').select('id').eq('slug', 'daire').single();
  const district = await service!.from('districts').select('id, city_id').limit(1).single();
  if (type.error || district.error) throw type.error ?? district.error;
  const prop = await service!
    .from('properties')
    .insert({
      organization_id: orgId,
      title: `Desen testi ilanı ${RUN}`,
      description: 'Bu ilan yalnızca otomatik desen (bundle) testleri için oluşturulur ve test sonunda silinir.',
      listing_type: 'sale',
      category: 'konut',
      property_type_id: type.data.id,
      city_id: district.data.city_id,
      district_id: district.data.id,
      price: 1000000,
      currency: 'TRY',
      status: 'draft',
      slug: LISTING_SLUG,
      reference_no: '',
    })
    .select('id')
    .single();
  if (prop.error) throw prop.error;
  for (const [i, folder] of ['living-room', 'kitchen', 'bedroom'].entries()) {
    const media = await service!.from('media_assets').insert({
      organization_id: orgId,
      property_id: prop.data.id,
      kind: 'property_photo',
      status: 'ready',
      public_base: `/demo/${folder}`,
      variant_widths: [320, 640, 960, 1440, 1920],
      width: 1920,
      height: 1280,
      sort_order: i,
      is_cover: i === 0,
    });
    if (media.error) throw media.error;
  }
  const pub = await service!.from('properties').update({ status: 'published' }).eq('id', prop.data.id);
  if (pub.error) throw pub.error;
}

test.afterAll(async () => {
  for (const id of orgs) await service!.from('organizations').delete().eq('id', id);
});

/** Gerçek sayfa istekleri: ziyaret edilen sayfalarda indirilen bütün JS parçaları + sayfaların HTML'i */
async function load(page: Page, urls: string[]) {
  const scripts: string[] = [];
  page.on('response', async (r) => {
    if (new URL(r.url()).pathname.endsWith('.js')) scripts.push(await r.text().catch(() => ''));
  });
  const html: string[] = [];
  const marks: string[] = [];
  for (const u of urls) {
    const res = await page.goto(u, { waitUntil: 'networkidle' });
    expect(res?.status(), u).toBe(200);
    await page.waitForTimeout(500);
    html.push(await res!.text());
    marks.push((await page.evaluate(() => document.documentElement.getAttribute('data-site-patterns'))) ?? '');
  }
  return { js: scripts.join('\n'), html: html.join('\n'), marks, chunks: scripts.length };
}

const interactionCss = (p: Pattern) => INTERACTION_CSS[p.id as keyof typeof INTERACTION_CSS];

for (const s of SITES) {
  const label = s.selected.map((p) => `${p.kind}/${p.id}`).join(', ') || 'desen yok';
  test(`PB-01/02 (${s.key}: ${label}): yalnızca seçilen interaktif kod indirilir`, async ({ page }) => {
    const base = `http://${s.host}:${PORT}`;
    const { js, html, marks, chunks } = await load(page, [`${base}/`, `${base}/ilan/${LISTING_SLUG}`]);
    expect(chunks).toBeGreaterThan(0);
    for (const p of INTERACTIVE) {
      const selected = s.selected.includes(p);
      expect(js.includes(p.marker!), `${p.kind}/${p.id} ${selected ? 'seçili ama indirilmedi' : 'seçilmediği hâlde indirildi'}`).toBe(selected);
      if (p.kind === 'interaction') expect(html.includes(interactionCss(p)), `${p.id} CSS'i`).toBe(selected);
    }
    // Etkileşim adaları <html data-site-patterns> işaretler (her sayfada)
    const marked = INTERACTIVE.filter((p) => p.kind === 'interaction' && s.selected.includes(p)).map((p) => p.marker).join(' ');
    for (const m of marks) expect(m).toBe(marked);
    // Galeri: ilan detayında yalnızca seçilen desen (yoksa mevcut standart galeri) çizilir
    const gallery = s.selected.find((p) => p.kind === 'gallery');
    await expect(page.locator('[data-pattern^="karay-pattern:gallery/"]')).toHaveCount(gallery ? 1 : 0);
    if (gallery) await expect(page.locator(`[data-pattern="${gallery.marker}"]`)).toBeVisible();
    if (!s.selected.some((p) => p.kind === 'interaction')) expect(html).not.toContain('site-patterns-');
  });
}

test('PB-02 (Elvankent): hiçbir D7 desen kodu, CSS’i veya izi yok (ana sayfa + ilan listesi + ilan detayı)', async ({ page }) => {
  const res = await page.request.get(`${baseURL}/ilanlar`);
  const slug = (await res.text()).match(/href="\/ilan\/([^"]+)"/)?.[1];
  expect(slug, 'Elvankent ilan bağlantısı').toBeTruthy();
  const { js, html, marks } = await load(page, [`${baseURL}/`, `${baseURL}/ilanlar`, `${baseURL}/ilan/${slug}`]);
  for (const p of INTERACTIVE) {
    expect(js).not.toContain(p.marker!);
    if (p.kind === 'interaction') expect(html).not.toContain(interactionCss(p));
  }
  expect(html).not.toContain('site-patterns-');
  expect(html).not.toContain('data-pattern=');
  expect(marks.every((m) => m === '')).toBe(true);
});

test('PB-03: seçilen ada çalışır (scroll-header: kaydırınca header belirginleşir)', async ({ page }) => {
  const s = SITES.find((x) => x.selected[0]?.kind === 'interaction' && x.selected[0].id === 'scroll-header');
  test.skip(!s, 'scroll-header kayıtlı değil');
  await page.goto(`http://${s!.host}:${PORT}/`, { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-site-patterns', /scroll-header/);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-site-scrolled'))).toBe(false);
  await page.mouse.wheel(0, 900);
  await expect(page.locator('html')).toHaveAttribute('data-site-scrolled', '');
});

test('PB-04: seçilen galeri deseni çalışır (carousel: sonraki fotoğraf, küçük resimler; tam ekran galeri açılır)', async ({ page }) => {
  const s = SITES.find((x) => x.selected[0]?.kind === 'gallery' && x.selected[0].id === 'carousel');
  test.skip(!s, 'carousel kayıtlı değil');
  await page.goto(`http://${s!.host}:${PORT}/ilan/${LISTING_SLUG}`, { waitUntil: 'networkidle' });
  const root = page.locator('[data-pattern="karay-pattern:gallery/carousel"]');
  await expect(root.getByText('1 / 3')).toBeVisible();
  await root.getByRole('button', { name: 'Sonraki fotoğraf' }).click();
  await expect(root.getByText('2 / 3')).toBeVisible();
  await expect(root.getByRole('button', { name: 'Fotoğraf 2', exact: true })).toHaveAttribute('aria-current', 'true');
  await root.getByRole('button', { name: /Fotoğraf 2 \/ 3/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
