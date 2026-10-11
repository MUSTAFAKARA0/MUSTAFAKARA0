'use client';

import Link from 'next/link';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { List, Map as MapIcon, MapPin } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import type { MapPoint } from '@/components/patterns/contracts';
import { FavoriteButton } from '@/components/property/property-actions';
import { formatArea, formatListingPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import type { PropertyCard } from '@/modules/properties/types';

// Harita (Leaflet) bu desenin içinden ayrıca tembel yüklenir: liste anında çizilir, harita
// masaüstünde hemen, telefonda yalnızca "Harita" seçilince indirilir
const ResultsMap = lazy(() => import('@/components/patterns/listing/map-results-map'));

const MARKER = 'karay-pattern:listing/map-results';

export interface MapResultsProps {
  items: PropertyCard[];
  points: MapPoint[];
  attribution: string;
  maxZoom: number;
  /** Sunucuda çizilen sayfalama (liste sütununun altında) */
  children?: ReactNode;
}

/**
 * İlan listesi deseni · map-results (Map First): LİSTE ↔ HARİTA ilişkisi.
 * Masaüstü: solda kompakt sonuçlar, sağda yapışkan harita; karta gelince haritadaki fiyat
 * işareti vurgulanır, işarete tıklanınca kart öne çıkar. Telefon: Liste / Harita geçişi.
 * Konumlar veri katmanından gelir (herkese açık konum; kesin değilse yaklaşık bölge).
 */
export default function MapResults({ items, points, attribution, maxZoom, children }: MapResultsProps) {
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [active, setActive] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const located = new Set(points.map((p) => p.id));
  const showMap = desktop || mode === 'map';

  return (
    <div data-pattern={MARKER} className="kp-map-results">
      <div role="radiogroup" aria-label="Görünüm" className="mb-5 inline-flex rounded-full bg-surface-muted p-1 ring-1 ring-border lg:hidden">
        {(
          [
            ['list', 'Liste', List],
            ['map', `Harita (${points.length})`, MapIcon],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => setMode(id)}
            className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition', mode === id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div className="kp-map-layout">
        <div className={cn('min-w-0', mode === 'map' && 'hidden lg:block')}>
          <ul className="flex flex-col gap-3" aria-label="Sonuçlar">
            {items.map((p, i) => (
              <li key={p.id} id={`sonuc-${p.id}`}>
                <article
                  onMouseEnter={() => setActive(p.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(p.id)}
                  className={cn('kp-result group relative grid gap-4 p-2', active === p.id && 'kp-result-active')}
                >
                  <div className="site-media relative aspect-[4/3] overflow-hidden bg-surface-muted">
                    {p.cover && <MediaImage media={p.cover} alt={p.cover.alt_text ?? p.title} fill sizes="160px" loading={i < 3 ? 'eager' : 'lazy'} className="object-cover" />}
                  </div>
                  <div className="flex min-w-0 flex-col py-0.5 pr-9">
                    <p className="numeric text-[1.05rem] font-bold tracking-tight text-foreground">{formatListingPrice(p.price, p.currency, p.listingType)}</p>
                    <h3 className="mt-0.5 line-clamp-2 text-[14.5px] leading-snug font-semibold text-foreground">
                      <Link href={`/ilan/${p.slug}`} className="after:absolute after:inset-0 after:z-[1] after:content-['']">
                        {p.title}
                      </Link>
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[12.5px] text-muted-foreground">
                      {LISTING_TYPE_LABELS[p.listingType]} · {[p.roomsLabel, formatArea(p.netM2 ?? p.grossM2)].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-auto flex items-center gap-1 pt-1.5 text-[12.5px] text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="line-clamp-1">{[p.neighborhoodName, p.districtName].filter(Boolean).join(', ') || p.cityName}</span>
                      {!located.has(p.id) && <span className="shrink-0">· haritada yok</span>}
                    </p>
                  </div>
                  <FavoriteButton propertyId={p.id} title={p.title} className="kp-over absolute top-2 right-2" />
                </article>
              </li>
            ))}
          </ul>
          {children}
        </div>
        <div className={cn('min-w-0', mode === 'list' && 'hidden lg:block')}>
          <div className="kp-map-pane relative overflow-hidden lg:sticky lg:top-24">
            {showMap ? (
              <Suspense fallback={<MapPlaceholder />}>
                <ResultsMap items={items} points={points} active={active} onSelect={setActive} attribution={attribution} maxZoom={maxZoom} />
              </Suspense>
            ) : (
              <MapPlaceholder />
            )}
            {points.length === 0 && (
              <p className="absolute inset-x-3 top-3 z-[500] rounded-lg bg-surface/95 px-3 py-2 text-center text-[13px] text-foreground shadow-sm">
                Bu sonuçlar için haritada gösterilebilecek konum yok.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-muted text-muted-foreground">
      <MapIcon className="size-8" aria-hidden />
    </div>
  );
}
