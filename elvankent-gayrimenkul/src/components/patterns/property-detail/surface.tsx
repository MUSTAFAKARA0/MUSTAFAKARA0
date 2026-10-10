import type { ComponentProps } from 'react';
import { ImmersiveDetail } from '@/components/patterns/property-detail/immersive';
import { InformationFirstDetail } from '@/components/patterns/property-detail/information-first';
import { MapFirstDetail } from '@/components/patterns/property-detail/map-first';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';
import { PropertyDetailView } from '@/components/property/property-detail-view';

/**
 * İlan detayı yüzeyi (sunucu). Standart → mevcut detay sayfası (değişmeden). D7.3 desenleri
 * aynı ilan verisini ortak yapı taşlarıyla (property-detail/parts.tsx) farklı hiyerarşide çizer.
 */
export function PropertyDetailSurface({ view, ...props }: Omit<ComponentProps<typeof PropertyDetailView>, 'view'> & { view?: PatternView | null }) {
  switch (resolvePattern(view, 'property-detail').id) {
    case 'immersive':
      return <ImmersiveDetail {...props} view={view} />;
    case 'information-first':
      return <InformationFirstDetail {...props} view={view} />;
    case 'map-first':
      return <MapFirstDetail {...props} view={view} />;
    default:
      return <PropertyDetailView {...props} view={view} />;
  }
}
