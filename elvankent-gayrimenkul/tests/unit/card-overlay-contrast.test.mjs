/**
 * Faz 2: kart üstü öğeler (rozet, tür çipi, favori kalbi) tema yüzeyini kullanır (bg-surface), bu yüzden
 * koyu temalarda "beyaz zemin üstünde açık yazı" olmaz. 18 ailenin gerçek token çıktısıyla denetlenir:
 *   rozet/çip yazısı (foreground) / yüzey >= 4.5:1; fiyat düştü (success) / yüzey >= 4.5:1; kalp (foreground) / yüzey >= 3:1.
 * Kaynakta sabit beyaz zemin geri gelirse CO-01 yakalar.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOG } from '@/site-factory/catalog';
import { findPalette } from '@/theme-engine/palettes';
import { siteCss } from '@/theme-engine/tokens';
import { contrastRatio } from '@/platform/branding/theme';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

function vars(fam) {
  const p = findPalette(fam.palette);
  const css = siteCss({ theme: fam.theme, colors: { mode: 'preset', preset: fam.palette, scheme: p.scheme }, typography: {}, style: {} }, { primary_color: null, accent_color: null }, true, 'x');
  return Object.fromEntries([...css.matchAll(/--([a-z-]+):(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

describe('Faz 2 › kart üstü kontrast (18 aile)', () => {
  test('CO-01 rozet, çip ve favori düğmesi sabit beyaz zemin kullanmaz', () => {
    for (const f of ['src/components/ui/badge.tsx', 'src/components/property/property-badges.tsx', 'src/components/property/property-card.tsx', 'src/components/property/property-actions.tsx']) {
      const code = read(f);
      const bad = code.split('\n').filter((l) => /bg-white\/(92|95)|hover:bg-white['" ]/.test(l) && !/inverse/.test(l));
      assert.deepEqual(bad, [], f);
    }
  });
  test('CO-02 aile sayısı 18', () => assert.equal(CATALOG.length, 18));
  for (const fam of CATALOG) {
    test(`CO-03 ${fam.id}: rozet yazısı, fiyat düştü ve kalp yüzeyde okunur`, () => {
      const v = vars(fam);
      assert.ok(contrastRatio(v.foreground, v.surface) >= 4.5, `foreground/surface ${contrastRatio(v.foreground, v.surface)}`);
      assert.ok(contrastRatio(v.success, v.surface) >= 4.5, `success/surface ${contrastRatio(v.success, v.surface)}`);
      assert.ok(contrastRatio(v.foreground, v.surface) >= 3);
    });
  }
});
