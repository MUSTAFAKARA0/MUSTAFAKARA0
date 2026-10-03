import { Fragment } from 'react';
import { Hero } from '@/components/home/hero';
import { SpotlightSection, StatsSection } from '@/components/home/design-sections';
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
import type { PostSummary, RegionPage } from '@/modules/content/queries';
import type { PropertyCard } from '@/modules/properties/types';
import type { SearchOptions } from '@/modules/properties/search-types';
import type { RegionCount } from '@/modules/properties/queries';
import type { Tenant } from '@/platform/tenant/tenant';
import type { SiteView } from '@/site-config/load';
import { DEFAULT_HOME_SECTIONS, type HomeSectionConfig } from '@/site-config/schema';

/**
 * Ana sayfa (SITE RENDERER sözleşmesi, bkz. site-frame.tsx): manifestin ana sayfa
 * kompozisyonunu gerçek bileşenlerle çizer. Veriyi kendisi çekmez — kiracı sayfası gerçek
 * veriyi, KARAY önizlemesi örnek veriyi verir; ikisi de aynı çıktıyı üretir.
 */
export interface HomeData {
  showcase: PropertyCard[];
  latestPool: PropertyCard[];
  inventory: { total: number; byListingType: { sale: number; rent: number }; byCategory: Record<string, number>; byType: Record<string, number> };
  options: SearchOptions;
  regions: RegionPage[];
  regionCounts: RegionCount[];
  posts: PostSummary[];
}

function coverFor(cards: PropertyCard[], predicate: (c: PropertyCard) => boolean) {
  return cards.find((c) => predicate(c) && c.cover)?.cover ?? null;
}

export function SiteHome({ tenant, view, data }: { tenant: Tenant; view: SiteView; data: HomeData }) {
  const { showcase, latestPool, inventory, options, regions, regionCounts, posts } = data;
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

  const heroSpot = showcase[0] ?? latestPool[0] ?? null;
  const sections = view.config.home?.sections ?? DEFAULT_HOME_SECTIONS;
  const render = (sec: HomeSectionConfig) => {
    const o: SectionOverride = { eyebrow: sec.eyebrow, title: sec.title, description: sec.description, ctaLabel: sec.ctaLabel, ctaHref: sec.ctaHref };
    switch (sec.type) {
      case 'hero':
        return <Hero tenant={tenant} options={options} spotlight={heroSpot} publishedCount={inventory.total} variant={view.style.hero} o={o} />;
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
      case 'stats':
        return <StatsSection inventory={inventory} regionCount={view.config.pages.bolgeler?.visible === false ? 0 : regions.length} o={o} />;
      case 'spotlight':
        // Hero'nun görselindeki ilandan farklı bir ilan (yoksa aynısı)
        return <SpotlightSection property={[...showcase, ...latestPool].find((p) => p.id !== heroSpot?.id && p.cover) ?? heroSpot} o={o} />;
    }
  };


  return (
    <>
      {sections
        .filter((sec) => sec.enabled)
        .map((sec) => (
          <Fragment key={sec.id}>{render(sec)}</Fragment>
        ))}
    </>
  );
}
