import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Suspense } from 'react';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { ListingsFilters } from '@/components/admin/listings/listings-filters';
import { ListingsTable } from '@/components/admin/listings/listings-table';
import { AdminPageHeader, EmptyPanel } from '@/components/panel/ui';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { cn, firstParam, parsePositiveInt } from '@/lib/utils';
import { adminStatusCounts, listAdminProperties, type AdminListFilters, type AdminStatusFilter } from '@/modules/properties/admin-queries';
import { STATUS_LABELS, type ListingType, type PropertyCategory } from '@/modules/properties/constants';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'İlanlar' };

const TABS: { value: AdminStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'draft', label: STATUS_LABELS.draft },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'published', label: STATUS_LABELS.published },
  { value: 'sold', label: STATUS_LABELS.sold },
  { value: 'rented', label: STATUS_LABELS.rented },
  { value: 'archived', label: STATUS_LABELS.archived },
  { value: 'cop', label: 'Çöp kutusu' },
];

const SORTS = ['guncel', 'yeni', 'eski', 'fiyat-artan', 'fiyat-azalan', 'baslik'] as const;

export default async function ListingsPage({ searchParams }: PageProps<'/admin/ilanlar'>) {
  const ctx = await requirePagePermission('properties.read');
  const sp = await searchParams;
  const status = (TABS.some((t) => t.value === firstParam(sp.durum)) ? firstParam(sp.durum) : 'all') as AdminStatusFilter;
  const sort = (SORTS as readonly string[]).includes(firstParam(sp.sirala) ?? '') ? (firstParam(sp.sirala) as AdminListFilters['sort']) : 'guncel';
  const listingType = ['sale', 'rent'].includes(firstParam(sp.tip) ?? '') ? (firstParam(sp.tip) as ListingType) : undefined;
  const category = ['konut', 'ticari', 'arsa', 'diger'].includes(firstParam(sp.kategori) ?? '') ? (firstParam(sp.kategori) as PropertyCategory) : undefined;
  const days = [7, 30, 90, 365].includes(Number(firstParam(sp.tarih))) ? Number(firstParam(sp.tarih)) : undefined;
  const filters: AdminListFilters = {
    q: firstParam(sp.q),
    status,
    listingType,
    category,
    sort,
    days,
    minPrice: parsePositiveInt(firstParam(sp.fiyat_min)),
    maxPrice: parsePositiveInt(firstParam(sp.fiyat_max)),
    page: Math.max(1, parsePositiveInt(firstParam(sp.sayfa), 10_000) ?? 1),
  };

  const [{ rows, total, pageCount }, counts] = await Promise.all([listAdminProperties(ctx, filters), adminStatusCounts(ctx)]);
  const trash = status === 'cop';
  const visibleTabs = TABS.filter((t) => t.value !== 'cop' || ctx.can('properties.delete') || counts.cop > 0);

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const value = firstParam(v);
      if (value && k !== 'sayfa') params.set(k, value);
    }
    if (page > 1) params.set('sayfa', String(page));
    const qs = params.toString();
    return qs ? `/admin/ilanlar?${qs}` : '/admin/ilanlar';
  };

  return (
    <>
      <AdminPageHeader
        title="İlanlar"
        description={`${formatNumber(counts.all)} ilan · ${formatNumber(counts.published)} yayında`}
        actions={
          ctx.can('properties.create') && (
            <Button asChild>
              <Link href="/admin/ilanlar/yeni">
                <Plus /> Yeni ilan
              </Link>
            </Button>
          )
        }
      />

      <nav aria-label="İlan durumu" className="scrollbar-none relative -mx-4 mb-5 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {visibleTabs.map((tab) => {
          const active = tab.value === status;
          return (
            <Link
              key={tab.value}
              href={tab.value === 'all' ? '/admin/ilanlar' : `/admin/ilanlar?durum=${tab.value}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition',
                active ? 'bg-surface-inverse text-white' : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              )}
            >
              {tab.value === 'cop' && <Trash2 className="size-3.5" aria-hidden />}
              {tab.label}
              <span className={cn('numeric rounded-full px-1.5 text-[11.5px]', active ? 'bg-white/15' : 'bg-surface-muted')}>{counts[tab.value] ?? 0}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-border bg-surface shadow-xs">
        <div className="border-b border-border p-4 sm:p-5">
          <Suspense fallback={<div className="h-11" />}>
            <ListingsFilters />
          </Suspense>
        </div>
        {trash && rows.length > 0 && (
          <p className="border-b border-border bg-warning-soft px-5 py-2.5 text-[13px] text-warning">
            Çöp kutusundaki ilanlar sitede görünmez. Geri yükleyebilir veya kalıcı olarak silebilirsiniz.
          </p>
        )}
        {rows.length === 0 ? (
          <EmptyPanel
            icon={trash ? Trash2 : Building2}
            title={trash ? 'Çöp kutusu boş' : total === 0 && status === 'all' && !filters.q ? 'Henüz ilan eklenmemiş' : 'Bu filtrelere uygun ilan yok'}
            description={trash ? undefined : 'Filtreleri değiştirerek veya yeni ilan ekleyerek devam edebilirsiniz.'}
            action={
              !trash && ctx.can('properties.create') ? (
                <Button asChild>
                  <Link href="/admin/ilanlar/yeni">
                    <Plus /> Yeni ilan
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ListingsTable
            rows={rows}
            trash={trash}
            perms={{ publish: ctx.can('properties.publish'), delete: ctx.can('properties.delete'), create: ctx.can('properties.create'), pdf: ctx.plan.features.pdf }}
          />
        )}
      </div>
      <Pagination page={filters.page} pageCount={pageCount} hrefFor={hrefFor} />
    </>
  );
}
