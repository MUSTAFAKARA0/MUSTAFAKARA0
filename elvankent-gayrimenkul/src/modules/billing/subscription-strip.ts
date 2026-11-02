/**
 * KI-21 · Ofis panelinde abonelik durum şeridi.
 *
 * Saf model: aboneliğin son satırından panelde gösterilecek şeridi üretir (yoksa null). YALNIZ GÖSTERİM:
 * hiçbir yetki/limit kararı buradan çıkmaz (platform_settings.enforce_subscription_limits kapalı kalır).
 * Durum tablosu: docs/OPS02_ABONELIK_DURUMLARI.md §2 ve §5.
 *
 * Metinler sahip kararlarına dayanır (01.11.2026, K-33):
 *  - D-04: ödeme gecikmesinde 7 takvim günü ek süre; bu sürede site ve panel çalışır; sonra kısıtlama UYGULANABİLİR.
 *  - D-05: iptalde ödenmiş dönemin sonuna kadar tam erişim, ardından 14 gün salt okunur, sonra askı.
 *  - Her ikisinde de otomatik veri silme yok.
 * Açık alt kararlar (OPS02 §5.3) metinlerde VAAT EDİLMEZ: hatırlatma zamanları/kanalı, 7 gün sonrası kısıtın türü,
 * "salt okunur"un kapsamı, askıdaki sitenin görünümü, saklama süresi. Kesin metin sahibin onayına tabidir
 * (müşteriye görünür taslak etiketi yok; izlenebilirlik için `policy` alanı `data-policy` olarak işlenir).
 *
 * Yalnız canlı şemadaki sütunlar kullanılır (subscriptions: status, trial_ends_at, renewal_at, cancelled_at,
 * started_at, updated_at). Ayrı bir "gecikme başlangıcı" ya da "dönem sonu" sütunu yoktur; yaklaşımlar:
 *  - Gecikme başlangıcı = satırın son değişimi (updated_at; yoksa started_at). KARAY konsolu durumu değiştirirken yeni satır
 *    açar (platform_set_org_plan), doğrudan güncellemede updated_at tetikleyicisi zamanı yazar.
 *  - Ödenmiş dönemin sonu = renewal_at. İptal bildirimi = `active` + cancelled_at (OPS02 §5.2).
 */
import { formatDate } from '@/lib/format';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';

/** Şeridin gösterdiği aşama */
export type StripState =
  | 'trialing'
  | 'trial_ended'
  | 'past_due_grace'
  | 'past_due_overdue'
  | 'cancel_scheduled'
  | 'read_only'
  | 'read_only_ended';

export interface SubscriptionRow {
  status: SubscriptionStatus | string;
  trial_ends_at: string | null;
  renewal_at?: string | null;
  cancelled_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
}

export interface SubscriptionStrip {
  state: StripState;
  status: SubscriptionStatus;
  tone: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  /** "Verilerinizi indirin" bağlantısı gösterilsin mi (yalnız dışa aktarma yetkisi olana) */
  exportLink: boolean;
  /** Metnin dayandığı karar (izlenebilirlik; arayüzde görünmez) */
  policy: 'D-03' | 'D-04' | 'D-05';
}

/** Ayarlar › Veri dışa aktarma bölümü (dışa aktarma rotası: /api/admin/export/[entity]) */
export const EXPORT_ANCHOR = 'veri-disa-aktarma';
export const EXPORT_HREF = `/admin/ayarlar#${EXPORT_ANCHOR}`;

/** D-04: ödeme gecikmesinde ek süre (takvim günü) */
export const PAST_DUE_GRACE_DAYS = 7;
/** D-05: dönem sonundan sonra salt okunur süre (takvim günü) */
export const READ_ONLY_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;
const TZ = 'Europe/Istanbul';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

/** İstanbul takvimine göre gün numarası (takvim günü farkı için) */
export function calendarDay(date: Date): number {
  return Math.round(Date.parse(`${dayKey.format(date)}T00:00:00Z`) / DAY);
}

/** Gün numarasını gösterilecek tarihe çevirir (öğlen UTC = İstanbul'da aynı gün) */
function dayToDate(day: number): Date {
  return new Date(day * DAY + 12 * 60 * 60 * 1000);
}

/**
 * Deneme bitimine kalan takvim günü: bugün bitiyorsa 0; bitmişse ya da tarih yoksa/geçersizse null.
 * (Bitmiş deneme "bugün bitiyor" sayılmaz; trialEnded ile ayrıca sorulur.)
 */
export function trialDaysLeft(trialEndsAt: string | null, now: Date): number | null {
  const end = parse(trialEndsAt);
  if (!end || end.getTime() <= now.getTime()) return null;
  return calendarDay(end) - calendarDay(now);
}

export function trialEnded(trialEndsAt: string | null, now: Date): boolean {
  const end = parse(trialEndsAt);
  return !!end && end.getTime() <= now.getTime();
}

const exportHint = (canExport: boolean, withAdvice: string) =>
  canExport ? withAdvice : 'Verilerinizin bir kopyası için ofis yöneticinizle görüşün.';

