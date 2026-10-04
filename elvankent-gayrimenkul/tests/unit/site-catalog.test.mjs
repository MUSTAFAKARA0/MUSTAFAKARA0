/**
 * KATALOG SÖZLEŞMESİ, SİTE TİPLERİ ve SİTE MANİFESTİ birim testleri (Aşama D2).
 *
 *  - Her katalog klasörü kayıtlıdır; kimlik = klasör adı; aile geçerli bir pakete derlenir.
 *  - YENİ AİLE: katalog kiracı runtime'ının içe aktarma grafiğinde yoktur → yeni bir klasör
 *    hiçbir kiracının sayfasını değiştiremez; mevcut ailelerin derlenmiş çıktısı da değişmez.
 *  - Site tipi içerik mimarisini, aile görsel dili belirler (bağımsız seçilir).
 *  - Manifest kapalıdır (bilinmeyen tip/aile/palet/varyant reddedilir) ve gidiş-dönüş kararlıdır:
 *    kayıtlı yapılandırmadan okunan manifest aynı yapılandırmayı üretir (önizleme = kiracı).
 *
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '@/site-factory/catalog';
import { DESIGN_FAMILIES, findDesignFamily } from '@/site-factory/families';
import { SITE_TYPES, findSiteType } from '@/site-factory/site-types';
import { compileManifest, composeHome, manifestFromConfig, parseManifest, resolvedVariants } from '@/site-factory/manifest';
import { compileDesign } from '@/site-factory/compile';
import { HOMEPAGE_COMPOSITIONS } from '@/site-factory/types';
import { THEME_IDS } from '@/theme-engine/ids';
import { findPalette } from '@/theme-engine/palettes';
import { THEMES } from '@/theme-engine/themes';
import { FONT_PACKAGES } from '@/theme-engine/typography/packages.generated';
import { FEATURE_KEYS, PAGE_KEYS, parseSiteConfig } from '@/site-config/schema';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = path.join(ROOT, 'src');
const CATALOG_DIR = path.join(SRC, 'site-factory/catalog');
const base = () => parseSiteConfig({});

describe('Katalog klasör sözleşmesi (catalog/<aile>/index.ts)', () => {
  test('her klasör kayıtlıdır ve her kayıt bir klasördür; kimlik = klasör adı', () => {
    const dirs = readdirSync(CATALOG_DIR).filter((d) => statSync(path.join(CATALOG_DIR, d)).isDirectory());
    assert.deepEqual([...dirs].sort(), CATALOG.map((f) => f.id).sort());
    for (const d of dirs) {
      assert.ok(existsSync(path.join(CATALOG_DIR, d, 'index.ts')), `${d}/index.ts yok`);
      assert.match(readFileSync(path.join(CATALOG_DIR, d, 'index.ts'), 'utf8'), new RegExp(`id: '${d}'`), `${d} kimliği klasör adıyla aynı değil`);
    }
    assert.equal(new Set(CATALOG.map((f) => f.id)).size, CATALOG.length, 'yinelenen kimlik');
    assert.equal(DESIGN_FAMILIES, CATALOG);
  });

  test('her aile paketi geçerli: tema, palet ve yazı tipi paketleri mevcut', () => {
    for (const f of CATALOG) {
      assert.ok(THEME_IDS.includes(f.theme), `${f.id}: tema`);
      assert.ok(findPalette(f.palette), `${f.id}: palet`);
      const fonts = [f.typography?.heading ?? THEMES[f.theme].fonts.heading, f.typography?.body ?? THEMES[f.theme].fonts.body];
      for (const id of fonts) assert.ok(FONT_PACKAGES[id], `${f.id}: yazı tipi paketi ${id}`);
      assert.ok(f.home.includes('hero') && f.home.includes('contact'), `${f.id}: hero ve iletişim`);
    }
  });

  test('katalog klasörleri yalnızca veri: React, CSS, bileşen veya runtime modülü içe aktarmaz', () => {
    for (const d of readdirSync(CATALOG_DIR)) {
      const p = path.join(CATALOG_DIR, d);
      const files = statSync(p).isDirectory() ? readdirSync(p).map((f) => path.join(p, f)) : [p];
      for (const file of files) {
        const imports = [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]);
        for (const i of imports) assert.match(i, /^@\/site-factory\/(types|catalog\/[a-z0-9-]+)$/, `${path.relative(SRC, file)} → ${i}`);
      }
    }
  });
});

/** Kiracı runtime'ının statik içe aktarma grafiği (src/app/t'den erişilebilen bütün modüller) */
function runtimeGraph() {
  const seen = new Set();
  const resolve = (from, spec) => {
    const b = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
    if (!b) return null;
    for (const c of [b, `${b}.ts`, `${b}.tsx`, `${b}/index.ts`, `${b}/index.tsx`]) if (existsSync(c) && statSync(c).isFile()) return c;
    return null;
  };
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
      const r = resolve(file, m[1]);
      if (r && /\.(ts|tsx)$/.test(r)) visit(r);
    }
  };
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(p)) visit(p);
    }
  };
  walk(path.join(SRC, 'app/t'));
  return seen;
}

