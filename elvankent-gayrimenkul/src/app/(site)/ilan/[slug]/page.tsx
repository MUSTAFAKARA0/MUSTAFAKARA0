import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { AlertTriangle, CalendarDays, Hash, MapPin, MessageSquareText, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { JsonLd } from '@/components/common/json-ld';
import { ContactForm } from '@/components/forms/contact-form';
import { LazyMap } from '@/components/map/lazy-map';
import { ContactButtons, MobileContactBar, ViewTracker } from '@/components/property/contact-actions';
import { FavoriteButton } from '@/components/property/favorite-button';
import { PropertyGallery } from '@/components/property/property-gallery';
import { PropertyDetailsTable, PropertyFeatureList, PropertyKeyFacts } from '@/components/property/property-features';
import { PropertyGrid } from '@/components/property/property-grid';
import { ShareButton } from '@/components/property/share-button';
import { LogoMark } from '@/components/layout/logo';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS } from '@/lib/constants';
import { propertyWhatsappMessage, telHref, whatsappHref } from '@/lib/contact-links';
import { findRedirect, getPropertyByListingNo, getSimilarProperties } from '@/lib/data/properties';
import { getSiteSettings } from '@/lib/data/settings';
import { regionPath } from '@/lib/data/regions';
import { absoluteUrl } from '@/lib/env';
import { formatDate, formatListingPrice, formatPhoneDisplay, formatPrice } from '@/lib/format';
import { imageUrl } from '@/lib/images';
import { LISTING_TYPE_TO_SLUG } from '@/lib/listing-filters';
import { propertyJsonLd } from '@/lib/seo';
import { listingNoFromSlug } from '@/lib/slug';
import { publicEnv } from '@/lib/env';

// İlan sayfaları istek anında üretilip 5 dk önbellekte tutulur; yönetim
// panelindeki her değişiklik önbelleği anında geçersiz kılar.
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

type Props = PageProps<'/ilan/[slug]'>;

