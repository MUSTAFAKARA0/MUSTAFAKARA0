/**
 * KI-21 · abonelik durum şeridi modeli (src/modules/billing/subscription-strip.ts).
 * Metinler D-05 kararına kadar taslaktır; burada yalnız davranış (hangi durumda şerit, ton, bağlantı) sınanır.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPORT_HREF, subscriptionStrip, trialDaysLeft } from '../../src/modules/billing/subscription-strip.ts';

const now = new Date('2026-10-31T12:00:00Z');

describe('KI-21 subscriptionStrip', () => {
  test('abonelik yoksa ve aktifse şerit yok', () => {
    assert.equal(subscriptionStrip(null, { canExport: true, now }), null);
    assert.equal(subscriptionStrip({ status: 'active', trial_ends_at: null }, { canExport: true, now }), null);
    assert.equal(subscriptionStrip({ status: 'bilinmeyen', trial_ends_at: null }, { canExport: true, now }), null);
  });

  test('deneme: kalan gün; bugün biterse 0; tarih yoksa genel metin; bağlantı yok', () => {
    const s = subscriptionStrip({ status: 'trialing', trial_ends_at: '2026-11-07T12:00:00Z' }, { canExport: true, now });
    assert.equal(s.tone, 'info');
    assert.match(s.message, /7 gün/);
    assert.equal(s.exportLink, false);
    assert.match(subscriptionStrip({ status: 'trialing', trial_ends_at: '2026-10-31T13:00:00Z' }, { canExport: true, now: new Date('2026-10-31T13:30:00Z') }).message, /bugün/);
    assert.match(subscriptionStrip({ status: 'trialing', trial_ends_at: null }, { canExport: true, now }).message, /deneme/);
    assert.equal(trialDaysLeft('2026-10-30T00:00:00Z', now), 0);
    assert.equal(trialDaysLeft('geçersiz', now), null);
  });

  test('ödeme gecikmesi uyarı tonunda; bağlantı yok', () => {
    const s = subscriptionStrip({ status: 'past_due', trial_ends_at: null }, { canExport: true, now });
    assert.equal(s.tone, 'warning');
    assert.equal(s.exportLink, false);
  });

  test('iptal ve süre dolumu: tehlike tonu; "verilerinizi indirin" yalnız dışa aktarma yetkisiyle', () => {
    for (const status of ['cancelled', 'expired']) {
      const yes = subscriptionStrip({ status, trial_ends_at: null }, { canExport: true, now });
      assert.equal(yes.tone, 'danger');
      assert.equal(yes.exportLink, true);
      const no = subscriptionStrip({ status, trial_ends_at: null }, { canExport: false, now });
      assert.equal(no.exportLink, false);
      assert.match(no.message, /yönetici/);
    }
    assert.equal(EXPORT_HREF, '/admin/ayarlar#veri-disa-aktarma');
  });

  test('her şerit taslak olarak işaretli (D-05)', () => {
    for (const status of ['trialing', 'past_due', 'cancelled', 'expired']) {
      assert.equal(subscriptionStrip({ status, trial_ends_at: null }, { canExport: true, now }).draft, true, status);
    }
  });
});
