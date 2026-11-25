/**
 * Tema imzaları (src/theme-engine/signature-css.ts) birim testleri — 24.11.2026.
 *
 *  - İmza CSS'i yalnızca kendi temasının sayfasına yazılır; başka temayı hedefleyen tek kural yoktur.
 *  - Hareket parçası yalnızca hareket dili açık sitede ([data-site-motion]) ve "hareketi azalt" tercihi yokken çalışır.
 *  - Animasyon kareleri yerleşimi yeniden hesaplatan özellik kullanmaz.
 *  - Dış kaynak yok: url() yalnızca satır içi data: SVG olabilir (CSP img-src data:).
 *  - Varsayılan Klasik sitenin tema CSS'i boş kalır.
 *
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNATURE } from '@/theme-engine/signature-css';
import { designCss } from '@/theme-engine/design-css';
import { THEME_IDS } from '@/theme-engine/ids';
import { resolveStyle } from '@/theme-engine/themes';

const themesIn = (css) => [...new Set([...css.matchAll(/data-site-theme='([a-z]+)'/g)].map((m) => m[1]))];
/** Kural blokları: "seçici{gövde}" — @-kuralları hariç */
const selectorsOf = (css) =>
  [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => !/^(from|to|\d+%|[\d%,\s]+)$/.test(s) && !s.startsWith('@'));

