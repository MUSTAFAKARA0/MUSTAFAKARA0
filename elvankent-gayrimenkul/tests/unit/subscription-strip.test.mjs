/**
 * KI-21 · abonelik durum şeridi modeli (src/modules/billing/subscription-strip.ts).
 * Durum → metin eşlemesi D-04 (7 gün ek süre) ve D-05 (dönem sonu + 14 gün salt okunur + askı) kararlarına göre sınanır;
 * açık alt kararların (hatırlatma zamanı, kısıt türü, salt okunur kapsamı, saklama süresi) vaat edilmediği de denetlenir.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPORT_HREF,
  PAST_DUE_GRACE_DAYS,
  READ_ONLY_DAYS,
  calendarDay,
  subscriptionStrip,
  trialDaysLeft,
  trialEnded,
} from '../../src/modules/billing/subscription-strip.ts';

// 31.10.2026 15:00 İstanbul
const now = new Date('2026-10-31T12:00:00Z');
const row = (fields) => ({ trial_ends_at: null, renewal_at: null, cancelled_at: null, started_at: null, updated_at: null, ...fields });
const strip = (fields, canExport = true, at = now) => subscriptionStrip(row(fields), { canExport, now: at });

// Hiçbir metin açık alt kararları vaat etmemeli (saat, kanal, kısıt türü, saklama süresi, silme tarihi)
const FORBIDDEN = [/saat\s*\d/i, /e-posta|sms|telefon/i, /bakım modu/i, /yeni kayıt/i, /\bsilinecek\b/i, /saklan(ır|acak)/i, /404/];
function assertNoPromises(s) {
  for (const re of FORBIDDEN) assert.doesNotMatch(s.message, re, `${s.state}: ${s.message}`);
}

describe('KI-21 subscriptionStrip', () => {
  test('abonelik yoksa, aktifse (iptal bildirimi yoksa) ve bilinmeyen durumda şerit yok', () => {
    assert.equal(subscriptionStrip(null, { canExport: true, now }), null);
    assert.equal(strip({ status: 'active' }), null);
    assert.equal(strip({ status: 'active', renewal_at: '2026-12-01T00:00:00Z' }), null);
    assert.equal(strip({ status: 'bilinmeyen' }), null);
  });

  test('deneme: takvim günüyle kalan gün; tarih yoksa genel metin; bağlantı yok', () => {
    const s = strip({ status: 'trialing', trial_ends_at: '2026-11-07T12:00:00Z' });
    assert.equal(s.state, 'trialing');
    assert.equal(s.tone, 'info');
    assert.equal(s.message, 'Deneme sürenizin bitmesine 7 gün kaldı.');
    assert.equal(s.exportLink, false);
    assert.equal(strip({ status: 'trialing' }).message, 'Ofisiniz deneme sürümünde.');
    assert.equal(trialDaysLeft('geçersiz', now), null);
  });

  test('deneme: "bugün bitiyor" yalnız gerçekten bugün (İstanbul) bitiyorsa', () => {
    // 31.10 23:30 İstanbul'da bitiyor, şu an 15:00
    assert.equal(strip({ status: 'trialing', trial_ends_at: '2026-10-31T20:30:00Z' }).message, 'Deneme süreniz bugün bitiyor.');
    // Ertesi gün 00:30 İstanbul: bugün değil, 1 gün
    assert.equal(strip({ status: 'trialing', trial_ends_at: '2026-10-31T21:30:00Z' }).message, 'Deneme sürenizin bitmesine 1 gün kaldı.');
  });

  test('biten deneme: "bugün bitiyor" DEĞİL; kısıt vaat etmeyen nötr metin (kalıcı olarak bugün bitiyor hatası yok)', () => {
    for (const ended of ['2026-10-31T11:59:00Z', '2026-10-30T00:00:00Z', '2026-06-01T00:00:00Z']) {
      const s = strip({ status: 'trialing', trial_ends_at: ended });
      assert.equal(s.state, 'trial_ended', ended);
      assert.equal(s.title, 'Deneme süresi sona erdi');
      assert.equal(
        s.message,
        'Deneme süreniz sona erdi. Aboneliğinizle ilgili KARAYS sizinle iletişime geçecek; dilerseniz siz de KARAYS ile iletişime geçebilirsiniz.',
      );
      assert.doesNotMatch(s.message, /bugün|kısıt|askı|salt okunur|kapan/i);
      assert.equal(s.tone, 'info');
      assert.equal(s.exportLink, false);
      assert.equal(trialDaysLeft(ended, now), null);
      assert.equal(trialEnded(ended, now), true);
    }
    assert.equal(trialEnded(null, now), false);
  });

  test('D-04 ödeme gecikmesi: 7 takvim günü ek süre, kalan gün ve tarih; site/panel çalışır; bağlantı yok', () => {
    assert.equal(PAST_DUE_GRACE_DAYS, 7);
    // Gecikme 29.10'da başladı → son gün 05.11 → 5 gün
    const s = strip({ status: 'past_due', updated_at: '2026-10-29T07:00:00Z' });
    assert.equal(s.state, 'past_due_grace');
    assert.equal(s.tone, 'warning');
    assert.equal(s.policy, 'D-04');
    assert.equal(s.exportLink, false);
    assert.equal(
      s.message,
      'Aboneliğinizin ödemesi gecikti. 5 gün ek süreniz var (5 Kasım 2026 tarihine kadar); bu sürede site ve panel çalışmaya devam eder. Kesinti yaşamamak için ödemeyi tamamlayın.',
    );
    // Başlangıç bilinmiyorsa (updated_at yok) started_at kullanılır
    assert.match(strip({ status: 'past_due', started_at: '2026-10-31T06:00:00Z' }).message, /7 gün ek süreniz var/);
    // Hiç tarih yoksa genel metin
    assert.match(strip({ status: 'past_due' }).message, /7 günlük ek süre boyunca site ve panel çalışmaya devam eder/);
    assertNoPromises(s);
  });

  test('D-04: ek sürenin son günü "bugün"; ertesi gün kısıt "uygulanabilir" (türü/zamanı vaat edilmez)', () => {
    const today = strip({ status: 'past_due', updated_at: '2026-10-24T09:00:00Z' });
    assert.equal(today.state, 'past_due_grace');
    assert.match(today.message, /Ek süreniz bugün sona eriyor; bu sürede site ve panel çalışmaya devam eder/);
    const over = strip({ status: 'past_due', updated_at: '2026-10-23T09:00:00Z' });
    assert.equal(over.state, 'past_due_overdue');
    assert.equal(over.tone, 'danger');
    assert.equal(over.title, 'Ödeme gecikti');
    assert.equal(
      over.message,
      'Ödeme için tanınan 7 günlük ek süre doldu. Hesabınıza kısıtlama uygulanabilir; verileriniz otomatik olarak silinmez. Lütfen ödemeyi en kısa sürede tamamlayın.',
    );
    assert.equal(over.exportLink, false);
    assertNoPromises(over);
  });

  test('D-05 iptal bildirildi, dönem sürüyor (active + cancelled_at): tam erişim, sonra 14 gün salt okunur; dışa aktarma', () => {
    const s = strip({ status: 'active', cancelled_at: '2026-10-20T10:00:00Z', renewal_at: '2026-11-15T09:00:00Z' });
    assert.equal(s.state, 'cancel_scheduled');
    assert.equal(s.policy, 'D-05');
    assert.equal(s.tone, 'warning');
    assert.equal(s.exportLink, true);
    assert.equal(
      s.message,
      'Aboneliğiniz 15 Kasım 2026 tarihinde sona erecek. O zamana kadar tüm özellikler açık kalır; ardından 14 gün boyunca hesabınıza salt okunur erişiminiz olur. Verilerinizi dilediğiniz zaman indirebilirsiniz.',
    );
    const noDate = strip({ status: 'active', cancelled_at: '2026-10-20T10:00:00Z' }, false);
    assert.match(noDate.message, /^Aboneliğiniz ödenmiş dönemin sonunda sona erecek\./);
    assert.match(noDate.message, /ofis yöneticinizle görüşün\.$/);
    assert.equal(noDate.exportLink, false);
    assertNoPromises(s);
  });

  test('D-05 salt okunur süre: dönem sonu + 14 takvim günü, kalan gün; sonra askı; otomatik silme yok', () => {
    assert.equal(READ_ONLY_DAYS, 14);
    // active + cancelled_at, dönem 25.10'da bitti → son gün 08.11 → 8 gün
    const a = strip({ status: 'active', cancelled_at: '2026-10-01T10:00:00Z', renewal_at: '2026-10-25T09:00:00Z' });
    assert.equal(a.state, 'read_only');
    assert.equal(a.tone, 'danger');
    assert.equal(a.exportLink, true);
    assert.equal(
      a.message,
      'Abonelik döneminiz sona erdi. Hesabınızın 14 günlük salt okunur erişim süresi 8 Kasım 2026 tarihinde bitiyor (8 gün kaldı). Ardından hesap askıya alınır; verileriniz otomatik olarak silinmez. Bu süre içinde verilerinizi indirmenizi öneririz.',
    );
    // cancelled: dönem sonu = cancelled_at (renewal_at gelecekteyse kullanılmaz)
    const c = strip({ status: 'cancelled', cancelled_at: '2026-10-17T10:00:00Z', renewal_at: '2027-01-01T00:00:00Z' });
    assert.equal(c.state, 'read_only');
    assert.match(c.message, /süresi bugün bitiyor\./);
    // expired: dönem sonu = geçmişteki renewal_at, yoksa updated_at
    assert.match(strip({ status: 'expired', renewal_at: '2026-10-30T00:00:00Z' }).message, /13 gün kaldı/);
    assert.match(strip({ status: 'expired', updated_at: '2026-10-31T08:00:00Z' }).message, /14 gün kaldı/);
    // Tarih hiç yoksa genel metin
    assert.match(strip({ status: 'expired' }).message, /14 gün boyunca salt okunur erişiminiz olur; ardından hesap askıya alınır/);
    for (const s of [a, c]) assertNoPromises(s);
  });

  test('D-05 salt okunur süre bitti: askıya alınacak; dışa aktarma hâlâ önerilir', () => {
    const s = strip({ status: 'cancelled', cancelled_at: '2026-10-10T10:00:00Z' });
    assert.equal(s.state, 'read_only_ended');
    assert.equal(
      s.message,
      'Salt okunur erişim süresi doldu; hesabınız askıya alınacak. Verileriniz otomatik olarak silinmez. Verilerinizi hâlâ indirebilirsiniz.',
    );
    assert.equal(s.exportLink, true);
    assertNoPromises(s);
  });

  test('"Verilerinizi indirin" yalnız dışa aktarma yetkisiyle; yetkisize yönetici yönlendirmesi', () => {
    for (const status of ['cancelled', 'expired']) {
      const yes = strip({ status, updated_at: '2026-10-30T00:00:00Z' }, true);
      assert.equal(yes.exportLink, true);
      const no = strip({ status, updated_at: '2026-10-30T00:00:00Z' }, false);
      assert.equal(no.exportLink, false);
      assert.match(no.message, /ofis yöneticinizle görüşün/);
    }
    assert.equal(EXPORT_HREF, '/admin/ayarlar#veri-disa-aktarma');
  });

  test('müşteriye görünür taslak işareti yok; her şeridin dayandığı karar policy alanında', () => {
    const cases = [
      [{ status: 'trialing', trial_ends_at: '2026-11-07T12:00:00Z' }, 'D-03'],
      [{ status: 'trialing', trial_ends_at: '2026-10-01T00:00:00Z' }, 'D-03'],
      [{ status: 'past_due', updated_at: '2026-10-30T00:00:00Z' }, 'D-04'],
      [{ status: 'active', cancelled_at: '2026-10-30T00:00:00Z' }, 'D-05'],
      [{ status: 'cancelled', cancelled_at: '2026-10-30T00:00:00Z' }, 'D-05'],
    ];
    for (const [fields, policy] of cases) {
      const s = strip(fields);
      assert.equal(s.policy, policy, fields.status);
      assert.equal('draft' in s, false);
      assert.doesNotMatch(`${s.title} ${s.message}`, /taslak|D-0\d/i);
    }
  });

  test('takvim günü İstanbul saatine göre', () => {
    // 31.10 23:59 İstanbul ve 01.11 00:01 İstanbul farklı günler
    assert.equal(calendarDay(new Date('2026-10-31T21:01:00Z')) - calendarDay(new Date('2026-10-31T20:59:00Z')), 1);
  });
});
