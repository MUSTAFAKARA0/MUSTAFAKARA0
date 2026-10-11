import Link from '@/components/common/intent-link';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, type ListingStatus } from '@/modules/properties/constants';

/** Yönetim sayfası başlığı: başlık, açıklama, sağda işlemler */
export function AdminPageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn('mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex text-[13px] font-medium text-muted-foreground hover:text-foreground">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-[1.85rem] leading-tight text-foreground sm:text-[2.1rem]">{title}</h1>
        {description && <div className="mt-1.5 max-w-3xl text-[14.5px] leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Beyaz yüzeyli bölüm kartı */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('min-w-0 rounded-2xl border border-border bg-surface shadow-xs', className)} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title && (
              <h2 id={id ? `${id}-title` : undefined} className="text-[15.5px] font-bold text-foreground">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('px-5 py-5 sm:px-6', bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  trend,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>>;
  hint?: React.ReactNode;
  href?: string;
  /** Önceki döneme göre yüzde değişim */
  trend?: number | null;
  tone?: 'default' | 'primary' | 'accent' | 'success' | 'warning';
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl',
            tone === 'default' && 'bg-surface-muted text-foreground/70',
            tone === 'primary' && 'bg-primary-soft text-primary-ink',
            tone === 'accent' && 'bg-accent-soft text-accent-ink',
            tone === 'success' && 'bg-success-soft text-success',
            tone === 'warning' && 'bg-warning-soft text-warning',
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="numeric mt-2 text-[1.75rem] leading-none font-bold tracking-tight text-foreground">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
        {trend !== undefined && trend !== null && Number.isFinite(trend) && (
          <span className={cn('inline-flex items-center gap-0.5 font-semibold', trend >= 0 ? 'text-success' : 'text-danger')}>
            {trend >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}%{Math.abs(Math.round(trend))}
          </span>
        )}
        {hint}
      </div>
    </>
  );
  const cls = 'block rounded-2xl border border-border bg-surface p-5 shadow-xs';
  return href ? (
    <Link href={href} className={cn(cls, 'transition hover:border-border-strong hover:shadow-sm')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const STATUS_VARIANT: Record<ListingStatus, React.ComponentProps<typeof Badge>['variant']> = {
  draft: 'neutral',
  pending: 'warning',
  published: 'success',
  archived: 'outline',
  sold: 'info',
  rented: 'info',
};

export function ListingStatusBadge({ status, deleted }: { status: ListingStatus; deleted?: boolean }) {
  if (deleted) return <Badge variant="danger">Çöp kutusunda</Badge>;
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

/** Tablo/liste boş durumu */
export function EmptyPanel({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-4 text-[15.5px] font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Basit tablo kabı: mobilde yatay kaydırma */
export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">{children}</table>
    </div>
  );
}

export const th = 'px-4 py-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase whitespace-nowrap';
export const td = 'px-4 py-3 align-middle';