async function loadProperty(slug: string) {
  const listingNo = listingNoFromSlug(slug);
  return listingNo ? getPropertyByListingNo(listingNo) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await loadProperty(slug);
  if (!p) return { title: 'İlan bulunamadı', robots: { index: false } };
  const location = [p.neighborhood?.name, p.district.name, p.city.name].filter(Boolean).join(', ');
  const priceText = formatListingPrice(p.price, p.currency, p.listing_type);
  const description =
    p.meta_description ??
    `${LISTING_TYPE_LABELS[p.listing_type]} ${p.type.name.toLocaleLowerCase('tr-TR')}, ${location}. ${priceText}. ${p.description
      .replace(/\s+/g, ' ')
      .slice(0, 110)}…`;
  const cover = p.images[0];
  const ogImage = cover ? imageUrl(cover.storage_path) : '/og-default.png';
  const url = `/ilan/${p.slug}`;
  return {
    title: `${p.title} – ${priceText}`,
    description,
    alternates: { canonical: url },
    robots: p.is_demo ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website',
      url,
      title: p.title,
      description,
      images: [{ url: ogImage, width: cover?.width ?? 1200, height: cover?.height ?? 630, alt: cover?.alt ?? p.title }],
    },
    twitter: { card: 'summary_large_image', title: p.title, description, images: [ogImage] },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const p = await loadProperty(slug);

  if (!p) {
    const r = await findRedirect(`/ilan/${slug}`);
    if (r) {
      if (r.status_code === 301 || r.status_code === 308) permanentRedirect(r.to_path);
      redirect(r.to_path);
    }
    notFound();
  }
  // Eski/eksik slug ile gelindiyse kanonik adrese kalıcı yönlendir
  if (p.slug !== slug) permanentRedirect(`/ilan/${p.slug}`);

  const [settings, similar] = await Promise.all([getSiteSettings(), getSimilarProperties(p)]);
  const url = absoluteUrl(`/ilan/${p.slug}`);
  const tel = telHref(settings.phone);
  const wa = whatsappHref(settings.whatsapp ?? settings.phone, propertyWhatsappMessage({ title: p.title, listingNo: p.listing_no, url }));
  const priceLabel = formatListingPrice(p.price, p.currency, p.listing_type);
  const locationText = [p.neighborhood?.name, p.district.name, p.city.name].filter(Boolean).join(', ');
  const listingPath = `/${LISTING_TYPE_TO_SLUG[p.listing_type]}-${p.type.slug}`;
  const hasMap = p.public_latitude !== null && p.public_longitude !== null;

  const crumbs = [
    { name: 'Ana Sayfa', path: '/' },
    { name: LISTING_TYPE_LABELS[p.listing_type], path: `/${LISTING_TYPE_TO_SLUG[p.listing_type]}` },
    { name: `${LISTING_TYPE_LABELS[p.listing_type]} ${p.type.name}`, path: listingPath },
    { name: p.district.name, path: regionPath(p.city.slug, p.district.slug) },
    { name: `İlan ${p.listing_no}`, path: `/ilan/${p.slug}` },
  ];

  return (
    <article className="container-page pt-4 pb-28 sm:pt-6 lg:pb-8">
      <ViewTracker propertyId={p.id} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-4">
        <PropertyGallery
          images={p.images}
          title={p.title}
          overlay={
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 md:top-4 md:left-4">
              <Badge variant={p.listing_type === 'sale' ? 'sale' : 'rent'}>{LISTING_TYPE_LABELS[p.listing_type]}</Badge>
              {p.is_featured && (
                <Badge variant="featured">
                  <Star className="size-3 fill-accent-500 text-accent-500" aria-hidden /> Öne Çıkan
                </Badge>
              )}
              {p.is_demo && <Badge variant="demo">Demo İlan</Badge>}
            </div>
          }
        />
      </div>

      {p.is_demo && (
        <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Bu bir <strong>demo ilandır</strong>; gerçek bir mülkü temsil etmez. Sitenin işleyişini göstermek için eklenmiştir.
          </span>
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-10">
          <header>
            <p className="text-sm font-semibold tracking-wide text-accent-700">
              {LISTING_TYPE_LABELS[p.listing_type]} · {CATEGORY_LABELS[p.category]} · {p.type.name}
            </p>
            <h1 className="mt-2 font-display text-[1.65rem] leading-tight text-ink sm:text-[2.15rem]">{p.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-sand-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-accent-600" aria-hidden /> {locationText}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Hash className="size-4 text-sand-400" aria-hidden /> İlan No: <strong className="text-ink">{p.listing_no}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-sand-400" aria-hidden />
                <time dateTime={p.published_at ?? p.created_at}>{formatDate(p.published_at ?? p.created_at)}</time>
              </span>
            </div>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[2rem] leading-none font-extrabold tracking-tight text-brand-800 sm:text-[2.35rem]">{priceLabel}</p>
                {(p.dues || p.price_negotiable) && (
                  <p className="mt-2 text-sm text-sand-600">
                    {p.dues ? `Aidat: ${formatPrice(p.dues, p.currency)}` : ''}
                    {p.dues && p.price_negotiable ? ' · ' : ''}
                    {p.price_negotiable ? 'Pazarlık payı var' : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <FavoriteButton propertyId={p.id} title={p.title} variant="outline" />
                <ShareButton propertyId={p.id} url={url} title={p.title} />
              </div>
            </div>
          </header>

          <section aria-labelledby="ozellikler">
            <h2 id="ozellikler" className="sr-only">
              İlan Özellikleri
            </h2>
            <PropertyKeyFacts p={p} />
          </section>

          <section aria-labelledby="aciklama">
            <SectionTitle id="aciklama">Açıklama</SectionTitle>
            <div className="mt-4 rounded-2xl bg-surface p-5 text-[15px] leading-[1.8] whitespace-pre-line text-sand-800 ring-1 ring-line/80 sm:p-6">
              {p.description}
            </div>
          </section>

          <section aria-labelledby="detaylar">
            <SectionTitle id="detaylar">Detaylı Özellikler</SectionTitle>
            <div className="mt-4">
              <PropertyDetailsTable p={p} />
            </div>
            {p.features.length > 0 && (
              <div className="mt-6 rounded-2xl bg-surface p-5 ring-1 ring-line/80 sm:p-6">
                <PropertyFeatureList p={p} />
              </div>
            )}
          </section>

          <section aria-labelledby="konum">
            <SectionTitle id="konum">Konum</SectionTitle>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-sand-600">
              <MapPin className="size-4 text-accent-600" aria-hidden /> {locationText}
            </p>
            {hasMap ? (
              <>
                <LazyMap
                  className="mt-4 h-[320px] overflow-hidden rounded-2xl ring-1 ring-line/80 sm:h-[380px]"
                  center={{ lat: p.public_latitude!, lng: p.public_longitude! }}
                  mode={p.location_precision === 'exact' ? 'pin' : 'area'}
                  radiusMeters={p.location_precision === 'neighborhood' ? 900 : 350}
                  zoom={p.location_precision === 'neighborhood' ? 14 : 15}
                  attribution={publicEnv.mapAttribution}
                  ariaLabel={`${p.title} konum haritası`}
                />
                {p.location_precision !== 'exact' && (
                  <p className="mt-2 text-[13px] text-sand-500">
                    Mülk sahibinin gizliliği için konum yaklaşık olarak gösterilmektedir. Kesin adres bilgisi için bizimle iletişime geçin.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-4 rounded-2xl bg-surface p-5 text-sm text-sand-600 ring-1 ring-line/80">
                Harita konumu için lütfen bizimle iletişime geçin.
              </p>
            )}
          </section>

          <section id="bilgi-talep" aria-labelledby="iletisim-formu" className="scroll-mt-24 lg:hidden">
            <SectionTitle id="iletisim-formu">Bilgi Talep Et</SectionTitle>
            <div className="mt-4 rounded-2xl bg-surface p-5 ring-1 ring-line/80">
              <ContactForm propertyId={p.id} propertyTitle={p.title} listingNo={p.listing_no} compact />
            </div>
          </section>
        </div>

        <aside aria-label="İletişim" className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line/70">
              <div className="flex items-center gap-3">
                {settings.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logo_url} alt="" className="size-12 rounded-xl object-contain" />
                ) : (
                  <LogoMark className="size-12" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{settings.business_name}</p>
                  <p className="text-[13px] text-sand-500">İlan sahibi emlak ofisi</p>
                </div>
              </div>
              <p className="mt-5 text-[1.6rem] font-extrabold tracking-tight text-brand-800">{priceLabel}</p>
              <ContactButtons
                className="mt-5"
                propertyId={p.id}
                tel={tel}
                whatsapp={wa}
                phoneLabel={settings.phone ? formatPhoneDisplay(settings.phone) : undefined}
              />
              {!tel && !wa && (
                <p className="mt-4 text-sm text-sand-600">Aşağıdaki formu doldurun, size en kısa sürede dönüş yapalım.</p>
              )}
            </div>
            <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line/70">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-ink">
                <MessageSquareText className="size-5 text-brand-700" aria-hidden /> Bilgi Talep Et
              </h2>
              <ContactForm propertyId={p.id} propertyTitle={p.title} listingNo={p.listing_no} compact />
            </div>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="benzer" className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <SectionTitle id="benzer">Benzer İlanlar</SectionTitle>
            <Link href={listingPath} className="text-sm font-semibold text-brand-700 hover:underline">
              Tümünü gör
            </Link>
          </div>
          <PropertyGrid properties={similar} columns={4} className="mt-6" />
        </section>
      )}

      <MobileContactBar propertyId={p.id} tel={tel} whatsapp={wa} priceLabel={priceLabel} />
      <JsonLd data={propertyJsonLd(p, settings)} />
    </article>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display text-[1.45rem] text-ink sm:text-2xl">
      {children}
    </h2>
  );
}
