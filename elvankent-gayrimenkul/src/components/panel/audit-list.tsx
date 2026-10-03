import Link from '@/components/common/intent-link';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AUDIT_CATEGORIES, auditTargetHref, describeAudit, type AuditCategory } from '@/modules/audit/labels';
import type { AuditEntry } from '@/modules/audit/queries';

const TONE_DOT = {
  neutral: 'bg-border-strong',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

function categoryOf(action: string): AuditCategory | null {
  for (const [key, c] of Object.entries(AUDIT_CATEGORIES)) if (c.prefixes.some((p) => action.startsWith(p))) return key as AuditCategory;
  return null;
}

/** Denetim kayıtları listesi: kim · ne yaptı · ne zaman · hangi kayıt */
export function AuditList({ rows, orgNames, linkTargets = true }: { rows: AuditEntry[]; orgNames?: Map<string, string>; linkTargets?: boolean }) {
  return (
    <ol className="divide-y divide-border">
      {rows.map((row) => {
        const d = describeAudit(row);
        const href = linkTargets ? auditTargetHref(row) : null;
        const category = categoryOf(row.action);
        return (
          <li key={row.id} className="flex gap-3 px-4 py-3.5 sm:px-6">
            <span className={cn('mt-2 size-2 shrink-0 rounded-full', TONE_DOT[d.tone])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug">
                <span className="font-semibold">{row.actor_label ?? (row.action.startsWith('auth.') ? 'Ziyaretçi' : 'Sistem')}</span>{' '}
                {href ? (
                  <Link href={href} className="hover:underline">
                    {d.text}
                  </Link>
                ) : (
                  d.text
                )}
              </p>
              {d.detail && <p className="mt-0.5 text-[13px] break-words text-muted-foreground">{d.detail}</p>}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                <time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time>
                {category && <Badge variant="outline">{AUDIT_CATEGORIES[category].label}</Badge>}
                {orgNames && <span>{row.organization_id ? (orgNames.get(row.organization_id) ?? 'Organizasyon') : 'Platform'}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
