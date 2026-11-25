import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { GallerySurface } from '@/components/patterns/gallery/surface';
import { Actions, ContactBlock, DemoNote, DetailSection, detailModel, LocationLine, LocationMap, MetaLine, PreviewStrip, PriceFacts, SimilarSection, StatusNotice, TypeLine, type DetailLayoutProps } from '@/components/patterns/property-detail/parts';
import { DetailContactBars } from '@/components/property/detail-contact-bars';
import { buildDetailSections, MIN_NAV_ITEMS } from '@/components/property/detail-nav-logic';
import { DetailSectionNav } from '@/components/property/detail-section-nav';
import { DetailsTable, FeatureList, KeyFacts } from '@/components/property/property-facts';

/**
 * İlan detayı deseni · information-first (Architectural): TEKNİK KÜNYE önce. Solda yapışkan
 * künye sütunu (başlık, konum, fiyat, iletişim); sağda galeri ve hemen ardından özellikler
 * tablosu, açıklama sonra. Kurumsal ve karşılaştırmacı okuyucu için: bilgi düzenli, hizalı.
 */
export function InformationFirstDetail({ tenant, p, similar, mode = 'public', deletedAt, view }: DetailLayoutProps) {
  const m = detailModel(tenant, p, mode);
  const hasMap = p.latitude !== null && p.longitude !== null;
  const navItems = buildDetailSections({ description: Boolean(p.description), features: p.features.length > 0, map: hasMap, similar: similar.length > 0 });
  const nav = navItems.length >= MIN_NAV_ITEMS ? <DetailSectionNav items={navItems} /> : null;
  return (
    <div data-pattern="karay-pattern:property-detail/information-first" className="kp-detail-info">
      {m.preview && <PreviewStrip p={p} deletedAt={deletedAt} />}
      <div className="container-page pt-5 pb-28 sm:pt-7 lg:pb-20">
        <Breadcrumbs tenant={tenant} items={m.crumbs} />
        <div className="kp-info-grid mt-6 grid gap-10">
          {/* Mobilde künye başlığı önce, iletişim formu özellikler tablosundan sonra gelir (okuma sırası) */}
          <aside aria-label="Künye" className="kp-spec-sheet max-lg:contents lg:sticky lg:top-24 lg:self-start">
            <div className="max-lg:order-1 max-lg:border-t-2 max-lg:border-foreground max-lg:pt-5">
            <TypeLine p={p} />
            <h1 className="mt-3 font-display text-display-lg text-foreground">{p.title}</h1>
            <LocationLine m={m} />
            <MetaLine p={p} />
            <div className="kp-spec-price mt-6">
              <p className="numeric text-price font-bold tracking-tight text-foreground">{m.priceLabel}</p>
              <PriceFacts p={p} />
            </div>
            <Actions p={p} m={m} className="mt-5 flex gap-2" />
            </div>
            <div className="mt-6 max-lg:order-3 max-lg:mt-0">
              <ContactBlock tenant={tenant} p={p} m={m} summary={false} />
            </div>
          </aside>

          <div className="min-w-0 space-y-10 max-lg:order-2">
            <GallerySurface view={view} images={p.images} title={p.title} />
            {nav}
            <StatusNotice p={p} />
            <div id="ozet" className="su-sec">
              <KeyFacts p={p} />
            </div>
            <DemoNote p={p} />
            <DetailSection id="ozellikler" title="Teknik künye">
              <DetailsTable p={p} />
            </DetailSection>
            {p.description && (
              <DetailSection id="aciklama" title="Açıklama">
                <div className="prose-content max-w-3xl whitespace-pre-line">{p.description}</div>
              </DetailSection>
            )}
            {p.features.length > 0 && (
              <DetailSection id="olanaklar" title="Olanaklar ve çevre">
                <FeatureList p={p} />
              </DetailSection>
            )}
            {hasMap && (
              <DetailSection id="konum" title="Konum">
                <LocationMap p={p} m={m} view={view} />
              </DetailSection>
            )}
          </div>
        </div>
        <SimilarSection p={p} m={m} similar={similar} columns={4} />
      </div>
      {m.available && !m.preview && <DetailContactBars propertyId={p.id} tel={m.tel} whatsapp={m.whatsapp} priceLabel={m.priceLabel} referenceNo={p.referenceNo} />}
    </div>
  );
}
