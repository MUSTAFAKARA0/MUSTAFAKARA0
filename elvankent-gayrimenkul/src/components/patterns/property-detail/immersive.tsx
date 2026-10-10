import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { GallerySurface } from '@/components/patterns/gallery/surface';
import { Actions, ContactBlock, DemoNote, DetailSection, detailModel, LocationLine, LocationMap, MetaLine, PreviewStrip, PriceFacts, SimilarSection, StatusNotice, type DetailLayoutProps } from '@/components/patterns/property-detail/parts';
import { MobileContactBar } from '@/components/property/contact-panel';
import { DetailsTable, FeatureList, KeyFacts } from '@/components/property/property-facts';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';

/**
 * İlan detayı deseni · immersive (Luxury): önce görsel. Galeri sayfanın tam genişliğinde
 * (seçili galeri deseniyle), ardından ortalanmış tek editoryal sütun: büyük serif başlık,
 * sakin fiyat, ölçülü teknik özet, geniş satır aralıklı açıklama. İletişim, içerikten ayrı
 * tam genişlik bir bantta. Aynı veri ve aynı iş kuralları; yalnızca hiyerarşi farklı.
 */
export function ImmersiveDetail({ tenant, p, similar, mode = 'public', deletedAt, view }: DetailLayoutProps) {
  const m = detailModel(tenant, p, mode);
  const hasMap = p.latitude !== null && p.longitude !== null;
  return (
    <div data-pattern="karay-pattern:property-detail/immersive" className="kp-detail-immersive">
      {m.preview && <PreviewStrip p={p} deletedAt={deletedAt} />}
      <GallerySurface view={view} images={p.images} title={p.title} />

      <article className="container-page pt-8 pb-28 lg:pb-20">
        <Breadcrumbs tenant={tenant} items={m.crumbs} />
        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="kp-kicker text-muted-foreground">
            {LISTING_TYPE_LABELS[p.listingType]}
            {p.typeName ? ` · ${p.typeName}` : ''}
          </p>
          <h1 className="mt-4 font-display text-display-2xl text-foreground">{p.title}</h1>
          <LocationLine m={m} className="mt-4 flex items-center justify-center gap-1.5 text-[15.5px] text-muted-foreground" />
          <p className="numeric mt-8 text-[1.75rem] font-medium tracking-tight text-foreground">{m.priceLabel}</p>
          <div className="flex justify-center">
            <PriceFacts p={p} />
          </div>
          <div className="mt-6 flex justify-center">
            <Actions p={p} m={m} />
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <StatusNotice p={p} />
          <KeyFacts p={p} />
          <DemoNote p={p} />
          {p.description && (
            <section aria-label="Açıklama" className="kp-prose">
              <div className="prose-content whitespace-pre-line">{p.description}</div>
            </section>
          )}
          <DetailSection id="ozellikler" title="Özellikler">
            <DetailsTable p={p} />
          </DetailSection>
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
          <div className="text-center">
            <MetaLine p={p} />
          </div>
        </div>

        <section aria-label="İletişim" className="kp-contact-band mt-16">
          <div className="kp-band-grid mx-auto grid max-w-5xl gap-8">
            <div>
              <p className="kp-kicker text-muted-foreground">{tenant.settings.display_name}</p>
              <h2 className="mt-3 font-display text-display-lg text-foreground">Bu gayrimenkulü birlikte görelim</h2>
              <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-muted-foreground">İlan no {p.referenceNo}. Sorularınız ve görüntüleme için bize ulaşın.</p>
            </div>
            <div>
              <ContactBlock tenant={tenant} p={p} m={m} summary={false} />
            </div>
          </div>
        </section>

        <SimilarSection p={p} m={m} similar={similar} title="Portföyden seçtiklerimiz" columns={2} />
      </article>

      {m.available && !m.preview && <MobileContactBar propertyId={p.id} tel={m.tel} whatsapp={m.whatsapp} priceLabel={m.priceLabel} />}
    </div>
  );
}
