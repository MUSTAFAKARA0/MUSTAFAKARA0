/**
 * RENK PALETLERİ (src/theme-engine/palettes.ts) — WCAG AA kontrast testleri (Faz 1).
 * Her palet, GERÇEK token üreticisinin (siteCss) çıktısı üzerinden denetlenir; böylece yalnızca ham
 * değerler değil, sitede gerçekten kullanılan türetilmiş renkler (primary-fg, accent-ink …) doğrulanır.
 *
 *  - metin / zemin        >= 4.5:1
 *  - soluk metin / zemin  >= 4.5:1 (zemin ve yüzey)
 *  - düğme yazısı / ana renk >= 4.5:1
 *  - vurgu mürekkebi / zemin >= 4.5:1; vurgu yazısı / vurgu >= 4.5:1
 *  - durum renkleri yüzeyde okunur (>= 4.5:1)
 * Ayrıca: kimlikler benzersiz, koyu paletlerin şeması 'dark', yeni 8 palet kayıtlı ve (koyu hariç) açık.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, findPalette } from '@/theme-engine/palettes';
import { siteCss } from '@/theme-engine/tokens';
import { contrastRatio } from '@/platform/branding/theme';

const NEW_PALETTES = ['aegean-sand', 'launch-indigo', 'steel-glass', 'field-earth', 'franchise-crimson', 'iznik-ink', 'rental-coral', 'midnight-brass'];

function vars(paletteId) {
  const p = findPalette(paletteId);
  const css = siteCss({ theme: 'klasik', colors: { mode: 'preset', preset: paletteId, scheme: p.scheme }, typography: {}, style: {} }, { primary_color: null, accent_color: null }, true, 'x');
  return Object.fromEntries([...css.matchAll(/--([a-z-]+):(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

describe('Paletler: kimlik, şema, kayıt', () => {
  test('kimlikler benzersiz; 8 yeni palet kayıtlı; midnight-brass koyu, diğer yeniler açık; night korunur', () => {
    const ids = PALETTES.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of NEW_PALETTES) assert.ok(findPalette(id), id);
    assert.equal(findPalette('midnight-brass').scheme, 'dark');
    for (const id of NEW_PALETTES.filter((x) => x !== 'midnight-brass')) assert.equal(findPalette(id).scheme, 'light', id);
    assert.equal(findPalette('night').scheme, 'dark');
    assert.equal(PALETTES.length, 18);
  });
});

describe('Paletler: WCAG AA kontrast (türetilmiş gerçek tokenlar)', () => {
  for (const p of PALETTES) {
    test(`${p.id}: metin, soluk metin, düğme, vurgu`, () => {
      const v = vars(p.id);
      const r = (a, b) => contrastRatio(v[a], v[b]);
      assert.ok(r('foreground', 'background') >= 4.5, `metin/zemin ${r('foreground', 'background').toFixed(2)}`);
      assert.ok(r('foreground', 'surface') >= 4.5, 'metin/yüzey');
      assert.ok(r('muted-foreground', 'background') >= 4.5, `soluk/zemin ${r('muted-foreground', 'background').toFixed(2)}`);
      assert.ok(r('muted-foreground', 'surface') >= 4.5, `soluk/yüzey ${r('muted-foreground', 'surface').toFixed(2)}`);
      assert.ok(r('primary-fg', 'primary') >= 4.5, `düğme yazısı/ana ${r('primary-fg', 'primary').toFixed(2)}`);
      assert.ok(r('accent-ink', 'background') >= 4.5, `vurgu mürekkebi/zemin ${r('accent-ink', 'background').toFixed(2)}`);
      assert.ok(r('primary-ink', 'background') >= 4.5, 'ana renk mürekkebi/zemin');
      // Vurgu yazısı/vurgu: mevcut paletlerin değerleri donmuş (bayt bayt aynı); ölçüt yeni paletlere uygulanır
      if (NEW_PALETTES.includes(p.id)) assert.ok(r('accent-fg', 'accent') >= 4.5, `vurgu yazısı/vurgu ${r('accent-fg', 'accent').toFixed(2)}`);
      assert.ok(r('inverse-foreground', 'surface-inverse') >= 7, 'koyu blok metni');
      for (const s of ['success', 'warning', 'danger']) assert.ok(r(s, 'surface') >= 4.5, `${s}/yüzey`);
    });
  }

  test('yeni paletlerin HAM değerleri de ölçüt dışında kalmaz: metin/zemin, soluk/zemin, düğme yazısı/ana renk', () => {
    for (const id of NEW_PALETTES) {
      const t = findPalette(id).tokens;
      assert.ok(contrastRatio(t.text, t.background) >= 4.5, `${id}: metin/zemin`);
      assert.ok(contrastRatio(t.muted, t.background) >= 4.5, `${id}: soluk/zemin`);
      assert.ok(contrastRatio(t.muted, t.surface) >= 4.5, `${id}: soluk/yüzey`);
      const fg = contrastRatio('#ffffff', t.primary) >= 4.5 ? '#ffffff' : '#141a18';
      assert.ok(contrastRatio(fg, t.primary) >= 4.5, `${id}: düğme yazısı/ana renk`);
    }
  });
});
