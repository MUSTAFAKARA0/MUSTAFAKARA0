import { Skeleton } from '@/components/ui/skeleton';

export function PropertyCardSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      <Skeleton className="mt-4 h-6 w-2/5" />
      <Skeleton className="mt-2.5 h-4 w-4/5" />
      <Skeleton className="mt-2 h-4 w-3/5" />
      <Skeleton className="mt-4 h-4 w-full" />
    </div>
  );
}

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="İlanlar yükleniyor" className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}
