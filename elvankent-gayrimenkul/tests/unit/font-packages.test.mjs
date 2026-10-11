/**
 * FONT-ISOLATION: tipografi paketleri. Her katalog yazı tipinin bir paketi vardır; paket yalnızca
 * kendi dosyalarına başvurur; bir siteye yazılan CSS yalnızca seçili ailelerin bildirimlerini
 * içerir (katalogdaki diğerleri yoktur). Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { FONT_IDS } from '@/theme-engine/ids';
import { FONT_CATALOG } from '@/theme-engine/typography/catalog';
import { FONT_PACKAGES } from '@/theme-engine/typography/packages.generated';
import { fontPackageCss, fontPreloads, resolveFontIds } from '@/theme-engine/typography/font-css';
import { THEMES } from '@/theme-engine/themes';

const PUBLIC = new URL('../../public', import.meta.url).pathname;
const families = (css) => [...new Set([...css.matchAll(/font-family:'([^']+)'/g)].map((m) => m[1].replace(/ Fallback$/, '')))];

describe('Tipografi paketleri', () => {
  test('her katalog yazı tipinin paketi var; aile adı ve değişken katalogla aynı', () => {
    for (const id of FONT_IDS) {
      const p = FONT_PACKAGES[id];
      assert.ok(p, id);
      assert.equal(p.family, FONT_CATALOG[id].name, id);
      assert.equal(p.cssVar, FONT_CATALOG[id].cssVar, id);
      assert.ok(p.preload.length > 0, `${id}: ön yükleme`);
      assert.match(p.css, new RegExp(`font-family:'${p.family} Fallback'`), `${id}: yedek yazı tipi`);
    }
  });

  test('paket yalnızca kendi dosyalarına başvurur ve dosyalar diskte', () => {
    for (const id of FONT_IDS) {
      const urls = [...FONT_PACKAGES[id].css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
      assert.ok(urls.length > 0);
      for (const u of [...urls, ...FONT_PACKAGES[id].preload]) {
        assert.ok(u.startsWith(`/fonts/site/${id}/`), `${id}: ${u}`);
        assert.ok(existsSync(PUBLIC + u), `${id}: ${u} yok`);
      }
      assert.ok(existsSync(`${PUBLIC}/fonts/site/${id}/preview.css`), `${id}: preview.css`);
      assert.deepEqual(families(FONT_PACKAGES[id].css), [FONT_PACKAGES[id].family]);
    }
  });

  test('siteye yazılan CSS yalnızca seçili aileleri içerir (her tema için)', () => {
    for (const theme of Object.keys(THEMES)) {
      const ids = resolveFontIds({ theme, typography: {} });
      const css = fontPackageCss(ids);
      assert.deepEqual(families(css).sort(), ids.map((i) => FONT_CATALOG[i].name).sort(), theme);
      for (const other of FONT_IDS.filter((f) => !ids.includes(f))) assert.ok(!css.includes(`/fonts/site/${other}/`), `${theme}: ${other} sızdı`);
      assert.ok(fontPreloads(ids).every((u) => ids.some((i) => u.startsWith(`/fonts/site/${i}/`))));
    }
  });

  test('Klasik (Elvankent): yalnızca Manrope + Fraunces; tipografi ayarı paketi değiştirir', () => {
    assert.deepEqual(resolveFontIds({ theme: 'klasik', typography: {} }), ['fraunces', 'manrope']);
    assert.deepEqual(resolveFontIds({ theme: 'klasik', typography: { heading: 'inter', body: 'inter' } }), ['inter']);
    assert.match(fontPackageCss(['inter']), /html:root\{--font-inter:"Inter", "Inter Fallback"\}$/);
  });
});
