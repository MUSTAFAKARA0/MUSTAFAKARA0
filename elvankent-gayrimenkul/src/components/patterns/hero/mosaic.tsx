import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import type { HeroPatternProps } from '@/components/patterns/contracts';
import { heroContent } from '@/components/patterns/hero/content';
import { propertyLocation } from '@/components/property/property-card';
import { HeroSearch } from '@/components/search/hero-search';
import { formatNumber } from '@/lib/format';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';

/**
 * Hero deseni · mosaic (Deniz Kıyısı): solda başlık ve bağlantılar, sağda GERÇEK ilanların
 * kapaklarından üçlü fotoğraf mozaiği (her kare ilana gider; altyazı yalnızca ilanın türü ve
 * konumu). Üç kapak yoksa şirket hero görseline veya tek ilan kapağına, o da yoksa marka rengi
 * zemine düşer. Altında tam genişlik arama.
 */
export function MosaicHero(props: HeroPatternProps) {
  const c = heroContent(props);
  const { mosaic = [], spotlight, options, inventory } = props;
  const photos = mosaic.flatMap((p) => (p.cover ? [{ p, cover: p.cover }] : [])).slice(0, 3);
  const sale = inventory.byListingType.sale;
  const rent = inventory.byListingType.rent;
  return (
    <section aria-labelledby="hero-baslik" data-pattern="karay-pattern:hero/mosaic" className="kp-hero-mosaic container-page kp-pad-top">
      <div className="kp-mosaic-layout">
        <div className="kp-mosaic-text">
          <p className="kp-kicker flex items-center gap-2 text-primary-ink">
            <MapPin className="size-4" aria-hidden /> {c.area ?? c.eyebrow}
          </p>
          <h1 id="hero-baslik" className="mt-4 font-display text-display-xl text-foreground">
            {c.title}
          </h1>
          <p className="mt-4 max-w-md text-[16.5px] leading-relaxed text-muted-foreground">{c.subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14.5px] font-semibold">
            <Link href="/ilanlar" className="kp-mosaic-cta">
              Tüm ilanları görün <ArrowRight className="size-4" aria-hidden />
            </Link>
            {sale > 0 && (
              <Link href="/satilik" className="numeric text-primary-ink hover:underline">
                Satılık · {formatNumber(sale)}
              </Link>
            )}
            {rent > 0 && (
              <Link href="/kiralik" className="numeric text-primary-ink hover:underline">
                Kiralık · {formatNumber(rent)}
              </Link>
            )}
          </div>
        </div>
        {photos.length === 3 ? (
          <ul className="kp-mosaic" aria-label="Vitrindeki ilanlar">
            {photos.map(({ p, cover }, i) => (
              <li key={p.id} className="kp-mosaic-cell">
                <Link href={`/ilan/${p.slug}`} className="kp-mosaic-link">
                  <MediaImage
                    media={cover}
                    alt={cover.alt_text ?? p.title}
                    fill
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : undefined}
                    sizes={i === 0 ? '(min-width: 1024px) 34vw, 100vw' : '(min-width: 1024px) 20vw, 50vw'}
                    className="hero-media object-cover"
                  />
                  <span className="kp-mosaic-cap">
                    {LISTING_TYPE_LABELS[p.listingType]} · {propertyLocation(p)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="kp-mosaic-single site-media">
            {c.heroImage ? (
              <Image src={c.heroImage} alt="" fill preload sizes="(min-width: 1024px) 56vw, 100vw" className="hero-media object-cover" />
            ) : spotlight?.cover ? (
              <MediaImage media={spotlight.cover} alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 56vw, 100vw" className="hero-media object-cover" />
            ) : null}
          </div>
        )}
      </div>
      <div className="kp-mosaic-search">
        <HeroSearch options={options} tone="surface" />
      </div>
    </section>
  );
}
