/**
 * SITE-FACTORY ve tasarım paketi (design bundle) birim testleri.
 *
 *  - Bir sitenin sayfasına yalnızca SEÇTİĞİ tema/varyantların CSS'i yazılır (katalog yazılmaz).
 *  - Manifest değerleri kapalı listedir: bilinmeyen/kötü niyetli değer CSS veya bileşen seçemez.
 *  - Her tasarım ailesi geçerli bir site yapılandırmasına derlenir; kiracının metinleri korunur.
 *
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { designCss } from '@/theme-engine/design-css';
import { THEME_IDS, HERO_LAYOUTS, CARD_LAYOUTS, HEADER_LAYOUTS, FOOTER_LAYOUTS, MOTION_LEVELS, CARD_SURFACES } from '@/theme-engine/ids';
import { resolveStyle, THEMES } from '@/theme-engine/themes';
import { applyTheme } from '@/theme-engine/runtime';
import { PALETTES } from '@/theme-engine/palettes';
import { styleSchema } from '@/theme-engine/settings';
import { parseSiteConfig, SECTION_SCHEMAS } from '@/site-config/schema';
import { compileDesign } from '@/site-factory/compile';
import { DESIGN_FAMILIES, findDesignFamily } from '@/site-factory/families';

const brand = { primary_color: '#1f5c4a', accent_color: '#c08a3e' };
const themesIn = (css) => [...css.matchAll(/data-site-theme='([a-z]+)'/g)].map((m) => m[1]);
const valuesIn = (css, attr) => [...new Set([...css.matchAll(new RegExp(`data-site-${attr}='([a-z]+)'`, 'g'))].map((m) => m[1]))];

describe('Seçilmiş tasarım paketi (design-css)', () => {
  test('varsayılan site (Klasik, tüm varsayılanlar) için tema sunum CSS\'i boştur', () => {
    const style = resolveStyle({ theme: 'klasik', style: {} });
    assert.equal(designCss('klasik', style), '');
  });

  test('her tema yalnızca kendi kurallarını yazar; başka temanın tek kuralı bile yoktur', () => {
    for (const id of THEME_IDS) {
      const css = designCss(id, resolveStyle({ theme: id, style: {} }));
      for (const t of themesIn(css)) assert.equal(t, id, `${id} sayfasında ${t} kuralı`);
    }
  });

  test('yalnızca seçilen kart yüzeyi / kart düzeni / header düzeni / hareket kuralları yazılır', () => {
    for (const card of CARD_SURFACES)
      for (const cardLayout of CARD_LAYOUTS)
        for (const headerLayout of HEADER_LAYOUTS)
          for (const motion of MOTION_LEVELS) {
            const style = { ...resolveStyle({ theme: 'klasik', style: {} }), card, cardLayout, headerLayout, motion };
            const css = designCss('klasik', style);
            for (const v of valuesIn(css, 'card')) assert.equal(v, card);
            for (const v of valuesIn(css, 'card-layout')) assert.equal(v, cardLayout);
            for (const v of valuesIn(css, 'header-layout')) assert.equal(v, headerLayout);
            assert.equal(css.includes('site-reveal'), motion !== 'none', `hareket ${motion}`);
          }
  });

  test('hareket kuralları "hareketi azalt" tercihine ve tarayıcı desteğine bağlıdır; yalnızca transform/opacity', () => {
    for (const motion of ['subtle', 'expressive']) {
      const css = designCss('klasik', { ...resolveStyle({ theme: 'klasik', style: {} }), motion });
      assert.match(css, /@media \(prefers-reduced-motion:no-preference\)/);
      const keyframes = [...css.matchAll(/@keyframes [\w-]+\{(.*?)\}\}/g)].map((m) => m[1]).join('');
      assert.doesNotMatch(keyframes, /(top|left|width|height|margin)\s*:/);
    }
  });

  test('bilinmeyen / kötü niyetli manifest değeri CSS üretmez (enjeksiyon yok)', () => {
    const evil = "x'] {} body{display:none} [a='";
    const style = { ...resolveStyle({ theme: 'klasik', style: {} }), card: evil, cardLayout: evil, headerLayout: evil, motion: evil, footer: evil, button: evil, image: evil, header: evil };
    const css = designCss(evil, style);
    assert.equal(css, '');
    assert.equal(styleSchema.safeParse({ cardLayout: evil }).success, false);
    assert.equal(styleSchema.safeParse({ hero: 'cinematic', headerLayout: 'floating', motion: 'subtle' }).success, true);
  });

  test('applyTheme: CSS = tokenlar + yalnızca seçili paket; hareket yoksa öznitelik de yok', () => {
    const base = parseSiteConfig({});
    const plain = applyTheme(base, brand, false);
    assert.equal(plain.attributes['data-site-motion'], undefined);
    assert.equal(plain.attributes['data-site-card-layout'], 'standard');
    const premium = applyTheme({ ...base, theme: 'rezidans', style: { hero: 'cinematic', cardLayout: 'overlay', motion: 'subtle' } }, brand, false);
    assert.equal(premium.attributes['data-site-motion'], 'subtle');
    assert.deepEqual(themesIn(premium.css).filter((t) => t !== 'rezidans'), []);
    assert.ok(premium.css.includes("data-site-card-layout='overlay'"));
    assert.ok(!premium.css.includes("data-site-card-layout='horizontal'"));
  });

  test('her hero düzeni şemada geçerlidir', () => {
    for (const hero of HERO_LAYOUTS) assert.equal(styleSchema.safeParse({ hero }).success, true, hero);
    for (const footerLayout of FOOTER_LAYOUTS) assert.equal(styleSchema.safeParse({ footerLayout }).success, true, footerLayout);
  });
});

describe('SITE-FACTORY: tasarım aileleri ve derleyici', () => {
  test('aile kimlikleri benzersizdir; tema ve palet mevcut katalogdan gelir', () => {
    const ids = DESIGN_FAMILIES.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const f of DESIGN_FAMILIES) {
      assert.ok(THEMES[f.theme], `${f.id}: tema`);
      assert.ok(PALETTES.some((p) => p.id === f.palette), `${f.id}: palet`);
      assert.equal(styleSchema.safeParse(f.style).success, true, `${f.id}: stil`);
    }
  });

  test('her aile geçerli bir manifeste derlenir (şema doğrulaması dahil)', () => {
    const current = parseSiteConfig({});
    for (const f of DESIGN_FAMILIES) {
      const out = compileDesign(f, current);
      for (const section of ['theme', 'colors', 'typography', 'style', 'home']) {
        assert.equal(SECTION_SCHEMAS[section].safeParse(out[section]).success, true, `${f.id}: ${section}`);
      }
      assert.deepEqual(out.home.sections.filter((s) => s.enabled).map((s) => s.type), f.home);
    }
  });

  test('derleme kiracının bölüm metinlerini, metin bölümlerini ve renk düzenini korur', () => {
    const current = parseSiteConfig({
      colors: { mode: 'brand', scheme: 'dark' },
      home: {
        sections: [
          { id: 'hero', type: 'hero', title: 'Ofisimizin başlığı' },
          { id: 'hakkimizda-metni', type: 'text', title: 'Hakkımızda', body: 'Ofis metni' },
          { id: 'contact', type: 'contact' },
        ],
      },
    });
    const out = compileDesign(findDesignFamily('sinematik-vitrin'), current);
    assert.equal(out.home.sections.find((s) => s.type === 'hero').title, 'Ofisimizin başlığı');
    const types = out.home.sections.map((s) => s.type);
    assert.ok(types.includes('text'));
    assert.ok(types.indexOf('text') < types.indexOf('contact'), 'metin bölümü iletişimden önce');
    assert.equal(out.colors.scheme, 'dark');
  });

  test('ailede olmayan özelleştirilmiş bölüm silinmez, kapalı olarak korunur', () => {
    const current = parseSiteConfig({ home: { sections: [{ id: 'process', type: 'process', title: 'Bizim yöntemimiz' }, { id: 'hero', type: 'hero' }] } });
    const out = compileDesign(findDesignFamily('editoryal-luks'), current);
    const process = out.home.sections.find((s) => s.type === 'process');
    assert.equal(process.title, 'Bizim yöntemimiz');
    assert.equal(process.enabled, false);
  });

  test('bilinmeyen aile bulunamaz', () => {
    assert.equal(findDesignFamily('yok'), null);
    assert.equal(findDesignFamily('__proto__'), null);
  });
});
