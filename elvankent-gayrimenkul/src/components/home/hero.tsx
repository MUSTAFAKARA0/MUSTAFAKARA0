import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Clock, MapPin, Home } from 'lucide-react';
import { MediaImage } from '@/components/gallery/media-image';
import { HeroSearch } from '@/components/search/hero-search';
import type { SearchOptions } from '@/components/search/types';
import { formatOpeningHours, parseOpeningHours } from '@/modules/content/hours';
import { brandingUrl } from '@/modules/media/variants';
import type { PropertyCard } from '@/modules/properties/types';
import type { Tenant } from '@/platform/tenant/tenant';
import type { SectionOverride } from '@/components/home/sections';
import { cn } from '@/lib/utils';

/**
 * Ana sayfa kahraman alanı. Görsel: şirket ayarlarındaki hero görseli; yoksa
 * vitrindeki ilanın kapak fotoğrafı (gerçek veri); o da yoksa marka rengi.
 * Güven satırı yalnızca gerçek verilerden oluşur (ilan sayısı, ofis, saatler).
 */
export function Hero({
  tenant,
  options,
  spotlight,
  publishedCount,
  variant = 'overlay',
  o,
}: {
  tenant: Tenant;
  options: SearchOptions;
  spotlight: PropertyCard | null;
  publishedCount: number;
  /** Tema düzeni: overlay (Klasik) · centered (Marble) · split (Atlas) */
  variant?: 'overlay' | 'centered' | 'split';
  o?: SectionOverride;
}) {
  const s = tenant.settings;
  const heroImage = brandingUrl(s.hero_image_url);
  const hours = formatOpeningHours(parseOpeningHours(s.opening_hours));
  const officeArea = [s.address_district, s.address_city].filter(Boolean).join(', ');
  const title = o?.title ?? s.hero_title ?? 'Size uygun gayrimenkulü, güvenle bulun.';
  const subtitle =
    o?.description ?? s.hero_subtitle ?? `${s.service_area ? `${s.service_area} ` : ''}seçilmiş satılık ve kiralık gayrimenkuller.`;

  const trust = [
    publishedCount > 0 ? { icon: Home, text: `${publishedCount} yayında ilan` } : null,
    officeArea ? { icon: MapPin, text: `Ofis: ${officeArea}` } : null,
    hours[0] ? { icon: Clock, text: hours[0] } : null,
  ].filter((x): x is { icon: typeof Home; text: string } => x !== null);

  const image = heroImage ? (
    <Image src={heroImage} alt="" fill preload sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
  ) : spotlight?.cover ? (
    <MediaImage media={spotlight.cover} alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
  ) : null;

  if (variant === 'split') {
    // Atlas: metin + arama solda, görsel sağda (telefonda görsel üstte)
    return (
      <section aria-labelledby="hero-baslik" className="container-page pt-3 sm:pt-5">
        <div className="site-media grid overflow-hidden rounded-[1.75rem] border border-border bg-surface lg:grid-cols-[1.05fr_1fr]">
          <div className="relative order-first min-h-[260px] bg-primary sm:min-h-[340px] lg:order-last lg:min-h-[560px]">{image}</div>
          <div className="flex flex-col justify-center px-5 py-8 sm:px-10 sm:py-12 lg:px-12">
            {s.service_area && <p className="eyebrow eyebrow-line">{o?.eyebrow ?? s.display_name}</p>}
            <h1 id="hero-baslik" className="mt-3 font-display text-display-xl text-foreground">
              {title}
            </h1>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted-foreground">{subtitle}</p>
            <div className="mt-8">
              <HeroSearch options={options} />
            </div>
            {trust.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] font-medium text-muted-foreground">
                {trust.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2">
                    <Icon className="size-4 text-primary-ink" aria-hidden /> <span className="numeric">{text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    );
  }

  const centered = variant === 'centered';
  return (
    <section aria-labelledby="hero-baslik" className="container-page pt-3 sm:pt-5">
      <div className="site-media relative isolate flex min-h-[600px] items-end overflow-hidden rounded-[1.75rem] bg-primary sm:min-h-[620px] lg:min-h-[680px]">
        {heroImage ? (
          <Image src={heroImage} alt="" fill preload sizes="(min-width: 1312px) 1248px, 100vw" className="-z-10 object-cover" />
        ) : spotlight?.cover ? (
          <MediaImage
            media={spotlight.cover}
            alt=""
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1312px) 1248px, 100vw"
            className="-z-10 object-cover"
          />
        ) : null}
        <div className="absolute inset-0 -z-10 scrim-hero" aria-hidden />

        <div className={cn('w-full px-5 pt-24 pb-6 sm:px-10 sm:pb-10 lg:px-14 lg:pb-12', centered && 'lg:pb-16')}>
          <div className={cn('max-w-3xl animate-fade-up', centered && 'mx-auto text-center')}>
            {s.service_area && <p className="eyebrow text-white/80">{o?.eyebrow ?? s.display_name}</p>}
            <h1 id="hero-baslik" className="mt-3 font-display text-display-2xl text-white">
              {title}
            </h1>
            <p className={cn('mt-4 max-w-2xl text-[17px] leading-relaxed text-white/85 sm:text-lg', centered && 'mx-auto')}>{subtitle}</p>
          </div>
          <div className={cn('mt-8 max-w-[68rem]', centered && 'mx-auto')}>
            <HeroSearch options={options} />
          </div>
          {trust.length > 0 && (
            <ul className={cn('mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] font-medium text-white/85', centered && 'justify-center')}>
              {trust.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon className="size-4 text-white/60" aria-hidden /> <span className="numeric">{text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!heroImage && spotlight && (
          <Link
            href={`/ilan/${spotlight.slug}`}
            className="absolute top-4 right-4 hidden max-w-xs items-center gap-2 rounded-full bg-white/90 py-1.5 pr-3 pl-4 text-[12.5px] font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-white md:inline-flex"
          >
            <span className="line-clamp-1">Görseldeki ilan: {spotlight.title}</span>
            <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  );
}
