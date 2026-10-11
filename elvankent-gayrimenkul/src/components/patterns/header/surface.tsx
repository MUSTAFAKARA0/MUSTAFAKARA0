import { SiteHeader } from '@/components/layout/site-header';
import type { HeaderPatternInput } from '@/components/patterns/header/parts';
import { SearchBarHeader } from '@/components/patterns/header/search-bar';
import { StructuredHeader } from '@/components/patterns/header/structured';
import { TransparentHeader } from '@/components/patterns/header/transparent';
import { resolvePattern } from '@/components/patterns/resolver';

/**
 * Menü (navigation) yüzeyi: header. Mevcut düzenler (classic · centered · floating) → mevcut
 * SiteHeader, değişmeden. D7.4 desenleri sunucu bileşenidir; menü paneli ve favoriler mevcut
 * istemci parçalarıdır (header-client), yeni tarayıcı kodu yok.
 */
export function HeaderSurface(props: HeaderPatternInput) {
  switch (resolvePattern(props.view, 'navigation').id) {
    case 'transparent':
      return <TransparentHeader {...props} />;
    case 'structured':
      return <StructuredHeader {...props} />;
    case 'search-bar':
      return <SearchBarHeader {...props} />;
    default:
      return <SiteHeader tenant={props.tenant} hasBlog={props.hasBlog} view={props.view} />;
  }
}
