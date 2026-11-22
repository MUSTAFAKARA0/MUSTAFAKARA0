// Site düzenleyici formlarının "kaydedilmemiş değişiklik" denetimi anahtar sırasından bağımsız olmalı (PO-7 kök nedeni).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sameValue, stableJson } from '../../src/lib/same-value.ts';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('SV-01 sameValue', () => {
  test('aynı içerik, farklı anahtar sırası → aynı (kayıttan sonra sunucudan dönen değer)', () => {
    const local = { sticky: true, height: 'regular', brand: 'auto', mobile: { showPhone: false, showWhatsapp: true }, style: 'dark' };
    const fromServer = { sticky: true, style: 'dark', height: 'regular', brand: 'auto', mobile: { showWhatsapp: true, showPhone: false } };
    assert.notEqual(JSON.stringify(local), JSON.stringify(fromServer)); // eski denetim bunu "kaydedilmemiş" sanıyordu
    assert.equal(sameValue(local, fromServer), true);
  });
  test('gerçek farklar yakalanır: değer, eksik/fazla alan, dizi sırası', () => {
    assert.equal(sameValue({ style: 'dark' }, { style: 'light' }), false);
    assert.equal(sameValue({ a: 1 }, { a: 1, b: 2 }), false);
    assert.equal(sameValue([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }]), false);
    assert.equal(sameValue({ cta: undefined, a: 1 }, { a: 1 }), true); // JSON gibi: undefined alan yok sayılır
    assert.equal(sameValue(null, null), true);
    assert.equal(stableJson({ b: 1, a: { d: 1, c: 2 } }), '{"a":{"c":2,"d":1},"b":1}');
  });
  test('site düzenleyici formları sıraya duyarlı JSON.stringify karşılaştırması kullanmaz', () => {
    for (const f of ['src/components/site-editor/structure-forms.tsx', 'src/components/site-editor/appearance-forms.tsx', 'src/components/site-editor/brand-form.tsx']) {
      const code = read(f);
      assert.doesNotMatch(code, /JSON\.stringify\([^)]*\)\s*[!=]==\s*JSON\.stringify/, f);
      assert.match(code, /sameValue\(/, f);
    }
  });
});
