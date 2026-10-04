/**
 * D7.3 — LUXURY · ARCHITECTURAL · MAP FIRST tasarım aileleri.
 *
 *  - Aile × yüzey matrisi: her ailenin her yüzey kararı kayıtlı bir desendir; derlenmiş
 *    yapılandırmadan çözümleyici aynı deseni bulur (önizleme = kiracı).
 *  - Aileler yalnızca renk değil: yapı (yüzey desenleri) birbirinden ve standarttan farklı.
 *  - Geri dönüş: aile kararı yoksa → standart; kaynağı (aile) olmayan eski site → standart.
 *  - Tema ≠ aile: tema ayrıca seçilebilir; yapı aileden, görünüm temadan.
 *  - Kiracı yalıtımı (yapılandırma düzeyi): bir kiracının derlemesi ortak katalog nesnelerini
 *    değiştirmez; iki kiracının sonucu birbirinden bağımsızdır.
 *  - Desen CSS'i ve veri ihtiyacı yalnızca seçilen desenlerde.
 *  - Sınırlar: kiracı sitesi (Site Engine) kataloğu/aileyi içe aktarmaz; sunucu desenleri
 *    istemci kodu değildir, interaktif desenler yalnızca yükleyicilerden.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATTERN_REGISTRY, findPattern } from '@/components/patterns/registry';
import { SURFACE_CONTRACTS } from '@/components/patterns/surfaces';
import { patternNeeds, resolveSurfaces } from '@/components/patterns/resolver';
import { patternCss } from '@/components/patterns/styles';
import { SURFACE_PATTERN_CSS } from '@/components/patterns/surface-css';
import { CATALOG } from '@/site-factory/catalog';
import { findDesignFamily } from '@/site-factory/families';
import { compileDesign } from '@/site-factory/compile';
import { compileManifest, manifestFromConfig, manifestSurfaces, parseManifest } from '@/site-factory/manifest';
import { parseSiteConfig } from '@/site-config/schema';
import { SITE_SURFACES } from '@/theme-engine/surfaces';
import { resolveStyle, THEMES } from '@/theme-engine/themes';
import { PALETTES } from '@/theme-engine/palettes';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const read = (rel) => readFileSync(path.join(SRC, rel), 'utf8');
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const NEW = ['luxury', 'architectural', 'map-first'];
const base = () => parseSiteConfig({});
const viewOf = (design) => {
  const config = parseSiteConfig(design);
  return { config, style: resolveStyle(config) };
};
const manifest = (designFamily, variants = {}) => ({ siteType: 'real-estate-office', designFamily, variants });
const contract = Object.fromEntries(SURFACE_CONTRACTS.map((c) => [c.surface, c]));

/** Ailenin beklenen yapısı (rapordaki tasarım kararlarıyla aynı) */
const EXPECTED = {
  luxury: { home: 'immersive', search: 'standard', listing: 'gallery-wide', 'property-detail': 'immersive', gallery: 'fullscreen', map: 'standard' },
  architectural: { home: 'blueprint', search: 'standard', listing: 'ruled-index', 'property-detail': 'information-first', gallery: 'grid', map: 'standard' },
  'map-first': { home: 'map-search', search: 'map-first', listing: 'map-results', 'property-detail': 'map-first', gallery: 'carousel', map: 'map-first' },
};

