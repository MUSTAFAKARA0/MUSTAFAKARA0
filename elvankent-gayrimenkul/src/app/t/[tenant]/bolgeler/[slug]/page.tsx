import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronDown, Info } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { LazyMap } from '@/components/common/maps/lazy-map';
import { PropertyGrid } from '@/components/property/property-grid';
import { Button } from '@/components/ui/button';
import { formatCompact, formatNumber } from '@/lib/format';
import { getRegionPageBySlug } from '@/modules/content/queries';
import { Markdown } from '@/modules/content/markdown';
import { publicMapConfig } from '@/modules/maps/providers';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import { findRedirect, getRegionPriceStats, searchProperties } from '@/modules/properties/queries';
import { followRedirect } from '@/modules/seo/redirects';
import { regionListingPath } from '@/modules/properties/routes';
import { requireSiteTenant } from '@/site-config/load';
import { guardSitePage } from '@/site-config/pages';

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/bolgeler/[slug]'>): Promise<Metadata> {
  const { tenant: key, slug } = await params;
  const tenant = await requireSiteTenant(key);
  const region = await getRegionPageBySlug(tenant.id, slug);
  if (!region) return { robots: { index: false } };
  const result = await searchProperties(tenant.id, { city: region.citySlug, district: region.districtSlug ?? undefined, neighborhood: region.neighborhoodSlug ?? undefined, sort: 'yeni', page: 1 }, 1);
  // İnce içerik koruması: ilan yoksa ve metin kısaysa dizine eklenmez
  const thin = result.total === 0 && region.body.length < 400;
  return {
    title: region.seoTitle ?? `${region.name} satılık ve kiralık gayrimenkuller`,
    description: region.seoDescription ?? region.intro ?? undefined,
    alternates: { canonical: `/bolgeler/${region.slug}` },
    robots: thin ? { index: false, follow: true } : undefined,
  };
}

export default async function RegionPage({ params }: PageProps<'/t/[tenant]/bolgeler/[slug]'>) {
  const { tenant: key, slug } = await params;
  const tenant = await requireSiteTenant(key);
  await guardSitePage(tenant, 'bolgeler');
  const region = await getRegionPageBySlug(tenant.id, slug);
  if (!region) {
    // Adresi değişen / silinen içerik: tanımlı yönlendirme varsa uygula
    const target = await findRedirect(tenant.id, `/bolgeler/${slug}`);
    if (target) followRedirect(target);
    notFound();
  }

  const location = { city: region.citySlug, district: region.districtSlug ?? undefined, neighborhood: region.neighborhoodSlug ?? undefined };
  const [listings, stats] = await Promise.all([
    searchProperties(tenant.id, { ...location, sort: 'yeni', page: 1 }, 8),
    getRegionPriceStats(tenant.id, region.cityId, region.districtId, region.neighborhoodId),
  ]);
  const listingPath = regionListingPath(region.citySlug, region.districtSlug, region.neighborhoodSlug);
  const map = publicMapConfig();

  return (
    <>
      <PageHeader
        tenant={tenant}
        eyebrow="Bölge rehberi"
        title={`${region.name} satılık ve kiralık gayrimenkuller`}
        description={region.intro ?? undefined}
        crumbs={[
          { name: 'Bölgeler', path: '/bolgeler' },
          { name: region.name, path: `/bolgeler/${region.slug}` },
        ]}
      />
      <div className="container-page space-y-16 py-12 sm:py-16">
        <section aria-labelledby="fiyatlar">
          <h2 id="fiyatlar" className="font-display text-2xl sm:text-3xl">
            {region.name} fiyat aralıkları
          </h2>
          {stats.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {stats.map((st) => (
                <div key={`${st.listingType}-${st.currency}`} className="rounded-2xl border border-border bg-surface p-6">
                  <p className="text-sm font-semibold text-muted-foreground">
                    {LISTING_TYPE_LABELS[st.listingType]} · <span className="numeric">{st.count} yayında ilan</span>
                  </p>
                  <p className="numeric mt-2 font-display text-3xl">
                    {formatNumber(st.median)} {st.currency === 'TRY' ? '₺' : st.currency}
                    <span className="ml-2 font-sans text-sm font-medium text-muted-foreground">medyan</span>
                  </p>
                  <p className="numeric mt-2 text-sm text-muted-foreground">
                    Aralık: {formatCompact(st.min)} – {formatCompact(st.max)} {st.currency === 'TRY' ? '₺' : st.currency}
                    {st.medianPerM2 ? ` · m² medyanı ${formatNumber(st.medianPerM2)} ₺` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 flex items-start gap-2 text-[15px] text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              Fiyat aralığı gösterebilmek için bu bölgede aynı türde en az 3 yayında ilan gerekir.
            </p>
          )}
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            Değerler yalnızca şu anda yayındaki ilanlarımızın fiyatlarından otomatik hesaplanır; bölgenin genel piyasa ortalamasını
            temsil etmez.
          </p>
        </section>

        {region.body && (
          <section className="max-w-3xl">
            <Markdown source={region.body} className="prose-content" />
          </section>
        )}

        <section aria-labelledby="bolge-ilanlari">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="bolge-ilanlari" className="font-display text-2xl sm:text-3xl">
              {region.name} ilanları
            </h2>
            {listings.total > 0 && (
              <Link href={listingPath} className="text-[15px] font-semibold underline-offset-4 hover:underline">
                Tüm {region.name} ilanları ({listings.total}) →
              </Link>
            )}
          </div>
          {listings.items.length > 0 ? (
            <PropertyGrid items={listings.items} columns={4} className="mt-8" />
          ) : (
            <div className="mt-6 rounded-2xl bg-surface-muted p-6">
              <p className="text-[15px]">Bu bölgede şu anda yayında ilan bulunmuyor.</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/iletisim">Aradığınızı bize iletin</Link>
              </Button>
            </div>
          )}
        </section>

        <div className="grid gap-12 lg:grid-cols-2">
          {region.faqs.length > 0 && (
            <section aria-labelledby="sss">
              <h2 id="sss" className="font-display text-2xl sm:text-3xl">
                Sık sorulan sorular
              </h2>
              <div className="mt-6 divide-y divide-border border-y border-border">
                {region.faqs.map((f) => (
                  <details key={f.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <ChevronDown className="size-5 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
          {region.latitude !== null && region.longitude !== null && (
            <section aria-label={`${region.name} haritası`}>
              <LazyMap
                center={{ lat: region.latitude, lng: region.longitude }}
                mode="area"
                radiusMeters={region.neighborhoodId ? 900 : 3500}
                zoom={region.neighborhoodId ? 14 : 12}
                attribution={map.attribution}
                maxZoom={map.maxZoom}
                ariaLabel={`${region.name} bölgesi`}
                className="h-[360px] overflow-hidden rounded-2xl border border-border"
              />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