describe('Tema imzaları', () => {
  test('SI-01 her temanın imzası vardır (kapalı liste ile birebir)', () => {
    assert.deepEqual(Object.keys(SIGNATURE).sort(), [...THEME_IDS].sort());
  });

  for (const id of THEME_IDS) {
    const sig = SIGNATURE[id];
    test(`SI-02 ${id}: her kural yalnızca kendi temasını hedefler`, () => {
      for (const part of [sig.static ?? '', sig.motion ?? '']) {
        if (!part) continue;
        assert.deepEqual(themesIn(part), [id]);
        for (const sel of selectorsOf(part)) {
          for (const one of sel.split(/,(?![^(]*\))/)) {
            assert.ok(one.trim().startsWith(`[data-site-theme='${id}']`), `kapsam dışı seçici: ${one}`);
          }
        }
      }
    });

    test(`SI-03 ${id}: hareket kuralları [data-site-motion] ve hareketi-azalt koruması altındadır`, () => {
      const motion = sig.motion ?? '';
      for (const sel of selectorsOf(motion)) {
        assert.match(sel, /\[data-site-motion\]/, `hareket kuralı koruma dışı: ${sel}`);
      }
      const body = motion.replace(/@keyframes [a-z-]+\{(?:[^{}]*\{[^{}]*\})*\}/g, '');
      if (body) assert.ok(body.includes('prefers-reduced-motion:no-preference'), 'hareketi azalt koruması yok');
      // Kalıcı parçadaki geçişler de yalnızca hareketi-azalt tercihi yokken
      const stat = sig.static ?? '';
      for (const m of stat.matchAll(/transition:/g)) {
        const before = stat.slice(0, m.index);
        assert.ok(before.lastIndexOf('prefers-reduced-motion:no-preference') > before.lastIndexOf('}}'), 'koruma dışı geçiş');
      }
      assert.ok(!/animation:/.test(stat), 'kalıcı parçada animasyon olmamalı');
    });

    test(`SI-04 ${id}: animasyon kareleri yalnızca güvenli özellikleri değiştirir`, () => {
      const all = (sig.static ?? '') + (sig.motion ?? '');
      for (const kf of all.matchAll(/@keyframes ([a-z-]+)\{((?:[^{}]*\{[^{}]*\})*)\}/g)) {
        assert.match(kf[1], /^sig-/, 'imza kareleri sig- önekli');
        for (const decl of kf[2].matchAll(/\{([^{}]*)\}/g)) {
          for (const prop of decl[1].split(';').map((d) => d.split(':')[0].trim()).filter(Boolean)) {
            assert.ok(['transform', 'opacity', 'filter', 'clip-path', 'background-position'].includes(prop), `${kf[1]}: ${prop}`);
          }
        }
      }
    });

    test(`SI-09 ${id}: kullanılan her animasyonun karesi aynı parçada tanımlı; sonsuz döngü yok`, () => {
      for (const part of [sig.static ?? '', sig.motion ?? '']) {
        const defined = new Set([...part.matchAll(/@keyframes ([a-z-]+)\{/g)].map((m) => m[1]));
        for (const a of part.matchAll(/animation:([^;}]+)/g)) {
          for (const one of a[1].split(/,(?![^(]*\))/)) {
            const name = one.trim().split(/\s+/)[0];
            assert.ok(defined.has(name), `${id}: ${name} karesi tanımsız`);
          }
        }
        // WCAG 2.2.2: 5 sn'den uzun süren hareket duraklatılamıyorsa sonlu olmalı
        assert.ok(!/infinite/.test(part), `${id}: sonsuz animasyon`);
      }
    });

    test(`SI-05 ${id}: dış kaynak yok, yalnızca satır içi data: görsel`, () => {
      const all = (sig.static ?? '') + (sig.motion ?? '');
      for (const u of all.matchAll(/url\(\s*(["']?)([^)"']{0,12})/g)) assert.match(u[2], /^(data:|#|%23)/, `dış url: ${u[2]}`); // %23: data: SVG içindeki filtre başvurusu
      assert.ok(!/@import|expression\(|javascript:/i.test(all));
    });
  }

  test('SI-06 Klasik temanın kalıcı imzası boştur; varsayılan site CSS\'i boş kalır', () => {
    assert.equal(SIGNATURE.klasik.static ?? '', '');
    assert.equal(designCss('klasik', resolveStyle({ theme: 'klasik', style: {} })), '');
  });

  test('SI-07 hareket kapalıyken imzanın hareket parçası sayfaya yazılmaz', () => {
    for (const id of THEME_IDS) {
      const off = designCss(id, resolveStyle({ theme: id, style: { motion: 'none' } }));
      assert.ok(!off.includes('data-site-motion]'), `${id}: hareket kuralı yazıldı`);
      assert.ok(!/animation-timeline/.test(off), `${id}: kaydırma animasyonu yazıldı`);
      if (SIGNATURE[id].static) assert.ok(off.includes(SIGNATURE[id].static), `${id}: kalıcı imza eksik`);
      const on = designCss(id, resolveStyle({ theme: id, style: { motion: 'subtle' } }));
      if (SIGNATURE[id].motion) assert.ok(on.includes(SIGNATURE[id].motion), `${id}: hareket imzası eksik`);
    }
  });

  test('SI-08 bir temanın sayfasına başka temanın imzası girmez', () => {
    for (const id of THEME_IDS) {
      const css = designCss(id, resolveStyle({ theme: id, style: { motion: 'expressive' } }));
      for (const other of THEME_IDS.filter((o) => o !== id)) {
        assert.ok(!css.includes(`data-site-theme='${other}'`), `${id} sayfasında ${other}`);
      }
    }
  });

  test('SI-10 boyut bütçesi: her temanın kalıcı imzası <= 3,5 KB, hareket imzası <= 2,5 KB; her satır içi SVG < 700 bayt', () => {
    for (const id of THEME_IDS) {
      assert.ok((SIGNATURE[id].static ?? '').length <= 3500, `${id}: kalıcı imza ${(SIGNATURE[id].static ?? '').length} bayt`);
      assert.ok((SIGNATURE[id].motion ?? '').length <= 2500, `${id}: hareket imzası ${(SIGNATURE[id].motion ?? '').length} bayt`);
      for (const part of [SIGNATURE[id].static ?? '', SIGNATURE[id].motion ?? '']) for (const m of part.matchAll(/url\("data:image\/svg\+xml,([^"]*)"\)/g)) assert.ok(m[1].length < 700, `${id}: SVG ${m[1].length} bayt`);
    }
  });

  test('SI-11 tema kimlikleri yalnızca küçük harf (seçici kuralı [a-z]+); 15 tema', () => {
    for (const id of THEME_IDS) assert.match(id, /^[a-z]+$/, id);
    assert.equal(THEME_IDS.length, 15);
    assert.equal(new Set(THEME_IDS).size, 15);
  });

  test('SI-12 yeni temaların (deniz, plaza, tarla, miras, gece) imzası vardır; hareket kuralları yalnızca hareketi azalt tercihi yokken', () => {
    for (const id of ['deniz', 'plaza', 'tarla', 'miras', 'gece']) {
      assert.ok((SIGNATURE[id].static ?? '').length > 300, `${id}: kalıcı imza yok`);
      assert.ok((SIGNATURE[id].motion ?? '').includes('prefers-reduced-motion:no-preference'), `${id}: hareket imzası yok`);
      // Her animasyon bitişli (sonsuz değil) ve en fazla 5 sn süreli tek geçiş veya kısa giriş
      for (const a of (SIGNATURE[id].motion ?? '').matchAll(/animation:sig-[a-z-]+ ([\d.]+)s/g)) assert.ok(Number(a[1]) <= 5, `${id}: animasyon ${a[1]} sn`);
    }
  });

  test('SI-13 her animation: kısayolunda gecikme + süre × yineleme <= 5 sn; sonsuz yok (WCAG 2.2.2)', () => {
    const sec = (t) => (t.endsWith('ms') ? parseFloat(t) / 1000 : parseFloat(t));
    let checked = 0;
    for (const id of THEME_IDS) {
      for (const part of [SIGNATURE[id].static ?? '', SIGNATURE[id].motion ?? '']) {
        for (const a of part.matchAll(/animation:([^;}]+)/g)) {
          for (const one of a[1].split(/,(?![^(]*\))/)) {
            const tokens = one.replace(/cubic-bezier\([^)]*\)/g, 'ease').trim().split(/\s+/);
            const times = tokens.filter((t) => /^\d*\.?\d+m?s$/.test(t));
            if (times.length === 0) continue; // kaydırma/görünüm zaman çizelgeli (süre yok)
            const iter = tokens.find((t) => /^\d+$/.test(t) || t === 'infinite');
            assert.notEqual(iter, 'infinite', `${id}: ${one}`);
            const total = sec(times[1] ?? '0s') + sec(times[0]) * (iter ? Number(iter) : 1);
            assert.ok(total <= 5.001, `${id}: ${one.trim()} toplam ${total} sn`);
            checked++;
          }
        }
      }
    }
    assert.ok(checked > 30, `çok az animasyon denetlendi (${checked})`);
  });
});
