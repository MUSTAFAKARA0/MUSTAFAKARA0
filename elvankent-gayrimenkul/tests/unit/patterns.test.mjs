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
import { SITE_SURFACES, SURFACE_SETTINGS } from '@/theme-engine/surfaces';
import { resolveStyle } from '@/theme-engine/themes';
import { SURFACE_CONTRACTS } from '@/components/patterns/surfaces';
import { resolvePattern, resolveSurfaces } from '@/components/patterns/resolver';
import { CATALOG } from '@/site-factory/catalog';
import { compileDesign } from '@/site-factory/compile';
import { compileManifest, manifestFromConfig, manifestSurfaces, parseManifest } from '@/site-factory/manifest';
import { parseSiteConfig } from '@/site-config/schema';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
/** Türe göre istemci yükleyicileri (interaktif desenler YALNIZCA bunlardan tembel yüklenir) */
const LOADERS = {
  interaction: 'components/patterns/interaction/islands.tsx',
  gallery: 'components/patterns/gallery/islands.tsx',
};
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

  test('adalar YALNIZCA kendi türünün istemci yükleyicisinden tembel yüklenir (statik içe aktarma yok)', () => {
    const files = walk(SRC);
    for (const p of interactive) {
      const loader = LOADERS[p.kind];
      assert.ok(loader, `${p.kind} türünün istemci yükleyicisi tanımlı değil`);
      const loaderSrc = read(loader);
      assert.match(loaderSrc, /^'use client';/, `${loader} istemci bileşeni olmalı`);
      const mod = '@/' + p.source.replace(/\.tsx?$/, '');
      assert.ok(loaderSrc.includes(`lazy(() => import('${mod}')`), `${p.kind}/${p.id} yükleyicide tembel değil`);
      for (const file of files) {
        if (file.endsWith(loader.replace(/\//g, path.sep)) || file.endsWith(p.source.replace(/\//g, path.sep))) continue;
        const src = readFileSync(file, 'utf8');
        assert.ok(!src.includes(`from '${mod}'`), `${path.relative(SRC, file)} adayı statik içe aktarıyor: ${mod}`);
        assert.ok(!src.includes(`import('${mod}')`), `${path.relative(SRC, file)} adayı yükleyici dışında yüklüyor: ${mod}`);
      }
    }
    // Her yükleyicinin girdileri = o türün interaktif desenleri (kayıt) = manifest kapalı listesi
    for (const [kind, loader] of Object.entries(LOADERS)) {
      const keys = [...read(loader).matchAll(/^\s+'([a-z-]+)': lazy/gm)].map((m) => m[1]);
      assert.deepEqual(keys.sort(), interactive.filter((p) => p.kind === kind).map((p) => p.id).sort(), loader);
    }
    assert.deepEqual(INTERACTION_PATTERNS.slice().sort(), interactive.filter((p) => p.kind === 'interaction').map((p) => p.id).sort());
  });

  test('istemci yükleyicilerini yalnızca Site Engine sunucu bileşenleri içe aktarır (bir istemci modülü değil)', () => {
    for (const loader of Object.values(LOADERS)) {
      const mod = `'@/${loader.replace(/\.tsx$/, '')}'`;
      const users = walk(SRC).filter((f) => readFileSync(f, 'utf8').includes(`from ${mod}`));
      assert.ok(users.length >= 1, `${loader} kullanılmıyor`);
      for (const f of users) {
        const src = readFileSync(f, 'utf8');
        assert.ok(!/^'use client';/.test(src), `${path.relative(SRC, f)} istemci modülü yükleyiciyi içe aktarıyor (bütün adalar tek pakete girer)`);
      }
    }
  });
});

describe('Yüzey sözleşmeleri ve desen çözümleyici (D7.2)', () => {
  const view = (style = {}, theme = 'klasik') => {
    const config = parseSiteConfig({ theme, style });
    return { config, style: resolveStyle(config) };
  };

  test('her site yüzeyinin bir sözleşmesi var; yüzey → desen türü ↔ manifest alanı tutarlı', () => {
    assert.deepEqual(SURFACE_CONTRACTS.map((c) => c.surface).sort(), [...SITE_SURFACES].sort());
    for (const c of SURFACE_CONTRACTS) {
      assert.ok(PATTERN_KINDS.includes(c.kind), c.surface);
      assert.ok(PATTERN_ENUMS[c.kind], `${c.kind} türünün manifest kapalı listesi yok`);
      assert.deepEqual(c.setting, SURFACE_SETTINGS[c.surface]);
      if (c.setting.in === 'slots') assert.ok(PATTERN_ENUMS[c.kind].includes('standard'), `${c.surface}: standart (mevcut bileşen) yok`);
    }
  });

  test('istenen yüzey desenlerinin sözleşmesi hazır: uygulanmış ∪ planlanmış; planlanmış seçilemez', () => {
    const want = {
      search: ['premium', 'sidebar', 'map-first', 'filter-sheet', 'compact'],
      listing: ['compact', 'horizontal', 'featured', 'map-results'],
      'property-detail': ['information-first', 'editorial', 'map-first', 'immersive'],
      gallery: ['grid', 'masonry', 'fullscreen', 'carousel', 'hero-thumbnails'],
      map: ['map-first'],
    };
    for (const [surface, ids] of Object.entries(want)) {
      const c = SURFACE_CONTRACTS.find((x) => x.surface === surface);
      const implemented = PATTERN_ENUMS[c.kind];
      for (const id of ids) assert.ok(implemented.includes(id) || c.planned.includes(id), `${surface}/${id} sözleşmede yok`);
      for (const id of c.planned) {
        assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
        assert.ok(!implemented.includes(id), `${surface}/${id} hem planlanmış hem uygulanmış`);
        assert.equal(findPattern(c.kind, id), null, `${surface}/${id} kayıtlı ama planlanmış`);
      }
    }
    // Planlanmış bir kimlik manifestte seçilemez
    assert.throws(() => parseManifest({ siteType: 'real-estate-office', designFamily: 'klasik-guven', variants: { gallery: 'masonry' } }));
    assert.throws(() => parseManifest({ siteType: 'real-estate-office', designFamily: 'klasik-guven', variants: { search: 'map-first' } }));
  });

  test('çözümleyici: seçim yoksa/bilinmiyorsa mevcut standart bileşen (eski kiracı → eski görünüm)', () => {
    for (const v of [null, undefined, view()]) {
      const r = resolveSurfaces(v);
      for (const s of ['search', 'listing', 'property-detail', 'gallery', 'map']) {
        assert.equal(r[s].id, 'standard', s);
        assert.equal(r[s].legacy, true, s);
      }
    }
    const v = view();
    const klasik = resolveSurfaces(v);
    assert.equal(klasik.home.id, v.style.hero);
    assert.equal(klasik.navigation.id, v.style.headerLayout);
    assert.equal(klasik.footer.id, v.style.footerLayout);
    // Kayıtlı yapılandırmada bilinmeyen değer: okuma şeması atar, çözümleyici standarda düşer
    assert.equal(resolvePattern(view({ slots: { gallery: 'masonry' } }), 'gallery').id, 'standard');
    // Elle bozulmuş görünüm (şemayı atlayan): yine standart
    assert.equal(resolvePattern({ config: { style: { slots: { gallery: '<script>' } } }, style: view().style }, 'gallery').id, 'standard');
    assert.equal(resolvePattern(view({ slots: { gallery: 'carousel' } }), 'gallery').id, 'carousel');
  });

  test('çözümleyici yalnızca sunucuda ve yalnızca veri: Supabase/CRM/yetki/sorgu yok', () => {
    const src = read('components/patterns/resolver.ts');
    assert.match(src, /^import 'server-only';/);
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(imports, ['@/components/patterns/contracts', '@/components/patterns/registry', '@/components/patterns/surfaces', '@/site-config/load'].sort());
    assert.ok(!/supabase|fetch\(|getSession|require[A-Z]/.test(src.replace(/import[^\n]+\n/g, '')), 'çözümleyicide veri erişimi');
    // İstemci modülleri çözümleyiciyi ve yüzey çizicilerini içe aktaramaz
    for (const f of walk(SRC)) {
      const text = readFileSync(f, 'utf8');
      if (!/^'use client';/.test(text)) continue;
      assert.ok(!text.includes("from '@/components/patterns/resolver'"), `${path.relative(SRC, f)} çözümleyiciyi istemciye taşıyor`);
      assert.ok(!/from '@\/components\/patterns\/[a-z-]+\/surface'/.test(text), `${path.relative(SRC, f)} yüzey çizicisini istemciye taşıyor`);
    }
  });

  test('desenler ve yüzey çizicileri veri sorgulamaz (veri katmanı ayrı)', () => {
    for (const f of walk(PATTERNS)) {
      const text = readFileSync(f, 'utf8');
      assert.ok(!/@\/lib\/supabase|@\/modules\/[a-z-]+\/queries|@\/platform\/auth|\.from\('|\.rpc\(/.test(text), `${path.relative(SRC, f)} veri sorgusu içeriyor`);
    }
  });

  test('her yüzey çizicisi türünün uygulanmış bütün desenlerini karşılar; standart = mevcut bileşen', () => {
    const SURFACE_FILES = {
      gallery: ['components/patterns/gallery/surface.tsx', 'PropertyGallery'],
      search: ['components/patterns/search/surface.tsx', 'ListingToolbar'],
      listing: ['components/patterns/listing/surface.tsx', 'PropertyGrid'],
      'property-detail': ['components/patterns/property-detail/surface.tsx', 'PropertyDetailView'],
      map: ['components/patterns/map/surface.tsx', 'LazyMap'],
    };
    for (const [kind, [file, legacyName]] of Object.entries(SURFACE_FILES)) {
      const src = read(file);
      assert.ok(src.includes(`<${legacyName} `), `${file}: standart bileşen yok`);
      assert.ok(src.includes(`resolvePattern(view, '${kind}')`), `${file}: çözümleyici kullanılmıyor`);
      const extra = PATTERN_ENUMS[kind].filter((id) => id !== 'standard');
      for (const id of extra) {
        const meta = findPattern(kind, id);
        // İnteraktif desen: türün yükleyicisi üzerinden; sunucu deseni: çizicide adıyla
        assert.ok(meta.interactive ? src.includes(LOADERS[kind].split('/').pop().replace('.tsx', '')) : src.includes(`'${id}'`), `${file}: ${id} çizilmiyor`);
      }
    }
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

  test('AİLE SÖZLEŞMESİ: her ailenin her yüzey kararı kayıtlı bir desendir; önizleme (manifest) = kiracı (çözümleyici)', () => {
    const contract = Object.fromEntries(SURFACE_CONTRACTS.map((c) => [c.surface, c]));
    const cases = [
      ...CATALOG.map((f) => ({ siteType: 'real-estate-office', designFamily: f.id, variants: {} })),
      { siteType: 'real-estate-office', designFamily: 'sinematik-vitrin', variants: { gallery: 'carousel', hero: 'split' } },
      { siteType: 'consultant', designFamily: 'yalin-galeri', variants: { gallery: 'grid', interactions: ['image-reveal'] } },
    ];
    for (const m of cases) {
      const surfaces = manifestSurfaces(m);
      assert.deepEqual(Object.keys(surfaces).sort(), [...SITE_SURFACES].sort());
      const config = parseSiteConfig(compileManifest(m, base()).design);
      const resolved = resolveSurfaces({ config, style: resolveStyle(config) });
      for (const s of SITE_SURFACES) {
        assert.ok(findPattern(contract[s].kind, surfaces[s]), `${m.designFamily}: ${s}/${surfaces[s]} kayıtlı değil`);
        assert.equal(resolved[s].id, surfaces[s], `${m.designFamily}: ${s} önizleme ≠ kiracı`);
      }
    }
  });

  test('mevcut 6 aile kilitli: bütün yeni yüzeylerde mevcut standart bileşenler', () => {
    for (const f of CATALOG.slice(0, 6)) {
      assert.equal(f.style.slots, undefined, f.id);
      const s = manifestSurfaces({ siteType: 'real-estate-office', designFamily: f.id });
      for (const k of ['search', 'listing', 'property-detail', 'gallery', 'map']) assert.equal(s[k], 'standard', `${f.id}: ${k}`);
    }
  });

  test('ailenin yüzey kararı derlenir, manifest varyantı ailenin kararını ezer, gidiş-dönüş yalnızca farkı taşır', () => {
    // Ailenin kararı (D7.3 aileleri style.slots ile verir): geçici olarak bir katalog ailesinde
    const fam = CATALOG[0];
    const original = fam.style;
    fam.style = { ...original, slots: { gallery: 'grid' } };
    try {
      assert.equal(compileDesign(fam, base()).style.slots.gallery, 'grid', 'ailenin kararı derlenmedi');
      assert.equal(manifestSurfaces({ siteType: 'real-estate-office', designFamily: fam.id }).gallery, 'grid');
      const withInteraction = compileManifest({ siteType: 'real-estate-office', designFamily: fam.id, variants: { interactions: ['image-reveal'] } }, base());
      assert.deepEqual(withInteraction.design.style.slots, { gallery: 'grid', interactions: ['image-reveal'] }, 'manifest slotu ailenin kararını sildi');
      assert.deepEqual(manifestFromConfig(parseSiteConfig(withInteraction.design)).variants, { interactions: ['image-reveal'] }, 'ailenin kararı varyant sanıldı');
      const override = compileManifest({ siteType: 'real-estate-office', designFamily: fam.id, variants: { gallery: 'carousel' } }, base());
      assert.equal(override.design.style.slots.gallery, 'carousel');
    } finally {
      fam.style = original;
    }
    // Manifest varyantı > aile; aile slotu manifestte etkileşim seçilince kaybolmaz
    const m = { siteType: 'real-estate-office', designFamily: 'sinematik-vitrin', variants: { gallery: 'carousel', interactions: ['scroll-header'] } };
    const c = compileManifest(m, base());
    assert.equal(c.design.style.slots.gallery, 'carousel');
    assert.deepEqual(c.design.style.slots.interactions, ['scroll-header']);
    assert.deepEqual(manifestFromConfig(parseSiteConfig(c.design)).variants, { gallery: 'carousel', interactions: ['scroll-header'] });
  });
});
