import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import type { HeroPatternProps } from '@/components/patterns/contracts';
import { heroContent } from '@/components/patterns/hero/content';
import { formatNumber } from '@/lib/format';

/**
 * Hero deseni · immersive (Luxury): kenardan kenara tek görsel, az metin, tek birincil çağrı.
 * Arama kutusu yok — premium portföy önce görsel ve seçkiyle karşılar; arama "Portföy" sayfasında.
 * Sayılar yalnızca gerçek envanterden; görsel yoksa marka rengi zemin.
 */
export function ImmersiveHero(props: HeroPatternProps) {
  const c = heroContent(props);
  const { spotlight, inventory } = props;
  const sale = inventory.byListingType.sale;
  const rent = inventory.byListingType.rent;
  return (
    <section aria-labelledby="hero-baslik" data-pattern="karay-pattern:hero/immersive" className="kp-hero-immersive relative isolate overflow-hidden bg-primary text-white">
      {c.heroImage ? (
        <Image src={c.heroImage} alt="" fill preload sizes="100vw" className="hero-media -z-10 object-cover" />
      ) : spotlight?.cover ? (
        <MediaImage media={spotlight.cover} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="hero-media -z-10 object-cover" />
      ) : null}
      <div className="kp-immersive-scrim absolute inset-0 -z-10" aria-hidden />
      <div className="kp-immersive-inner container-page flex flex-col justify-end">
        <p className="kp-kicker text-white/75">{c.eyebrow}</p>
        <h1 id="hero-baslik" className="mt-5 max-w-4xl font-display text-display-2xl text-white">
          {c.title}
        </h1>
        <div className="mt-8 flex flex-col gap-8 border-t border-white/25 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-xl text-[16.5px] leading-relaxed text-white/80">{c.subtitle}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/ilanlar" className="kp-cta-light">
              Portföyü keşfedin <ArrowRight className="size-4" aria-hidden />
            </Link>
            {sale > 0 && (
              <Link href="/satilik" className="kp-link-light numeric">
                Satılık · {formatNumber(sale)}
              </Link>
            )}
            {rent > 0 && (
              <Link href="/kiralik" className="kp-link-light numeric">
                Kiralık · {formatNumber(rent)}
              </Link>
            )}
          </div>
        </div>
        {!c.heroImage && spotlight && (
          <Link href={`/ilan/${spotlight.slug}`} className="kp-link-light kp-start mt-6 inline-flex max-w-md items-center gap-2 text-[13px]">
            <span className="line-clamp-1">Görseldeki ilan: {spotlight.title}</span>
            <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  );
}
