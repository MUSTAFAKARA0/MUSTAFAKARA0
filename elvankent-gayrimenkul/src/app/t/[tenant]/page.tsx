import type { Metadata } from 'next';
import { JsonLd } from '@/components/common/json-ld';
import { Hero } from '@/components/home/hero';
import {
  BlogSection,
  CategorySection,
  ContactBand,
  LatestSection,
  TextSection,
  type SectionOverride,
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
import { Fragment } from 'react';
import { getSiteView } from '@/platform/site/load';
import { DEFAULT_HOME_SECTIONS, type HomeSectionConfig } from '@/platform/site/schema';
import { THEMES } from '@/platform/site/themes';

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

  const view = await getSiteView(tenant);
  const theme = THEMES[view.config.theme];
  const sections = view.config.home?.sections ?? DEFAULT_HOME_SECTIONS;
  const seo = view.config.seo;
  const render = (sec: HomeSectionConfig) => {
    const o: SectionOverride = { eyebrow: sec.eyebrow, title: sec.title, description: sec.description, ctaLabel: sec.ctaLabel, ctaHref: sec.ctaHref };
    switch (sec.type) {
      case 'hero':
        return <Hero tenant={tenant} options={options} spotlight={showcase[0] ?? latestPool[0] ?? null} publishedCount={inventory.total} variant={theme.hero} o={o} />;
      case 'showcase':
        return <ShowcaseSection items={showcase} o={o} />;
      case 'categories':
        return <CategorySection tiles={tiles} o={o} />;
      case 'latest':
        return <LatestSection items={latest.slice(0, latestCount)} o={o} />;
      case 'regions':
        return view.config.pages.bolgeler?.visible === false ? null : <RegionsSection regions={regions} counts={regionListingCounts} o={o} />;
      case 'process':
        return <ProcessSection o={o} />;
      case 'owner_cta':
        return <OwnerCtaSection tenant={tenant} o={o} valuation={view.features.valuation && view.config.pages.degerleme?.visible !== false} whatsapp={view.features.whatsapp} />;
      case 'text':
        return <TextSection id={sec.id} o={o} body={sec.body} />;
      case 'blog':
        return view.features.blog && view.config.pages.blog?.visible !== false ? <BlogSection posts={posts} o={o} /> : null;
      case 'contact':
        return <ContactBand tenant={tenant} o={o} whatsapp={view.features.whatsapp} />;
    }
  };

  return (
    <>
      <JsonLd data={[organizationJsonLd(tenant, view.features.advancedSeo ? seo : undefined), websiteJsonLd(tenant)]} />
      {sections
        .filter((sec) => sec.enabled)
        .map((sec) => (
          <Fragment key={sec.id}>{render(sec)}</Fragment>
        ))}
    </>
  );
}

