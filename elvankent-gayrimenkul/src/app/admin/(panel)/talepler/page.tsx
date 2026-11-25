import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Inbox, Phone, Search } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { EmptyFiltered } from '@/components/panel/empty-filtered';
import { NewLeadDialog } from '@/components/admin/crm/new-lead-dialog';
import { AdminPageHeader, EmptyPanel, TableWrap, Td, Th, Tr } from '@/components/panel/ui';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form-controls';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatDateTime, formatPhoneDisplay, formatRelativeDate } from '@/lib/format';
import { cn, firstParam, parsePositiveInt } from '@/lib/utils';
import { getMembers, getPickerOptions, leadStatusCounts, listLeads, type LeadSource, type LeadStatus } from '@/modules/crm/admin-queries';
import { LEAD_INTENT_LABELS, LEAD_SOURCE_LABELS, LEAD_SOURCES, LEAD_STATUS_LABELS, LEAD_STATUS_TONES, LEAD_STATUSES } from '@/modules/crm/constants';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Talepler' };

export default async function LeadsPage({ searchParams }: PageProps<'/admin/talepler'>) {
  const ctx = await requirePagePermission('leads.read');
  const sp = await searchParams;
  const status = LEAD_STATUSES.includes(firstParam(sp.durum) as LeadStatus) ? (firstParam(sp.durum) as LeadStatus) : undefined;
  const source = LEAD_SOURCES.includes(firstParam(sp.kaynak) as LeadSource) ? (firstParam(sp.kaynak) as LeadSource) : undefined;
  const assigned = ['me', 'none'].includes(firstParam(sp.atanan) ?? '') ? (firstParam(sp.atanan) as 'me' | 'none') : undefined;
  const deleted = firstParam(sp.durum) === 'silinen';
  const page = Math.max(1, parsePositiveInt(firstParam(sp.sayfa), 10_000) ?? 1);
  const q = firstParam(sp.q);
  const customerId = firstParam(sp.musteri);

  const [{ rows, pageCount }, counts, members, picker] = await Promise.all([
    listLeads(ctx, { status, source, assigned, q, page, deleted, customerId }),
    leadStatusCounts(ctx),
    getMembers(ctx),
    ctx.can('leads.create') ? getPickerOptions(ctx) : Promise.resolve({ customers: [], properties: [] }),
  ]);
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  const hrefWith = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const value = firstParam(v);
      if (value) params.set(k, value);
    }
    params.delete('sayfa');
    for (const [k, v] of Object.entries(changes)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    return qs ? `/admin/talepler?${qs}` : '/admin/talepler';
  };

  const tabs: { value: string | null; label: string; count?: number }[] = [
    { value: null, label: 'Tümü', count: counts.all },
    ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s], count: counts[s] })),
    ...(ctx.can('leads.delete') ? [{ value: 'silinen', label: 'Silinenler' }] : []),
  ];
  const activeTab = deleted ? 'silinen' : (status ?? null);

  return (
    <>
      <AdminPageHeader
        title="Talepler"
        breadcrumbs={[{ label: 'Ofis paneli', href: '/admin' }, { label: 'Talepler' }]}
        description="Web sitesindeki formlardan, WhatsApp'tan ve telefonla gelen tüm talepler."
        actions={ctx.can('leads.create') && <NewLeadDialog customers={picker.customers} properties={picker.properties} members={members} />}
      />

      <nav aria-label="Talep durumu" className="tab-strip scrollbar-none relative -mx-4 mb-5 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tabs.map((tab) => {
          const active = tab.value === activeTab;
          return (
            <Link
              key={tab.label}
              href={hrefWith({ durum: tab.value })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition sm:min-h-10',
                active ? 'bg-surface-inverse text-white' : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count !== undefined && <span className={cn('numeric rounded-full px-1.5 text-[11.5px]', active ? 'bg-white/15' : 'bg-surface-muted')}>{tab.count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-1)]">
        <form action="/admin/talepler" method="get" className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
          {status && <input type="hidden" name="durum" value={status} />}
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="lead-q" className="sr-only">
              Talep ara
            </label>
            <input
              id="lead-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Ad, telefon veya e-posta"
              maxLength={60}
              className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-base sm:text-sm focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
            />
          </div>
          <Select name="kaynak" defaultValue={source ?? ''} aria-label="Kaynak" className="h-11 sm:w-48">
            <option value="">Tüm kaynaklar</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select name="atanan" defaultValue={assigned ?? ''} aria-label="Sorumlu" className="h-11 sm:w-52">
            <option value="">Tüm sorumlular</option>
            <option value="me">Bana atananlar</option>
            <option value="none">Atanmamış</option>
          </Select>
          <Button type="submit" variant="outline">
            Filtrele
          </Button>
        </form>

        {rows.length === 0 ? (
          q || source || assigned ? (
            <EmptyFiltered clearHref={hrefWith({ q: null, kaynak: null, atanan: null })} title="Bu filtrelere uygun talep yok" />
          ) : (
            <EmptyPanel icon={Inbox} title="Bu filtrelere uygun talep yok" description="Sitedeki formlardan gelen talepler burada listelenir." />
          )
        ) : (
          <TableWrap caption="Talepler" cards inlineLabels zebra className="[&_table]:min-w-[860px]">
            <thead role="rowgroup" className="border-b border-border bg-surface-muted/50">
              <Tr>
                <Th>Ad / telefon</Th>
                <Th>İlan</Th>
                <Th>Kaynak</Th>
                <Th>Durum</Th>
                <Th>Tarih</Th>
                <Th>
                  <span className="sr-only">Hızlı işlemler</span>
                </Th>
              </Tr>
            </thead>
            <tbody role="rowgroup" className="divide-y divide-border">
              {rows.map((r) => {
                const name = r.customer?.name ?? 'İsimsiz';
                const tel = telHref(r.customer?.phone);
                const wa = whatsappHref(r.customer?.phone);
                return (
                  <Tr key={r.id} className="hover:bg-surface-muted/50">
                    <Td label="Ad / telefon" className="max-w-72">
                      <Link href={`/admin/talepler/${r.id}`} className="text-[15px] font-semibold hover:underline">
                        {name}
                      </Link>
                      <p className="numeric mt-0.5 text-[13px] text-muted-foreground">
                        {[r.customer?.phone ? formatPhoneDisplay(r.customer.phone) : null, r.customer?.email].filter(Boolean).join(' · ') || '—'}
                      </p>
                      {r.message && <p className="mt-1 line-clamp-1 text-[12.5px] text-muted-foreground">{r.message}</p>}
                    </Td>
                    <Td label="İlan" className="max-w-64">
                      <p className="line-clamp-2 text-[13.5px] text-foreground/85">
                        {r.property ? (
                          <>
                            <span className="numeric font-medium">{r.property.referenceNo}</span> · {r.property.title}
                          </>
                        ) : r.intent ? (
                          LEAD_INTENT_LABELS[r.intent]
                        ) : (
                          'Genel talep'
                        )}
                      </p>
                    </Td>
                    <Td label="Kaynak" className="text-[13px] text-muted-foreground">
                      <div>
                        {LEAD_SOURCE_LABELS[r.source]}
                        {r.assignedTo && <span className="block text-[12px]">Sorumlu: {memberName.get(r.assignedTo) ?? '—'}</span>}
                      </div>
                    </Td>
                    <Td label="Durum">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <Badge variant={LEAD_STATUS_TONES[r.status]} size="lg">
                          {LEAD_STATUS_LABELS[r.status]}
                        </Badge>
                        {r.deletedAt && <Badge variant="danger">Silindi</Badge>}
                      </span>
                    </Td>
                    <Td label="Tarih" className="text-[13px] whitespace-nowrap text-muted-foreground">
                      <div>
                        <span title={formatDateTime(r.createdAt)}>{formatRelativeDate(r.createdAt)}</span>
                        {r.nextFollowUpAt && <span className="block font-semibold text-warning">Takip: {formatDateTime(r.nextFollowUpAt)}</span>}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {tel && (
                          <a href={tel} aria-label={`${name} ara`} className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-muted hover:text-foreground sm:size-9">
                            <Phone className="size-[18px]" aria-hidden />
                          </a>
                        )}
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`${name} WhatsApp ile yaz`} className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-muted hover:text-whatsapp sm:size-9">
                            <WhatsAppIcon className="size-[18px]" aria-hidden />
                          </a>
                        )}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </div>
      <Pagination page={page} pageCount={pageCount} hrefFor={(n) => (n > 1 ? `${hrefWith({})}${hrefWith({}).includes('?') ? '&' : '?'}sayfa=${n}` : hrefWith({}))} />
    </>
  );
}
