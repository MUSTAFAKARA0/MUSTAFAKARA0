/**
 * KARAYS sayfası küçük metin kontrastı (K-19, Lighthouse color-contrast bulgusu).
 * Sayfadaki 13 px bölüm başlıklarının rengi, sayfanın iki zemininde (beyaz, bulut #f4f7fb) WCAG AA
 * küçük metin eşiğini (4,5:1) karşılamalıdır. Renk sayfa kaynağından okunur, oran hesaplanır.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLATFORM_BRAND } from '../../src/platform/branding/platform-brand.ts';

const luminance = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('KARAYS sayfası küçük metin kontrastı', () => {
  const page = readFileSync(new URL('../../src/app/karay/page.tsx', import.meta.url), 'utf8');
  const smallText = [...page.matchAll(/className="text-\[13px\][^"]*text-\[(#[0-9a-f]{6})\][^"]*"/gi)].map((m) => m[1].toLowerCase());

  test('13 px bölüm başlıkları bulundu', () => {
    assert.ok(smallText.length >= 5, `${smallText.length} başlık`);
  });
  test('her başlık rengi kendi zemininde en az 4,5:1 (turkuaz yalnızca lacivert bölümde, diğerleri beyaz/bulut)', () => {
    const { navy, cloud, turquoise } = PLATFORM_BRAND.colors;
    for (const color of new Set(smallText)) {
      const grounds = color === turquoise ? [navy] : ['#ffffff', cloud];
      for (const bg of grounds) assert.ok(contrast(color, bg) >= 4.5, `${color} / ${bg}: ${contrast(color, bg).toFixed(2)}`);
    }
    // Turkuaz küçük metin yalnızca lacivert zeminli "Nasıl çalışır?" bölümünde
    const dark = page.slice(page.indexOf('id="nasil-calisir"'), page.indexOf('</section>', page.indexOf('id="nasil-calisir"')));
    const turquoiseCount = smallText.filter((c) => c === turquoise).length;
    assert.equal((dark.match(new RegExp(`text-\\[${turquoise}\\]`, 'gi')) ?? []).length, turquoiseCount);
  });
  test('kontrol: sinyal mavisi küçük metinde eşiğin altında (bu yüzden koyu ton kullanılır)', () => {
    assert.ok(contrast(PLATFORM_BRAND.colors.signal, PLATFORM_BRAND.colors.cloud) < 4.5);
  });
});
