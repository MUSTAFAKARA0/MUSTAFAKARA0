import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Building2, Plus, Search } from 'lucide-react';
import { AdminPageHeader, EmptyPanel, Panel } from '@/components/panel/ui';
import { OrgTable } from '@/components/platform/org-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { cn, firstParam } from '@/lib/utils';
import { CUSTOMER_STATUS_META } from '@/modules/platform/customer-status';
import { CUSTOMER_FILTERS, filterCustomers, isCustomerFilter, listCustomers } from '@/modules/platform/customers';
import { listPlans } from '@/modules/platform/queries';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Organizasyonlar' };

export default async function PlatformOrgsPage({ searchParams }: PageProps<'/platform/organizasyonlar'>) {
  const session = await requireSuperAdminPage();
  const sp = await searchParams;
  const q = (firstParam(sp.q) ?? '').trim().slice(0, 80);
  const rawStatus = firstParam(sp.durum);
  const status = isCustomerFilter(rawStatus) ? rawStatus : null;
  const [all, plans] = await Promise.all([listCustomers(session), listPlans(session)]);
  const rows = filterCustomers(all, q, status);
  const count = (key: (typeof CUSTOMER_FILTERS)[number]) => all.filter((r) => r.customer.key === key).length;
  const href = (durum: string | null) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (durum) p.set('durum', durum);
    const s = p.toString();
    return s ? `/platform/organizasyonlar?${s}` : '/platform/organizasyonlar';
  };
  const chip = (active: boolean) =>
    cn('rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold', active ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface text-foreground/80 hover:border-border-strong');
  return (
    <>
      <AdminPageHeader
        title="Organizasyonlar"
        description="Her müşteri ofisinin durumu: kurulumda, yayına hazır, yayında veya dikkat isteyen. Durum mevcut kayıtlardan (sahip hesabı, site, alan adı, abonelik) hesaplanır."
        actions={
          <Button asChild>
            <Link href="/platform/organizasyonlar/yeni">
              <Plus /> Yeni organizasyon
            </Link>
          </Button>
        }
      />
      <nav aria-label="Müşteri durumu filtresi" className="mb-5 flex flex-wrap gap-2">
        <Link href={href(null)} aria-current={!status ? 'page' : undefined} className={chip(!status)}>
          Tümü <span className="numeric opacity-75">{all.length}</span>
        </Link>
        {CUSTOMER_FILTERS.map((key) => (
          <Link key={key} href={href(key)} aria-current={status === key ? 'page' : undefined} className={chip(status === key)}>
            {CUSTOMER_STATUS_META[key].label} <span className="numeric opacity-75">{count(key)}</span>
          </Link>
        ))}
      </nav>
      <Panel bodyClassName="p-0 sm:p-0">
        <form action="/platform/organizasyonlar" role="search" className="relative border-b border-border p-4 sm:px-6">
          {status && <input type="hidden" name="durum" value={status} />}
          <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground sm:left-9" aria-hidden />
          <label htmlFor="org-q" className="sr-only">
            Ofis adı, kısa ad, alan adı veya sahip e-postası ile ara
          </label>
          <Input id="org-q" name="q" defaultValue={q} placeholder="Ofis adı, kısa ad, alan adı veya sahip e-postası" className="h-10 pl-10" />
        </form>
        {rows.length === 0 ? (
          <EmptyPanel icon={Building2} title="Bu filtrede müşteri yok" />
        ) : (
          <OrgTable orgs={rows} plans={new Map(plans.map((p) => [p.id, p.name]))} />
        )}
      </Panel>
    </>
  );
}
