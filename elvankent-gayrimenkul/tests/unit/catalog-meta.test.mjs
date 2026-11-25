/**
 * KATALOG ÜST VERİSİ (src/site-factory/catalog-meta.ts) — Faz 1.
 *  - Her katalog ailesinin üst verisi var; bilinmeyen aile için üst veri yok.
 *  - Her segment en az bir ailede kullanılır; segment kimlikleri kapalı listededir.
 *  - Metinler kısa (<= 140 karakter) ve dürüst: kanıtlanamaz üstünlük/garanti ifadesi yok.
 *  - Koyu aile ↔ koyu palet tutarlı.
 */
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CATALOG } from '@/site-factory/catalog';
import { FAMILY_META } from '@/site-factory/catalog-meta';
import { SEGMENTS, SEGMENT_IDS } from '@/site-factory/catalog-segments';
import { findPalette } from '@/theme-engine/palettes';

const FORBIDDEN = /(^|\s)en (iyi|çok|hızlı|yüksek|büyük)\b|garanti|%\s?\d|\d\s?%|birinci|\blider\b|rakipsiz|kesin sonuç|dönüşüm|satış artır|\d+\s*(gün|saat|dakika) içinde/i;
const texts = (m) => [...m.tags, ...m.bestFor, ...(m.notFor ? [m.notFor] : []), ...m.mood];

describe('Katalog üst verisi', () => {
  test('her katalog ailesinin üst verisi var ve fazladan kayıt yok', () => {
    assert.deepEqual(Object.keys(FAMILY_META).sort(), CATALOG.map((f) => f.id).sort());
  });

  test('segment kimlikleri kapalı listede ve benzersiz; her segment en az bir ailede kullanılır', () => {
    assert.equal(new Set(SEGMENT_IDS).size, SEGMENT_IDS.length);
    assert.equal(SEGMENTS.length, 11);
    const used = new Set(Object.values(FAMILY_META).flatMap((m) => m.segments));
    for (const id of SEGMENT_IDS) assert.ok(used.has(id), `${id} hiçbir ailede yok`);
    for (const m of Object.values(FAMILY_META)) {
      assert.ok(m.segments.length >= 1 && m.segments.length <= 4);
      for (const s of m.segments) assert.ok(SEGMENT_IDS.includes(s), s);
      assert.equal(new Set(m.segments).size, m.segments.length);
    }
  });

  test('metinler <= 140 karakter ve dürüst (üstünlük, garanti, oran, süre vaadi yok)', () => {
    for (const [id, m] of Object.entries(FAMILY_META)) {
      const f = CATALOG.find((x) => x.id === id);
      for (const t of [...texts(m), f.description, f.audience]) {
        assert.ok(t.length <= 140 || t === f.description, `${id}: ${t.length} karakter: ${t}`);
        assert.ok(!FORBIDDEN.test(t), `${id}: kanıtlanamaz ifade: ${t}`);
      }
      assert.ok(f.description.length <= 260, `${id}: açıklama uzun`);
      assert.ok(m.bestFor.length >= 1 && m.tags.length >= 1 && m.mood.length >= 1, id);
    }
  });

  test('koyu aile ↔ koyu palet tutarlı; yalnızca koyu paletli aileler koyu segmentte', () => {
    for (const f of CATALOG) {
      const dark = findPalette(f.palette)?.scheme === 'dark';
      assert.equal(FAMILY_META[f.id].contrast === 'dark', dark, f.id);
      assert.equal(FAMILY_META[f.id].segments.includes('koyu'), dark, f.id);
    }
  });

  test('yoğunluk değerleri kapalı liste', () => {
    for (const m of Object.values(FAMILY_META)) assert.ok(['airy', 'balanced', 'dense'].includes(m.density));
  });

  test('FAMILY_META sunucuya özel: yalnızca server-only modül ve sunucu dosyaları içe aktarır; istemci bileşenleri catalog-segments kullanır', () => {
    const read = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
    assert.match(read('site-factory/catalog-meta.ts'), /^import 'server-only';/);
    for (const f of ['components/site-editor/family-card.tsx', 'components/site-editor/family-filters.tsx', 'components/site-editor/family-catalog.tsx', 'components/site-editor/family-catalog-logic.ts', 'components/site-editor/design-family-picker.tsx', 'components/platform/site-wizard/site-wizard.tsx', 'components/platform/site/family-catalog-admin.tsx']) {
      assert.ok(!/site-factory\/catalog-meta/.test(read(f)), `${f} catalog-meta içe aktarıyor`);
    }
  });

  test('dürüst anlatım: kurumsal-zincir "çok şubeli/franchise" yeteneği vaat etmez; gece-premium galeriyi "tam genişlik" diye anlatır', () => {
    const z = CATALOG.find((f) => f.id === 'kurumsal-zincir');
    const all = [z.description, z.audience, ...texts(FAMILY_META['kurumsal-zincir'])].join(' ');
    assert.ok(!/çok şubeli|franchise|zincir ağ|şube/i.test(all), all);
    const g = CATALOG.find((f) => f.id === 'gece-premium');
    assert.match(g.description, /tam genişlik galeri/);
    assert.ok(!/kaydırmalı/.test(g.description));
  });
});
