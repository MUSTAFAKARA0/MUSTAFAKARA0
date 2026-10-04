import Link from 'next/link';
import { ArrowDownRight, CalendarDays, EyeOff, Info, MapPin, PencilLine, RefreshCcw } from 'lucide-react';
import { MapSurface } from '@/components/patterns/map/surface';
import type { PatternView } from '@/components/patterns/resolver';
import { PropertyBadges } from '@/components/property/property-badges';
import { CompareToggle, FavoriteButton, ShareButton } from '@/components/property/property-actions';
import { ContactPanel } from '@/components/property/contact-panel';
import { PropertyGrid } from '@/components/property/property-grid';
import { Button } from '@/components/ui/button';
import { propertyWhatsappMessage, telHref, whatsappHref } from '@/lib/contact-links';
import { formatArea, formatDate, formatListingPrice, formatNumber, formatPhoneDisplay } from '@/lib/format';
import { publicMapConfig } from '@/modules/maps/providers';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS, LISTING_TYPE_TO_SLUG, PRECISION_LABELS, STATUS_LABELS } from '@/modules/properties/constants';
import { regionListingPath } from '@/modules/properties/routes';
import type { PropertyCard, PropertyDetail } from '@/modules/properties/types';
import { tenantUrl, type Tenant } from '@/platform/tenant/tenant';

/**
 * İlan detayı desenlerinin ORTAK yapı taşları (D7.3). Desenler aynı ilan verisini ve aynı iş
 * kurallarını (iletişim, WhatsApp, durum notu, demo notu, önizleme kipi, benzer ilanlar)
 * kullanır; yalnızca HİYERARŞİ ve yerleşim farklıdır. Mevcut PropertyDetailView kilitli kalır.
 */
export interface DetailLayoutProps {
  tenant: Tenant;
  p: PropertyDetail;
  similar: PropertyCard[];
  mode?: 'public' | 'preview';
  deletedAt?: string | null;
  view?: PatternView | null;
}

export function detailModel(tenant: Tenant, p: PropertyDetail, mode: 'public' | 'preview' = 'public') {
  const s = tenant.settings;
  const url = tenantUrl(tenant, `/ilan/${p.slug}`);
  return {
    preview: mode === 'preview',
    url,
    tel: telHref(s.phone),
    whatsapp: tenant.site.overrides.whatsapp === false ? null : whatsappHref(s.whatsapp ?? s.phone, propertyWhatsappMessage(p.title, p.referenceNo, url)),
    phoneLabel: s.phone ? formatPhoneDisplay(s.phone) : null,
    priceLabel: formatListingPrice(p.price, p.currency, p.listingType),
    location: [p.neighborhoodName, p.districtName, p.cityName].filter(Boolean).join(', '),
    available: p.status === 'published',
    typePath: `/${LISTING_TYPE_TO_SLUG[p.listingType]}-${p.typeSlug}`,
    areaPath: p.citySlug && p.districtSlug ? regionListingPath(p.citySlug, p.districtSlug, p.neighborhoodSlug) : null,
    crumbs: [
      { name: 'Ana sayfa', path: '/' },
      { name: LISTING_TYPE_LABELS[p.listingType], path: `/${LISTING_TYPE_TO_SLUG[p.listingType]}` },
      ...(p.typeSlug ? [{ name: `${LISTING_TYPE_LABELS[p.listingType]} ${p.typeName.toLocaleLowerCase('tr-TR')}`, path: `/${LISTING_TYPE_TO_SLUG[p.listingType]}-${p.typeSlug}` }] : []),
      { name: p.title, path: `/ilan/${p.slug}` },
    ],
  };
}
export type DetailModel = ReturnType<typeof detailModel>;

/** Yönetim paneli taslak önizlemesi şeridi (mevcut detaydaki ile aynı) */
export function PreviewStrip({ p, deletedAt }: { p: PropertyDetail; deletedAt?: string | null }) {
  return (
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
  );
}

export function TypeLine({ p, className }: { p: PropertyDetail; className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold tracking-[0.12em] text-accent-ink uppercase">
          {LISTING_TYPE_LABELS[p.listingType]}
          {p.typeName ? ` · ${p.typeName}` : ''}
        </span>
        <PropertyBadges property={p} className="flex flex-wrap gap-1.5" />
      </div>
    </div>
  );
}

export function LocationLine({ m, className }: { m: DetailModel; className?: string }) {
  if (!m.location) return null;
  return (
    <p className={className ?? 'mt-3 flex items-center gap-1.5 text-[15.5px] text-muted-foreground'}>
      <MapPin className="size-4 shrink-0" aria-hidden />
      {m.areaPath && !m.preview ? (
        <Link href={m.areaPath} className="hover:text-foreground hover:underline">
          {m.location}
        </Link>
      ) : (
        m.location
      )}
    </p>
  );
}

export function MetaLine({ p }: { p: PropertyDetail }) {
  return (
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
  );
}

export function Actions({ p, m, className }: { p: PropertyDetail; m: DetailModel; className?: string }) {
  if (m.preview) return null;
  return (
    <div className={className ?? 'flex shrink-0 gap-2'}>
      <FavoriteButton propertyId={p.id} title={p.title} variant="outline" />
      <ShareButton propertyId={p.id} url={m.url} title={p.title} variant="outline" />
      <CompareToggle propertyId={p.id} variant="outline" className="hidden sm:inline-flex" />
    </div>
  );
}

