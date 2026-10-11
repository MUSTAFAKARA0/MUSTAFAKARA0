import { SiteFooter } from '@/components/layout/site-footer';
import { DiscoveryFooter } from '@/components/patterns/footer/discovery';
import { EditorialFooter } from '@/components/patterns/footer/editorial';
import type { FooterPatternInput } from '@/components/patterns/footer/parts';
import { StructuredFooter } from '@/components/patterns/footer/structured';
import { resolvePattern } from '@/components/patterns/resolver';

/**
 * Footer yüzeyi. Mevcut düzenler (classic · contact · minimal) → mevcut SiteFooter, değişmeden.
 * D7.4 desenleri sunucu bileşenidir (tek istemci parçası mevcut çerez tercihleri bağlantısı).
 */
export function FooterSurface(props: FooterPatternInput) {
  switch (resolvePattern(props.view, 'footer').id) {
    case 'editorial':
      return <EditorialFooter {...props} />;
    case 'structured':
      return <StructuredFooter {...props} />;
    case 'discovery':
      return <DiscoveryFooter {...props} />;
    default:
      return <SiteFooter tenant={props.tenant} regions={props.regions} hasBlog={props.hasBlog} view={props.view} />;
  }
}
