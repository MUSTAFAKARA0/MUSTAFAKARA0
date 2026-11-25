import Link from '@/components/common/intent-link';
import { TableWrap, Td, Th, Tr } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatRelativeDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SUBSCRIPTION_LABELS } from '@/modules/platform/queries';
import type { CustomerRow } from '@/modules/platform/customers';

const SITE_LABEL: Record<CustomerRow['siteStatus'], string> = { active: 'Ziyaretçiye açık', draft: 'Taslak (kapalı)', maintenance: 'Bakımda' };

const INVITATION_LABEL: Record<string, string> = {
  not_sent: 'davet gönderilmedi',
  pending: 'davet gönderildi',
  expired: 'davetin süresi doldu',
};

/** KARAY müşteri listesi (FAZ 1): müşteri durumu, kurulum, sahip, site ve alan adı tek satırda */
export function OrgTable({ orgs, plans }: { orgs: CustomerRow[]; plans: Map<string, string> }) {
  // Müşteri ofisleri KARAY'ın müşterileridir; en eski kayıt "İlk müşteri" olarak işaretlenir
  const firstCustomerId = [...orgs].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.id;
  return (
    <TableWrap caption="Müşteri ofisleri" zebra cards className="[&_table]:min-w-[1120px] max-sm:[&_table]:min-w-0">
      <thead role="rowgroup" className="border-b border-border bg-surface-muted/50">
        <Tr>
          <Th>Müşteri</Th>
          <Th>Durum</Th>
          <Th>Kurulum</Th>
          <Th>Sahip</Th>
          <Th>Site / alan adı</Th>
          <Th>Plan</Th>
          <Th className="text-right">İlan (yayında)</Th>
          <Th>Son etkinlik</Th>
        </Tr>
      </thead>
      <tbody role="rowgroup" className="divide-y divide-border">
        {orgs.map((o) => {
          const sub = o.subscription_status ? SUBSCRIPTION_LABELS[o.subscription_status] : null;
          return (
            <Tr key={o.id} className="hover:bg-surface-muted/40 max-sm:py-3" data-customer-status={o.customer.key}>
              <Td label="Müşteri" className="max-w-72">
                <Link href={`/platform/organizasyonlar/${o.id}`} className="font-semibold hover:underline">
                  {o.name}
                </Link>
                {o.id === firstCustomerId && (
                  <Badge variant="primary-soft" className="ml-2">
                    İlk müşteri
                  </Badge>
                )}
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {o.slug} · {formatRelativeDate(o.created_at)}
                </p>
              </Td>
              <Td className={cn('max-w-64')} label="Durum">
                <Badge variant={o.customer.tone}>{o.customer.label}</Badge>
                {o.customer.issues.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[12px] text-danger">
                    {o.customer.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
              </Td>
              <Td label="Kurulum">
                <span className="numeric text-[13px] font-semibold">
                  {o.progress.done}/{o.progress.total}
                </span>
                <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${o.progress.percent}%` }} />
                </span>
              </Td>
              <Td className={cn('max-w-60')} label="Sahip">
                <p className="truncate text-[13px]">{o.ownerEmail ?? '—'}</p>
                {o.ownerPending && <p className="text-[12px] text-muted-foreground">{INVITATION_LABEL[o.invitationStatus ?? 'not_sent'] ?? 'hesap etkin değil'}</p>}
              </Td>
              <Td className={cn('max-w-60')} label="Site / alan adı">
                <p className="text-[13px]">
                  {SITE_LABEL[o.siteStatus]}
                  {o.publishedVersion > 0 ? <span className="text-muted-foreground"> · v{o.publishedVersion}</span> : <span className="text-muted-foreground"> · yayınlanmadı</span>}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {o.primary_domain ?? (o.domainsWaiting > 0 ? `${o.domainsWaiting} alan adı bekliyor` : 'özel alan adı yok')}
                </p>
              </Td>
              <Td label="Plan">
                <span className="font-medium">{o.plan_id ? (plans.get(o.plan_id) ?? o.plan_id) : '—'}</span>
                {sub && (
                  <Badge variant={sub.tone} className="ml-2">
                    {sub.label}
                  </Badge>
                )}
              </Td>
              <Td className={cn('numeric text-right')} label="İlan (yayında)">
                {formatNumber(Number(o.property_count))} <span className="text-muted-foreground">({formatNumber(Number(o.published_count))})</span>
              </Td>
              <Td className={cn('whitespace-nowrap text-muted-foreground')} label="Son etkinlik">{o.last_activity_at ? formatRelativeDate(o.last_activity_at) : '—'}</Td>
            </Tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
