/** Hero vurgulu satır zamanlaması: toplam otomatik hareket 5 sn'yi geçmez ve durağan cümleyle biter (WCAG 2.2.2) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotorSchedule } from '../../src/components/karay/rotor-logic.ts';
import { readFileSync } from 'node:fs';

// content.ts lucide simgelerini içe aktarır (react-server koşulunda yüklenmez): sözcük listesi kaynaktan okunur
const source = readFileSync(new URL('../../src/components/karay/content.ts', import.meta.url), 'utf8');
const PANEL_WORDS = [...source.match(/PANEL_WORDS = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('rotorSchedule: toplam süre <= 5000 ms, sıra tüm sözcükleri kapsar, durağan halle biter', () => {
  const s = rotorSchedule(PANEL_WORDS, 900);
  assert.ok(s.total <= 5000, `${s.total} ms`);
  assert.equal(s.endsStatic, true);
  assert.deepEqual(s.steps.map((x) => x.index), PANEL_WORDS.map((_, i) => i));
  assert.deepEqual(s.steps.map((x) => x.at), PANEL_WORDS.map((_, i) => i * 900));
});

test('rotorSchedule: boş liste güvenli', () => {
  assert.deepEqual(rotorSchedule([], 900), { steps: [], total: 0, endsStatic: true });
});
