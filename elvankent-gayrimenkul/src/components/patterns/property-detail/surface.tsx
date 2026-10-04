import type { ComponentProps } from 'react';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';
import { PropertyDetailView } from '@/components/property/property-detail-view';

/**
 * İlan detayı yüzeyi (sunucu). Bugün yalnızca standart (galeri öncelikli mevcut detay sayfası);
 * sözleşmesi hazır desenler: surfaces.ts › property-detail.planned. İlan verisi sayfadan gelir.
 */
export function PropertyDetailSurface({ view, ...props }: Omit<ComponentProps<typeof PropertyDetailView>, 'view'> & { view?: PatternView | null }) {
  switch (resolvePattern(view, 'property-detail').id) {
    default:
      return <PropertyDetailView {...props} view={view} />;
  }
}
