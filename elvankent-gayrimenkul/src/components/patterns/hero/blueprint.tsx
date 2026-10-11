import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import type { HeroPatternProps } from '@/components/patterns/contracts';
import { heroContent } from '@/components/patterns/hero/content';
import { HeroSearch } from '@/components/search/hero-search';
import { formatNumber } from '@/lib/format';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Hero deseni · blueprint (Architectural): 12 sütunlu ızgara. Solda başlık ve NUMARALI kategori
 * dizini (gerçek ilan sayılarıyla), sağda ince çerçeveli, köşe işaretli görsel; altta çizgili
 * arama çubuğu. Düzen, boşluk ve hizalama öne çıkar; süsleme yok.
 */
export function BlueprintHero(props: HeroPatternProps) {
  const c = heroContent(props);
  const { spotlight, inventory, options } = props;
  const index = [
    { href: '/satilik', label: 'Satılık', count: inventory.byListingType.sale },
    { href: '/kiralik', label: 'Kiralık', count: inventory.byListingType.rent },
    { href: '/konut', label: 'Konut', count: inventory.byCategory.konut ?? 0 },
    { href: '/ticari', label: 'Ticari', count: inventory.byCategory.ticari ?? 0 },
    { href: '/arsa', label: 'Arsa', count: inventory.byCategory.arsa ?? 0 },
  ].filter((x) => x.count > 0);
  return (
    <section aria-labelledby="hero-baslik" data-pattern="karay-pattern:hero/blueprint" className="kp-hero-blueprint container-page kp-pad-top">
      <div className="kp-rule-grid grid gap-y-10 lg:grid-cols-12">
        <div className="flex flex-col lg:col-span-5">
          <p className="kp-kicker text-muted-foreground">
            <span className="numeric text-foreground">00</span> — {c.eyebrow}
          </p>
          <h1 id="hero-baslik" className="mt-5 font-display text-display-xl text-foreground">
            {c.title}
          </h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted-foreground">{c.subtitle}</p>
          {index.length > 0 && (
            <ol className="kp-index mt-10" aria-label="Portföy dizini">
              {index.map((x, i) => (
                <li key={x.href}>
                  <Link href={x.href} className="kp-index-row group">
                    <span className="numeric text-muted-foreground">{pad(i + 1)}</span>
                    <span className="font-medium text-foreground">{x.label}</span>
                    <span className="numeric ml-auto text-muted-foreground">{formatNumber(x.count)} ilan</span>
                    <ArrowUpRight className="size-4 text-muted-foreground transition" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
        <figure className="kp-frame relative lg:col-span-7">
          <div className="kp-frame-media site-media relative overflow-hidden bg-surface-muted">
            {c.heroImage ? (
              <Image src={c.heroImage} alt="" fill preload sizes="(min-width: 1024px) 58vw, 100vw" className="hero-media object-cover" />
            ) : spotlight?.cover ? (
              <MediaImage media={spotlight.cover} alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 58vw, 100vw" className="hero-media object-cover" />
            ) : null}
          </div>
          {!c.heroImage && spotlight && (
            <figcaption className="mt-3 flex items-center justify-between gap-3 text-[12.5px] text-muted-foreground">
              <Link href={`/ilan/${spotlight.slug}`} className="line-clamp-1 hover:text-foreground">
                Görseldeki ilan: {spotlight.title}
              </Link>
              {c.area && <span className="shrink-0">{c.area}</span>}
            </figcaption>
          )}
        </figure>
      </div>
      <div className="kp-search-rule mt-10">
        <HeroSearch options={options} tone="surface" />
      </div>
    </section>
  );
}
