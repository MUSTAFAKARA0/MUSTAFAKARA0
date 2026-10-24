/**
 * K-18 P2 doğrulamaları:
 *  - singleLine: tek satırlık alanlarda kontrol karakteri ve satır sonu kalmaz (company_name,
 *    ofis şirket adı/unvan/slogan). Satır sonlu company_name, geri dönüş betiğinde yorumdan
 *    taşıyabiliyordu (92ad985); veri kaynağında da tek satır tutulur.
 *  - openingHoursSchema: bir satırdaki gün listesi en fazla 7 öğe ve tekil.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { singleLine } from '../../src/lib/single-line.ts';
import { openingHoursSchema } from '../../src/modules/content/hours-schema.ts';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('singleLine', () => {
  test('satır sonu, sekme, NUL ve C1 kontrol karakterleri boşluğa iner', () => {
    assert.equal(singleLine('X\ncreate table t();--'), 'X create table t();--');
    assert.equal(singleLine('A\r\n\tB\u0000C\u0085D E F\u007fG'), 'A B C D E F G');
  });
  test('olağan metin değişmez; uçlar kırpılır, ardışık boşluk teke iner', () => {
    assert.equal(singleLine('  Özel Unvan  A.Ş. '), 'Özel Unvan A.Ş.');
    assert.equal(singleLine('A&B <Emlak> "Ltd"'), 'A&B <Emlak> "Ltd"');
  });
  test('platform company_name ve ofis metin alanları singleLine kullanır', () => {
    assert.match(read('src/app/actions/karay-admin.ts'), /company_name: z\s*\.string\(\)\s*\.max\(160\)\s*\.transform\(singleLine\)/);
    assert.match(read('src/app/actions/admin-settings.ts'), /const clean = \(v: string\) => singleLine\(/);
  });
});

describe('openingHoursSchema (çalışma saatleri)', () => {
  const row = (days) => [{ days, opens: '09:00', closes: '18:00' }];

  test('olağan seçim kabul edilir ve haftanın sırasına göre tekilleşir', () => {
    assert.deepEqual(openingHoursSchema.parse(row(['fr', 'mo', 'mo', 'we']))[0].days, ['mo', 'we', 'fr']);
    assert.deepEqual(openingHoursSchema.parse(row(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']))[0].days.length, 7);
  });
  test('7 öğeden uzun gün listesi reddedilir (aynı gün tekrar tekrar gönderilse de)', () => {
    assert.equal(openingHoursSchema.safeParse(row(Array(8).fill('mo'))).success, false);
    assert.equal(openingHoursSchema.safeParse(row(Array(10000).fill('mo'))).success, false);
  });
  test('boş gün listesi, geçersiz gün ve ters saat reddedilir', () => {
    assert.equal(openingHoursSchema.safeParse(row([])).success, false);
    assert.equal(openingHoursSchema.safeParse(row(['xx'])).success, false);
    assert.equal(openingHoursSchema.safeParse([{ days: ['mo'], opens: '18:00', closes: '09:00' }]).success, false);
  });
  test('ayar eylemi bu şemayı kullanır', () => {
    assert.match(read('src/app/actions/admin-settings.ts'), /const hoursSchema = openingHoursSchema;/);
  });
});
