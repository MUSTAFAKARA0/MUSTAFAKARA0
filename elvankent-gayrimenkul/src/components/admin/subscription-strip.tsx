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
 * KI-21 · panelin üstündeki abonelik durum şeridi (iskelet).
 * Metinler D-05 kararına kadar TASLAK: `data-draft="D-05"` ve görünür "Taslak metin" etiketi taşır.
 */
export function SubscriptionStrip({ strip }: { strip: Strip | null }) {
  if (!strip) return null;
  return (
    <section
      aria-label="Abonelik durumu"
      data-subscription-status={strip.status}
      data-draft={strip.draft ? 'D-05' : undefined}
      className={cn('mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-[13.5px]', TONES[strip.tone])}
    >
      <p className="min-w-0">
        <strong className="font-bold">{strip.title}.</strong> {strip.message}
        {strip.draft && (
          <span className="ml-2 inline-block rounded border border-current px-1.5 py-px align-middle text-[11px] font-semibold uppercase tracking-wide opacity-80">
            Taslak metin · D-05
          </span>
        )}
      </p>
      {strip.exportLink && (
        <Link href={EXPORT_HREF} className="inline-flex items-center gap-1.5 font-bold underline underline-offset-2">
          <Download className="size-4" aria-hidden /> Verilerinizi indirin
        </Link>
      )}
    </section>
  );
}