describe('YENİ AİLE sözleşmesi: diğer kiracılara runtime etkisi yok', () => {
  test('kiracı runtime grafiğinde Site Factory (katalog, site tipleri, manifest) yoktur', () => {
    const graph = runtimeGraph();
    assert.ok(graph.size > 50, `grafik çok küçük (${graph.size}) — test yanlış kök tarıyor`);
    const leaked = [...graph].filter((f) => f.startsWith(path.join(SRC, 'site-factory'))).map((f) => path.relative(SRC, f));
    assert.deepEqual(leaked, []);
  });

  test('kataloğa yeni aile eklemek mevcut ailelerin derlenmiş çıktısını değiştirmez', () => {
    const before = CATALOG.map((f) => JSON.stringify(compileDesign(f, base())));
    const extended = [...CATALOG, { ...CATALOG[1], id: 'yeni-aile-test', name: 'Yeni Aile', theme: 'marble', palette: 'minimal-black', style: { hero: 'split', motion: 'expressive' } }];
    const after = extended.slice(0, CATALOG.length).map((f) => JSON.stringify(compileDesign(f, base())));
    assert.deepEqual(after, before);
    // Kayıtlı olmayan aile manifestte reddedilir (katalog dışı paket derlenemez)
    assert.throws(() => compileManifest({ siteType: 'real-estate-office', designFamily: 'yeni-aile-test' }, base()), /Geçersiz tasarım ailesi/);
  });
});

describe('Site tipleri (içerik mimarisi ≠ görsel dil)', () => {
  test('5 site tipi tanımlı; özellik, sayfa ve öneri kimlikleri geçerli', () => {
    assert.deepEqual(
      SITE_TYPES.map((t) => t.id),
      ['real-estate-office', 'consultant', 'project-builder', 'developer', 'corporate'],
    );
    for (const t of SITE_TYPES) {
      for (const k of Object.keys(t.features)) assert.ok(FEATURE_KEYS.includes(k), `${t.id}: özellik ${k}`);
      for (const k of t.hiddenPages) assert.ok(PAGE_KEYS.includes(k), `${t.id}: sayfa ${k}`);
      for (const f of t.recommendedFamilies) assert.ok(findDesignFamily(f), `${t.id}: önerilen aile ${f}`);
      for (const s of t.requiredSections) assert.ok(!t.excludedSections.includes(s), `${t.id}: ${s} hem zorunlu hem hariç`);
    }
  });

  test('her tip × her aile × her kompozisyon: zorunlu bölümler var, hariç bölümler yok, geçerli yapılandırma', () => {
    for (const t of SITE_TYPES)
      for (const f of CATALOG)
        for (const homepage of HOMEPAGE_COMPOSITIONS) {
          const order = composeHome(t, f, homepage);
          for (const s of t.requiredSections) assert.ok(order.includes(s), `${t.id}/${f.id}/${homepage}: ${s} eksik`);
          for (const s of t.excludedSections) assert.ok(!order.includes(s), `${t.id}/${f.id}/${homepage}: ${s} olmamalı`);
          assert.equal(order[0], 'hero');
          assert.equal(new Set(order).size, order.length, 'yinelenen bölüm');
          const c = compileManifest({ siteType: t.id, designFamily: f.id, variants: { homepage } }, base());
          assert.deepEqual(c.content.features, t.features);
          for (const p of t.hiddenPages) assert.equal(c.content.pages[p]?.visible, false);
          assert.deepEqual(c.design.style.origin, { siteType: t.id, family: f.id, homepage });
        }
  });

  test('aynı aile farklı site tipinde aynı görsel dili korur, içerik değişir', () => {
    const a = compileManifest({ siteType: 'real-estate-office', designFamily: 'sinematik-vitrin' }, base());
    const b = compileManifest({ siteType: 'project-builder', designFamily: 'sinematik-vitrin' }, base());
    for (const k of ['theme', 'colors', 'typography']) assert.deepEqual(a.design[k], b.design[k]);
    const withoutOrigin = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'origin'));
    assert.deepEqual(withoutOrigin(a.design.style), withoutOrigin(b.design.style));
    const on = (c) => c.design.home.sections.filter((s) => s.enabled).map((s) => s.type);
    assert.ok(on(a).includes('owner_cta') && !on(b).includes('owner_cta'), 'müteahhit sitesinde mülk sahibi çağrısı olmamalı');
    assert.equal(a.content.features.valuation, true);
    assert.equal(b.content.features.valuation, false);
  });
});

