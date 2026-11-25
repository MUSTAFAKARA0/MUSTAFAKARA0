/**
 * ALTIN PARMAK İZİ (Aşama 1 güvenlik ağı): mevcut 9 tasarım ailesinin derlenmiş çıktısı, tema CSS'i,
 * öznitelikleri ve desen CSS'i bayt bayt aynı kalır. Yeni aile/tema/palet/desen eklemek bu
 * değerleri DEĞİŞTİRMEMELİDİR. Fixture yalnızca bilinçli bir tasarım değişikliğinde yenilenir:
 *   GOLDEN_UPDATE=1 node --import ./tests/unit/register-alias.mjs --conditions=react-server --test tests/unit/family-golden.test.mjs
 * Fixture eksikse test ASLA kendiliğinden yazmaz (başarısız olur); CI'da yenileme reddedilir.
 * Bilinçli değişiklikler: Faz 1 düzeltmesi — Rezidans imzasındaki 48 sn'lik sig-ken-burns tek geçişli 5 sn yapıldı
 * (WCAG 2.2.2) ve Atlas imzasındaki sig-pulse 2,6 sn × 2 → 2,4 sn × 2 yapıldı (toplam <= 5 sn); yalnızca
 * sinematik-vitrin (rezidans) ve map-first (atlas) CSS kayıtları değişti.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeGolden, EXISTING_IDS } from './fixtures/family-golden-compute.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/family-golden.json', import.meta.url));

describe('Mevcut 9 ailenin altın parmak izi', () => {
  const actual = computeGolden();
  if (process.env.GOLDEN_UPDATE === '1') {
    if (process.env.CI) throw new Error('CI içinde GOLDEN_UPDATE reddedildi');
    writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 2)}\n`);
  }
  if (!existsSync(FIXTURE)) throw new Error('fixture missing: tests/unit/fixtures/family-golden.json (otomatik üretilmez)');
  const golden = JSON.parse(readFileSync(FIXTURE, 'utf8'));

  test('fixture 9 aileyi kapsar', () => {
    assert.deepEqual(Object.keys(golden.families), EXISTING_IDS);
  });
  for (const id of EXISTING_IDS) {
    test(`${id}: derlenmiş tasarım, tema CSS'i, öznitelikler ve desen CSS'i değişmedi`, () => {
      assert.deepEqual(actual.families[id], golden.families[id]);
    });
  }
  test('mevcut desen ve etkileşim CSS parçaları değişmedi', () => {
    assert.deepEqual(actual.patternCss, golden.patternCss);
    assert.deepEqual(actual.interactionCss, golden.interactionCss);
  });
});
