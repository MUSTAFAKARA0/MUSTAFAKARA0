import Link from 'next/link';
import type { ListingSearchPatternProps } from '@/components/patterns/contracts';
import { ActiveFilterChips, ListingToolbar } from '@/components/search/listing-toolbar';
import { cn } from '@/lib/utils';
import { listingHref } from '@/modules/properties/filters';

/**
 * Arama deseni · map-first (Map First): filtreler + BÖLGE kısayolları tek satırda. Mevcut filtre
 * çubuğu (aynı URL mantığı) aynen kullanılır; altına yayında ilanı olan ilçeler gerçek ilan
 * sayılarıyla eklenir — kullanıcı bölgeyi tek dokunuşla değiştirir, liste ve harita birlikte
 * güncellenir. Desen sorgu yapmaz: ilçe sayıları arama seçeneklerinden (veri katmanı) gelir.
 */
export function MapFirstSearch({ query, preset, options }: ListingSearchPatternProps) {
  const districts = [...options.districts].filter((d) => d.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr')).slice(0, 12);
  const pinned = Boolean(preset.district);
  return (
    <div data-pattern="karay-pattern:search/map-first" className="kp-search-mapfirst">
      <ListingToolbar query={query} preset={preset} options={options} />
      {!pinned && districts.length > 1 && (
        <nav aria-label="Bölgeler" className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href={listingHref({ ...query, city: undefined, district: undefined, neighborhood: undefined, page: 1 })} aria-current={!query.district ? 'page' : undefined} className={cn('kp-district', !query.district && 'kp-district-on')}>
            Tüm bölgeler
          </Link>
          {districts.map((d) => {
            const on = query.district === d.slug;
            return (
              <Link
                key={`${d.citySlug}-${d.slug}`}
                href={listingHref({ ...query, city: d.citySlug, district: d.slug, neighborhood: undefined, page: 1 })}
                aria-current={on ? 'page' : undefined}
                className={cn('kp-district', on && 'kp-district-on')}
              >
                {d.name} <span className="numeric opacity-70">{d.count}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <ActiveFilterChips query={query} preset={preset} options={options} />
    </div>
  );
}