describe('Site manifesti', () => {
  test('kapalı manifest: bilinmeyen tip, aile, palet, varyant anahtarı veya değeri reddedilir', () => {
    const ok = { siteType: 'real-estate-office', designFamily: 'klasik-guven' };
    assert.ok(parseManifest(ok));
    for (const bad of [
      { ...ok, siteType: 'yok' },
      { ...ok, designFamily: 'yok' },
      { ...ok, palette: 'yok' },
      { ...ok, variants: { hero: 'yok' } },
      { ...ok, variants: { component: '../../etc' } },
      { ...ok, variants: { headingFont: 'comic-sans' } },
      { ...ok, extra: 1 },
      { ...ok, designFamily: '<script>' },
    ])
      assert.throws(() => parseManifest(bad), JSON.stringify(bad));
  });

  test('varyantlar ailenin seçimini ezer; boş varyant = ailenin değeri', () => {
    const m = { siteType: 'consultant', designFamily: 'editoryal-luks', variants: { hero: 'split', header: 'floating', card: 'outline', footer: 'contact', motion: 'none', headingFont: 'lora', homepage: 'featured-first' } };
    const c = compileManifest(m, base());
    assert.equal(c.design.style.hero, 'split');
    assert.equal(c.design.style.headerLayout, 'floating');
    assert.equal(c.design.style.card, 'outline');
    assert.equal(c.design.style.footerLayout, 'contact');
    assert.equal(c.design.style.motion, 'none');
    assert.equal(c.design.style.cardLayout, 'editorial', 'aileden');
    assert.equal(c.design.typography.heading, 'lora');
    assert.equal(c.design.home.sections.find((s) => s.enabled && s.type !== 'hero')?.type, 'spotlight');
    const r = resolvedVariants(m);
    assert.equal(r.hero, 'split');
    assert.equal(r.cardLayout, 'editorial');
    assert.equal(r.bodyFont, THEMES.prestij.fonts.body);
    assert.equal(r.testimonials, 'none');
  });

  test('gidiş-dönüş: yapılandırmadan okunan manifest aynı yapılandırmayı üretir (önizleme = kiracı)', () => {
    const cases = [
      { siteType: 'real-estate-office', designFamily: 'klasik-guven', variants: {} },
      { siteType: 'developer', designFamily: 'kurumsal-portfoy', palette: 'luxury-estate', variants: { hero: 'cinematic', motion: 'expressive', homepage: 'listings-first', gallery: 'standard' } },
      { siteType: 'consultant', designFamily: 'yalin-galeri', variants: { header: 'centered', bodyFont: 'dm-sans' } },
    ];
    for (const m of cases) {
      const first = compileManifest(m, base());
      const saved = parseSiteConfig({ ...first.design, pages: first.content.pages });
      const back = manifestFromConfig(saved);
      assert.deepEqual(back, m, JSON.stringify(m));
      assert.deepEqual(compileManifest(back, saved).design, first.design);
    }
    // Kaynağı olmayan eski site (ör. Elvankent): manifest yok, katalogdan çıkarım yapılmaz
    assert.equal(manifestFromConfig(base()), null);
  });

  test('kiracının içeriği korunur: özel başlık ve metin bölümü kaybolmaz', () => {
    const current = parseSiteConfig({
      home: { sections: [{ id: 'hero', type: 'hero', title: 'Bizim başlık' }, { id: 'metin-1', type: 'text', title: 'Hakkımızda notu', body: 'Metin' }, { id: 'contact', type: 'contact' }] },
    });
    const c = compileManifest({ siteType: 'project-builder', designFamily: 'dogal-yasam' }, current);
    assert.equal(c.design.home.sections.find((s) => s.type === 'hero').title, 'Bizim başlık');
    assert.ok(c.design.home.sections.some((s) => s.id === 'metin-1' && s.enabled));
    assert.equal(findSiteType('project-builder').name, 'Proje / Müteahhit');
    // Kayıtlı kaynakta bilinmeyen site tipi derlemeyi bozmaz (varsayılan tipe düşer)
    const tampered = parseSiteConfig({ style: { origin: { siteType: 'olmayan-tip', family: 'klasik-guven' } } });
    assert.equal(compileDesign(CATALOG[1], tampered).style.origin.siteType, 'real-estate-office');
  });
});
