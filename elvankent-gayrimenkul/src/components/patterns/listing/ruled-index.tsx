import Link from 'next/link';
import { Pagination } from '@/components/common/pagination';
import { MediaImage } from '@/components/common/media-image';
import type { ListingResultsPatternProps } from '@/components/patterns/contracts';
import { PropertyBadges } from '@/components/property/property-badges';
import { CompareToggle, FavoriteButton } from '@/components/property/property-actions';
import { propertyLocation } from '@/components/property/property-card';
import { formatArea, formatListingPrice } from '@/lib/format';
import { floorLabel, LISTING_TYPE_LABELS, PAGE_SIZE } from '@/modules/properties/constants';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * İlan listesi deseni · ruled-index (Architectural): çizgilerle bölünmüş, NUMARALI dizin.
 * Her kayıt aynı ızgaraya oturur: sıra no + tür + ilan no başlığı, köşesiz kare görsel, başlık,
 * üç hücreli teknik satır (oda · m² · kat) ve fiyat. Bilgi yoğun ama düzenli; süs yok.
 */
export function RuledIndexListing({ items, page, pageCount, hrefFor, priorityCount = 2 }: ListingResultsPatternProps) {
  const offset = (page - 1) * PAGE_SIZE;
  return (
    <div data-pattern="karay-pattern:listing/ruled-index">
      <ol className="kp-ruled grid sm:grid-cols-2 xl:grid-cols-3">
        {items.map((p, i) => {
          const cells = [
            ['Oda', p.roomsLabel ?? '—'],
            ['Alan', formatArea(p.netM2 ?? p.grossM2) ?? '—'],
            ['Kat', floorLabel(p.floor) ?? '—'],
          ];
          return (
            <li key={p.id} className="kp-ruled-item">
              <article className="group relative flex h-full flex-col">
                <header className="kp-track flex items-baseline gap-3 text-[12px] uppercase">
                  <span className="numeric font-semibold text-foreground">{pad(offset + i + 1)}</span>
                  <span className="text-muted-foreground">
                    {LISTING_TYPE_LABELS[p.listingType]} / {p.typeName}
                  </span>
                  <span className="numeric ml-auto text-muted-foreground">{p.referenceNo}</span>
                </header>
                <div className="kp-square site-media relative mt-3 overflow-hidden bg-surface-muted">
                  {p.cover ? (
                    <MediaImage
                      media={p.cover}
                      alt={p.cover.alt_text ?? p.title}
                      fill
                      sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
                      loading={i < priorityCount ? 'eager' : 'lazy'}
                      fetchPriority={i < priorityCount ? 'high' : undefined}
                      className="kp-mute object-cover transition duration-500"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Fotoğraf yok</div>
                  )}
                  <PropertyBadges property={p} className="absolute top-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-1.5" />
                  <FavoriteButton propertyId={p.id} title={p.title} className="kp-over absolute top-3 right-3" />
                </div>
                <h3 className="mt-4 line-clamp-2 text-[16px] leading-snug font-semibold text-foreground">
                  <Link href={`/ilan/${p.slug}`} className="after:absolute after:inset-0 after:z-[1] after:content-['']">
                    {p.title}
                  </Link>
                </h3>
                <p className="mt-1 line-clamp-1 text-[13.5px] text-muted-foreground">{propertyLocation(p)}</p>
                <dl className="kp-cells mt-4 grid grid-cols-3">
                  {cells.map(([k, v]) => (
                    <div key={k}>
                      <dt className="kp-track text-[11px] text-muted-foreground uppercase">{k}</dt>
                      <dd className="numeric mt-0.5 text-[14px] font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <p className="numeric text-[1.15rem] font-bold tracking-tight text-foreground">{formatListingPrice(p.price, p.currency, p.listingType)}</p>
                  <CompareToggle propertyId={p.id} variant="text" className="kp-over relative -mr-2" />
                </div>
              </article>
            </li>
          );
        })}
      </ol>
      <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
