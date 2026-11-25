import { PropertyCardSkeleton as CardSkeleton, SkeletonGrid } from '@/components/property/skeletons/card-skeleton';

/** Geriye uyumlu dışa aktarımlar; iskelet artık kart düzenine (cardLayout) uyar. */
export function PropertyCardSkeleton() {
  return <CardSkeleton />;
}

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="İlanlar yükleniyor">
      <SkeletonGrid count={count} />
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}
