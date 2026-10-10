import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPinned } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { getRegionPages } from '@/modules/content/queries';
import { getRegionCounts } from '@/modules/properties/queries';
import { regionListingPath } from '@/modules/properties/routes';
import { requireSiteTenant } from '@/site-config/load';
import { applyPageSeo, guardSitePage, sitePageSettings } from '@/site-config/pages';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/bolgeler'>): Promise<Metadata> {
  const tenant = await requireSiteTenant((await params).tenant);
  return applyPageSeo(await sitePageSettings(tenant, 'bolgeler'), {
    title: 'Bölgeler',
    description: `${tenant.settings.display_name} bölge rehberleri: güncel ilanlar ve yayındaki ilanlara göre fiyat aralıkları.`,
    alternates: { canonical: '/bolgeler' },
  });
}

export default async function RegionsIndexPage({ params }: PageProps<'/t/[tenant]/bolgeler'>) {
  const tenant = await requireSiteTenant((await params).tenant);
  await guardSitePage(tenant, 'bolgeler');
  const [regions, counts] = await Promise.all([getRegionPages(tenant.id), getRegionCounts(tenant.id)]);
  const districtTotals = new Map<string, { name: string; path: string; count: number }>();
  for (const c of counts) {
    const key = `${c.citySlug}-${c.districtSlug}`;
    const d = districtTotals.get(key) ?? { name: `${c.districtName}, ${c.cityName}`, path: regionListingPath(c.citySlug, c.districtSlug), count: 0 };
    d.count += c.count;
    districtTotals.set(key, d);
  }
  const countFor = (r: (typeof regions)[number]) =>
    counts
      .filter((c) => c.citySlug === r.citySlug && (!r.districtSlug || c.districtSlug === r.districtSlug) && (!r.neighborhoodSlug || c.neighborhoodSlug === r.neighborhoodSlug))
      .reduce((s, c) => s + c.count, 0);

  return (
    <>
      <PageHeader
        tenant={tenant}
        eyebrow="Bölge rehberi"
        title="Bölgeler"
        description="Çalıştığımız bölgelerdeki güncel ilanlar ve yayındaki ilanlardan hesaplanan fiyat aralıkları."
        crumbs={[{ name: 'Bölgeler', path: '/bolgeler' }]}
      />
      <div className="container-page py-12 sm:py-16">
        {regions.length === 0 ? (
          <EmptyState icon={MapPinned} title="Henüz bölge sayfası yok" description="Bölge rehberleri yakında burada olacak." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regions.map((r) => (
              <li key={r.slug}>
                <Link href={`/bolgeler/${r.slug}`} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition hover:border-border-strong hover:shadow-md">
                  <span className="text-sm text-muted-foreground">{[r.districtName !== r.name ? r.districtName : null, r.cityName].filter(Boolean).join(', ')}</span>
                  <span className="mt-1 font-display text-[1.7rem] text-foreground">{r.name}</span>
                  {r.intro && <span className="mt-3 line-clamp-3 text-[14.5px] leading-relaxed text-muted-foreground">{r.intro}</span>}
                  <span className="mt-auto flex items-center justify-between pt-6 text-sm font-semibold">
                    <span className="numeric text-muted-foreground">{countFor(r)} yayında ilan</span>
                    <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {districtTotals.size > 0 && (
          <section aria-labelledby="ilceler" className="mt-16">
            <h2 id="ilceler" className="font-display text-2xl">
              İlçelere göre ilanlar
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {[...districtTotals.values()].map((d) => (
                <li key={d.path}>
                  <Link href={d.path} className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium hover:border-foreground/50">
                    {d.name} <span className="numeric text-muted-foreground">{d.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
