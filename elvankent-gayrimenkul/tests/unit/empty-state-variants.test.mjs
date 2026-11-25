/** Faz 2: bağlama duyarlı boş durum metinleri — Türkçe, vaatsiz; öneriler yalnızca etkin filtrelerden. */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_COPY, emptySuggestions } from '@/components/common/empty-state-copy';

describe('Faz 2 › boş durumlar', () => {
  test('ES-01 her varyantın başlığı ve açıklaması vardır, Türkçe karakter/nokta içerir', () => {
    for (const [k, c] of Object.entries(EMPTY_COPY)) {
      assert.ok(c.title.length > 5 && c.description.length > 20, k);
      assert.ok(/[a-zçğıöşü]/i.test(c.title), k);
    }
  });

  test('ES-02 metinlerde yanıt süresi, geri arama veya bildirim vaadi yoktur', () => {
    const banned = /(dakika|saat içinde|en kısa sürede|garanti|haber verelim|arayacağız|ücretsiz)/i;
    for (const [k, c] of Object.entries(EMPTY_COPY)) assert.ok(!banned.test(`${c.title} ${c.description}`), k);
  });

  test('ES-03 filtre boş sonucu başlığı mevcut E2E ile uyumludur', () => {
    assert.equal(EMPTY_COPY.filtered.title, 'Hiç ilan bulunamadı');
    assert.equal(EMPTY_COPY.favorites.title, 'Henüz favori ilanınız yok');
  });

  test('ES-04 öneriler etkin filtrelere bağlıdır ve en fazla üç tanedir', () => {
    assert.deepEqual(emptySuggestions({}), []);
    assert.equal(emptySuggestions({ minPrice: 1 }).length, 1);
    const many = emptySuggestions({ q: 'x', minPrice: 1, rooms: ['3+1'], district: 'a', flagCount: 2, minM2: 5 });
    assert.equal(many.length, 3);
    assert.ok(emptySuggestions({ neighborhood: 'm', district: 'd' }).some((s) => s.includes('Mahalle')));
  });
});

import { priceRangeLabel } from '@/components/search/filter-labels';

describe('Faz 2 › filtre etiketleri', () => {
  test('FL-01 fiyat çipi anlamsız "0 – ∞" göstermez', () => {
    assert.equal(priceRangeLabel(undefined, undefined), undefined);
    assert.match(priceRangeLabel(900000000, undefined), /^En az 900\.000\.000 ₺$/);
    assert.match(priceRangeLabel(undefined, 5000), /^En çok 5\.000 ₺$/);
    assert.match(priceRangeLabel(1000, 2000), /^1\.000 – 2\.000 ₺$/);
  });
});
