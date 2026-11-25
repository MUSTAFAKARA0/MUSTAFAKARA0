import { SkeletonGrid, type SkeletonLayout } from '@/components/property/skeletons/card-skeleton';

/*
 * Sayfa iskeletleri (loading.tsx). Yalnızca tema değişkenlerini kullanır; hareket CSS'te, tercihe bağlı.
 * NOT: [slug] (liste) ve blog dizini için loading.tsx KONMAZ: akış başladıktan sonra notFound() 404
 * yerine 200 döndürür (yumuşak 404). Liste iskeleti sayfa İÇİNDE Suspense ile gösterilir.
 */

function Bar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`su-skel ${className ?? ''}`} style={style} />;
}

function Status({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}

function HeaderBlock() {
  return (
    <div className="border-b border-border bg-surface">
      <div className="container-page pt-7 pb-10 sm:pt-9 sm:pb-14">
        <Bar className="h-4 w-48" />
        <Bar className="mt-8 h-3 w-24" />
        <Bar className="mt-4 h-10 w-3/5 max-w-xl" />
        <Bar className="mt-5 h-4 w-full max-w-2xl" />
      </div>
    </div>
  );
}

export function ListingPageSkeleton({ layout, image }: SkeletonLayout = {}) {
  return (
    <>
      <Status label="İlanlar yükleniyor" />
      <div className="border-b border-border bg-surface">
        <div className="container-page pt-7 pb-6 sm:pt-9">
          <Bar className="h-4 w-48" />
          <Bar className="mt-6 h-10 w-2/3 max-w-lg" />
          <Bar className="mt-4 h-4 w-full max-w-3xl" />
          <div className="mt-7 flex flex-wrap gap-2">
            {[7, 6, 5, 6, 8].map((w, i) => (
              <Bar key={i} className="h-11 rounded-full" style={{ width: `${w}rem` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="container-page py-10 sm:py-14">
        <SkeletonGrid count={6} layout={layout} image={image} />
      </div>
    </>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="container-page pt-5 pb-20 sm:pt-7">
      <Status label="İlan yükleniyor" />
      <Bar className="h-4 w-64" />
      <Bar className="mt-8 h-3 w-40" />
      <Bar className="mt-4 h-11 w-3/4 max-w-3xl" />
      <Bar className="mt-4 h-4 w-56" />
      <Bar className="mt-6 h-[min(36rem,62vh)] min-h-[16rem] w-full rounded-[1.5rem]" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <div className="space-y-6">
          <Bar className="h-10 w-48" />
          <Bar className="h-24 w-full rounded-2xl" />
          <Bar className="h-4 w-full max-w-3xl" />
          <Bar className="h-4 w-11/12 max-w-3xl" />
          <Bar className="h-4 w-4/5 max-w-3xl" />
        </div>
        <Bar className="hidden h-72 rounded-2xl lg:block" />
      </div>
    </div>
  );
}

export function RegionsPageSkeleton() {
  return (
    <>
      <Status label="Bölgeler yükleniyor" />
      <HeaderBlock />
      <div className="container-page grid gap-4 py-12 sm:grid-cols-2 sm:py-16 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Bar key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </>
  );
}

export function SimplePageSkeleton({ label }: { label: string }) {
  return (
    <>
      <Status label={label} />
      <HeaderBlock />
      <div className="container-page py-12 sm:py-16">
        <Bar className="h-72 w-full rounded-2xl" />
      </div>
    </>
  );
}
