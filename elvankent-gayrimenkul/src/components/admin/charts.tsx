import Link from '@/components/common/intent-link';
import { formatNumber, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Sunucuda çizilen alan grafiği (JavaScript gerektirmez). Ekran okuyucular
 * için aynı veriler gizli bir tabloda sunulur.
 */
export function AreaChart({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
  height = 220,
  caption,
}: {
  primary: SeriesPoint[];
  secondary?: SeriesPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  height?: number;
  caption: string;
}) {
  const W = 640;
  const H = height;
  const pad = { top: 12, right: 8, bottom: 26, left: 36 };
  const max = Math.max(1, ...primary.map((p) => p.value), ...(secondary ?? []).map((p) => p.value));
  const niceMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const n = Math.max(primary.length - 1, 1);
  const x = (i: number) => pad.left + (i / n) * (W - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - v / niceMax) * (H - pad.top - pad.bottom);
  const line = (pts: SeriesPoint[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = (pts: SeriesPoint[]) => `${line(pts)} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.max(1, Math.ceil(primary.length / 6));

  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-4 text-[12.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden /> {primaryLabel}
        </span>
        {secondary && secondaryLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent" aria-hidden /> {secondaryLabel}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={caption}>
        <defs>
          <linearGradient id="chartPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
              {formatNumber(Math.round(t))}
            </text>
          </g>
        ))}
        {primary.length > 1 && (
          <>
            <path d={area(primary)} fill="url(#chartPrimary)" />
            <path d={line(primary)} fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {secondary && secondary.length > 1 && (
          <path d={line(secondary)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
        )}
        {primary.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r="7" fill="transparent">
              <title>{`${formatShortDate(p.label)}: ${p.value} ${primaryLabel.toLocaleLowerCase('tr-TR')}${secondary ? `, ${secondary[i]?.value ?? 0} ${secondaryLabel?.toLocaleLowerCase('tr-TR')}` : ''}`}</title>
            </circle>
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
                {formatShortDate(p.label)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Gün</th>
            <th>{primaryLabel}</th>
            {secondaryLabel && <th>{secondaryLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {primary.map((p, i) => (
            <tr key={p.label}>
              <td>{formatShortDate(p.label)}</td>
              <td>{p.value}</td>
              {secondary && <td>{secondary[i]?.value ?? 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Yatay çubuk listesi (kaynaklar, konumlar, en çok görüntülenenler) */
export function BarList({
  items,
  emptyText = 'Bu dönemde veri yok.',
  tone = 'primary',
}: {
  items: { label: React.ReactNode; value: number; href?: string; key: string; hint?: string }[];
  emptyText?: string;
  tone?: 'primary' | 'accent';
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const content = (
          <>
            <span
              className={cn('absolute inset-y-0 left-0 rounded-lg', tone === 'primary' ? 'bg-primary-soft' : 'bg-accent-soft')}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
              aria-hidden
            />
            <span className="relative min-w-0 flex-1 truncate text-[13.5px] font-medium">{item.label}</span>
            <span className="numeric relative shrink-0 text-[13px] font-semibold text-foreground/80">{formatNumber(item.value)}</span>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className="relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 hover:ring-1 hover:ring-border" title={item.hint}>
                {content}
              </Link>
            ) : (
              <div className="relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2" title={item.hint}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
