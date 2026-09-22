import { PropertyCard } from './property-card';
import { cn } from '@/lib/utils';
import type { PropertyCardData } from '@/types/database';

export function PropertyGrid({
  properties,
  columns = 3,
  preloadFirst = 0,
  className,
}: {
  properties: PropertyCardData[];
  columns?: 3 | 4;
  preloadFirst?: number;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'grid gap-5 sm:grid-cols-2 sm:gap-6',
        columns === 3 ? 'xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {properties.map((p, i) => (
        <li key={p.id} className="flex">
          <PropertyCard property={p} preload={i < preloadFirst} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
