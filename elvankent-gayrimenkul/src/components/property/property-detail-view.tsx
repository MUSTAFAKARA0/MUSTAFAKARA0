import Link from 'next/link';
import { ArrowDownRight, CalendarDays, EyeOff, Info, MapPin, PencilLine, RefreshCcw } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { PropertyGallery } from '@/components/gallery/property-gallery';
import { LazyMap } from '@/components/common/maps/lazy-map';
import { PropertyBadges } from '@/components/property/property-badges';
import { CompareToggle, FavoriteButton, ShareButton } from '@/components/property/property-actions';
import { ContactPanel, MobileContactBar } from '@/components/property/contact-panel';
import { DetailsTable, FeatureList, KeyFacts } from '@/components/property/property-facts';
import { PropertyGrid } from '@/components/property/property-grid';
import { Button } from '@/components/ui/button';
import { propertyWhatsappMessage, telHref, whatsappHref } from '@/lib/contact-links';
import { formatArea, formatDate, formatListingPrice, formatNumber, formatPhoneDisplay } from '@/lib/format';
import { publicMapConfig } from '@/modules/maps/providers';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS, LISTING_TYPE_TO_SLUG, PRECISION_LABELS, STATUS_LABELS } from '@/modules/properties/constants';
import { regionListingPath } from '@/modules/properties/routes';
import type { PropertyCard, PropertyDetail } from '@/modules/properties/types';
import { tenantUrl, type Tenant } from '@/platform/tenant/tenant';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border pt-10">
      <h2 id={id} className="font-display text-[1.6rem] leading-tight text-foreground">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

interface PropertyDetailViewProps {
  tenant: Tenant;
  p: PropertyDetail;
  similar: PropertyCard[];
  /** preview: yönetim paneli taslak önizlemesi (iletişim ve etkileşimler kapalı) */
  mode?: 'public' | 'preview';
  deletedAt?: string | null;
}