function readOnlyStrip(status: SubscriptionStatus, periodEnd: Date | null, now: Date, canExport: boolean): SubscriptionStrip {
  const base = { status, tone: 'danger' as const, title: 'Abonelik sona erdi', exportLink: canExport, policy: 'D-05' as const };
  const advice = exportHint(canExport, 'Bu süre içinde verilerinizi indirmenizi öneririz.');
  if (!periodEnd) {
    return {
      ...base,
      state: 'read_only',
      message: `Abonelik döneminiz sona erdi. Hesabınıza ${READ_ONLY_DAYS} gün boyunca salt okunur erişiminiz olur; ardından hesap askıya alınır. Verileriniz otomatik olarak silinmez. ${advice}`,
    };
  }
  const lastDay = calendarDay(periodEnd) + READ_ONLY_DAYS;
  const left = lastDay - calendarDay(now);
  if (left < 0) {
    return {
      ...base,
      state: 'read_only_ended',
      message: `Salt okunur erişim süresi doldu; hesabınız askıya alınacak. Verileriniz otomatik olarak silinmez. ${exportHint(canExport, 'Verilerinizi hâlâ indirebilirsiniz.')}`,
    };
  }
  const when = left === 0 ? 'bugün bitiyor' : `${formatDate(dayToDate(lastDay))} tarihinde bitiyor (${left} gün kaldı)`;
  return {
    ...base,
    state: 'read_only',
    message: `Abonelik döneminiz sona erdi. Hesabınızın ${READ_ONLY_DAYS} günlük salt okunur erişim süresi ${when}. Ardından hesap askıya alınır; verileriniz otomatik olarak silinmez. ${advice}`,
  };
}

export function subscriptionStrip(row: SubscriptionRow | null, options: { canExport: boolean; now?: Date }): SubscriptionStrip | null {
  if (!row) return null;
  const now = options.now ?? new Date();
  const { canExport } = options;
  switch (row.status) {
    case 'active': {
      // D-05: iptal bildirildi (cancelled_at), abonelik ödenmiş dönem boyunca `active` kalır
      if (!parse(row.cancelled_at)) return null;
      const periodEnd = parse(row.renewal_at);
      if (periodEnd && periodEnd.getTime() <= now.getTime()) return readOnlyStrip('active', periodEnd, now, canExport);
      const until = periodEnd ? `${formatDate(periodEnd)} tarihinde` : 'ödenmiş dönemin sonunda';
      return {
        state: 'cancel_scheduled',
        status: 'active',
        tone: 'warning',
        title: 'Abonelik iptal edildi',
        message: `Aboneliğiniz ${until} sona erecek. O zamana kadar tüm özellikler açık kalır; ardından ${READ_ONLY_DAYS} gün boyunca hesabınıza salt okunur erişiminiz olur. ${exportHint(canExport, 'Verilerinizi dilediğiniz zaman indirebilirsiniz.')}`,
        exportLink: canExport,
        policy: 'D-05',
      };
    }
    case 'trialing': {
      // Deneme kendiliğinden `expired` olmaz (OPS02 §5.3 #7); biten deneme kısıt vaat etmeyen nötr metin alır
      if (trialEnded(row.trial_ends_at, now)) {
        return {
          state: 'trial_ended',
          status: 'trialing',
          tone: 'info',
          title: 'Deneme süresi sona erdi',
          message: 'Deneme süreniz sona erdi. Aboneliğinizle ilgili KARAYS sizinle iletişime geçecek; dilerseniz siz de KARAYS ile iletişime geçebilirsiniz.',
          exportLink: false,
          policy: 'D-03',
        };
      }
      const days = trialDaysLeft(row.trial_ends_at, now);
      return {
        state: 'trialing',
        status: 'trialing',
        tone: 'info',
        title: 'Deneme süresi',
        message: days === null ? 'Ofisiniz deneme sürümünde.' : days === 0 ? 'Deneme süreniz bugün bitiyor.' : `Deneme sürenizin bitmesine ${days} gün kaldı.`,
        exportLink: false,
        policy: 'D-03',
      };
    }
    case 'past_due': {
      const since = parse(row.updated_at) ?? parse(row.started_at);
      const base = { status: 'past_due' as const, exportLink: false, policy: 'D-04' as const };
      if (!since) {
        return {
          ...base,
          state: 'past_due_grace',
          tone: 'warning',
          title: 'Ödeme bekleniyor',
          message: `Aboneliğinizin ödemesi gecikti. ${PAST_DUE_GRACE_DAYS} günlük ek süre boyunca site ve panel çalışmaya devam eder. Kesinti yaşamamak için ödemeyi tamamlayın.`,
        };
      }
      const lastDay = calendarDay(since) + PAST_DUE_GRACE_DAYS;
      const left = lastDay - calendarDay(now);
      if (left < 0) {
        return {
          ...base,
          state: 'past_due_overdue',
          tone: 'danger',
          title: 'Ödeme gecikti',
          message: `Ödeme için tanınan ${PAST_DUE_GRACE_DAYS} günlük ek süre doldu. Hesabınıza kısıtlama uygulanabilir; verileriniz otomatik olarak silinmez. Lütfen ödemeyi en kısa sürede tamamlayın.`,
        };
      }
      const when = left === 0 ? 'Ek süreniz bugün sona eriyor' : `${left} gün ek süreniz var (${formatDate(dayToDate(lastDay))} tarihine kadar)`;
      return {
        ...base,
        state: 'past_due_grace',
        tone: 'warning',
        title: 'Ödeme bekleniyor',
        message: `Aboneliğinizin ödemesi gecikti. ${when}; bu sürede site ve panel çalışmaya devam eder. Kesinti yaşamamak için ödemeyi tamamlayın.`,
      };
    }
    case 'cancelled':
    case 'expired': {
      // Dönem sonu: geçmişteki renewal_at; yoksa durumun değiştiği an (cancelled_at, updated_at)
      const renewal = parse(row.renewal_at);
      const periodEnd =
        (renewal && renewal.getTime() <= now.getTime() ? renewal : null) ??
        (row.status === 'cancelled' ? parse(row.cancelled_at) : null) ??
        parse(row.updated_at);
      return readOnlyStrip(row.status, periodEnd, now, canExport);
    }
    default:
      return null;
  }
}
