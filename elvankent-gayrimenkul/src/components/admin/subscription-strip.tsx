import Link from '@/components/common/intent-link';
import { Download } from 'lucide-react';
import { EXPORT_HREF, type SubscriptionStrip as Strip } from '@/modules/billing/subscription-strip';
import { cn } from '@/lib/utils';

const TONES: Record<Strip['tone'], string> = {
  info: 'border-info/25 bg-info-soft text-info',
  warning: 'border-warning/25 bg-warning-soft text-warning',
  danger: 'border-danger/25 bg-danger-soft text-danger',
};

/**
 * KI-21 · panelin üstündeki abonelik durum şeridi (yalnız gösterim; yetki/limit değiştirmez).
 * Metinler D-04/D-05 kararlarına dayanır; kesin ifade sahibin onayına tabidir. Müşteriye görünür "taslak" etiketi
 * gösterilmez; dayanılan karar `data-policy`, aşama `data-subscription-state` olarak işaretlenir.
 */
export function SubscriptionStrip({ strip }: { strip: Strip | null }) {
  if (!strip) return null;
  return (
    <section
      aria-label="Abonelik durumu"
      data-subscription-status={strip.status}
      data-subscription-state={strip.state}
      data-policy={strip.policy}
      className={cn('mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-[13.5px]', TONES[strip.tone])}
    >
      <p className="min-w-0">
        <strong className="font-bold">{strip.title}.</strong> {strip.message}
      </p>
      {strip.exportLink && (
        <Link href={EXPORT_HREF} className="inline-flex items-center gap-1.5 font-bold underline underline-offset-2">
          <Download className="size-4" aria-hidden /> Verilerinizi indirin
        </Link>
      )}
    </section>
  );
}
