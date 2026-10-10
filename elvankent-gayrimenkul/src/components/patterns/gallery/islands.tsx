'use client';

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import type { GalleryPatternProps } from '@/components/patterns/contracts';
import type { GalleryLayout } from '@/theme-engine/ids';

/**
 * Galeri desenleri için İSTEMCİ yükleyicisi (D7.0 kuralı). Her desen ayrı bir tarayıcı
 * parçasıdır ve yalnızca çizildiğinde indirilir: carousel seçen site grid kodunu, standart
 * galeriyi kullanan site hiçbirini indirmez. Girdiler = GALLERY_LAYOUTS (standart hariç).
 */
export type GalleryIslandId = Exclude<GalleryLayout, 'standard'>;

const GALLERIES: Record<GalleryIslandId, LazyExoticComponent<ComponentType<GalleryPatternProps>>> = {
  'grid': lazy(() => import('@/components/patterns/gallery/grid')),
  'carousel': lazy(() => import('@/components/patterns/gallery/carousel')),
  'fullscreen': lazy(() => import('@/components/patterns/gallery/fullscreen')),
};

export function GalleryIsland({ id, images, title }: GalleryPatternProps & { id: GalleryIslandId }) {
  const Gallery = GALLERIES[id];
  return (
    <Suspense fallback={<div className="kp-gallery-fallback bg-surface-muted" aria-hidden />}>
      <Gallery images={images} title={title} />
    </Suspense>
  );
}
