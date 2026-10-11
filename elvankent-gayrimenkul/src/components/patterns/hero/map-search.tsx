import Link from 'next/link';
import { ArrowRight, MapPin, Map as MapIcon } from 'lucide-react';
import type { HeroPatternProps } from '@/components/patterns/contracts';
import { heroContent } from '@/components/patterns/hero/content';
import { HeroSearch } from '@/components/search/hero-search';
import { formatNumber } from '@/lib/format';
import { regionListingPath } from '@/modules/properties/routes';

/**
 * Hero deseni · map-search (Map First): arama önce. Kısa başlık, tam genişlik arama ve hemen
 * altında BÖLGE dizini (yayında ilanı olan ilçeler ve gerçek ilan sayıları) → kullanıcı ilk
 * ekranda bölge ↔ ilan ilişkisine geçer. "Haritada keşfet" ilan listesinin harita görünümüne gider.
 */
export function MapSearchHero(props: HeroPatternProps) {
  const c = heroContent(props);
  const { options, publishedCount } = props;
  const cityName = new Map(options.cities.map((x) => [x.slug, x.name]));
  const districts = [...options.districts].filter((d) => d.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr')).slice(0, 8);
  return (
    <section aria-labelledby="hero-baslik" data-pattern="karay-pattern:hero/map-search" className="kp-hero-mapsearch container-page kp-pad-top">
      <div className="kp-map-canvas relative overflow-hidden border border-border bg-surface px-5 py-8 sm:px-10 sm:py-12">
        <div className="relative max-w-3xl">
          <p className="kp-kicker flex items-center gap-2 text-primary-ink">
            <MapPin className="size-4" aria-hidden /> {c.area ?? c.eyebrow}
          </p>
          <h1 id="hero-baslik" className="mt-3 font-display text-display-xl text-foreground">
            {c.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">{c.subtitle}</p>
        </div>
        <div className="relative mt-7">
          <HeroSearch options={options} tone="surface" />
        </div>
        <div className="relative mt-8 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-foreground">Bölgeye göre keşfedin</h2>
          <Link href="/ilanlar" className="inline-flex items-center gap-2 text-[14px] font-semibold text-primary-ink hover:underline">
            <MapIcon className="size-4" aria-hidden />
            {publishedCount > 0 ? `${formatNumber(publishedCount)} ilanı haritada görün` : 'İlanları haritada görün'}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {districts.length > 0 && (
          <ul className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Bölgeler">
            {districts.map((d) => (
              <li key={`${d.citySlug}-${d.slug}`}>
                <Link href={regionListingPath(d.citySlug, d.slug)} className="kp-region-chip">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">{d.name}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{cityName.get(d.citySlug) ?? ''}</span>
                  </span>
                  <span className="numeric shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[12px] font-semibold text-primary-ink">{formatNumber(d.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
