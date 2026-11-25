import Link from '@/components/common/intent-link';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs, type Crumb } from '@/components/panel/breadcrumbs';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, type ListingStatus } from '@/modules/properties/constants';

/** Yönetim sayfası başlığı: başlık, açıklama, sağda işlemler */
export function AdminPageHeader({
  title,
  description,
  actions,
  back,
  breadcrumbs,
  status,
  className,
}: {
  title: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Başlığın yanında durum rozeti */
  status?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn('mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        {back && (
          <Link href={back.href} className="mb-2 inline-flex min-h-6 items-center text-[13px] font-medium text-muted-foreground hover:text-foreground">
            ← {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-[1.85rem] leading-tight tracking-tight text-foreground sm:text-[2.1rem]">{title}</h1>
          {status}
        </div>
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
  variant = 'default',
}: {
  /** default: beyaz kart; quiet: çerçevesiz zemin; form-section: form bölümü (hafif başlık zemini); danger: tehlikeli işlem */
  variant?: 'default' | 'quiet' | 'form-section' | 'danger';
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} data-variant={variant !== 'default' ? variant : undefined}
      className={cn(
        'min-w-0 scroll-mt-24 rounded-2xl border border-border bg-surface shadow-[var(--shadow-1)]',
        variant === 'quiet' && 'border-transparent bg-surface-muted/60 shadow-none',
        variant === 'form-section' && 'overflow-hidden',
        variant === 'danger' && 'border-danger/30',
        className,
      )} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <div
          className={cn(
            'flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6',
            variant === 'form-section' && 'bg-surface-muted/50',
            variant === 'danger' && 'border-danger/20 bg-danger-soft/50',
          )}
        >
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
  loading = false,
  sparkline,
  trendLabel,
}: {
  loading?: boolean;
  /** Gerçek günlük seriden küçük grafik (Sparkline); veri yoksa verilmez */
  sparkline?: React.ReactNode;
  /** trend yanında karşılaştırma açıklaması, ör. "önceki 14 güne göre" */
  trendLabel?: string;
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
        <p className="min-w-0 text-[13px] font-semibold break-words text-muted-foreground">{label}</p>
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
      {loading ? (
        <span className="skeleton mt-3 block h-7 w-20" aria-hidden />
      ) : (
        <p className="numeric mt-2 text-[1.75rem] leading-none font-bold tracking-tight text-foreground">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground [&>*]:min-w-0 [&>*]:break-words">
        {trend !== undefined && trend !== null && Number.isFinite(trend) && (
          <span className={cn('inline-flex items-center gap-0.5 font-semibold', trend >= 0 ? 'text-success' : 'text-danger')}>
            {trend >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}%{Math.abs(Math.round(trend))}
          </span>
        )}
        {trend !== undefined && trend !== null && Number.isFinite(trend) && trendLabel && <span>{trendLabel}</span>}
        {hint}
      </div>
      {sparkline && <div className="mt-3">{sparkline}</div>}
    </>
  );
  const cls = 'block rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-1)]';
  return href ? (
    <Link href={href} className={cn(cls, 'transition hover:border-border-strong hover:shadow-[var(--shadow-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary')}>
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

/** Tablo/liste boş durumu. illustration verilirse simgenin yerinde gösterilir (ör. KARAYS yardımcı maskotu) */
export function EmptyPanel({
  icon: Icon,
  illustration,
  title,
  description,
  action,
}: { title: string; description?: string; action?: React.ReactNode } & ({ icon: LucideIcon; illustration?: never } | { icon?: never; illustration: React.ReactNode })) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
      ) : (
        illustration
      )}
      <p className="mt-4 text-[15.5px] font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Tablo kabı: mobilde yatay kaydırma. İsteğe bağlı: yapışkan başlık, yoğunluk, zebra, ekran okuyucu başlığı (caption),
 * mobilde kart satırlar (cards: hücrelere data-label verilmelidir).
 */
export function TableWrap({
  children,
  className,
  caption,
  stickyHeader = false,
  density = 'default',
  zebra = false,
  cards = false,
  inlineLabels = false,
}: {
  children: React.ReactNode;
  className?: string;
  caption?: string;
  stickyHeader?: boolean;
  density?: 'default' | 'compact' | 'comfortable';
  zebra?: boolean;
  cards?: boolean;
  /** Kart kipinde etiket ile değer yan yana (hücre içeriği tek sarmalayıcı öğe olmalı) */
  inlineLabels?: boolean;
}) {
  return (
    <div className={cn('relative', stickyHeader ? 'overflow-x-clip' : 'overflow-x-auto', className)} {...(stickyHeader || !caption ? {} : { tabIndex: 0, role: 'region', 'aria-label': caption })}>
      <table
        data-sticky={stickyHeader || undefined}
        data-density={density === 'default' ? undefined : density}
        data-zebra={zebra || undefined}
        data-cards={cards || undefined}
        data-inline-labels={(cards && inlineLabels) || undefined}
        role={cards ? 'table' : undefined}
        className="data-table w-full min-w-[640px] border-collapse text-left text-[14px]"
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export const th = 'px-4 py-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase whitespace-nowrap';
export const td = 'px-4 py-3 align-middle';

/** Sütun başlığı: scope=col, isteğe bağlı sıralama durumu (aria-sort); sıralama bağlantısı children içinde verilir */
export function Th({ children, className, sort, ...rest }: Omit<React.ComponentProps<'th'>, 'aria-sort' | 'scope' | 'role'> & { sort?: 'ascending' | 'descending' | 'none' }) {
  return (
    <th scope="col" role="columnheader" aria-sort={sort} className={cn(th, className)} {...rest}>
      {children}
    </th>
  );
}

/**
 * Kart kipi (TableWrap cards) için anlamlı satır/hücre: CSS ile blok görünüme geçse de tablo anlamı
 * (row / cell / columnheader) açık rollerle korunur. label: mobilde değerin üstünde görünen sütun adı.
 */
export function Tr({ children, className, ...rest }: React.ComponentProps<'tr'>) {
  return (
    <tr role="row" className={className} {...rest}>
      {children}
    </tr>
  );
}

export function Td({ children, className, label, ...rest }: React.ComponentProps<'td'> & { label?: string }) {
  return (
    <td role="cell" data-label={label} className={cn(td, className)} {...rest}>
      {children}
    </td>
  );
}

/** Sıkı metrik şeridi: ikincil sayılar (başlık + 2/4 sütunlu değer listesi); öksüz satır bırakmaz */
export function MetricStrip({ title, items }: { title: string; items: { label: string; value: React.ReactNode; href?: string; hint?: string }[] }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-2xl border border-border bg-surface shadow-[var(--shadow-1)]">
      <h2 className="border-b border-border px-5 py-3 text-[12px] font-bold tracking-[0.1em] text-muted-foreground uppercase">{title}</h2>
      <ul className={cn('grid grid-cols-2', items.length >= 4 ? 'sm:grid-cols-4' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {items.map((it, i) => {
          const inner = (
            <>
              <span className="block text-[12.5px] font-medium text-muted-foreground">{it.label}</span>
              <span className="numeric mt-1 block text-[1.35rem] leading-none font-bold text-foreground">{typeof it.value === 'number' ? it.value.toLocaleString('tr-TR') : it.value}</span>
              {it.hint && <span className="mt-1 block text-[12px] text-muted-foreground">{it.hint}</span>}
            </>
          );
          const cell = cn('block h-full px-5 py-3.5', i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border', 'sm:border-t-0', i > 0 && 'sm:border-l');
          return (
            <li key={it.label} className="min-w-0">
              {it.href ? (
                <Link href={it.href} className={cn(cell, 'transition hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary')}>
                  {inner}
                </Link>
              ) : (
                <div className={cell}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
