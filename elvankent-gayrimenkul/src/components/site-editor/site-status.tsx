import { formatRelativeDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Canlı ↔ taslak durumu (KARAY Site Kontrol Merkezi ve ofis /admin/site ortak): kullanıcı neyin
 * yayında olduğunu düşünmek zorunda kalmaz. Sunucu bileşenidir; istemciye JS göndermez.
 */
export function SiteStatusCards({
  live,
  version,
  publishedAt,
  hasUnpublishedChanges,
  pendingLabels,
}: {
  live: boolean;
  version: number;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  pendingLabels: string[];
}) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2" data-testid="site-status">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', live ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden />
        <div className="min-w-0 text-[13.5px]">
          <p className="font-semibold text-foreground">Canlı site · {version > 0 ? `Sürüm ${version}` : 'Varsayılan görünüm'}</p>
          <p className="text-muted-foreground">{publishedAt ? `Son yayın ${formatRelativeDate(publishedAt)}` : 'Henüz yayın yapılmadı'} · ziyaretçiler bunu görür</p>
        </div>
      </div>
      <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', hasUnpublishedChanges ? 'border-amber-300 bg-amber-50' : 'border-border bg-surface')}>
        <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', hasUnpublishedChanges ? 'bg-amber-500' : 'bg-border-strong')} aria-hidden />
        <div className="min-w-0 text-[13.5px]">
          <p className={cn('font-semibold', hasUnpublishedChanges ? 'text-amber-900' : 'text-foreground')}>
            {hasUnpublishedChanges ? 'Taslak değişiklikler var' : 'Taslak canlı siteyle aynı'}
          </p>
          <p className={hasUnpublishedChanges ? 'text-amber-900/80' : 'text-muted-foreground'}>
            {hasUnpublishedChanges
              ? `${pendingLabels.length ? pendingLabels.join(', ') : 'Bölümler'} · önizleyip yayınlayın`
              : 'Değişiklikler önce taslağa kaydedilir; yayınlayana kadar canlı site değişmez'}
          </p>
        </div>
      </div>
    </div>
  );
}
