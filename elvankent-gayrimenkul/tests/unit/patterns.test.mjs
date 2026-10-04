/**
 * DESIGN PATTERN LIBRARY sözleşme testleri (D7.1).
 *
 *  - Kayıt ↔ manifest kapalı listeleri ↔ dosyalar birebir eşleşir.
 *  - İnteraktif desen yükleme sözleşmesi: adalar YALNIZCA istemci yükleyicisinden (islands.tsx)
 *    tembel yüklenir; başka hiçbir modül statik içe aktaramaz (D7.0 ölçümü: statik import ve
 *    sunucu tarafı next/dynamic seçilmeyen kodu tarayıcıya taşıyor).
 *  - Kayıt yalnızca veridir (bileşen içe aktarmaz).
 *  - Desen CSS'i yalnızca seçilen desenler için üretilir.
 *  - Mevcut 6 aile kilitli: hiçbiri D7 deseni seçmez; manifest yeni alanla geriye uyumlu.
 *
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATTERN_ENUMS, PATTERN_REGISTRY, findPattern } from '@/components/patterns/registry';
import { PATTERN_KINDS } from '@/components/patterns/contracts';
import { patternCss } from '@/components/patterns/styles';
import { INTERACTION_CSS } from '@/components/patterns/interaction/styles';
import { INTERACTION_PATTERNS } from '@/theme-engine/ids';
import { CATALOG } from '@/site-factory/catalog';
import { compileDesign } from '@/site-factory/compile';
import { compileManifest, manifestFromConfig, parseManifest } from '@/site-factory/manifest';
import { parseSiteConfig } from '@/site-config/schema';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const PATTERNS = path.join(SRC, 'components/patterns');
const read = (rel) => readFileSync(path.join(SRC, rel), 'utf8');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(p)) out.push(p);
  }
  return out;
}

describe('Desen kaydı ↔ manifest ↔ dosyalar', () => {
  test('her manifest değerinin bir kaydı, her kaydın bir manifest değeri var', () => {
    for (const [kind, ids] of Object.entries(PATTERN_ENUMS)) {
      const registered = PATTERN_REGISTRY.filter((p) => p.kind === kind).map((p) => p.id);
      assert.deepEqual([...registered].sort(), [...ids].sort(), kind);
    }
    for (const p of PATTERN_REGISTRY) assert.ok(PATTERN_ENUMS[p.kind]?.includes(p.id), `${p.kind}/${p.id} manifestte yok`);
  });

  test('kimlikler benzersiz ve kebab-case; türler bilinen türler; kaynak dosyalar mevcut', () => {
    const keys = PATTERN_REGISTRY.map((p) => `${p.kind}/${p.id}`);
    assert.equal(new Set(keys).size, keys.length, 'yinelenen desen');
    for (const p of PATTERN_REGISTRY) {
      assert.ok(PATTERN_KINDS.includes(p.kind), p.kind);
      assert.match(p.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, p.id);
      assert.ok(existsSync(path.join(SRC, p.source)), `${p.kind}/${p.id}: ${p.source} yok`);
    }
  });

  test('her desen türünün klasörü ve sözleşme notu var', () => {
    for (const kind of PATTERN_KINDS) assert.ok(existsSync(path.join(PATTERNS, kind)), `patterns/${kind}/ yok`);
  });

  test('kayıt yalnızca veridir: hiçbir bileşen veya istemci modülü içe aktarmaz', () => {
    const imports = [...read('components/patterns/registry.ts').matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(imports.sort(), ['@/components/patterns/contracts', '@/theme-engine/ids'].sort());
  });
});

describe('İnteraktif desen yükleme sözleşmesi (D7.0 kuralı)', () => {
  const interactive = PATTERN_REGISTRY.filter((p) => p.interactive);

  test('her interaktif desen: istemci bileşeni, varsayılan dışa aktarım, benzersiz işaret kaynakta', () => {
    assert.ok(interactive.length >= 2, 'en az iki ada (seçili/seçilmeyen testi için)');
    const markers = interactive.map((p) => p.marker);
    assert.equal(new Set(markers).size, markers.length, 'yinelenen işaret');
    for (const p of interactive) {
      const src = read(p.source);
      assert.match(src, /^'use client';/, `${p.source} istemci bileşeni değil`);
      assert.match(src, /export default function/, `${p.source} varsayılan dışa aktarım yok`);
      assert.equal(p.marker, `karay-pattern:${p.kind}/${p.id}`);
      assert.ok(src.includes(`'${p.marker}'`), `${p.source} işareti içermiyor`);
    }
  });

  test('adalar YALNIZCA istemci yükleyicisinden tembel yüklenir (statik içe aktarma yok)', () => {
    const loader = 'components/patterns/interaction/islands.tsx';
    const loaderSrc = read(loader);
    assert.match(loaderSrc, /^'use client';/, 'yükleyici istemci bileşeni olmalı');
    for (const p of interactive) {
      const mod = '@/' + p.source.replace(/\.tsx?$/, '');
      assert.ok(loaderSrc.includes(`lazy(() => import('${mod}')`), `${p.id} yükleyicide tembel değil`);
      for (const file of walk(SRC)) {
        if (file.endsWith(loader.replace(/\//g, path.sep)) || file.endsWith(p.source.replace(/\//g, path.sep))) continue;
        const src = readFileSync(file, 'utf8');
        assert.ok(!src.includes(`from '${mod}'`), `${path.relative(SRC, file)} adayı statik içe aktarıyor: ${mod}`);
        assert.ok(!src.includes(`import('${mod}')`), `${path.relative(SRC, file)} adayı yükleyici dışında yüklüyor: ${mod}`);
      }
    }
    // Yükleyicideki girdiler = manifest kapalı listesi
    const keys = [...loaderSrc.matchAll(/^\s+'([a-z-]+)': lazy/gm)].map((m) => m[1]);
    assert.deepEqual(keys.sort(), [...INTERACTION_PATTERNS].sort());
  });
});

describe('Desen CSS’i yalnızca seçilenler için', () => {
  test('seçim yoksa boş; seçilen desen dışında hiçbir desenin CSS’i yok; bilinmeyen kimlik yok sayılır', () => {
    assert.equal(patternCss({}), '');
    assert.equal(patternCss({ interactions: [] }), '');
    for (const id of INTERACTION_PATTERNS) {
      const css = patternCss({ interactions: [id] });
      assert.equal(css, INTERACTION_CSS[id]);
      for (const other of INTERACTION_PATTERNS.filter((x) => x !== id)) assert.ok(!css.includes(INTERACTION_CSS[other]), `${id} içinde ${other}`);
      assert.match(css, /prefers-reduced-motion/, `${id}: hareket kısıtlaması yok`);
    }
    assert.equal(patternCss({ interactions: ['<script>'] }), '');
  });
});

describe('Manifest ve aile ↔ desen sözleşmesi', () => {
  const base = () => parseSiteConfig({});

  test('etkileşim seçimi manifestten site yapılandırmasına derlenir, tekrarlar ayıklanır, gidiş-dönüş kararlı', () => {
    const m = { siteType: 'real-estate-office', designFamily: 'sinematik-vitrin', variants: { interactions: ['scroll-header', 'scroll-header'] } };
    const c = compileManifest(m, base());
    assert.deepEqual(c.design.style.slots.interactions, ['scroll-header']);
    const back = manifestFromConfig(parseSiteConfig(c.design));
    assert.deepEqual(back.variants.interactions, ['scroll-header']);
    assert.throws(() => parseManifest({ ...m, variants: { interactions: ['bilinmeyen'] } }));
    // Kayıtlı yapılandırmada bilinmeyen etkileşim: okuma şeması varsayılana düşürür (siteyi bozmaz)
    const tampered = parseSiteConfig({ style: { slots: { interactions: ['<script>'] } } });
    assert.equal(tampered.style.slots?.interactions, undefined);
  });

  test('mevcut 6 aile kilitli: hiçbiri D7 deseni seçmez, derlenmiş çıktılarında etkileşim yok', () => {
    assert.equal(CATALOG.length >= 6, true);
    for (const f of CATALOG.slice(0, 6)) {
      assert.equal(f.style.slots?.interactions, undefined, f.id);
      assert.equal(compileDesign(f, base()).style.slots?.interactions, undefined, f.id);
    }
  });

  test('her ailenin seçtiği her desen kayıtlıdır', () => {
    const map = { hero: 'hero', headerLayout: 'header', cardLayout: 'listing-card', footerLayout: 'footer' };
    for (const f of CATALOG) {
      for (const [key, kind] of Object.entries(map)) if (f.style[key]) assert.ok(findPattern(kind, f.style[key]), `${f.id}: ${kind}/${f.style[key]}`);
      for (const id of f.style.slots?.interactions ?? []) assert.ok(findPattern('interaction', id), `${f.id}: interaction/${id}`);
    }
  });
});
