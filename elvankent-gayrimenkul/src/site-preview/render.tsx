import type { ReactNode } from 'react';
import { resolveSurfaces } from '@/components/patterns/resolver';
import { PropertyDetailSurface } from '@/components/patterns/property-detail/surface';
import { SiteFrame } from '@/components/site/site-frame';
import { SiteHome, type HomeData } from '@/components/site/site-home';
import { SiteListing, type ListingPageData } from '@/components/site/site-listing';
import type { PropertyCard, PropertyDetail } from '@/modules/properties/types';
import type { Tenant } from '@/platform/tenant/tenant';
import type { SiteView } from '@/site-config/load';
import type { PreviewSurface } from '@/site-preview/surfaces';

export { parsePreviewSurface, PREVIEW_SURFACES, type PreviewSurface } from '@/site-preview/surfaces';

/**
 * GERÇEK ÖNİZLEME yüzeyleri: ANA SAYFA + ARAMA (ilan listesi) + İLAN DETAYI. Kiracı sitesinin
 * AYNI Site Engine bileşenleriyle çizilir (SiteFrame, SiteHome, SiteListing, PropertyDetailSurface);
 * yalnızca veri kaynağı önizlemeye göre değişir (KARAY: örnek içerik · ofis: ofisin kendi verisi).
 */
export interface PreviewContent {
  home?: HomeData;
  listing?: ListingPageData;
  /** null: gösterilecek ilan yok (uydurma ilan çizilmez) */
  detail?: { property: PropertyDetail; similar: PropertyCard[] } | null;
}

export function PreviewPage(props: {
  surface: PreviewSurface;
  tenant: Tenant;
  view: SiteView;
  regions: { slug: string; name: string }[];
  hasBlog: boolean;
  content: PreviewContent;
  label: string;
  attributes?: Record<string, string>;
  empty?: ReactNode;
}) {
  const { surface, tenant, view, content } = props;
  const patterns = resolveSurfaces(view);
  return (
    <div
      data-site-preview=""
      data-preview-surface={surface}
      data-preview-patterns={Object.entries(patterns)
        .map(([s, p]) => `${s}:${p.id}`)
        .join(' ')}
      {...props.attributes}
    >
      <style href="site-preview-inert" precedence="low">
        {'[data-site-preview] a,[data-site-preview] button[type=submit],[data-site-preview] form{pointer-events:none}'}
      </style>
      <p className="fixed bottom-3 left-3 z-[70] rounded-full bg-neutral-900/85 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg" role="status">
        {props.label}
      </p>
      <SiteFrame tenant={tenant} view={view} hasBlog={props.hasBlog} regions={props.regions} version="onizleme" mode="preview">
        {surface === 'ana-sayfa' && content.home && <SiteHome tenant={tenant} view={view} data={content.home} />}
        {surface === 'ilanlar' && content.listing && <SiteListing tenant={tenant} view={view} data={content.listing} />}
        {surface === 'ilan' &&
          (content.detail ? <PropertyDetailSurface view={view} tenant={tenant} p={content.detail.property} similar={content.detail.similar} /> : props.empty)}
      </SiteFrame>
    </div>
  );
}
