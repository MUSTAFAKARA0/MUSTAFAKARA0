/**
 * PREVIEW birim testleri (Aşama D3): önizleme manifesti = kiracı manifesti.
 *
 *  - Önizleme modeli, createSite'ın taslağa yazacağı yapılandırmanın AYNISINI kullanır.
 *  - Önizleme seçilen varyantları gösterir; başka ailenin CSS'i yazılmaz.
 *  - Önizleme isteği kapalı şemayla çözülür (bozuk/kurcalanmış/aşırı uzun → reddedilir).
 *  - Kiracı sitesi ve önizleme aynı bileşenleri (SiteFrame, SiteHome) kullanır.
 *
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPreviewModel } from '@/site-preview/model';
import { parsePreviewSurface, PREVIEW_SURFACES } from '@/site-preview/surfaces';
import { decodePreviewPayload, encodePreviewPayload, initialSiteSections } from '@/site-factory/site-info';
import { CATALOG } from '@/site-factory/catalog';
import { SITE_TYPES } from '@/site-factory/site-types';
import { parseSiteConfig } from '@/site-config/schema';
import { applyTheme } from '@/theme-engine/runtime';

const info = { siteName: 'Örnek Emlak', companyName: 'Örnek Emlak Ltd. Şti.', phone: '+90 555 000 00 00', email: 'ofis@example.test', address: { city: 'Ankara' }, social: { instagram: 'https://instagram.com/ornek' }, seo: { title: 'Örnek Emlak' } };
const themesIn = (css) => [...new Set([...css.matchAll(/data-site-theme='([a-z]+)'/g)].map((m) => m[1]))];

describe('PREVIEW: önizleme = kiracı', () => {
  test('her tip × her aile: önizleme yapılandırması createSite yapılandırmasıyla birebir aynı', () => {
    for (const t of SITE_TYPES)
      for (const f of CATALOG) {
        const manifest = { siteType: t.id, designFamily: f.id, variants: {} };
        const preview = buildPreviewModel({ manifest, info }, 'http://localhost');
        const created = parseSiteConfig(initialSiteSections(manifest, info).sections);
        assert.deepEqual(preview.config, created, `${t.id}/${f.id}`);
        assert.deepEqual(preview.view.config, created);
      }
  });

  test('önizleme seçilen varyantları gösterir ve yalnızca seçilen ailenin temasını yazar', () => {
    const manifest = { siteType: 'consultant', designFamily: 'editoryal-luks', variants: { hero: 'cinematic', header: 'floating', card: 'bezel', footer: 'contact', motion: 'expressive', headingFont: 'lora' } };
    const { view, tenant } = buildPreviewModel({ manifest, info }, 'http://localhost');
    assert.equal(view.style.hero, 'cinematic');
    assert.equal(view.style.headerLayout, 'floating');
    assert.equal(view.style.card, 'bezel');
    assert.equal(view.style.footerLayout, 'contact');
    assert.equal(view.style.motion, 'expressive');
    assert.equal(view.config.typography.heading, 'lora');
    const { css } = applyTheme(view.config, tenant.settings, false);
    assert.deepEqual(themesIn(css), ['prestij']);
    assert.equal(tenant.settings.display_name, 'Örnek Emlak');
    assert.equal(tenant.settings.instagram_url, 'https://instagram.com/ornek');
  });

  test('site tipi önizlemede de uygulanır (müteahhit: değerleme kapalı, mülk sahibi çağrısı yok)', () => {
    const { view } = buildPreviewModel({ manifest: { siteType: 'project-builder', designFamily: 'sinematik-vitrin', variants: {} }, info }, 'http://localhost');
    assert.equal(view.features.valuation, false);
    assert.ok(!view.config.home.sections.some((s) => s.enabled && s.type === 'owner_cta'));
    assert.equal(view.config.pages.degerleme?.visible, false);
  });

  test('önizleme isteği: gidiş-dönüş, kurcalama ve sınırlar', () => {
    const payload = { manifest: { siteType: 'developer', designFamily: 'dogal-yasam', variants: { homepage: 'listings-first' } }, info };
    const enc = encodePreviewPayload(payload);
    assert.match(enc, /^[A-Za-z0-9_-]+$/);
    const dec = decodePreviewPayload(enc);
    assert.equal(dec.manifest.designFamily, 'dogal-yasam');
    assert.equal(dec.info.siteName, 'Örnek Emlak');
    for (const bad of [null, '', 'x'.repeat(9000), 'a+b/c=', enc.slice(0, -4), encodePreviewPayload({ ...payload, manifest: { ...payload.manifest, variants: { hero: 'evil' } } }), encodePreviewPayload({ ...payload, organization_id: '00000000-0000-0000-0000-000000000001' })])
      assert.equal(decodePreviewPayload(bad), null, String(bad).slice(0, 40));
    // HTML enjeksiyonu: açılı ayraçlar temizlenir (React ayrıca kaçışlar)
    const xss = decodePreviewPayload(encodePreviewPayload({ ...payload, info: { ...info, siteName: '<img src=x onerror=alert(1)>Ofis' } }));
    assert.ok(!/[<>]/.test(xss.info.siteName));
    // Katalogda olmayan aile modeli kuramaz
    assert.throws(() => buildPreviewModel({ manifest: { siteType: 'developer', designFamily: 'yok-boyle-aile', variants: {} }, info }, 'http://localhost'));
  });

  test('kiracı sitesi ve önizleme aynı Site Renderer bileşenlerini kullanır', () => {
    const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
    // Önizlemeler (KARAY ve ofis) ortak çizici site-preview/render.tsx üzerinden aynı bileşenleri kullanır
    for (const p of ['app/t/[tenant]/layout.tsx', 'site-preview/render.tsx']) assert.match(src(p), /from '@\/components\/site\/site-frame'/, p);
    for (const p of ['app/t/[tenant]/page.tsx', 'site-preview/render.tsx']) assert.match(src(p), /<SiteHome /, p);
    for (const p of ['app/t/[tenant]/[slug]/page.tsx', 'site-preview/render.tsx']) assert.match(src(p), /<SiteListing\s/, p);
    for (const p of ['app/t/[tenant]/ilan/[slug]/page.tsx', 'site-preview/render.tsx']) assert.match(src(p), /<PropertyDetailSurface /, p);
    for (const p of ['app/site-onizleme/page.tsx', 'app/site-onizleme/ofis/page.tsx']) assert.match(src(p), /<PreviewPage\s/, p);
  });

  test('önizleme yüzeyleri: ana sayfa + arama + ilan detayı; örnek içerik açıkça örnektir', () => {
    const m = buildPreviewModel({ manifest: { siteType: 'real-estate-office', designFamily: 'klasik-guven', variants: {} }, info }, 'http://localhost');
    assert.deepEqual(PREVIEW_SURFACES.map((s) => s.id), ['ana-sayfa', 'ilanlar', 'ilan']);
    assert.equal(parsePreviewSurface('ilan'), 'ilan');
    assert.equal(parsePreviewSurface('<script>'), 'ana-sayfa');
    assert.equal(parsePreviewSurface(undefined), 'ana-sayfa');
    assert.equal(m.listing.result.items.length, m.data.latestPool.length);
    assert.equal(m.listing.route.path, '/ilanlar');
    const p = m.detail.property;
    assert.ok(p.isDemo, 'örnek ilan demo olarak işaretli');
    assert.match(p.title, /^Örnek ilan/);
    assert.ok(p.images.length >= 5 && p.images.every((i) => i.public_base.startsWith('/demo/')), 'yalnızca uygulamanın demo görselleri');
    assert.equal(p.latitude, null, 'konum uydurulmaz');
    assert.deepEqual(p.features, []);
    assert.equal(p.organizationId, m.tenant.id);
    assert.ok(m.detail.similar.every((c) => c.isDemo));
  });
});