describe('D7.3 aile × yüzey matrisi', () => {
  test('üç aile katalogda ve manifestte seçilebilir', () => {
    for (const id of NEW) {
      assert.ok(findDesignFamily(id), id);
      assert.doesNotThrow(() => parseManifest(manifest(id)), id);
    }
    // Aile paletleri açık şemalı (koyu palet ailenin açık zeminine karışmaz)
    for (const id of NEW) assert.equal(PALETTES.find((p) => p.id === findDesignFamily(id).palette)?.scheme, 'light', id);
    // İlk 6 aile kilitli: sıra ve kimlikler değişmedi
    assert.deepEqual(CATALOG.slice(0, 6).map((f) => f.id), ['klasik-guven', 'sinematik-vitrin', 'editoryal-luks', 'kurumsal-portfoy', 'yalin-galeri', 'dogal-yasam']);
  });

  for (const id of NEW) {
    test(`${id}: her yüzey → kayıtlı desen; manifest = çözümleyici (önizleme = kiracı)`, () => {
      const m = manifest(id);
      const surfaces = manifestSurfaces(m);
      const resolved = resolveSurfaces(viewOf(compileManifest(m, base()).design));
      for (const s of SITE_SURFACES) {
        assert.ok(findPattern(contract[s].kind, surfaces[s]), `${id}: ${s}/${surfaces[s]}`);
        assert.equal(resolved[s].id, surfaces[s], `${id}: ${s}`);
      }
      for (const [s, want] of Object.entries(EXPECTED[id])) assert.equal(resolved[s].id, want, `${id}: ${s}`);
    });
  }

  test('aileler yalnızca renk değil: yapıları birbirinden ve standarttan farklı', () => {
    const structural = ['home', 'search', 'listing', 'property-detail', 'gallery', 'map'];
    const sig = Object.fromEntries(NEW.map((id) => [id, manifestSurfaces(manifest(id))]));
    for (const a of NEW) {
      const nonStandard = structural.filter((s) => !findPattern(contract[s].kind, sig[a][s]).legacy);
      assert.ok(nonStandard.length >= 4, `${a}: en az 4 yüzey D7.3 deseni olmalı (${nonStandard})`);
      for (const b of NEW.filter((x) => x !== a)) {
        const diff = structural.filter((s) => sig[a][s] !== sig[b][s]);
        assert.ok(diff.length >= 4, `${a} ↔ ${b} yalnızca ${diff.length} yüzeyde farklı`);
      }
    }
  });

  test('her D7.3 deseni en az bir ailede kullanılır (kullanılmayan kod yok) ve kendi işaretini taşır', () => {
    const used = new Set(NEW.flatMap((id) => Object.entries(manifestSurfaces(manifest(id))).map(([s, v]) => `${contract[s].kind}/${v}`)));
    for (const p of PATTERN_REGISTRY.filter((x) => !x.legacy && x.kind !== 'interaction')) {
      if (p.kind === 'gallery' && p.id === 'carousel') continue; // D7.2 deseni; Map First kullanır
      assert.ok(used.has(`${p.kind}/${p.id}`) || (p.kind === 'gallery' && p.id === 'grid'), `${p.kind}/${p.id} hiçbir ailede yok`);
      const src = read(p.source);
      assert.equal(p.marker, `karay-pattern:${p.kind}/${p.id}`);
      assert.ok(src.includes(p.marker), `${p.source} işaret yok`);
      if (!p.interactive) assert.ok(!/^'use client';/.test(src), `${p.source} sunucu deseni olmalı (istemci kodu taşımamalı)`);
    }
  });
});

describe('Geri dönüş (fallback) ve geriye dönük uyumluluk', () => {
  test('aile kararı olmayan yüzey → tema varsayılanı / standart', () => {
    const lux = manifestSurfaces(manifest('luxury'));
    assert.equal(lux.search, 'standard');
    assert.equal(lux.map, 'standard');
  });

  test('kaynağı (ailesi) olmayan eski site ve bilinmeyen aile → bütün yüzeyler standart', () => {
    for (const raw of [{}, { style: { origin: { siteType: 'real-estate-office', family: 'yok-boyle-aile' } } }]) {
      const r = resolveSurfaces(viewOf(raw));
      for (const s of ['search', 'listing', 'property-detail', 'gallery', 'map']) assert.equal(r[s].id, 'standard', s);
      assert.equal(r.home.legacy, true);
      assert.equal(manifestFromConfig(parseSiteConfig(raw)), null);
    }
  });

  test('mevcut 6 aile: yüzeyleri ve derlenmiş çıktıları D7.3 ile değişmedi (standart)', () => {
    for (const f of CATALOG.slice(0, 6)) {
      const s = manifestSurfaces(manifest(f.id));
      for (const k of ['search', 'listing', 'property-detail', 'gallery', 'map']) assert.equal(s[k], 'standard', `${f.id}/${k}`);
      assert.ok(findPattern('hero', s.home).legacy, `${f.id}: hero`);
      assert.equal(compileDesign(f, base()).style.slots, undefined, f.id);
      assert.equal(patternCss({ surfaces: [] }), '');
    }
  });
});

