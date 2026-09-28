import Link from '@/components/common/intent-link';
import { TableWrap, td, th } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { formatBytes, formatNumber, formatRelativeDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ORG_STATUS_LABELS, SUBSCRIPTION_LABELS, type PlatformOrg } from '@/modules/platform/queries';

export function OrgTable({ orgs, plans }: { orgs: PlatformOrg[]; plans: Map<string, string> }) {
  return (
    <TableWrap className="[&_table]:min-w-[980px]">
      <thead className="border-b border-border bg-surface-muted/50">
        <tr>
          <th className={th}>Organizasyon</th>
          <th className={th}>Durum</th>
          <th className={th}>Plan</th>
          <th className={cn(th, 'text-right')}>Kullanıcı</th>
          <th className={cn(th, 'text-right')}>İlan (yayında)</th>
          <th className={cn(th, 'text-right')}>Depolama</th>
          <th className={cn(th, 'text-right')}>Talep (30 gün)</th>
          <th className={th}>Son etkinlik</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {orgs.map((o) => {
          const status = ORG_STATUS_LABELS[o.status];
          const sub = o.subscription_status ? SUBSCRIPTION_LABELS[o.subscription_status] : null;
          return (
            <tr key={o.id} className="hover:bg-surface-muted/40">
              <td className={cn(td, 'max-w-72')}>
                <Link href={`/platform/organizasyonlar/${o.id}`} className="font-semibold hover:underline">
                  {o.name}
                </Link>
                {o.is_default && (
                  <Badge variant="primary-soft" className="ml-2">
                    Varsayılan
                  </Badge>
                )}
                <p className="truncate text-[12.5px] text-muted-foreground">{o.primary_domain ?? o.slug}</p>
              </td>
              <td className={td}>{status && <Badge variant={status.tone}>{status.label}</Badge>}</td>
              <td className={td}>
                <span className="font-medium">{o.plan_id ? (plans.get(o.plan_id) ?? o.plan_id) : '—'}</span>
                {sub && (
                  <Badge variant={sub.tone} className="ml-2">
                    {sub.label}
                  </Badge>
                )}
              </td>
              <td className={cn(td, 'numeric text-right')}>{formatNumber(Number(o.member_count))}</td>
              <td className={cn(td, 'numeric text-right')}>
                {formatNumber(Number(o.property_count))} <span className="text-muted-foreground">({formatNumber(Number(o.published_count))})</span>
              </td>
              <td className={cn(td, 'numeric text-right')}>{formatBytes(Number(o.storage_bytes))}</td>
              <td className={cn(td, 'numeric text-right')}>{formatNumber(Number(o.leads_30d))}</td>
              <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{o.last_activity_at ? formatRelativeDate(o.last_activity_at) : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
