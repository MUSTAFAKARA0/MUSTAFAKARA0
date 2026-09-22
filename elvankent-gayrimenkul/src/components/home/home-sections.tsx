import Link from 'next/link';
import { ArrowRight, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { SERVICES, VALUES } from '@/content/site-content';
import type { RegionCount } from '@/lib/data/properties';
import { regionPath } from '@/lib/data/regions';
import { cn } from '@/lib/utils';

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="text-xs font-bold tracking-[0.2em] text-accent-700 uppercase">{eyebrow}</p>}
        <h2 id={id} className="mt-2 font-display text-[1.75rem] leading-tight text-ink sm:text-[2.1rem]">{title}</h2>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-sand-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SeeAllLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-brand-700 transition hover:text-brand-900"
    >
      {children}
      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Aktif ilanı olan mahalleler (en çok ilan içerenler önce) */
export function PopularRegions({ regions }: { regions: RegionCount[] }) {
  const items = regions
    .filter((r) => r.neighborhood_slug)
    .slice(0, 8)
    .map((r) => ({
      name: r.neighborhood_name!,
      parent: `${r.district_name}, ${r.city_name}`,
      count: r.listing_count,
      href: regionPath(r.city_slug, r.district_slug, r.neighborhood_slug!),
    }));
  if (!items.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((r, i) => (
        <li key={r.href}>
          <Link
            href={r.href}
            className={cn(
              'group relative flex h-full min-h-32 flex-col justify-between overflow-hidden rounded-2xl p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-lift sm:p-5',
              i === 0 ? 'bg-brand-800 text-white ring-brand-800' : 'bg-surface text-ink ring-line/80',
            )}
          >
            <MapPin className={cn('size-5', i === 0 ? 'text-accent-300' : 'text-accent-600')} aria-hidden />
            <div className="mt-6">
              <p className="font-display text-lg leading-tight sm:text-xl">{r.name}</p>
              <p className={cn('mt-1 text-[12.5px]', i === 0 ? 'text-brand-200' : 'text-sand-500')}>{r.parent}</p>
              <p className={cn('mt-3 text-sm font-bold', i === 0 ? 'text-accent-200' : 'text-brand-700')}>
                {r.count} ilan <ArrowRight className="inline size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ServicesGrid({ compact }: { compact?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SERVICES.map(({ slug, icon: Icon, title, summary }) => (
        <li key={slug} className="rounded-2xl bg-surface p-6 ring-1 ring-line/80 transition hover:shadow-card">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <Icon className="size-6" aria-hidden />
          </span>
          <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
          <p className={cn('mt-2 text-sm leading-relaxed text-sand-600', compact && 'line-clamp-3')}>{summary}</p>
        </li>
      ))}
    </ul>
  );
}

export function WhyUs({ aboutText }: { aboutText: string | null }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
      <div>
        <SectionHeading eyebrow="Neden biz?" title="Güvenle ev almanın, satmanın ve kiralamanın yolu şeffaflıktan geçer" />
        {aboutText && <p className="mt-5 line-clamp-6 text-[15px] leading-relaxed text-sand-700">{aboutText.split('\n')[0]}</p>}
        <div className="mt-6">
          <SeeAllLink href="/hakkimizda">Hakkımızda daha fazla bilgi</SeeAllLink>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {VALUES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-2xl bg-surface p-5 ring-1 ring-line/80">
            <Icon className="size-6 text-accent-600" aria-hidden />
            <h3 className="mt-4 font-bold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-sand-600">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContactCta({ tel, whatsapp }: { tel: string | null; whatsapp: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-800 px-6 py-10 text-white sm:px-10 sm:py-14">
      <svg className="pointer-events-none absolute -right-16 -bottom-24 h-80 w-80 text-brand-700 opacity-60" viewBox="0 0 200 200" aria-hidden>
        <path d="M20 100 L100 30 L180 100 V180 H20 Z" fill="none" stroke="currentColor" strokeWidth="10" strokeLinejoin="round" />
        <path d="M70 180 V120 H130 V180" fill="none" stroke="currentColor" strokeWidth="10" />
      </svg>
      <div className="relative max-w-2xl">
        <p className="text-xs font-bold tracking-[0.2em] text-accent-300 uppercase">Mülk sahipleri için</p>
        <h2 className="mt-3 font-display text-[1.7rem] leading-tight sm:text-4xl">Mülkünüzü satmak veya kiraya vermek mi istiyorsunuz?</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-brand-100">
          Mülkünüzü yerinde inceleyelim, bölgedeki güncel ilanlarla karşılaştıralım ve size en uygun yol haritasını birlikte belirleyelim.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          {whatsapp && (
            <Button asChild variant="whatsapp" size="lg">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-5!" /> WhatsApp ile yazın
              </a>
            </Button>
          )}
          {tel && (
            <Button asChild variant="accent" size="lg">
              <a href={tel}>
                <Phone /> Hemen arayın
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link href="/iletisim">İletişim formu</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
