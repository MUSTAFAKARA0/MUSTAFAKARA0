import Link from 'next/link';
import { Pagination } from '@/components/common/pagination';
import { MediaImage } from '@/components/common/media-image';
import type { ListingResultsPatternProps } from '@/components/patterns/contracts';
import { PropertyBadges } from '@/components/property/property-badges';
import { FavoriteButton } from '@/components/property/property-actions';
import { propertyLocation } from '@/components/property/property-card';
import { formatArea, formatListingPrice } from '@/lib/format';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';

/**
 * İlan listesi deseni · gallery-wide (Luxury): iki sütunlu, görsel baskın seçki. Kartta kutu,
 * gölge veya etiket yığını yok: büyük fotoğraf, editoryal başlık, sakin fiyat. Daha az ilan
 * görünür ama her ilan daha değerli sunulur. Bütün kart tıklanabilir; favori düğmesi üstte kalır.
 */
export function GalleryWideListing({ items, page, pageCount, hrefFor, priorityCount = 2 }: ListingResultsPatternProps) {
  return (
    <div data-pattern="karay-pattern:listing/gallery-wide">
      <ul className="kp-wide-grid grid md:grid-cols-2">
        {items.map((p, i) => {
          const specs = [p.roomsLabel, formatArea(p.netM2 ?? p.grossM2)].filter(Boolean).join(' · ');
          return (
            <li key={p.id}>
              <article className="group relative">
                <div className="kp-wide-media site-media relative overflow-hidden bg-surface-muted">
                  {p.cover ? (
                    <MediaImage
                      media={p.cover}
                      alt={p.cover.alt_text ?? p.title}
                      fill
                      sizes="(min-width: 1312px) 620px, (min-width: 768px) 50vw, 100vw"
                      loading={i < priorityCount ? 'eager' : 'lazy'}
                      fetchPriority={i < priorityCount ? 'high' : undefined}
                      className="object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Fotoğraf yok</div>
                  )}
                  <PropertyBadges property={p} className="absolute top-4 left-4 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-1.5" />
                  <FavoriteButton propertyId={p.id} title={p.title} className="kp-over absolute top-4 right-4" />
                </div>
                <div className="mt-5 flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <p className="kp-kicker text-muted-foreground">
                      {LISTING_TYPE_LABELS[p.listingType]} · {p.typeName} · {propertyLocation(p)}
                    </p>
                    <h3 className="mt-2 font-display text-[1.6rem] leading-tight text-foreground">
                      <Link href={`/ilan/${p.slug}`} className="after:absolute after:inset-0 after:z-[1] after:content-['']">
                        {p.title}
                      </Link>
                    </h3>
                    {specs && <p className="numeric mt-2 text-[14px] text-muted-foreground">{specs}</p>}
                  </div>
                  <p className="kp-wide-price numeric shrink-0 text-[1.05rem] font-medium whitespace-nowrap text-foreground">{formatListingPrice(p.price, p.currency, p.listingType)}</p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
