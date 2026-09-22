import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BedDouble, Building2, Camera, ImageOff, MapPin, Ruler, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from './favorite-button';
import { LinkPendingOverlay } from '@/components/common/link-pending';
import { LISTING_TYPE_LABELS } from '@/lib/constants';
import { formatArea, formatFloor, formatListingPrice, formatRelativeDate } from '@/lib/format';
import { imageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import type { PropertyCardData } from '@/types/database';

interface PropertyCardProps {
  property: PropertyCardData;
  /** İlk ekrandaki kartlar için görseli önceden yükle (LCP) */
  preload?: boolean;
  className?: string;
}

export function PropertyCard({ property: p, preload, className }: PropertyCardProps) {
  const href = `/ilan/${p.slug}`;
  const location = [p.neighborhood_name, p.district_name].filter(Boolean).join(', ');
  const specs = [
    p.gross_m2 ? { icon: Ruler, label: formatArea(p.gross_m2), sr: 'Brüt alan' } : null,
    p.rooms_label && p.category !== 'arsa' ? { icon: BedDouble, label: p.rooms_label, sr: 'Oda sayısı' } : null,
    p.floor && p.category !== 'arsa' ? { icon: Building2, label: formatFloor(p.floor), sr: 'Kat' } : null,
  ].filter(Boolean) as { icon: typeof Ruler; label: string; sr: string }[];

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
        {p.cover ? (
          <Image
            src={imageUrl(p.cover.storage_path)}
            alt={p.cover.alt || p.title}
            fill
            sizes="(min-width: 1280px) 24rem, (min-width: 768px) 45vw, 100vw"
            quality={60}
            preload={preload}
            placeholder={p.cover.blur_data_url ? 'blur' : 'empty'}
            blurDataURL={p.cover.blur_data_url ?? undefined}
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sand-400">
            <ImageOff className="size-10" aria-hidden />
            <span className="sr-only">Fotoğraf yok</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge variant={p.listing_type === 'sale' ? 'sale' : 'rent'}>{LISTING_TYPE_LABELS[p.listing_type]}</Badge>
          {p.is_featured && (
            <Badge variant="featured">
              <Star className="size-3 fill-accent-500 text-accent-500" aria-hidden /> Öne Çıkan
            </Badge>
          )}
          {p.is_demo && <Badge variant="demo">Demo</Badge>}
        </div>
        <FavoriteButton propertyId={p.id} title={p.title} className="absolute top-2.5 right-2.5" />
        {p.image_count > 1 && (
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">
            <Camera className="size-3.5" aria-hidden />
            {p.image_count}
            <span className="sr-only">fotoğraf</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="text-[1.3rem] leading-tight font-extrabold tracking-tight text-brand-800">
          {formatListingPrice(p.price, p.currency, p.listing_type)}
        </p>
        <h3 className="mt-1.5 line-clamp-2 min-h-[2.75rem] text-[15px] leading-snug font-semibold text-ink">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {p.title}
            <LinkPendingOverlay />
          </Link>
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-sand-600">
          <MapPin className="size-3.5 shrink-0 text-accent-600" aria-hidden />
          <span className="truncate">{location}</span>
        </p>

        {specs.length > 0 && (
          <ul className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3.5 text-[13px] font-semibold text-sand-700">
            {specs.map(({ icon: Icon, label, sr }) => (
              <li key={sr} className="inline-flex items-center gap-1.5">
                <Icon className="size-4 text-sand-400" aria-hidden />
                <span className="sr-only">{sr}: </span>
                {label}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-center justify-between pt-4 text-[12.5px] text-sand-500">
          <time dateTime={p.published_at ?? p.created_at}>{formatRelativeDate(p.published_at ?? p.created_at)}</time>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700 transition group-hover:gap-1.5" aria-hidden>
            Detaylar <ArrowRight className="size-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
