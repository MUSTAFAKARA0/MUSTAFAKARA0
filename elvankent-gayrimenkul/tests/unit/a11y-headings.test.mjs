/**
 * Erişilebilirlik: ilan listesi sayfasında başlık sırası h1 → h2 → h3 (Lighthouse "heading-order", 24.11.2026 ölçümü).
 * İlan kartlarının başlığı h3'tür; sonuç bölümü görünmez bir h2 ile adlandırılır (E2E seçicileri bölüm adını kullanır).
 * Çalıştırma: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../src/components/site/site-listing.tsx', import.meta.url), 'utf8');

test('AH-01 sonuç bölümü görünmez h2 ile adlandırılır; bölüm adı "Arama sonuçları" kalır', () => {
  assert.match(src, /<section id="sonuclar" aria-labelledby="sonuclar-baslik"/);
  assert.match(src, /<h2 id="sonuclar-baslik" className="sr-only">\s*Arama sonuçları\s*<\/h2>/);
  assert.ok(src.indexOf('<h1') < src.indexOf('<h2 id="sonuclar-baslik"'), 'h1, h2 den önce');
});
