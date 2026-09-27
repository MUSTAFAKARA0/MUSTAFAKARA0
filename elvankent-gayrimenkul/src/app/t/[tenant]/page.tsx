import type { Metadata } from 'next';
import { JsonLd } from '@/components/common/json-ld';
import { Hero } from '@/components/home/hero';
import {
  BlogSection,
  CategorySection,
  ContactBand,
  LatestSection,
  OwnerCtaSection,
  ProcessSection,
  RegionsSection,
  ShowcaseSection,
  type CategoryTile,
} from '@/components/home/sections';
import { getPublishedPosts, getRegionPages } from '@/modules/content/queries';
import { getInventoryCounts, getLatestProperties, getRegionCounts, getShowcaseProperties } from '@/modules/properties/queries';
import { getSearchOptions } from '@/modules/properties/search-options';
import type { PropertyCard } from '@/modules/properties/types';
import { organizationJsonLd, websiteJsonLd } from '@/modules/seo/jsonld';
import { requireTenant } from '@/platform/tenant/tenant';

export const revalidate = 300;

export const metadata: Metadata = { alternates: { canonical: '/' } };

function coverFor(cards: PropertyCard[], predicate: (c: PropertyCard) => boolean) {
  return cards.find((c) => predicate(c) && c.cover)?.cover ?? null;
}

export default async function HomePage({ params }: PageProps<'/t/[tenant]'>) {
  const tenant = await requireTenant((await params).tenant);
  const [showcase, latestPool, inventory, options, regions, regionCounts, posts] = await Promise.all([
    getShowcaseProperties(tenant.id, 4),
    getLatestProperties(tenant.id, 24),
    getInventoryCounts(tenant.id),
    getSearchOptions(tenant.id),
    getRegionPages(tenant.id),
    getRegionCounts(tenant.id),
    getPublishedPosts(tenant.id, 3),
  ]);

  const showcaseIds = new Set(showcase.map((p) => p.id));
  const latest = latestPool.filter((p) => !showcaseIds.has(p.id));
  const latestCount = latest.length >= 8 ? 8 : latest.length >= 4 ? 4 : latest.length;

  const tiles: CategoryTile[] = [
    { href: '/konut', title: 'Konut', count: inventory.byCategory.konut ?? 0, image: coverFor(latestPool, (c) => c.category === 'konut' && c.typeSlug === 'daire') },
    {
      href: '/ilanlar?emlak=villa,mustakil-ev',
      title: 'Villa & müstakil',
      count: (inventory.byType.villa ?? 0) + (inventory.byType['mustakil-ev'] ?? 0),
      image: coverFor(latestPool, (c) => ['villa', 'mustakil-ev'].includes(c.typeSlug)),
    },
    { href: '/ticari', title: 'Ticari', count: inventory.byCategory.ticari ?? 0, image: coverFor(latestPool, (c) => c.category === 'ticari') },
    { href: '/arsa', title: 'Arsa & tarla', count: inventory.byCategory.arsa ?? 0, image: coverFor(latestPool, (c) => c.category === 'arsa') },
  ];

  const regionListingCounts = new Map<string, number>();
  for (const r of regions) {
    const count = regionCounts
      .filter(
        (c) =>
          c.citySlug === r.citySlug &&
          (!r.districtSlug || c.districtSlug === r.districtSlug) &&
          (!r.neighborhoodSlug || c.neighborhoodSlug === r.neighborhoodSlug),
      )
      .reduce((sum, c) => sum + c.count, 0);
    regionListingCounts.set(r.slug, count);
  }

  return (
    <>
      <JsonLd data={[organizationJsonLd(tenant), websiteJsonLd(tenant)]} />
      <Hero tenant={tenant} options={options} spotlight={showcase[0] ?? latestPool[0] ?? null} publishedCount={inventory.total} />
      <ShowcaseSection items={showcase} />
      <CategorySection tiles={tiles} />
      <LatestSection items={latest.slice(0, latestCount)} />
      <RegionsSection regions={regions} counts={regionListingCounts} />
      <ProcessSection />
      <OwnerCtaSection tenant={tenant} />
      <BlogSection posts={posts} />
      <ContactBand tenant={tenant} />
    </>
  );
}
