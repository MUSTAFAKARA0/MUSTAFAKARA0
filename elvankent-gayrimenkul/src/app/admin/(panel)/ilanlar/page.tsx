import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Building2, Eye, ImageOff, Search, Star } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { PropertyRowActions } from '@/components/admin/property-row-actions';
import { StatusBadge } from '@/components/admin/status-badge';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { requireAdminPage } from '@/lib/auth';
import { LISTING_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants';
import { getStatusCounts, listAdminProperties, type AdminPropertyFilters } from '@/lib/data/admin';
import { formatDate, formatListingPrice, formatNumber } from '@/lib/format';
import { imageUrl } from '@/lib/images';
import { cn, firstParam, parsePositiveInt } from '@/lib/utils';
import type { PropertyStatus } from '@/types/database';

export const metadata: Metadata = { title: 'İlanlar' };

const STATUS_TABS: (PropertyStatus | 'all')[] = ['all', 'active', 'passive', 'draft', 'sold', 'rented'];

export default async function AdminPropertiesPage({ searchParams }: PageProps<'/admin/ilanlar'>) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const statusParam = firstParam(sp.durum) as PropertyStatus | 'all' | undefined;
  const filters: AdminPropertyFilters = {
    status: statusParam && STATUS_TABS.includes(statusParam) ? statusParam : 'all',
    q: firstParam(sp.q)?.slice(0, 60),
    page: parsePositiveInt(firstParam(sp.sayfa), 1000) || 1,
    sort: (['yeni', 'eski', 'fiyat', 'goruntulenme'] as const).find((s) => s === firstParam(sp.sirala)) ?? 'yeni',
  };
  const [{ rows, total, pageCount }, counts] = await Promise.all([listAdminProperties(supabase, filters), getStatusCounts(supabase)]);

  const href = (over: Partial<{ durum: string; q: string; sayfa: number; sirala: string }>) => {
    const p = new URLSearchParams();
    const durum = over.durum ?? filters.status;
    if (durum && durum !== 'all') p.set('durum', durum);
    const q = over.q ?? filters.q;
    if (q) p.set('q', q);
    const sirala = over.sirala ?? filters.sort;
    if (sirala && sirala !== 'yeni') p.set('sirala', sirala);
    const sayfa = over.sayfa ?? 1;
    if (sayfa > 1) p.set('sayfa', String(sayfa));
    const qs = p.toString();
    return qs ? `/admin/ilanlar?${qs}` : '/admin/ilanlar';
  };

  return (
    <>
      <AdminPageHeader title="İlanlar" description={`${formatNumber(counts.all)} ilan`} showNewButton />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Durum filtresi" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
          {STATUS_TABS.map((s) => (
            <Link
              key={s}
              href={href({ durum: s })}
              aria-current={filters.status === s ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                filters.status === s ? 'bg-brand-700 text-white' : 'bg-surface text-sand-700 ring-1 ring-line hover:bg-sand-50',
              )}
            >
              {s === 'all' ? 'Tümü' : STATUS_LABELS[s]} <span className="opacity-70">({counts[s]})</span>
            </Link>
          ))}
        </nav>
        <form action="/admin/ilanlar" className="flex w-full gap-2 sm:w-auto">
          {filters.status !== 'all' && <input type="hidden" name="durum" value={filters.status} />}
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sand-400" aria-hidden />
            <Input name="q" defaultValue={filters.q} placeholder="Başlık veya ilan no" aria-label="İlan ara" className="h-10 pl-9" />
          </div>
          <select
            name="sirala"
            defaultValue={filters.sort}
            aria-label="Sıralama"
            className="h-10 rounded-xl border border-line bg-surface px-2 text-sm"
          >
            <option value="yeni">En yeni</option>
            <option value="eski">En eski</option>
            <option value="fiyat">Fiyat</option>
            <option value="goruntulenme">Görüntülenme</option>
          </select>
          <Button type="submit" variant="outline" size="sm" className="h-10">
            Ara
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={counts.all === 0 ? 'Henüz ilan eklemediniz' : 'Bu kriterlere uygun ilan yok'}
          description={counts.all === 0 ? 'İlk ilanınızı birkaç dakikada ekleyebilirsiniz.' : 'Filtreleri değiştirerek tekrar deneyin.'}
          action={
            <Button asChild>
              <Link href={counts.all === 0 ? '/admin/ilan-ekle' : '/admin/ilanlar'}>
                {counts.all === 0 ? 'Yeni ilan ekle' : 'Filtreleri temizle'}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">İlan listesi, toplam {total} kayıt</caption>
            <thead className="hidden border-b border-line bg-sand-50 text-[12px] font-bold tracking-wide text-sand-600 uppercase md:table-header-group">
              <tr>
                <th scope="col" className="px-4 py-3">
                  İlan
                </th>
                <th scope="col" className="px-4 py-3">
                  Fiyat
                </th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">
                  Tip
                </th>
                <th scope="col" className="px-4 py-3">
                  Durum
                </th>
                <th scope="col" className="hidden px-4 py-3 xl:table-cell">
                  Görüntülenme
                </th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">
                  Tarih
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2.5 p-4 md:table-row md:p-0">
                  <td className="col-span-3 md:min-w-[17rem] md:px-4 md:py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-sand-100">
                        {p.cover_path ? (
                          <Image src={imageUrl(p.cover_path)} alt="" fill sizes="56px" quality={60} className="object-cover" />
                        ) : (
                          <ImageOff className="absolute inset-0 m-auto size-5 text-sand-400" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/admin/ilan/${p.id}`} className="line-clamp-2 font-semibold text-ink hover:text-brand-700">
                          {p.title}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-sand-500">
                          <span>No {p.listing_no}</span>
                          {p.location && <span>· {p.location}</span>}
                          {p.is_featured && (
                            <span className="inline-flex items-center gap-0.5 font-semibold text-accent-700">
                              <Star className="size-3 fill-accent-500 text-accent-500" aria-hidden /> Öne çıkan
                            </span>
                          )}
                          {p.is_demo && <Badge variant="demo">Demo</Badge>}
                          {p.image_count === 0 && <span className="font-semibold text-amber-700">· Fotoğraf yok</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="font-bold whitespace-nowrap text-brand-800 md:px-4 md:py-3">
                    {formatListingPrice(p.price, p.currency, p.listing_type)}
                  </td>
                  <td className="hidden text-sand-700 lg:table-cell lg:px-4 lg:py-3">
                    {LISTING_TYPE_LABELS[p.listing_type]} · {p.type_name}
                  </td>
                  <td className="md:px-4 md:py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="hidden text-sand-700 xl:table-cell xl:px-4 xl:py-3">
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Eye className="size-4 text-sand-400" aria-hidden /> {formatNumber(p.stats.view_count)}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap text-sand-600 lg:table-cell lg:px-4 lg:py-3">{formatDate(p.created_at)}</td>
                  <td className="md:px-4 md:py-3">
                    <PropertyRowActions
                      id={p.id}
                      slug={p.slug}
                      title={p.title}
                      status={p.status}
                      isFeatured={p.is_featured}
                      price={p.price}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={filters.page} pageCount={pageCount} hrefFor={(sayfa) => href({ sayfa })} />
    </>
  );
}
