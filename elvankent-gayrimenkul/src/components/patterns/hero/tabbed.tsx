import Link from 'next/link';
import type { HeroPatternProps } from '@/components/patterns/contracts';
import { heroContent } from '@/components/patterns/hero/content';
import { HeroSearch } from '@/components/search/hero-search';
import { formatNumber } from '@/lib/format';

/**
 * Hero deseni · tabbed (Plaza Ofis, Kiralık Merkezi): portal düzeni. Marka renginde üst bant
 * (kısa başlık), bandın altına taşan arama kartı (Satılık / Kiralık sekmeleri + alanlar) ve
 * kartın altında gerçek envanterden sayı şeridi. Açılışta seçili sekme, yayında daha çok ilanı
 * olan türdür. Sayılar yalnızca yayındaki ilanlardan; boş sayı gösterilmez.
 */
export function TabbedHero(props: HeroPatternProps) {
  const c = heroContent(props);
  const { options, inventory } = props;
  const stats = [
    { href: '/satilik', label: 'Satılık ilan', value: inventory.byListingType.sale },
    { href: '/kiralik', label: 'Kiralık ilan', value: inventory.byListingType.rent },
    { href: '/konut', label: 'Konut', value: inventory.byCategory.konut ?? 0 },
    { href: '/ticari', label: 'Ticari', value: inventory.byCategory.ticari ?? 0 },
    { href: '/arsa', label: 'Arsa', value: inventory.byCategory.arsa ?? 0 },
    { href: '/bolgeler', label: 'Bölge', value: options.districts.filter((d) => d.count > 0).length },
  ]
    .filter((x) => x.value > 0)
    .slice(0, 4);
  const initial = inventory.byListingType.rent > inventory.byListingType.sale ? 'rent' : 'sale';
  return (
    <section aria-labelledby="hero-baslik" data-pattern="karay-pattern:hero/tabbed" className="kp-hero-tabbed">
      <div className="kp-tabbed-band bg-primary text-primary-fg">
        <div className="container-page kp-tabbed-top">
          <p className="kp-kicker text-primary-fg/80">{c.area ?? c.eyebrow}</p>
          <h1 id="hero-baslik" className="mt-3 max-w-3xl font-display text-display-xl text-primary-fg">
            {c.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-primary-fg/85">{c.subtitle}</p>
        </div>
      </div>
      <div className="container-page kp-tabbed-card-wrap">
        <div className="kp-tabbed-card site-media">
          <HeroSearch options={options} tone="surface" initialListingType={initial} />
        </div>
        {stats.length > 0 && (
          <ul className="kp-tabbed-stats" aria-label="Portföy sayıları">
            {stats.map((x) => (
              <li key={x.label}>
                <Link href={x.href} className="kp-tabbed-stat">
                  <span className="numeric">{formatNumber(x.value)}</span>
                  <span>{x.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
