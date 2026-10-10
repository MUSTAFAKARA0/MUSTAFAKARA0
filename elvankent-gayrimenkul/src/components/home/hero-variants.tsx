import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, MapPin, type LucideIcon } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import { propertyLocation } from '@/components/property/property-card';
import { HeroSearch } from '@/components/search/hero-search';
import { formatArea, formatListingPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import type { SearchOptions } from '@/modules/properties/search-types';
import type { PropertyCard } from '@/modules/properties/types';

/**
 * Premium hero düzenleri (Site Factory › Hero kataloğu). Hepsi aynı veriyi (HeroContent)
 * farklı görsel hiyerarşiyle çizer; veri modeli ortaktır, tasarım farklıdır. Yalnızca sitenin
 * manifestinde seçilen düzen sunucuda çizilir — seçilmeyenlerin işaretlemesi ve kodu
 * tarayıcıya gitmez (sunucu bileşeni; istemci kodu yalnızca ortak HeroSearch).
 *
 * Hareket: yalnızca transform/opacity (Theme Engine › hareket dili); güven satırı ve
 * sayılar yalnızca gerçek veridir (ilan sayısı, ofis konumu, çalışma saatleri).
 */
export interface HeroContent {
  eyebrow: string | null;
  title: string;
  subtitle: string;
  /** "Ankara · Çankaya" gibi konum etiketi (ofis adresinden) */
  locationLabel: string | null;
  trust: { icon: LucideIcon; text: string }[];
  options: SearchOptions;
  spotlight: PropertyCard | null;
  heroImage: string | null;
  /** Ofisin yayındaki ilan sayısı (gerçek veri; 0 ise gösterilmez) */
  publishedCount: number;
}

function HeroImage({ c, sizes, className }: { c: HeroContent; sizes: string; className?: string }) {
  if (c.heroImage) return <Image src={c.heroImage} alt="" fill preload sizes={sizes} className={cn('object-cover', className)} />;
  if (c.spotlight?.cover)
    return <MediaImage media={c.spotlight.cover} alt="" fill loading="eager" fetchPriority="high" sizes={sizes} className={cn('object-cover', className)} />;
  return null;
}

function TrustStrip({ items, tone }: { items: HeroContent['trust']; tone: 'light' | 'dark' }) {
  if (!items.length) return null;
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-px overflow-hidden rounded-2xl',
        items.length >= 3 ? 'sm:grid-cols-3' : items.length === 2 ? 'sm:grid-cols-2' : '',
        tone === 'light' ? 'bg-white/15 ring-1 ring-white/15' : 'bg-border ring-1 ring-border',
      )}
    >
      {items.map(({ icon: Icon, text }) => (
        <li
          key={text}
          className={cn('flex items-center gap-3 px-4 py-3 text-[13.5px] font-medium', tone === 'light' ? 'bg-black/25 text-white/90 backdrop-blur-sm' : 'bg-surface text-foreground/80')}
        >
          <Icon className={cn('size-4 shrink-0', tone === 'light' ? 'text-white/60' : 'text-primary-ink')} aria-hidden />
          <span className="numeric">{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Eyebrow: küçük hap etiket (konum ikonu ile) */
function LocationPill({ text, tone }: { text: string; tone: 'light' | 'dark' }) {
  return (
    <p
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold tracking-[0.16em] uppercase',
        tone === 'light' ? 'bg-white/12 text-white/90 ring-1 ring-white/25 backdrop-blur-sm' : 'bg-surface-muted text-muted-foreground ring-1 ring-border',
      )}
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </p>
  );
}

/**
 * Sinematik: kenardan kenara fotoğraf, büyük tipografi, yüzen arama paneli ve gerçek veri
 * şeridi. Telefonda: fotoğraf + başlık üstte, arama paneli fotoğrafın altına hafifçe binerek
 * ayrı bir blok olur (fotoğraf üzerinde form sıkışmaz).
 */
export function CinematicHero({ c }: { c: HeroContent }) {
  return (
    <section aria-labelledby="hero-baslik" className="relative">
      <div className="hero-media relative isolate flex min-h-[34rem] items-end overflow-hidden bg-primary sm:min-h-[40rem] lg:min-h-[min(88svh,52rem)]">
        <HeroImage c={c} sizes="100vw" className="-z-10" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(8_10_12/0.86),rgb(8_10_12/0.35)_48%,rgb(8_10_12/0.15))]" aria-hidden />
        <div className="absolute inset-y-0 left-0 -z-10 w-2/3 bg-[linear-gradient(to_right,rgb(8_10_12/0.45),transparent)]" aria-hidden />
        <div className="container-page w-full pt-28 pb-24 sm:pb-28 lg:pb-36">
          <div className="max-w-4xl">
            {c.locationLabel && <LocationPill text={c.locationLabel} tone="light" />}
            <h1 id="hero-baslik" className="mt-5 font-display text-[clamp(2.4rem,7vw,5.6rem)] leading-[0.98] tracking-[-0.02em] text-balance text-white">
              {c.title}
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/85 sm:text-lg">{c.subtitle}</p>
          </div>
        </div>
      </div>
      <div className="container-page relative z-10 -mt-14 sm:-mt-16 lg:-mt-24">
        <div className="rounded-[1.75rem] bg-surface p-3 shadow-[0_30px_60px_-30px_rgb(10_14_13/0.45)] ring-1 ring-black/5 sm:p-4">
          <HeroSearch options={c.options} tone="surface" />
        </div>
        {c.trust.length > 0 && (
          <div className="mt-4">
            <TrustStrip items={c.trust} tone="dark" />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Editoryal: asimetrik ızgara — solda büyük serif başlık ve arama, sağda dikey çerçeveli
 * görsel ve üzerine binen künye kartı. Telefonda: başlık → görsel (çerçevesiz) → arama.
 */
export function EditorialHero({ c }: { c: HeroContent }) {
  const s = c.spotlight;
  return (
    <section aria-labelledby="hero-baslik" className="container-page pt-8 pb-4 sm:pt-12 lg:pt-16">
      <div className="grid items-end gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7 lg:pb-6">
          {(c.eyebrow || c.locationLabel) && (
            <p className="eyebrow eyebrow-line">{[c.eyebrow, c.locationLabel].filter(Boolean).join(' · ')}</p>
          )}
          <h1 id="hero-baslik" className="mt-5 font-display text-[clamp(2.5rem,6.2vw,5.4rem)] leading-[1.02] tracking-[-0.02em] text-balance text-foreground">
            {c.title}
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground sm:text-lg">{c.subtitle}</p>
          {c.publishedCount > 0 && (
            <p className="mt-8 flex items-baseline gap-3 border-t border-border pt-5">
              <span className="numeric font-display text-[2.6rem] leading-none text-foreground">{c.publishedCount}</span>
              <span className="text-[14px] font-medium text-muted-foreground">yayında ilan</span>
            </p>
          )}
        </div>
        <div className="relative lg:col-span-5">
          <div className="pointer-events-none absolute inset-0 hidden translate-x-4 translate-y-4 rounded-[1.75rem] border border-border-strong lg:block" aria-hidden />
          <div className="hero-media site-media relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-surface-muted lg:aspect-[4/5]">
            <HeroImage c={c} sizes="(min-width: 1024px) 40vw, 100vw" />
          </div>
          {s && !c.heroImage && (
            <Link
              href={`/ilan/${s.slug}`}
              className="group absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl bg-surface/92 p-3.5 shadow-lg ring-1 ring-black/5 backdrop-blur transition hover:bg-surface sm:right-auto sm:max-w-sm lg:-left-8"
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Görseldeki ilan</span>
                <span className="mt-0.5 line-clamp-1 block text-[14px] font-semibold text-foreground">{s.title}</span>
              </span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </Link>
          )}
        </div>
      </div>
      <div className="mt-10 lg:mt-12">
        <HeroSearch options={c.options} tone="surface" />
      </div>
    </section>
  );
}

/**
 * İlan öncelikli vitrin: başlık satırı + geniş vitrin ilanı fotoğrafı ve üzerine binen ilan
 * paneli (fiyat, konum, temel bilgiler, bağlantı). Vitrin ilanı yoksa sinematik düzene döner.
 * Telefonda panel fotoğrafın altına iner (üst üste binme yok, dokunma alanları çakışmaz).
 */
export function ShowcaseHero({ c }: { c: HeroContent }) {
  const p = c.spotlight;
  if (!p) return <CinematicHero c={c} />;
  const facts = [p.roomsLabel, p.grossM2 ? formatArea(p.grossM2) : null, `${LISTING_TYPE_LABELS[p.listingType]} · ${p.typeName}`].filter(Boolean) as string[];
  return (
    <section aria-labelledby="hero-baslik" className="container-page pt-8 sm:pt-12">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-12">
        <div>
          {c.locationLabel && <LocationPill text={c.locationLabel} tone="dark" />}
          <h1 id="hero-baslik" className="mt-4 font-display text-[clamp(2.2rem,5.4vw,4.4rem)] leading-[1.02] tracking-[-0.02em] text-balance text-foreground">
            {c.title}
          </h1>
        </div>
        <p className="max-w-lg text-[17px] leading-relaxed text-muted-foreground lg:pb-2">{c.subtitle}</p>
      </div>
      <div className="relative mt-8 lg:mt-10">
        <div className="hero-media site-media relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-surface-muted sm:aspect-[16/9] lg:aspect-[21/9]">
          {p.cover && <MediaImage media={p.cover} alt={p.cover.alt_text ?? p.title} fill loading="eager" fetchPriority="high" sizes="(min-width: 1312px) 1248px, 100vw" className="object-cover" />}
        </div>
        <article className="relative z-10 mx-3 -mt-10 rounded-[1.5rem] bg-surface p-5 shadow-[0_30px_60px_-30px_rgb(10_14_13/0.45)] ring-1 ring-black/5 sm:mx-6 sm:p-6 lg:absolute lg:right-8 lg:-bottom-10 lg:mx-0 lg:mt-0 lg:w-[24rem]">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Vitrindeki ilan</p>
          <p className="numeric mt-2 text-[1.6rem] leading-tight font-bold tracking-tight text-primary-ink">{formatListingPrice(p.price, p.currency, p.listingType)}</p>
          <h2 className="mt-1.5 line-clamp-2 text-[16px] leading-snug font-semibold text-foreground">{p.title}</h2>
          <p className="mt-1.5 flex items-center gap-1 text-[13.5px] text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{propertyLocation(p)}</span>
          </p>
          {facts.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {facts.map((f) => (
                <li key={f} className="numeric rounded-full bg-surface-muted px-2.5 py-1 text-[12.5px] font-medium text-foreground/80">
                  {f}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/ilan/${p.slug}`}
            className="btn group mt-5 inline-flex w-full items-center justify-between gap-3 rounded-full bg-primary py-1.5 pr-1.5 pl-5 text-[14.5px] font-semibold text-primary-fg transition active:scale-[0.98]"
          >
            İlanı inceleyin
            <span className="flex size-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="size-4" aria-hidden />
            </span>
          </Link>
        </article>
      </div>
      <div className="mt-8 lg:mt-20">
        <HeroSearch options={c.options} tone="surface" />
      </div>
    </section>
  );
}
