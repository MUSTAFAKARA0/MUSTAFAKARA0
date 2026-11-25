/** Faz 2: ilan detayı bölüm gezintisi yalnızca bulunan bölümlerden kurulur. */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDetailSections, MIN_NAV_ITEMS } from '@/components/property/detail-nav-logic';

const ids = (p) => buildDetailSections(p).map((i) => i.id);

describe('Faz 2 › detay gezintisi', () => {
  test('DN-01 hiçbir isteğe bağlı bölüm yoksa yalnızca Özet ve Özellikler', () => {
    assert.deepEqual(ids({ description: false, features: false, map: false, similar: false }), ['ozet', 'ozellikler']);
    assert.ok(2 < MIN_NAV_ITEMS);
  });
  test('DN-02 tüm bölümler sayfa sırasıyla listelenir', () => {
    assert.deepEqual(ids({ description: true, features: true, map: true, similar: true }), ['ozet', 'aciklama', 'ozellikler', 'olanaklar', 'konum', 'benzer']);
  });
  test('DN-03 var olmayan bölüm listeye girmez', () => {
    assert.ok(!ids({ description: true, features: false, map: true, similar: false }).includes('olanaklar'));
    assert.ok(!ids({ description: true, features: false, map: true, similar: false }).includes('benzer'));
  });
  test('DN-04 etiketler Türkçe ve boş değildir', () => {
    for (const i of buildDetailSections({ description: true, features: true, map: true, similar: true })) assert.ok(i.label.length > 2);
  });
});

import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('Faz 2 › gezinti her detay düzeninde', () => {
  for (const f of ['immersive', 'information-first', 'map-first']) {
    test(`DN-05 ${f}: gezinti, iletişim çubukları ve #ozet çapası var`, () => {
      const code = read(`src/components/patterns/property-detail/${f}.tsx`);
      assert.ok(code.includes('{nav}') && code.includes('DetailSectionNav'));
      assert.ok(code.includes('DetailContactBars'));
      assert.ok(code.includes('id="ozet"'));
    });
  }
  test('DN-06 çubuklar iletişim kutusunu izler', () => {
    assert.ok(read('src/components/patterns/property-detail/parts.tsx').includes('id="iletisim-kutusu"'));
    assert.ok(read('src/components/property/property-detail-view.tsx').includes('id="iletisim-kutusu"'));
  });
});
