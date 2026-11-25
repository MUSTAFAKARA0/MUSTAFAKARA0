/** Kaydırmayla giriş ve paralaks saf yardımcıları (reveal-logic.ts) */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTLE_EPSILON, lerp, normalizePointer, shouldForceReveal, shouldPend } from '../../src/components/karay/reveal-logic.ts';

describe('shouldPend', () => {
  test('"hareketi azalt": hiçbir zaman bekletmez', () => {
    assert.equal(shouldPend({ top: 5000 }, 900, true), false);
  });
  test('ekranda olan öğe bekletilmez (içerik atlamaz)', () => {
    assert.equal(shouldPend({ top: 120 }, 900, false), false);
    assert.equal(shouldPend({ top: 900 }, 900, false), false);
  });
  test('ekranın tamamen altındaki öğe bekletilir', () => {
    assert.equal(shouldPend({ top: 901 }, 900, false), true);
  });
});

describe('shouldForceReveal (güvenlik zamanlayıcısı)', () => {
  test('yalnızca şu an ekranda olan bekleyenleri gösterir', () => {
    assert.equal(shouldForceReveal({ top: 100, bottom: 300 }, 900), true);
    assert.equal(shouldForceReveal({ top: 1200, bottom: 1400 }, 900), false);
    assert.equal(shouldForceReveal({ top: -400, bottom: -10 }, 900), false);
  });
});

describe('paralaks yardımcıları', () => {
  test('normalizePointer -1..1 aralığına sıkıştırır', () => {
    assert.equal(normalizePointer(0, 1000), -1);
    assert.equal(normalizePointer(500, 1000), 0);
    assert.equal(normalizePointer(1000, 1000), 1);
    assert.equal(normalizePointer(5000, 1000), 1);
    assert.equal(normalizePointer(10, 0), 0);
  });
  test('lerp hedefe yaklaşır ve eşikte durur (boşta rAF yok)', () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = lerp(v, 1, 0.09);
    assert.ok(Math.abs(v - 1) < SETTLE_EPSILON);
  });
});
