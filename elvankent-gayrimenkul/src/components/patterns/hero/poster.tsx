import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import type { HeroPatternProps } from '@/components/patterns/contracts';
import { heroContent } from '@/components/patterns/hero/content';
import { formatNumber } from '@/lib/format';

/**
 * Hero deseni · poster (Proje Lansman): afiş düzeni. Koyu zeminde iri başlık, tek birincil çağrı
 * ve GERÇEK envanter sayaçları (yayındaki ilan, satılık, kiralık, konut); sağda dikey bir afiş
 * karesi (şirket hero görseli ya da vitrindeki ilanın kapağı). Tarih, fiyat, teslim vaadi veya
 * uydurma sayı yok: yalnızca KARAY Web Sitesi Yönetimi'ndeki metinler ve yayındaki ilan sayıları.
 */
export function PosterHero(props: HeroPatternProps) {
  const c = heroContent(props);
  const { spotlight, inventory } = props;
  const counters = [
    { label: 'Yayında ilan', value: inventory.total },
    { label: 'Satılık', value: inventory.byListingType.sale },
    { label: 'Kiralık', value: inventory.byListingType.rent },
    { label: 'Konut', value: inventory.byCategory.konut ?? 0 },
  ]
    .filter((x) => x.value > 0)
    .slice(0, 4);
  return (
    <section aria-labelledby="hero-baslik" data-pattern="karay-pattern:hero/poster" className="kp-hero-poster bg-surface-inverse text-inverse-foreground">
      <div className="container-page kp-poster-grid">
        <div className="kp-poster-text">
          <p className="kp-kicker text-inverse-foreground/70">{c.area ?? c.eyebrow}</p>
          <h1 id="hero-baslik" className="mt-5 font-display text-display-2xl text-inverse-foreground">
            {c.title}
          </h1>
          <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-inverse-foreground/75">{c.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/ilanlar" className="kp-poster-cta">
              İlanları inceleyin <ArrowRight className="size-4" aria-hidden />
            </Link>
            {spotlight && (
              <Link href={`/ilan/${spotlight.slug}`} className="kp-poster-link">
                Öne çıkan ilan <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
          {counters.length > 0 && (
            <dl className="kp-poster-counters" aria-label="Portföy sayıları">
              {counters.map((x) => (
                <div key={x.label}>
                  <dt>{x.label}</dt>
                  <dd className="numeric">{formatNumber(x.value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <figure className="kp-poster-frame">
          <div className="kp-poster-media site-media">
            {c.heroImage ? (
              <Image src={c.heroImage} alt="" fill preload sizes="(min-width: 1024px) 38vw, 100vw" className="hero-media object-cover" />
            ) : spotlight?.cover ? (
              <MediaImage media={spotlight.cover} alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 38vw, 100vw" className="hero-media object-cover" />
            ) : null}
          </div>
          {!c.heroImage && spotlight && (
            <figcaption className="kp-poster-cap">
              <Link href={`/ilan/${spotlight.slug}`} className="line-clamp-1 hover:text-inverse-foreground">
                Görseldeki ilan: {spotlight.title}
              </Link>
            </figcaption>
          )}
        </figure>
      </div>
    </section>
  );
}
