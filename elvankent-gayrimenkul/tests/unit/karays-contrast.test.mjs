/**
 * KARAYS sayfası küçük metin kontrastı (K-19, Lighthouse color-contrast bulgusu).
 * Sayfadaki 13 px bölüm başlıklarının rengi, sayfanın iki zemininde (beyaz, bulut #f4f7fb) WCAG AA
 * küçük metin eşiğini (4,5:1) karşılamalıdır. Renk sayfa kaynağından okunur, oran hesaplanır.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

/** Yeni koyu bölümler ("Canlı Vitrin"): açık metin koyu zeminde en az 4,5:1 (alfa karışımı hesaba katılır) */
const hex = (c) => [0, 2, 4].map((i) => parseInt(c.slice(1 + i, 3 + i), 16));
const lum = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg, alpha, bg) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

describe('KARAYS koyu bölümlerde açık metin kontrastı', () => {
  const NAVY = '#0b1b3a';
  const DEEP = '#07122a';
  const dir = new URL('../../src/components/karay/', import.meta.url);
  const sources = [
    ['page.tsx', readFileSync(new URL('../../src/app/karay/page.tsx', import.meta.url), 'utf8')],
    ...readdirSync(dir).filter((f) => /\.tsx$/.test(f)).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]),
  ];
  const css = readFileSync(new URL('../../src/app/karay/karay.css', import.meta.url), 'utf8');

  test('text-white/NN sınıfları (bilgilendirici metin) alfa >= 0,7 ve her iki lacivert zeminde >= 4,5:1', () => {
    let n = 0;
    for (const [name, src] of sources) {
      for (const m of src.matchAll(/(?<![\w:-])text-white\/(\d{2,3})\b/g)) {
        const alpha = Number(m[1]) / 100;
        n++;
        assert.ok(alpha >= 0.7, `${name}: text-white/${m[1]} (alfa < 0,7)`);
        for (const bg of [NAVY, DEEP]) assert.ok(ratio(over([255, 255, 255], alpha, hex(bg)), hex(bg)) >= 4.5, `${name}: text-white/${m[1]} / ${bg}`);
      }
    }
    assert.ok(n >= 10, `${n} kullanım`);
  });

  test('CSS: color: rgb(255 255 255 / a) alfa >= 0,7', () => {
    for (const m of css.matchAll(/(?<![-\w])color:\s*rgb\(255 255 255 \/ ([0-9.]+)\)/g)) assert.ok(Number(m[1]) >= 0.7, m[0]);
  });

  test('açıkça listelenen yeni renk çiftleri (küçük metin)', () => {
    const pairs = [
      ['#9fc0ff', NAVY, 'koyu bölüm eyebrow'],
      ['#9fc0ff', DEEP, 'koyu bölüm eyebrow (derin)'],
      ['#ffffff', NAVY, 'başlıklar'],
      ['#1cc8b6', NAVY, 'hero vurgulu sözcük / Adım etiketi'],
      ['#0b1b3a', '#ffffff', 'çerçeve rozetleri'],
      ['#0b1b3a', '#dbe7ff', 'adım rozeti (açık mavi)'],
      ['#0b1b3a', '#1cc8b6', 'Canlı etiketi (turkuaz zemin)'],
      ['#0b1b3a', '#cfe0ff', 'durum hapı vurgusu'],
      ['#ffffff', '#24407a', 'adım numarası (pasif)'],
      ['#ffffff', '#2457e0', 'adım numarası (etkin)'],
      ['#176b4d', '#f8fafc', 'SERP örnek adres'],
      ['#4a5871', '#d9f6f2', 'turkuaz bento kartında gövde metni'],
      ['#4a5871', '#dbe7ff', 'mavi bento kartında gövde metni'],
      ['#0f6f65', '#d9f6f2', 'marka kartı etiketi'],
    ];
    for (const [fg, bg, what] of pairs) assert.ok(ratio(hex(fg), hex(bg)) >= 4.5, `${what}: ${fg} / ${bg} = ${ratio(hex(fg), hex(bg)).toFixed(2)}`);
  });

  test('turkuaz 13 px metin yalnızca page.tsx "nasil-calisir" bölümünde; timeline.tsx de lacivert zeminde', () => {
    const tl = readFileSync(new URL('timeline.tsx', dir), 'utf8');
    assert.match(tl, /text-\[13px\][^"]*text-\[#1cc8b6\]/);
    // sinyal mavisi (#2f6bff) hiçbir 13 px metinde kullanılmaz
    for (const [name, src] of sources) assert.doesNotMatch(src, /text-\[13px\][^"]*text-\[#2f6bff\]/, name);
  });
});
