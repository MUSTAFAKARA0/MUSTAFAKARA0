/**
 * KI-21 · Ofis panelinde abonelik durum şeridi (iskelet).
 *
 * Saf model: aboneliğin son satırından panelde gösterilecek şeridi üretir (yoksa null).
 * Durum tablosu: docs/OPS02_ABONELIK_DURUMLARI.md §2.
 *
 * METİNLER TASLAKTIR (D-05 kararı bekleniyor): iptal/süre dolumu sonrası verinin ne kadar saklanacağı ve
 * sitenin yayında kalıp kalmayacağı D-05'e bağlıdır. Kesin metin D-05 kararı ve sözleşme metniyle değişir;
 * o zamana kadar her metin `draft: true` taşır ve arayüz bunu görünür biçimde işaretler.
 */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';

export interface SubscriptionRow {
  status: SubscriptionStatus | string;
  trial_ends_at: string | null;
}

export interface SubscriptionStrip {
  status: SubscriptionStatus;
  tone: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  /** "Verilerinizi indirin" bağlantısı gösterilsin mi (yalnız dışa aktarma yetkisi olana) */
  exportLink: boolean;
  /** Metin D-05 kararıyla kesinleşecek (yer tutucu) */
  draft: true;
}

/** Ayarlar › Veri dışa aktarma bölümü */
export const EXPORT_ANCHOR = 'veri-disa-aktarma';
export const EXPORT_HREF = `/admin/ayarlar#${EXPORT_ANCHOR}`;

const DAY = 24 * 60 * 60 * 1000;

/** Deneme bitimine kalan tam gün (bugün bitiyorsa 0; geçmişse 0) */
export function trialDaysLeft(trialEndsAt: string | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  const end = Date.parse(trialEndsAt);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / DAY));
}

export function subscriptionStrip(row: SubscriptionRow | null, options: { canExport: boolean; now?: Date }): SubscriptionStrip | null {
  if (!row) return null;
  const now = options.now ?? new Date();
  switch (row.status) {
    case 'active':
      return null;
    case 'trialing': {
      const days = trialDaysLeft(row.trial_ends_at, now);
      return {
        status: 'trialing',
        tone: 'info',
        title: 'Deneme süresi',
        message: days === null ? 'Ofisiniz deneme sürümünde.' : days === 0 ? 'Deneme süreniz bugün bitiyor.' : `Deneme sürenizin bitmesine ${days} gün kaldı.`,
        exportLink: false,
        draft: true,
      };
    }
    case 'past_due':
      return {
        status: 'past_due',
        tone: 'warning',
        title: 'Ödeme bekleniyor',
        message: 'Aboneliğinizin ödemesi gecikti. Hizmetin kesintisiz sürmesi için ödemeyi tamamlayın.',
        exportLink: false,
        draft: true,
      };
    case 'cancelled':
    case 'expired':
      return {
        status: row.status,
        tone: 'danger',
        title: row.status === 'cancelled' ? 'Abonelik sona erdi' : 'Abonelik süresi doldu',
        message: options.canExport
          ? 'Verilerinizi indirerek saklayabilirsiniz.'
          : 'Verilerinizin bir kopyası için ofis yöneticinizle görüşün.',
        exportLink: options.canExport,
        draft: true,
      };
    default:
      return null;
  }
}
