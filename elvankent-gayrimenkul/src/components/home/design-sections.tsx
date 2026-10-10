import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import { PropertyBadges } from '@/components/property/property-badges';
import { propertyLocation } from '@/components/property/property-card';
import type { SectionOverride } from '@/components/home/sections';
import { formatArea, formatListingPrice } from '@/lib/format';
import { floorLabel, LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import type { PropertyCard } from '@/modules/properties/types';

/**
 * Site Factory bölüm kataloğu (ana sayfa kompozisyonu) — premium bölümler. Tema ile sayfa
 * kompozisyonu ayrıdır: bu bölümler her temayla kullanılabilir ve yalnızca sitenin ana sayfa
 * yapılandırmasında (home.sections) yer alıyorsa sunucuda çizilir.
 */

/**
 * Rakamlar: YALNIZCA gerçek veriden (yayındaki ilan sayıları, bölge rehberi sayısı).
 * Uydurma istatistik, müşteri sayısı veya yıl bilgisi gösterilmez; 2'den az gerçek değer
 * varsa bölüm hiç çizilmez.
 */
export function StatsSection({
  inventory,
  regionCount,
  o,
}: {
  inventory: { total: number; byListingType: { sale: number; rent: number } };
  regionCount: number;
  o?: SectionOverride;
}) {
  const items = [
    { value: inventory.total, label: 'yayında ilan' },
    { value: inventory.byListingType.sale, label: 'satılık' },
    { value: inventory.byListingType.rent, label: 'kiralık' },
    { value: regionCount, label: 'bölge rehberi' },
  ].filter((x) => x.value > 0);
  if (items.length < 2) return null;
  return (
    <section aria-labelledby="rakamlar" className="container-page py-8 sm:py-12">
      <div className="grid gap-8 border-y border-border py-10 lg:grid-cols-[1fr_2.2fr] lg:items-center lg:gap-16">
        <div>
          <p className="eyebrow eyebrow-line">{o?.eyebrow ?? 'Rakamlarla'}</p>
          <h2 id="rakamlar" className="mt-3 font-display text-display-lg text-foreground">
            {o?.title ?? 'Güncel portföyümüz'}
          </h2>
          {o?.description && <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">{o.description}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          {items.map((it) => (
            <div key={it.label} className="border-l border-border pl-5">
              <dt className="text-[13px] font-medium text-muted-foreground">{it.label}</dt>
              <dd className="numeric mt-1 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] leading-none tracking-tight text-foreground">{it.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * Seçilmiş ilan (editoryal): büyük dikey görsel + dergi tipografisiyle künye. Telefonda
 * görsel üstte, künye altta; masaüstünde asimetrik iki sütun.
 */
export function SpotlightSection({ property: p, o }: { property: PropertyCard | null; o?: SectionOverride }) {
  if (!p) return null;
  const facts = [
    p.roomsLabel ? { label: 'Oda', value: p.roomsLabel } : null,
    p.grossM2 ? { label: 'Brüt alan', value: formatArea(p.grossM2) } : null,
    p.netM2 ? { label: 'Net alan', value: formatArea(p.netM2) } : null,
    p.floor ? { label: 'Kat', value: floorLabel(p.floor, p.totalFloors) } : null,
  ].filter((x): x is { label: string; value: string } => Boolean(x?.value));
  return (
    <section aria-labelledby="secilmis-ilan" className="container-page py-16 sm:py-24">
      <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-14">
        <div className="relative lg:col-span-7">
          <div className="site-media relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-surface-muted lg:aspect-[5/4]">
            {p.cover && (
              <MediaImage
                media={p.cover}
                alt={p.cover.alt_text ?? p.title}
                fill
                sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw"
                className="object-cover transition-transform duration-1000 ease-premium hover:scale-[1.03]"
              />
            )}
            <PropertyBadges property={p} className="absolute top-4 left-4 flex flex-wrap gap-1.5" />
          </div>
        </div>
        <div className="lg:col-span-5">
          <p className="eyebrow eyebrow-line">{o?.eyebrow ?? 'Seçilmiş ilan'}</p>
          <h2 id="secilmis-ilan" className="mt-4 font-display text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.08] tracking-[-0.01em] text-balance text-foreground">
            {o?.title ?? p.title}
          </h2>
          <p className="mt-3 flex items-center gap-1.5 text-[15px] text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden /> {propertyLocation(p)}
          </p>
          <p className="numeric mt-6 text-[1.9rem] leading-tight font-bold tracking-tight text-primary-ink">{formatListingPrice(p.price, p.currency, p.listingType)}</p>
          <p className="mt-1 text-[13.5px] font-medium text-muted-foreground">
            {LISTING_TYPE_LABELS[p.listingType]} · {p.typeName}
          </p>
          {facts.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border ring-1 ring-border">
              {facts.map((f) => (
                <div key={f.label} className="bg-surface px-4 py-3">
                  <dt className="text-[12px] font-medium text-muted-foreground">{f.label}</dt>
                  <dd className="numeric mt-0.5 text-[15px] font-semibold text-foreground">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <Link
            href={o?.ctaHref ?? `/ilan/${p.slug}`}
            className="btn group mt-8 inline-flex items-center gap-3 rounded-full bg-foreground py-1.5 pr-1.5 pl-6 text-[15px] font-semibold text-surface transition active:scale-[0.98]"
          >
            {o?.ctaLabel ?? 'İlanı inceleyin'}
            <span className="flex size-9 items-center justify-center rounded-full bg-surface/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="size-4" aria-hidden />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
