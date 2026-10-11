import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { GallerySurface } from '@/components/patterns/gallery/surface';
import { Actions, ContactBlock, DemoNote, DetailSection, detailModel, LocationLine, LocationMap, MetaLine, PreviewStrip, PriceFacts, SimilarSection, StatusNotice, TypeLine, type DetailLayoutProps } from '@/components/patterns/property-detail/parts';
import { MobileContactBar } from '@/components/property/contact-panel';
import { DetailsTable, FeatureList, KeyFacts } from '@/components/property/property-facts';

/**
 * İlan detayı deseni · map-first (Map First): KONUM bağlamı önce. Galeri ve harita üstte yan
 * yana; altında bölge bağlantısı ("bu bölgedeki ilanlar"). Kullanıcı ilanı bölgesiyle birlikte
 * değerlendirir ve tek tıkla aynı bölgede aramaya döner. Konum yoksa galeri tam genişlik.
 */
export function MapFirstDetail({ tenant, p, similar, mode = 'public', deletedAt, view }: DetailLayoutProps) {
  const m = detailModel(tenant, p, mode);
  const hasMap = p.latitude !== null && p.longitude !== null;
  return (
    <div data-pattern="karay-pattern:property-detail/map-first" className="kp-detail-mapfirst">
      {m.preview && <PreviewStrip p={p} deletedAt={deletedAt} />}
      <div className="container-page pt-5 pb-28 sm:pt-7 lg:pb-20">
        <Breadcrumbs tenant={tenant} items={m.crumbs} />
        <header className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <TypeLine p={p} />
            <h1 className="mt-2 max-w-4xl font-display text-display-lg text-foreground">{p.title}</h1>
            <LocationLine m={m} />
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <p className="numeric text-price font-bold tracking-tight text-foreground">{m.priceLabel}</p>
            <Actions p={p} m={m} />
          </div>
        </header>

        <div className={hasMap ? 'kp-detail-split mt-6 grid gap-3' : 'mt-6'}>
          <div className="min-w-0">
            <GallerySurface view={view} images={p.images} title={p.title} />
          </div>
          {hasMap && (
            <div className="kp-detail-map min-w-0">
              <LocationMap p={p} m={m} view={view} area className="kp-detail-mapbox overflow-hidden rounded-2xl border border-border" />
            </div>
          )}
        </div>
        {!hasMap && m.areaPath && !m.preview && (
          <Link href={m.areaPath} className="kp-area-link mt-4">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{m.location}</span>
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold">
              Bu bölgedeki ilanlar <ArrowRight className="size-4" aria-hidden />
            </span>
          </Link>
        )}

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <div className="min-w-0 space-y-10">
            <PriceFacts p={p} />
            <StatusNotice p={p} />
            <KeyFacts p={p} />
            <DemoNote p={p} />
            {p.description && (
              <DetailSection id="aciklama" title="Açıklama">
                <div className="prose-content max-w-3xl whitespace-pre-line">{p.description}</div>
              </DetailSection>
            )}
            <DetailSection id="ozellikler" title="Özellikler">
              <DetailsTable p={p} />
            </DetailSection>
            {p.features.length > 0 && (
              <DetailSection id="olanaklar" title="Olanaklar ve çevre">
                <FeatureList p={p} />
              </DetailSection>
            )}
            <MetaLine p={p} />
          </div>
          <aside aria-label="İletişim" className="lg:sticky lg:top-24 lg:self-start">
            <ContactBlock tenant={tenant} p={p} m={m} />
          </aside>
        </div>
        <SimilarSection p={p} m={m} similar={similar} />
      </div>
      {m.available && !m.preview && <MobileContactBar propertyId={p.id} tel={m.tel} whatsapp={m.whatsapp} priceLabel={m.priceLabel} />}
    </div>
  );
}
