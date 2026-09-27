import { PropertyCard } from '@/components/property/property-card';
import { cn } from '@/lib/utils';
import type { PropertyCard as PropertyCardData } from '@/modules/properties/types';

export function PropertyGrid({
  items,
  columns = 3,
  priorityCount = 0,
  className,
}: {
  items: PropertyCardData[];
  columns?: 2 | 3 | 4;
  priorityCount?: number;
  className?: string;
}) {
  const sizes =
    columns === 4
      ? '(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw'
      : columns === 2
        ? '(min-width: 1024px) 560px, (min-width: 640px) 50vw, 100vw'
        : '(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw';
  return (
    <ul
      className={cn(
        'grid gap-x-6 gap-y-10 sm:grid-cols-2',
        columns === 3 && 'xl:grid-cols-3',
        columns === 4 && 'lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {items.map((p, i) => (
        <li key={p.id} className="flex">
          <PropertyCard property={p} priority={i < priorityCount} sizes={sizes} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
