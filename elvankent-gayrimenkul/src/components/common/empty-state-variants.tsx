import Link from 'next/link';
import { Heart, ImageOff, MapPinned, PackageOpen, SearchX, type LucideIcon } from 'lucide-react';
import { EMPTY_COPY, type EmptyVariant } from '@/components/common/empty-state-copy';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ICONS: Record<EmptyVariant, LucideIcon> = {
  filtered: SearchX,
  'no-listings': PackageOpen,
  'no-photos': ImageOff,
  favorites: Heart,
  'no-region-listings': MapPinned,
};

/**
 * Bağlama duyarlı boş durum: ne olduğunu, neden olabileceğini ve sonraki adımı söyler.
 * Yüzey, kenarlık ve yarıçap tema değişkenlerinden gelir (.su-empty).
 */
export function ContextEmptyState({
  variant,
  suggestions = [],
  clearHref,
  contactHref = '/iletisim',
  className,
}: {
  variant: EmptyVariant;
  suggestions?: string[];
  /** Verilirse "Filtreleri temizle" bağlantısı gösterilir */
  clearHref?: string;
  contactHref?: string | null;
  className?: string;
}) {
  const Icon = ICONS[variant];
  const copy = EMPTY_COPY[variant];
  return (
    <div className={cn('su-empty flex flex-col items-center px-6 py-14 text-center sm:py-16', className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
        <Icon className="size-7" aria-hidden />
      </span>
      <h2 className="mt-5 font-display text-xl text-foreground sm:text-2xl">{copy.title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
      {suggestions.length > 0 && (
        <ul className="mt-5 grid max-w-md gap-2 text-left text-[14px] text-foreground/85" aria-label="Öneriler">
          {suggestions.map((s) => (
            <li key={s} className="su-empty-hint bg-surface-muted/60 py-1.5 pr-3 pl-3">
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {clearHref && (
          <Button asChild>
            <Link href={clearHref}>Filtreleri temizle</Link>
          </Button>
        )}
        {variant === 'favorites' && (
          <Button asChild>
            <Link href="/ilanlar">İlanları keşfedin</Link>
          </Button>
        )}
        {contactHref && variant !== 'favorites' && (
          <Button asChild variant={clearHref ? 'outline' : 'primary'}>
            <Link href={contactHref}>{variant === 'filtered' ? 'Aradığımı bildir' : 'Talebinizi iletin'}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
