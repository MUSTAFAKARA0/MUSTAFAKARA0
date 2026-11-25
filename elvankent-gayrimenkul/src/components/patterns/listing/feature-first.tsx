import { Pagination } from '@/components/common/pagination';
import type { ListingResultsPatternProps } from '@/components/patterns/contracts';
import { PropertyCard } from '@/components/property/property-card';

/**
 * İlan listesi deseni · feature-first (Miras Konak, Butik Ofis): sayfanın ilk ilanı büyük
 * (iki sütun × iki satır), diğerleri standart ızgarada. Aynı ilan kartı ve aynı veri; yalnızca
 * yerleşim değişir. "Öne çıkan" etiketi yoktur: ilk sıradaki ilan, sıralama neyse odur
 * (uydurma vurgu yok). Telefonda tek sütun.
 */
export function FeatureFirstListing({ items, page, pageCount, hrefFor, priorityCount = 2 }: ListingResultsPatternProps) {
  return (
    <div data-pattern="karay-pattern:listing/feature-first">
      <ul className="kp-ff-grid listing-grid">
        {items.map((p, i) => (
          <li key={p.id} className={i === 0 ? 'kp-ff-lead flex' : 'flex'}>
            <PropertyCard
              property={p}
              priority={i < priorityCount}
              sizes={i === 0 ? '(min-width: 1024px) 66vw, 100vw' : '(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw'}
              className="w-full"
            />
          </li>
        ))}
      </ul>
      <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