describe('Tema ≠ tasarım ailesi', () => {
  test('tema ayrıca seçilebilir: yapı aileden, yazı tipi/görünüm temadan; gidiş-dönüş kararlı', () => {
    const m = manifest('luxury', { theme: 'yalin' });
    const d = compileManifest(m, base()).design;
    assert.equal(d.theme, 'yalin');
    assert.equal(d.style.slots.grid, 'gallery-wide', 'yapı ailede kalır');
    assert.equal(d.style.hero, 'immersive');
    assert.equal(d.typography.heading, undefined, 'tema seçilince ailenin yazı tipi dayatılmaz');
    assert.deepEqual(manifestFromConfig(parseSiteConfig(d)).variants, { theme: 'yalin' });
    assert.equal(resolveSurfaces(viewOf(d)).listing.id, 'gallery-wide');
    // Tema seçilmezse ailenin teması ve tipografisi
    const plain = compileManifest(manifest('luxury'), base()).design;
    assert.equal(plain.theme, findDesignFamily('luxury').theme);
    assert.equal(plain.typography.heading, 'cormorant');
    assert.deepEqual(manifestFromConfig(parseSiteConfig(plain)).variants, {});
    assert.throws(() => parseManifest(manifest('luxury', { theme: 'yok' })));
    assert.ok(THEMES.yalin);
  });
});

describe('Kiracı yalıtımı (yapılandırma düzeyi)', () => {
  test('bir kiracının derlemesi ortak aile nesnelerini değiştirmez; kiracılar birbirini etkilemez', () => {
    const snapshot = JSON.stringify(CATALOG);
    const a = compileManifest(manifest('luxury', { gallery: 'carousel', theme: 'kent' }), base()).design;
    const b = compileManifest(manifest('map-first'), base()).design;
    a.style.slots.grid = 'map-results'; // A'nın yapılandırmasını sonradan bozmak
    assert.equal(JSON.stringify(CATALOG), snapshot, 'katalog değişti');
    assert.equal(b.style.slots.grid, 'map-results');
    const b2 = compileManifest(manifest('map-first'), base()).design;
    assert.deepEqual(b2, b);
    const a2 = compileManifest(manifest('luxury', { gallery: 'carousel', theme: 'kent' }), base()).design;
    assert.equal(a2.style.slots.grid, 'gallery-wide');
  });
});

describe('Desen CSS’i ve veri ihtiyacı yalnızca seçilenlerde', () => {
  const css = (id) => {
    const r = resolveSurfaces(viewOf(compileManifest(manifest(id), base()).design));
    return patternCss({ surfaces: Object.values(r).filter((p) => !p.legacy).map((p) => `${p.kind}/${p.id}`) });
  };
  test('her aile yalnızca kendi desenlerinin CSS’ini taşır', () => {
    for (const a of NEW) {
      const mine = css(a);
      const own = new Set(Object.values(resolveSurfaces(viewOf(compileManifest(manifest(a), base()).design))).map((p) => `${p.kind}/${p.id}`));
      for (const [key, rule] of Object.entries(SURFACE_PATTERN_CSS)) {
        if (!rule) continue;
        assert.equal(mine.includes(rule), own.has(key), `${a}: ${key}`);
      }
    }
  });
  test('harita konumu yalnızca Map First listesinde istenir', () => {
    for (const id of [...CATALOG.map((f) => f.id)]) {
      const v = viewOf(compileManifest(manifest(id), base()).design);
      assert.equal(patternNeeds(v, 'map-points'), id === 'map-first', id);
    }
    assert.equal(patternNeeds(null, 'map-points'), false);
  });
});

describe('Sınırlar', () => {
  test('kiracı sitesi (Site Engine) kataloğu/aileyi içe aktarmaz (yanlış aile importu)', () => {
    const files = [...walk(path.join(SRC, 'components/patterns')), ...walk(path.join(SRC, 'components/site')), ...walk(path.join(SRC, 'app/t'))];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      assert.ok(!/from '@\/site-factory/.test(src), `${path.relative(SRC, f)} Site Factory'yi içe aktarıyor`);
    }
  });
  test('desenler aile adıyla dallanmaz (aile adı/kimliği desen kodunda yok)', () => {
    for (const f of walk(path.join(SRC, 'components/patterns'))) {
      if (f.endsWith('README.md')) continue;
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      for (const fam of ["'luxury'", "'architectural'", 'origin.family', 'designFamily']) assert.ok(!code.includes(fam), `${path.relative(SRC, f)}: ${fam}`);
    }
  });
});
