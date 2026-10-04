import { PropertyGallery } from '@/components/gallery/property-gallery';
import type { GalleryPatternProps } from '@/components/patterns/contracts';
import { GalleryIsland, type GalleryIslandId } from '@/components/patterns/gallery/islands';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';

/**
 * Galeri yüzeyi (sunucu): manifestin seçtiği galeri desenini çizer. Standart (veya seçim yok,
 * fotoğraf yok) → mevcut PropertyGallery, değişmeden. Diğerleri yalnızca istemci yükleyicisinden.
 */
export function GallerySurface({ view, images, title }: GalleryPatternProps & { view?: PatternView | null }) {
  const pattern = resolvePattern(view, 'gallery');
  if (pattern.id === 'standard' || images.length === 0) return <PropertyGallery images={images} title={title} />;
  return <GalleryIsland id={pattern.id as GalleryIslandId} images={images} title={title} />;
}
