/**
 * AİLE KATALOĞU SAF MANTIĞI (src/components/site-editor/family-catalog-logic.ts) — Faz 1.
 * Filtre, sıralama, segment sayıları, adres durumu gidiş-dönüşü ve sonuç sayacı metni.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '@/site-factory/catalog';
import { FAMILY_META } from '@/site-factory/catalog-meta';
import { SEGMENT_IDS } from '@/site-factory/catalog-segments';
import {
  DEFAULT_STATE,
  filterFamilies,
  fold,
  isDefaultState,
  parseState,
  resultText,
  segmentCounts,
  serializeState,
  sortFamilies,
  withPossessive,
} from '@/components/site-editor/family-catalog-logic';

const ITEMS = CATALOG.map((f, i) => ({ id: f.id, name: f.name, description: f.description, audience: f.audience, meta: FAMILY_META[f.id], recommended: ['plaza-ofis', 'klasik-guven'].includes(f.id), sites: 18 - i }));

describe('Filtre', () => {
  test('varsayılan durum hepsini döner; segment filtresi yalnızca o segmenti', () => {
    assert.equal(filterFamilies(ITEMS, DEFAULT_STATE).length, 18);
    const ticari = filterFamilies(ITEMS, { ...DEFAULT_STATE, segment: 'ticari' }).map((f) => f.id);
    assert.ok(ticari.includes('plaza-ofis') && ticari.includes('architectural') && ticari.includes('kurumsal-portfoy'));
    assert.ok(!ticari.includes('deniz-kiyisi'));
    for (const id of ticari) assert.ok(FAMILY_META[id].segments.includes('ticari'));
  });

  test('koyu tema anahtarı yalnızca koyu aileleri bırakır', () => {
    assert.deepEqual(filterFamilies(ITEMS, { ...DEFAULT_STATE, dark: true }).map((f) => f.id), ['gece-premium']);
  });

  test('metin araması ad, etiket ve kime uygun üzerinde; Türkçe harf ve aksan duyarsız; tüm kelimeler eşleşmeli', () => {
    const ids = (q) => filterFamilies(ITEMS, { ...DEFAULT_STATE, q }).map((f) => f.id);
    assert.deepEqual(ids('PLAZA'), ['plaza-ofis']);
    assert.ok(ids('harita').includes('map-first') && ids('harita').includes('arsa-tarla'));
    assert.ok(ids('yazlik').includes('deniz-kiyisi'), 'ı/ı duyarsız (yazlık)');
    assert.deepEqual(ids('kemer miras'), ['miras-konak']);
    assert.deepEqual(ids('xyzyok'), []);
    assert.equal(ids('   ').length, 18);
  });

  test('segment + metin + koyu birlikte (VE)', () => {
    assert.deepEqual(filterFamilies(ITEMS, { segment: 'villa-luks', q: 'parıltı', sort: 'recommended', dark: true }).map((f) => f.id), ['gece-premium']);
    assert.deepEqual(filterFamilies(ITEMS, { segment: 'arsa', q: 'kemer', sort: 'recommended', dark: false }), []);
  });

  test('fold: büyük/küçük harf, ı/İ ve aksanlar', () => {
    assert.equal(fold('ISLAK İzmir Çankaya'), fold('islak izmir cankaya'));
  });
});

describe('Sıralama ve sayılar', () => {
  test('önerilen önce (kararlı: katalog sırası korunur); A–Z Türkçe; kullanan site sayısı azalan', () => {
    const rec = sortFamilies(ITEMS, 'recommended').map((f) => f.id);
    assert.deepEqual(rec.slice(0, 2), ['klasik-guven', 'plaza-ofis']);
    assert.deepEqual(rec.slice(2), ITEMS.map((f) => f.id).filter((id) => !['klasik-guven', 'plaza-ofis'].includes(id)));
    const az = sortFamilies(ITEMS, 'az').map((f) => f.name);
    assert.deepEqual(az, [...az].sort((a, b) => a.localeCompare(b, 'tr')));
    const sites = sortFamilies(ITEMS, 'sites').map((f) => f.sites);
    assert.deepEqual(sites, [...sites].sort((a, b) => b - a));
  });

  test('sıralama girdiyi değiştirmez', () => {
    const before = ITEMS.map((f) => f.id).join();
    sortFamilies(ITEMS, 'az');
    assert.equal(ITEMS.map((f) => f.id).join(), before);
  });

  test('segment sayıları: her segment >= 1, toplam üst verideki segment sayısına eşit', () => {
    const counts = segmentCounts(ITEMS);
    for (const s of SEGMENT_IDS) assert.ok(counts[s] >= 1, s);
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), Object.values(FAMILY_META).reduce((a, m) => a + m.segments.length, 0));
  });
});

describe('Adres durumu', () => {
  test('gidiş-dönüş: serialize → parse aynı durumu verir; varsayılanlar yazılmaz', () => {
    assert.equal(serializeState(DEFAULT_STATE), '');
    const s = { segment: 'ticari', q: 'ofis harita', sort: 'az', dark: true };
    const qs = serializeState(s);
    assert.match(qs, /^segment=ticari&/);
    assert.deepEqual(parseState(new URLSearchParams(qs)), s);
    assert.ok(isDefaultState(DEFAULT_STATE) && !isDefaultState(s));
  });

  test('bilinmeyen/kötü değerler varsayılana düşer; uzun metin kırpılır; düz nesne de okunur', () => {
    const p = parseState(new URLSearchParams('segment=<script>&sirala=hack&koyu=evet&q=' + 'a'.repeat(200)));
    assert.equal(p.segment, 'all');
    assert.equal(p.sort, 'recommended');
    assert.equal(p.dark, false);
    assert.equal(p.q.length, 60);
    assert.deepEqual(parseState({ segment: 'arsa' }), { ...DEFAULT_STATE, segment: 'arsa' });
  });
});

describe('Sonuç sayacı (aria-live)', () => {
  test('Türkçe iyelik eki', () => {
    const want = { 1: "1'i", 2: "2'si", 3: "3'ü", 4: "4'ü", 5: "5'i", 6: "6'sı", 7: "7'si", 8: "8'i", 9: "9'u", 10: "10'u", 12: "12'si", 17: "17'si", 18: "18'i", 20: "20'si" };
    for (const [n, text] of Object.entries(want)) assert.equal(withPossessive(Number(n)), text);
  });
  test('metinler', () => {
    assert.equal(resultText(18, 18), '18 aile gösteriliyor');
    assert.equal(resultText(18, 5), "18 aileden 5'i gösteriliyor");
    assert.equal(resultText(18, 6), "18 aileden 6'sı gösteriliyor");
    assert.equal(resultText(18, 0), 'Eşleşen aile yok');
  });
});
