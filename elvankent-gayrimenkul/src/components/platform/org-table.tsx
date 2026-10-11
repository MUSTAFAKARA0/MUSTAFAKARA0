import Link from '@/components/common/intent-link';
import { TableWrap, td, th } from '@/components/panel/ui';
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
    <TableWrap className="[&_table]:min-w-[1120px]">
      <thead className="border-b border-border bg-surface-muted/50">
        <tr>
          <th className={th}>Müşteri</th>
          <th className={th}>Durum</th>
          <th className={th}>Kurulum</th>
          <th className={th}>Sahip</th>
          <th className={th}>Site / alan adı</th>
          <th className={th}>Plan</th>
          <th className={cn(th, 'text-right')}>İlan (yayında)</th>
          <th className={th}>Son etkinlik</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {orgs.map((o) => {
          const sub = o.subscription_status ? SUBSCRIPTION_LABELS[o.subscription_status] : null;
          return (
            <tr key={o.id} className="hover:bg-surface-muted/40" data-customer-status={o.customer.key}>
              <td className={cn(td, 'max-w-72')}>
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
              </td>
              <td className={cn(td, 'max-w-64')}>
                <Badge variant={o.customer.tone}>{o.customer.label}</Badge>
                {o.customer.issues.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[12px] text-danger">
                    {o.customer.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td className={td}>
                <span className="numeric text-[13px] font-semibold">
                  {o.progress.done}/{o.progress.total}
                </span>
                <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${o.progress.percent}%` }} />
                </span>
              </td>
              <td className={cn(td, 'max-w-60')}>
                <p className="truncate text-[13px]">{o.ownerEmail ?? '—'}</p>
                {o.ownerPending && <p className="text-[12px] text-muted-foreground">{INVITATION_LABEL[o.invitationStatus ?? 'not_sent'] ?? 'hesap etkin değil'}</p>}
              </td>
              <td className={cn(td, 'max-w-60')}>
                <p className="text-[13px]">
                  {SITE_LABEL[o.siteStatus]}
                  {o.publishedVersion > 0 ? <span className="text-muted-foreground"> · v{o.publishedVersion}</span> : <span className="text-muted-foreground"> · yayınlanmadı</span>}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {o.primary_domain ?? (o.domainsWaiting > 0 ? `${o.domainsWaiting} alan adı bekliyor` : 'özel alan adı yok')}
                </p>
              </td>
              <td className={td}>
                <span className="font-medium">{o.plan_id ? (plans.get(o.plan_id) ?? o.plan_id) : '—'}</span>
                {sub && (
                  <Badge variant={sub.tone} className="ml-2">
                    {sub.label}
                  </Badge>
                )}
              </td>
              <td className={cn(td, 'numeric text-right')}>
                {formatNumber(Number(o.property_count))} <span className="text-muted-foreground">({formatNumber(Number(o.published_count))})</span>
              </td>
              <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{o.last_activity_at ? formatRelativeDate(o.last_activity_at) : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
