import Link from 'next/link';
import { ArrowRight, Camera, MapPin } from 'lucide-react';
import { MediaImage } from '@/components/gallery/media-image';
import { PropertyBadges } from '@/components/property/property-badges';
import { FavoriteButton } from '@/components/property/property-actions';
import { propertyLocation } from '@/components/property/property-card';
import { formatArea, formatListingPrice } from '@/lib/format';
import { floorLabel, LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import type { PropertyCard } from '@/modules/properties/types';

/** Vitrin kartı: büyük görsel + ayrıntı paneli (ana sayfa öne çıkanlar) */
export function FeaturedPropertyCard({ property: p }: { property: PropertyCard }) {
  const facts = [
    p.roomsLabel ? { label: 'Oda', value: p.roomsLabel } : null,
    p.grossM2 ? { label: 'Brüt alan', value: formatArea(p.grossM2) } : null,
    p.netM2 ? { label: 'Net alan', value: formatArea(p.netM2) } : null,
    p.floor ? { label: 'Kat', value: floorLabel(p.floor, p.totalFloors) } : null,
    p.buildingAge !== null ? { label: 'Bina yaşı', value: p.buildingAge === 0 ? 'Sıfır' : `${p.buildingAge}` } : null,
  ]
    .filter((x): x is { label: string; value: string } => Boolean(x?.value))
    .slice(0, 4);

  return (
    <article className="group relative grid overflow-hidden rounded-[1.5rem] border border-border bg-surface lg:grid-cols-[1.45fr_1fr]">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted lg:aspect-auto lg:min-h-[440px]">
        {p.cover && (
          <MediaImage
            media={p.cover}
            alt={p.cover.alt_text ?? p.title}
            fill
            sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw"
            className="object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
          />
        )}
        <PropertyBadges property={p} className="absolute top-4 left-4 flex flex-wrap gap-1.5" />
        <FavoriteButton propertyId={p.id} title={p.title} className="absolute top-4 right-4" />
        {p.imageCount > 1 && (
          <span className="numeric absolute right-4 bottom-4 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Camera className="size-3.5" aria-hidden /> {p.imageCount} fotoğraf
          </span>
        )}
      </div>
      <div className="flex flex-col p-6 sm:p-8">
        <p className="eyebrow">
          {LISTING_TYPE_LABELS[p.listingType]} · {p.typeName}
        </p>
        <h3 className="mt-3 font-display text-[1.6rem] leading-tight text-foreground sm:text-[1.85rem]">
          <Link href={`/ilan/${p.slug}`} className="after:absolute after:inset-0 after:z-[1] after:content-['']">
            {p.title}
          </Link>
        </h3>
        <p className="mt-3 flex items-center gap-1.5 text-[14.5px] text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden /> {propertyLocation(p)}
        </p>
        <p className="numeric mt-6 text-price font-bold tracking-tight text-foreground">
          {formatListingPrice(p.price, p.currency, p.listingType)}
        </p>
        {facts.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{f.label}</dt>
                <dd className="numeric mt-1 text-[15px] font-semibold text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <span className="mt-auto inline-flex items-center gap-2 pt-8 text-[15px] font-semibold text-primary-ink">
          İlanı incele <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </div>
    </article>
  );
}