export function PriceFacts({ p }: { p: PropertyDetail }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {p.hasPriceDrop && p.pricePrevious && (
        <span className="inline-flex items-center gap-1 font-semibold text-success">
          <ArrowDownRight className="size-4" aria-hidden /> Önceki fiyat {formatNumber(p.pricePrevious)} ₺{p.priceDroppedAt ? ` · ${formatDate(p.priceDroppedAt)}` : ''}
        </span>
      )}
      {p.grossM2 && p.price && p.listingType === 'sale' && <span className="numeric">m² fiyatı ≈ {formatNumber(Math.round(p.price / p.grossM2))} ₺</span>}
      {p.dues ? <span className="numeric">Aidat {formatNumber(p.dues)} ₺</span> : null}
      {p.priceNegotiable && <span>Pazarlık payı var</span>}
    </div>
  );
}

export function StatusNotice({ p }: { p: PropertyDetail }) {
  if (p.status !== 'sold' && p.status !== 'rented') return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-surface-inverse p-5 text-inverse-foreground">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold text-white">{p.status === 'sold' ? 'Bu gayrimenkul satıldı.' : 'Bu gayrimenkul kiralandı.'}</p>
        <p className="mt-1 text-sm text-white/75">Benzer seçenekler için aşağıdaki ilanlara göz atabilir veya aradığınız özellikleri bize iletebilirsiniz.</p>
      </div>
    </div>
  );
}

export function DemoNote({ p }: { p: PropertyDetail }) {
  if (!p.isDemo) return null;
  return (
    <p role="note" className="rounded-2xl bg-warning-soft p-4 text-sm leading-relaxed text-warning">
      <strong>Demo ilan:</strong> Bu ilan gerçek bir gayrimenkulü temsil etmez; sitenin nasıl göründüğünü göstermek için eklenmiştir.
    </p>
  );
}

export function DetailSection({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={className ?? 'border-t border-border pt-10'}>
      <h2 id={id} className="font-display text-[1.6rem] leading-tight text-foreground">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Konum haritası (harita yüzeyi deseniyle); konum yoksa null */
export function LocationMap({ p, m, view, className, area }: { p: PropertyDetail; m: DetailModel; view?: PatternView | null; className?: string; area?: boolean }) {
  if (p.latitude === null || p.longitude === null) return null;
  const map = publicMapConfig();
  return (
    <>
      <p className="-mt-2 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <MapPin className="size-4" aria-hidden /> {m.location}
        {p.locationPrecision !== 'exact' && <span>· {PRECISION_LABELS[p.locationPrecision]} gösterilmektedir.</span>}
      </p>
      <MapSurface
        view={view}
        center={{ lat: p.latitude, lng: p.longitude }}
        mode={p.locationPrecision === 'exact' ? 'pin' : 'area'}
        radiusMeters={p.locationPrecision === 'neighborhood' ? 700 : 300}
        zoom={p.locationPrecision === 'neighborhood' ? 14 : 15}
        attribution={map.attribution}
        maxZoom={map.maxZoom}
        ariaLabel={`${p.title} konumu`}
        className={className ?? 'h-[340px] overflow-hidden rounded-2xl border border-border sm:h-[420px]'}
        area={area ? { label: m.location, href: m.preview ? null : m.areaPath } : null}
      />
    </>
  );
}

/** İletişim: özet + iletişim paneli (önizlemede devre dışı notu) + bilgilendirme */
export function ContactBlock({ tenant, p, m, summary = true }: { tenant: Tenant; p: PropertyDetail; m: DetailModel; summary?: boolean }) {
  return (
    <>
      {summary && (
        <div className="rounded-2xl bg-surface-muted p-5 sm:p-6">
          <p className="text-[13px] font-semibold text-muted-foreground">
            {CATEGORY_LABELS[p.category]} · {p.referenceNo}
          </p>
          <p className="numeric mt-1 text-[1.6rem] font-bold tracking-tight">{m.priceLabel}</p>
          <p className="numeric mt-1 text-sm text-muted-foreground">{[p.roomsLabel, formatArea(p.grossM2)].filter(Boolean).join(' · ')}</p>
        </div>
      )}
      <div className={summary ? 'mt-3' : undefined}>
        {m.preview ? (
          <p className="rounded-2xl border border-dashed border-border-strong p-5 text-sm leading-relaxed text-muted-foreground">
            İletişim butonları ve talep formu önizlemede devre dışıdır. İlan yayınlandığında ziyaretçiler buradan arama, WhatsApp ve form ile ulaşabilir.
          </p>
        ) : (
          <ContactPanel
            propertyId={p.id}
            title={p.title}
            referenceNo={p.referenceNo}
            tel={m.tel}
            whatsapp={m.whatsapp}
            phoneLabel={m.phoneLabel}
            appointmentsEnabled={tenant.features.crm}
            available={m.available}
          />
        )}
      </div>
      <p className="mt-4 px-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {tenant.settings.display_name} · İlan bilgileri bilgilendirme amaçlıdır; işlem öncesinde tapu ve imar bilgileri resmi kurumlardan teyit edilmelidir.
      </p>
    </>
  );
}

export function SimilarSection({ p, m, similar, title = 'Bu ilana benzer gayrimenkuller', columns = 4 }: { p: PropertyDetail; m: DetailModel; similar: PropertyCard[]; title?: string; columns?: 2 | 3 | 4 }) {
  if (!similar.length) return null;
  return (
    <section aria-labelledby="benzer" className="mt-20 border-t border-border pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Size uygun olabilir</p>
          <h2 id="benzer" className="mt-2 font-display text-display-lg">
            {title}
          </h2>
        </div>
        {p.typeSlug && (
          <Link href={m.typePath} className="text-[15px] font-semibold underline-offset-4 hover:underline">
            Tüm {LISTING_TYPE_LABELS[p.listingType].toLocaleLowerCase('tr-TR')} {p.typeName.toLocaleLowerCase('tr-TR')} ilanları →
          </Link>
        )}
      </div>
      <PropertyGrid items={similar} columns={columns} className="mt-10" />
    </section>
  );
}
