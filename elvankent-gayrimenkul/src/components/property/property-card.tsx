import Link from 'next/link';
import { Camera, MapPin } from 'lucide-react';
import { LinkPendingOverlay } from '@/components/common/link-pending';
import { MediaImage } from '@/components/common/media-image';
import { PropertyBadges } from '@/components/property/property-badges';
import { CompareToggle, FavoriteButton } from '@/components/property/property-actions';
import { formatArea, formatListingPrice, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { floorLabel, LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import type { PropertyCard as PropertyCardData } from '@/modules/properties/types';

export function propertyLocation(p: Pick<PropertyCardData, 'neighborhoodName' | 'districtName' | 'cityName'>): string {
  return [p.neighborhoodName, p.districtName].filter(Boolean).join(', ') || p.cityName;
}

function specs(p: PropertyCardData): string[] {
  const list: string[] = [];
  if (p.roomsLabel) list.push(p.roomsLabel);
  const area = formatArea(p.netM2 ?? p.grossM2);
  if (area) list.push(p.netM2 ? `${area} net` : area);
  if (p.category === 'konut' || p.category === 'ticari') {
    const floor = floorLabel(p.floor);
    if (floor) list.push(floor);
    if (p.buildingAge !== null) list.push(p.buildingAge === 0 ? 'Sıfır bina' : `${p.buildingAge} yaşında`);
  }
  return list.slice(0, 4);
}

/**
 * İlan kartı. Tüm kart tıklanabilir (başlıktaki bağlantı kartı kaplar);
 * favori ve karşılaştır butonları üstte kalır. Hover animasyonu yalnızca
 * dekoratiftir; mobilde hiçbir işlev hover'a bağlı değildir.
 */
export function PropertyCard({
  property: p,
  priority,
  sizes = '(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw',
  className,
}: {
  property: PropertyCardData;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const href = `/ilan/${p.slug}`;
  const inactive = p.status !== 'published';
  return (
    <article className={cn('card-lift group relative flex flex-col rounded-[1.25rem] p-2', className)}>
      <div className="site-media relative aspect-[4/3] overflow-hidden rounded-[0.875rem] bg-surface-muted">
        {p.cover ? (
          <MediaImage
            media={p.cover}
            alt={p.cover.alt_text ?? p.title}
            fill
            sizes={sizes}
            fetchPriority={priority ? 'high' : undefined}
            loading={priority ? 'eager' : 'lazy'}
            className={cn(
              'object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.06]',
              inactive && 'grayscale-[35%]',
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Fotoğraf yok</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 scrim-bottom opacity-80" aria-hidden />
        <PropertyBadges property={p} className="absolute top-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-1.5" />
        <FavoriteButton propertyId={p.id} title={p.title} className="absolute top-3 right-3" />
        <span className="absolute bottom-3 left-3 rounded-full bg-white/92 px-2.5 py-1 text-[11.5px] font-bold text-foreground backdrop-blur">
          {LISTING_TYPE_LABELS[p.listingType]} · {p.typeName}
        </span>
        {p.imageCount > 1 && (
          <span className="numeric absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11.5px] font-semibold text-white backdrop-blur">
            <Camera className="size-3.5" aria-hidden /> {p.imageCount}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pt-3.5 pb-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <p className="numeric text-[1.3rem] leading-tight font-bold tracking-tight text-primary-ink">
            {formatListingPrice(p.price, p.currency, p.listingType)}
          </p>
          {p.hasPriceDrop && p.pricePrevious && (
            <p className="numeric text-[13px] text-muted-foreground line-through" aria-label={`Önceki fiyat ${formatNumber(p.pricePrevious)}`}>
              {formatNumber(p.pricePrevious)}
            </p>
          )}
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] leading-snug font-semibold text-foreground">
          <Link href={href} className="rounded-sm after:absolute after:inset-0 after:z-[1] after:rounded-[1.25rem] after:content-['']">
            {p.title}
            <LinkPendingOverlay />
          </Link>
        </h3>
        <p className="mt-1.5 flex items-center gap-1 text-[13.5px] text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-1">{propertyLocation(p)}</span>
        </p>
        {specs(p).length > 0 && (
          <ul className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border pt-3 text-[13px] font-medium text-foreground/80">
            {specs(p).map((s, i) => (
              <li key={s} className="flex items-center gap-2.5">
                {i > 0 && <span className="size-1 rounded-full bg-border-strong" aria-hidden />}
                <span className="numeric">{s}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <p className="line-clamp-1 text-[12.5px] text-muted-foreground">{p.highlights.join(' · ')}</p>
          <CompareToggle propertyId={p.id} variant="text" className="-mr-2 shrink-0" />
        </div>
      </div>
    </article>
  );
}
