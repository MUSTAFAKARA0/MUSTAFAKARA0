/**
 * KARAYS sayfası dürüstlük denetimi: uydurma müşteri sayısı, yorum, referans, puan, yüzde yoktur; rakamlar içerik
 * dizilerinin uzunluğundan türetilir. Yorum satırları taranmaz (kuralı anlatan açıklamalar olabilir).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../src/components/karay/', import.meta.url);
const page = readFileSync(new URL('../../src/app/karay/page.tsx', import.meta.url), 'utf8');
const files = [['page.tsx', page], ...readdirSync(dir).filter((f) => /\.(tsx|ts)$/.test(f) && !/(logic|karay-lead-form)/.test(f)).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')])];
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

/** Okunur metin: tırnaklı dizgeler ve JSX metin düğümleri (sınıf adı gibi görünenler hariç) */
function copyOf(src) {
  const code = stripComments(src);
  const out = [];
  for (const m of code.matchAll(/'([^'\n]{12,})'|"([^"\n]{12,})"|`([^`]{12,})`|>([^<>{}\n]{6,})</g)) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return out.filter((t) => /\p{L}{4,}\s+\p{L}{2,}/u.test(t) && !/[[\]_]/.test(t));
}

const BANNED_WORDS = [/müşteri(miz)?\s+sayısı/i, /referans/i, /\byorum/i, /★/, /memnuniyet/i, /güvenen/i, /kullanıyor/i, /ofis(e)?\s+hizmet\s+veriyoruz/i, /\d+\s*(ofis|müşteri|kullanıcı)\b/i];
const BANNED_NUMERIC = [/\b\d{2,}\s*(\+|%)/];

describe('uydurma istatistik, yorum ve referans yok', () => {
  for (const [name, src] of files) {
    test(name, () => {
      const text = copyOf(src);
      for (const t of text) {
        for (const re of [...BANNED_WORDS, ...BANNED_NUMERIC]) assert.doesNotMatch(t, re, `${name}: "${t}"`);
      }
    });
  }
  test('okunur metin gerçekten bulundu (tarayıcı boş geçmiyor)', () => {
    assert.ok(copyOf(page).length > 10);
  });
});

describe('rakamlar sabitlerden türetilir', () => {
  test('page.tsx rakam şeridi dizi uzunluklarını kullanır', () => {
    assert.match(page, /THEME_LIST\.length/);
    assert.match(page, /GALLERY_FAMILIES\.length/);
    assert.match(page, /STEPS\.length/);
    assert.match(page, /ROLES\.length/);
  });
  test('<FactsBand değerleri elle yazılmış sayı değil', () => {
    const band = page.slice(page.indexOf('<FactsBand'), page.indexOf('/>', page.indexOf('<FactsBand')));
    assert.ok(band.length > 20);
    assert.doesNotMatch(band, /value:\s*\d/);
  });
  test('count-up yalnızca facts-band.tsx değerini gösterir (sunucu çıktısında gerçek sayı)', () => {
    const fb = readFileSync(new URL('facts-band.tsx', dir), 'utf8');
    assert.match(fb, /ky-fact-real">\{f\.value\}/);
  });
});
