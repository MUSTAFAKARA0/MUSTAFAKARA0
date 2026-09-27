import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';
import { NewCustomerDialog } from '@/components/admin/crm/customer-form';
import { AdminPageHeader, EmptyPanel } from '@/components/admin/ui';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { formatDate, formatPhoneDisplay } from '@/lib/format';
import { firstParam, parsePositiveInt } from '@/lib/utils';
import { listCustomers } from '@/modules/crm/admin-queries';
import { LEAD_SOURCE_LABELS } from '@/modules/crm/constants';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Müşteriler' };

export default async function CustomersPage({ searchParams }: PageProps<'/admin/musteriler'>) {
  const ctx = await requirePagePermission('leads.read');
  if (!ctx.plan.features.crm) return <CrmUpsell />;
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const page = Math.max(1, parsePositiveInt(firstParam(sp.sayfa), 10_000) ?? 1);
  const { rows, total, pageCount } = await listCustomers(ctx, { q, page });

  return (
    <>
      <AdminPageHeader title="Müşteriler" description={`${total} müşteri kaydı`} actions={ctx.can('leads.create') && <NewCustomerDialog />} />
      <div className="rounded-2xl border border-border bg-surface shadow-xs">
        <form action="/admin/musteriler" method="get" className="flex gap-2 border-b border-border p-4 sm:p-5">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="c-q" className="sr-only">
              Müşteri ara
            </label>
            <input
              id="c-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Ad, telefon veya e-posta"
              maxLength={60}
              className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-sm focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
            />
          </div>
          <Button type="submit" variant="outline">
            Ara
          </Button>
        </form>
        {rows.length === 0 ? (
          <EmptyPanel icon={Users} title={q ? 'Eşleşen müşteri yok' : 'Henüz müşteri yok'} description="Sitedeki formlardan gelen talepler müşteri kaydını otomatik oluşturur." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/musteriler/${c.id}`} className="flex flex-col gap-1 px-5 py-4 transition hover:bg-surface-muted/50 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{c.fullName}</span>
                    <span className="numeric block truncate text-[13px] text-muted-foreground">
                      {[c.phone ? formatPhoneDisplay(c.phone) : null, c.email].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-4 text-[12.5px] text-muted-foreground">
                    <span>{c.leads} talep</span>
                    {c.source && <span>{LEAD_SOURCE_LABELS[c.source]}</span>}
                    <span>{formatDate(c.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pagination page={page} pageCount={pageCount} hrefFor={(n) => `/admin/musteriler?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { sayfa: String(n) } : {}) })}`} />
    </>
  );
}

function CrmUpsell() {
  return (
    <>
      <AdminPageHeader title="Müşteriler" />
      <EmptyPanel icon={Users} title="CRM planınızda bulunmuyor" description="Müşteri kartları, randevular ve seçkiler için planınızı yükseltin. Talepler bölümü tüm planlarda kullanılabilir." />
    </>
  );
}
