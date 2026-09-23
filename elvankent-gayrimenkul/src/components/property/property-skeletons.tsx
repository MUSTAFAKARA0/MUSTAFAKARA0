import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-6 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <div className="flex gap-3 border-t border-line pt-3.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>
    </div>
  );
}

export function PropertyGridSkeleton({ count = 6, columns = 3 }: { count?: number; columns?: 3 | 4 }) {
  return (
    <div
      role="status"
      aria-label="İlanlar yükleniyor"
      className={cn('grid gap-5 sm:grid-cols-2 sm:gap-6', columns === 3 ? 'xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4')}
    >
      {Array.from({ length: count }, (_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}
