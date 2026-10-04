'use client';

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import type { MapResultsProps } from '@/components/patterns/listing/map-results';

/**
 * İlan listesi desenleri için İSTEMCİ yükleyicisi (D7.0 kuralı): Map First'ün liste ↔ harita
 * deseni ayrı tarayıcı parçasıdır ve yalnızca çizildiğinde (onu seçen sitede) indirilir.
 * Diğer liste desenleri sunucu bileşenidir ve buraya girmez.
 */
export type ListingIslandId = 'map-results';

const LISTINGS: Record<ListingIslandId, LazyExoticComponent<ComponentType<MapResultsProps>>> = {
  'map-results': lazy(() => import('@/components/patterns/listing/map-results')),
};

export function ListingIsland({ id, ...props }: MapResultsProps & { id: ListingIslandId }) {
  const Listing = LISTINGS[id];
  return (
    <Suspense fallback={<div className="min-h-[60vh] rounded-2xl bg-surface-muted" aria-hidden />}>
      <Listing {...props} />
    </Suspense>
  );
}