/** İlan detay sayfasının gövdesi (herkese açık sayfa ve yönetim önizlemesi ortak kullanır) */
export function PropertyDetailView({ tenant, p, similar, mode = 'public', deletedAt }: PropertyDetailViewProps) {
  const preview = mode === 'preview';
  const s = tenant.settings;
  const url = tenantUrl(tenant, `/ilan/${p.slug}`);
  const tel = telHref(s.phone);
  const whatsapp = tenant.site.overrides.whatsapp === false ? null : whatsappHref(s.whatsapp ?? s.phone, propertyWhatsappMessage(p.title, p.referenceNo, url));
  const priceLabel = formatListingPrice(p.price, p.currency, p.listingType);
  const location = [p.neighborhoodName, p.districtName, p.cityName].filter(Boolean).join(', ');
  const available = p.status === 'published';
  const map = publicMapConfig();
  const typePath = `/${LISTING_TYPE_TO_SLUG[p.listingType]}-${p.typeSlug}`;
  const areaPath = p.citySlug && p.districtSlug ? regionListingPath(p.citySlug, p.districtSlug, p.neighborhoodSlug) : null;

  return (
    <>
      {preview && (
        <div className="sticky top-0 z-40 border-b border-warning/30 bg-warning-soft text-warning">
          <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <EyeOff className="size-4 shrink-0" aria-hidden />
              Önizleme · {deletedAt ? 'Çöp kutusunda' : STATUS_LABELS[p.status]}
              <span className="font-normal text-warning/85">— Bu görünüm yalnızca yönetim paneli kullanıcılarına açıktır.</span>
            </p>
            <Button asChild size="sm" variant="outline" className="bg-surface">
              <Link href={`/admin/ilanlar/${p.id}`}>
                <PencilLine /> Düzenlemeye dön
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div className="container-page pt-5 pb-28 sm:pt-7 lg:pb-20">
        <Breadcrumbs
          tenant={tenant}
          items={[
            { name: 'Ana sayfa', path: '/' },
            { name: LISTING_TYPE_LABELS[p.listingType], path: `/${LISTING_TYPE_TO_SLUG[p.listingType]}` },
            ...(p.typeSlug ? [{ name: `${LISTING_TYPE_LABELS[p.listingType]} ${p.typeName.toLocaleLowerCase('tr-TR')}`, path: typePath }] : []),
            { name: p.title, path: `/ilan/${p.slug}` },
          ]}
        />

        <header className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold tracking-[0.12em] text-accent-ink uppercase">
                {LISTING_TYPE_LABELS[p.listingType]}
                {p.typeName ? ` · ${p.typeName}` : ''}
              </span>
              <PropertyBadges property={p} className="flex flex-wrap gap-1.5" />
            </div>
            <h1 className="mt-3 max-w-4xl font-display text-display-lg text-foreground">{p.title}</h1>
            {location && (
              <p className="mt-3 flex items-center gap-1.5 text-[15.5px] text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {areaPath && !preview ? (
                  <Link href={areaPath} className="hover:text-foreground hover:underline">
                    {location}
                  </Link>
                ) : (
                  location
                )}
              </p>
            )}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
              <span>
                İlan no: <strong className="numeric font-semibold text-foreground">{p.referenceNo}</strong>
              </span>
              {p.publishedAt && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden /> İlan tarihi: {formatDate(p.publishedAt)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <RefreshCcw className="size-3.5" aria-hidden /> Güncelleme: {formatDate(p.updatedAt)}
              </span>
            </p>
          </div>
          {!preview && (
            <div className="flex shrink-0 gap-2">
              <FavoriteButton propertyId={p.id} title={p.title} variant="outline" />
              <ShareButton propertyId={p.id} url={url} title={p.title} variant="outline" />
              <CompareToggle propertyId={p.id} variant="outline" className="hidden sm:inline-flex" />
            </div>
          )}
        </header>

        <div className="mt-6">
          <PropertyGallery images={p.images} title={p.title} />
        </div>

        {(p.status === 'sold' || p.status === 'rented') && (
          <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl bg-surface-inverse p-5 text-inverse-foreground">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold text-white">{p.status === 'sold' ? 'Bu gayrimenkul satıldı.' : 'Bu gayrimenkul kiralandı.'}</p>
              <p className="mt-1 text-sm text-white/75">
                Benzer seçenekler için aşağıdaki ilanlara göz atabilir veya aradığınız özellikleri bize iletebilirsiniz.
              </p>
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <div className="min-w-0 space-y-10">
            <div>
              <p className="numeric text-price font-bold tracking-tight text-foreground">{priceLabel}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {p.hasPriceDrop && p.pricePrevious && (
                  <span className="inline-flex items-center gap-1 font-semibold text-success">
                    <ArrowDownRight className="size-4" aria-hidden /> Önceki fiyat {formatNumber(p.pricePrevious)} ₺
                    {p.priceDroppedAt ? ` · ${formatDate(p.priceDroppedAt)}` : ''}
                  </span>
                )}
                {p.grossM2 && p.price && p.listingType === 'sale' && (
                  <span className="numeric">m² fiyatı ≈ {formatNumber(Math.round(p.price / p.grossM2))} ₺</span>
                )}
                {p.dues ? <span className="numeric">Aidat {formatNumber(p.dues)} ₺</span> : null}
                {p.priceNegotiable && <span>Pazarlık payı var</span>}
              </div>
            </div>

            <KeyFacts p={p} />

            {p.isDemo && (
              <p role="note" className="rounded-2xl bg-warning-soft p-4 text-sm leading-relaxed text-warning">
                <strong>Demo ilan:</strong> Bu ilan gerçek bir gayrimenkulü temsil etmez; sitenin nasıl göründüğünü göstermek için eklenmiştir.
              </p>
            )}

            {p.description && (
              <Section id="aciklama" title="Açıklama">
                <div className="prose-content max-w-3xl whitespace-pre-line">{p.description}</div>
              </Section>
            )}

            <Section id="ozellikler" title="Özellikler">
              <DetailsTable p={p} />
            </Section>

            {p.features.length > 0 && (
              <Section id="olanaklar" title="Olanaklar ve çevre">
                <FeatureList p={p} />
              </Section>
            )}

            {p.latitude !== null && p.longitude !== null && (
              <Section id="konum" title="Konum">
                <p className="-mt-2 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <MapPin className="size-4" aria-hidden /> {location}
                  {p.locationPrecision !== 'exact' && <span>· {PRECISION_LABELS[p.locationPrecision]} gösterilmektedir.</span>}
                </p>
                <LazyMap
                  center={{ lat: p.latitude, lng: p.longitude }}
                  mode={p.locationPrecision === 'exact' ? 'pin' : 'area'}
                  radiusMeters={p.locationPrecision === 'neighborhood' ? 700 : 300}
                  zoom={p.locationPrecision === 'neighborhood' ? 14 : 15}
                  attribution={map.attribution}
                  maxZoom={map.maxZoom}
                  ariaLabel={`${p.title} konumu`}
                  className="h-[340px] overflow-hidden rounded-2xl border border-border sm:h-[420px]"
                />
              </Section>
            )}
          </div>

          <aside aria-label="İletişim" className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl bg-surface-muted p-5 sm:p-6">
              <p className="text-[13px] font-semibold text-muted-foreground">
                {CATEGORY_LABELS[p.category]} · {p.referenceNo}
              </p>
              <p className="numeric mt-1 text-[1.6rem] font-bold tracking-tight">{priceLabel}</p>
              <p className="numeric mt-1 text-sm text-muted-foreground">{[p.roomsLabel, formatArea(p.grossM2)].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="mt-3">
              {preview ? (
                <p className="rounded-2xl border border-dashed border-border-strong p-5 text-sm leading-relaxed text-muted-foreground">
                  İletişim butonları ve talep formu önizlemede devre dışıdır. İlan yayınlandığında ziyaretçiler buradan arama,
                  WhatsApp ve form ile ulaşabilir.
                </p>
              ) : (
                <ContactPanel
                  propertyId={p.id}
                  title={p.title}
                  referenceNo={p.referenceNo}
                  tel={tel}
                  whatsapp={whatsapp}
                  phoneLabel={s.phone ? formatPhoneDisplay(s.phone) : null}
                  appointmentsEnabled={tenant.features.crm}
                  available={available}
                />
              )}
            </div>
            <p className="mt-4 px-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {s.display_name} · İlan bilgileri bilgilendirme amaçlıdır; işlem öncesinde tapu ve imar bilgileri resmi kurumlardan
              teyit edilmelidir.
            </p>
          </aside>
        </div>

        {similar.length > 0 && (
          <section aria-labelledby="benzer" className="mt-20 border-t border-border pt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Size uygun olabilir</p>
                <h2 id="benzer" className="mt-2 font-display text-display-lg">
                  Bu ilana benzer gayrimenkuller
                </h2>
              </div>
              {p.typeSlug && (
                <Link href={typePath} className="text-[15px] font-semibold underline-offset-4 hover:underline">
                  Tüm {LISTING_TYPE_LABELS[p.listingType].toLocaleLowerCase('tr-TR')} {p.typeName.toLocaleLowerCase('tr-TR')} ilanları →
                </Link>
              )}
            </div>
            <PropertyGrid items={similar} columns={4} className="mt-10" />
          </section>
        )}
      </div>

      {available && !preview && <MobileContactBar propertyId={p.id} tel={tel} whatsapp={whatsapp} priceLabel={priceLabel} />}
    </>
  );
}
