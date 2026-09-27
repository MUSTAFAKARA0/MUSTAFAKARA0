import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/common/json-ld';
import { ViewTracker } from '@/components/property/contact-panel';
import { PropertyDetailView } from '@/components/property/property-detail-view';
import { formatListingPrice } from '@/lib/format';
import { markdownToPlainText } from '@/modules/content/markdown';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import { findRedirect, getPublicPropertyBySlug, getSimilarProperties } from '@/modules/properties/queries';
import { followRedirect } from '@/modules/seo/redirects';
import { listingJsonLd } from '@/modules/seo/jsonld';
import { baseOpenGraph, listingOgImage } from '@/modules/seo/og';
import { requireTenant } from '@/platform/tenant/tenant';

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/ilan/[slug]'>): Promise<Metadata> {
  const { tenant: key, slug } = await params;
  const tenant = await requireTenant(key);
  const p = await getPublicPropertyBySlug(tenant.id, slug);
  if (!p) return { title: 'İlan bulunamadı', robots: { index: false } };
  const location = [p.neighborhoodName, p.districtName, p.cityName].filter(Boolean).join(', ');
  const og = listingOgImage(p);
  const title = p.seoTitle ?? `${p.title} – ${formatListingPrice(p.price, p.currency, p.listingType)}`;
  const description =
    p.seoDescription ??
    `${LISTING_TYPE_LABELS[p.listingType]} ${p.typeName.toLocaleLowerCase('tr-TR')}, ${location}. ${markdownToPlainText(p.description ?? '', 150)}`;
  return {
    title,
    description,
    alternates: { canonical: `/ilan/${p.slug}` },
    // Demo ve satılmış/kiralanmış ilanlar dizine eklenmez (bağlantıları çalışmaya devam eder)
    robots: p.isDemo || p.status !== 'published' ? { index: false, follow: true } : undefined,
    openGraph: { type: 'website', ...baseOpenGraph(tenant), title: p.title, description, url: `/ilan/${p.slug}`, images: [og] },
    twitter: { card: 'summary_large_image', title: p.title, description, images: [og] },
  };
}

export default async function PropertyPage({ params }: PageProps<'/t/[tenant]/ilan/[slug]'>) {
  const { tenant: key, slug } = await params;
  const tenant = await requireTenant(key);
  const p = await getPublicPropertyBySlug(tenant.id, slug);
  if (!p) {
    const target = await findRedirect(tenant.id, `/ilan/${slug}`);
    if (target) followRedirect(target);
    notFound();
  }
  const similar = await getSimilarProperties(tenant.id, p.id, 4);

  return (
    <>
      <ViewTracker propertyId={p.id} />
      <JsonLd data={listingJsonLd(tenant, p)} />
      <PropertyDetailView tenant={tenant} p={p} similar={similar} />
    </>
  );
}
