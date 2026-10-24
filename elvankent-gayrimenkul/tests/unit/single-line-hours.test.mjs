/**
 * K-18 P2 doğrulamaları:
 *  - singleLine: tek satırlık alanlarda kontrol karakteri ve satır sonu kalmaz (company_name,
 *    ofis şirket adı/unvan/slogan). Satır sonlu company_name, geri dönüş betiğinde yorumdan
 *    taşıyabiliyordu (92ad985); veri kaynağında da tek satır tutulur.
 *  - openingHoursSchema: bir satırdaki gün listesi en fazla 7 öğe ve tekil.
 * Şemalar sunucu eylemlerinin kullandığı modüllerden alınır; davranış doğrudan sınanır.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { singleLine } from '../../src/lib/single-line.ts';
import { openingHoursSchema } from '../../src/modules/content/hours-schema.ts';
import { companySchema } from '../../src/modules/content/settings-schema.ts';
import { companyNameSchema, profileSchema } from '../../src/modules/karay/profile-schema.ts';

const issue = (result) => (result.success ? null : result.error.issues[0]?.message);

describe('singleLine', () => {
  test('satır sonu, sekme, NUL ve C1 kontrol karakterleri boşluğa iner', () => {
    assert.equal(singleLine('X\ncreate table t();--'), 'X create table t();--');
    assert.equal(singleLine('A\r\n\tB\u0000C\u0085D E F\u007fG'), 'A B C D E F G');
  });
  test('olağan metin değişmez; uçlar kırpılır, ardışık boşluk teke iner', () => {
    assert.equal(singleLine('  Özel Unvan  A.Ş. '), 'Özel Unvan A.Ş.');
    assert.equal(singleLine('A&B <Emlak> "Ltd"'), 'A&B <Emlak> "Ltd"');
  });
});

describe('KARAYS şirket adı (platform_settings.company_name)', () => {
  test('tek satıra iner', () => {
    assert.equal(companyNameSchema.parse('KARAYS\nGayrimenkul'), 'KARAYS Gayrimenkul');
    assert.equal(companyNameSchema.parse('Çağlayan & Ortakları A.Ş.'), 'Çağlayan & Ortakları A.Ş.');
  });
  test('uzunluk hataları Türkçe', () => {
    assert.match(issue(companyNameSchema.safeParse(' K ')), /en az 2 karakter/);
    assert.match(issue(companyNameSchema.safeParse('K'.repeat(81))), /en fazla 80 karakter/);
  });
  test('eylemin şeması company_name için bu kuralı kullanır', () => {
    const base = { company_name: 'X\nY', tagline: '', contact_email: '', contact_phone: '', whatsapp: '', address: '', city: '', website_url: '', linkedin_url: '', instagram_url: '', x_url: '', youtube_url: '', seo_title: '', seo_description: '', indexable: true, lead_notify_emails: '' };
    assert.equal(profileSchema.parse(base).company_name, 'X Y');
  });
});

describe('Ofis şirket ayarları (companySchema)', () => {
  const valid = {
    display_name: 'Elvankent\nEmlak',
    legal_name: 'Elvankent  Emlak Ltd. Şti.',
    tagline: '<b>Güvenilir</b> emlak',
    primary_color: '#0f766e',
    accent_color: '#c2410c',
    phone: '',
    whatsapp: '',
    email: '',
    opening_hours: [{ days: ['fr', 'mo', 'mo'], opens: '09:00', closes: '18:00' }],
  };
  test('metin alanları tek satıra iner, < > silinir, saatler tekilleşir', () => {
    const out = companySchema.parse(valid);
    assert.equal(out.display_name, 'Elvankent Emlak');
    assert.equal(out.legal_name, 'Elvankent Emlak Ltd. Şti.');
    assert.equal(out.tagline, 'bGüvenilir/b emlak');
    assert.deepEqual(out.opening_hours[0].days, ['mo', 'fr']);
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
  test('ofis şirket ayarları bu şemayı kullanır (8 günlük satır reddedilir)', () => {
    const base = { display_name: 'Elvankent Emlak', primary_color: '#0f766e', accent_color: '#c2410c', phone: '', whatsapp: '', email: '' };
    assert.equal(companySchema.safeParse({ ...base, opening_hours: row(Array(8).fill('mo')) }).success, false);
    assert.equal(companySchema.safeParse({ ...base, opening_hours: row(['mo']) }).success, true);
  });
});
