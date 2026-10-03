import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { MediaImage } from '@/components/common/media-image';
import { SectionHeading } from '@/components/home/section-heading';
import { FeaturedPropertyCard } from '@/components/property/featured-property-card';
import { PropertyGrid } from '@/components/property/property-grid';
import { Button } from '@/components/ui/button';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { cn } from '@/lib/utils';
import { formatDate, formatPhoneDisplay } from '@/lib/format';
import { formatOpeningHours, parseOpeningHours } from '@/modules/content/hours';
import type { PostSummary, RegionPage } from '@/modules/content/queries';
import type { MediaSource } from '@/modules/media/variants';
import type { PropertyCard } from '@/modules/properties/types';
import type { Tenant } from '@/platform/tenant/tenant';

/** KARAY Web Sitesi Yönetimi › Ana Sayfa: bölüm metinlerinin isteğe bağlı değiştirilmesi */
export interface SectionOverride {
  eyebrow?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function ShowcaseSection({ items, o }: { items: PropertyCard[]; o?: SectionOverride }) {
  if (!items.length) return null;
  const [first, ...rest] = items;
  return (
    <section aria-labelledby="vitrin" className="container-page py-16 sm:py-24">
      <SectionHeading
        id="vitrin"
        eyebrow={o?.eyebrow ?? 'Seçkiler'}
        title={o?.title ?? 'Öne çıkan gayrimenkuller'}
        description={o?.description ?? 'Ekibimizin öne çıkardığı, ayrıntılı bilgi ve fotoğraflarıyla yayındaki ilanlar.'}
        action={{ href: o?.ctaHref ?? '/ilanlar?one_cikan=1', label: o?.ctaLabel ?? 'Tüm öne çıkanlar' }}
      />
      <div className="mt-10">
        <FeaturedPropertyCard property={first} />
      </div>
      {rest.length > 0 && <PropertyGrid items={rest.slice(0, 3)} className="mt-12" />}
    </section>
  );
}

export interface CategoryTile {
  href: string;
  title: string;
  count: number;
  image: MediaSource | null;
}

export function CategorySection({ tiles, o }: { tiles: CategoryTile[]; o?: SectionOverride }) {
  const visible = tiles.filter((t) => t.count > 0);
  if (visible.length < 2) return null;
  return (
    <section aria-labelledby="kategoriler" className="bg-glow py-16 sm:py-24">
      <div className="container-page">
        <SectionHeading id="kategoriler" eyebrow={o?.eyebrow ?? 'Keşfedin'} title={o?.title ?? 'Ne tür bir gayrimenkul arıyorsunuz?'} description={o?.description} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="site-media group relative flex aspect-[4/5] items-end overflow-hidden rounded-2xl bg-surface-inverse p-5 shadow-md ring-1 ring-black/5 transition-shadow duration-500 hover:shadow-lg sm:aspect-[3/4]"
              >
                {t.image && (
                  <MediaImage
                    media={t.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover opacity-90 transition-transform duration-700 ease-premium group-hover:scale-[1.04]"
                  />
                )}
                <span className="absolute inset-0 scrim-bottom" aria-hidden />
                <span className="relative flex w-full items-end justify-between gap-3">
                  <span>
                    <span className="block font-display text-[1.6rem] leading-tight text-white">{t.title}</span>
                    <span className="numeric mt-1 block text-sm font-medium text-white/80">{t.count} ilan</span>
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-foreground transition duration-300 group-hover:rotate-45 group-hover:bg-white">
                    <ArrowUpRight className="size-5" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LatestSection({ items, o }: { items: PropertyCard[]; o?: SectionOverride }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="yeni-ilanlar" className="container-page py-16 sm:py-24">
      <SectionHeading
        id="yeni-ilanlar"
        eyebrow={o?.eyebrow ?? 'Güncel'}
        title={o?.title ?? 'Yeni eklenen ilanlar'}
        description={o?.description}
        action={{ href: o?.ctaHref ?? '/ilanlar', label: o?.ctaLabel ?? 'Tüm ilanlar' }}
      />
      <PropertyGrid items={items} columns={4} className="mt-10" />
    </section>
  );
}

export function RegionsSection({ regions, counts, o }: { regions: RegionPage[]; counts: Map<string, number>; o?: SectionOverride }) {
  if (!regions.length) return null;
  return (
    <section aria-labelledby="bolgeler" className="border-y border-border bg-glow py-16 sm:py-20">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <SectionHeading
          id="bolgeler"
          eyebrow={o?.eyebrow ?? 'Bölgeler'}
          title={o?.title ?? 'Çalıştığımız bölgeleri yakından tanıyın'}
          description={o?.description ?? 'Bölge sayfalarında güncel ilanları ve yayındaki ilanlara göre hesaplanan fiyat aralıklarını bulabilirsiniz.'}
          action={{ href: o?.ctaHref ?? '/bolgeler', label: o?.ctaLabel ?? 'Tüm bölgeler' }}
        />
        <ul className="grid gap-3">
          {regions.slice(0, 6).map((r) => (
            <li key={r.slug}>
              <Link href={`/bolgeler/${r.slug}`} className="card-lift group flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
                <span>
                  <span className="block font-display text-[1.4rem] text-foreground">{r.name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {[r.districtName && r.districtName !== r.name ? r.districtName : null, r.cityName].filter(Boolean).join(', ')}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="numeric rounded-full bg-primary-soft px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-primary-ink">{counts.get(r.slug) ?? 0} ilan</span>
                  <ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary-ink" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  { title: 'İhtiyacınızı dinleriz', text: 'Bütçenizi, bölge tercihinizi ve olmazsa olmazlarınızı birlikte netleştiririz.' },
  { title: 'Uygun seçenekleri paylaşırız', text: 'Kriterlerinize uyan ilanları bilgileri ve fotoğraflarıyla size özel olarak iletiriz.' },
  { title: 'Gösterim ve değerlendirme', text: 'Uygun zamanda gösterim planlar, sorularınızı yerinde yanıtlarız.' },
  { title: 'Tapu ve teslim', text: 'Belgeler, tapu randevusu ve teslim adımlarında süreci birlikte takip ederiz.' },
];

export function ProcessSection({ o }: { o?: SectionOverride }) {
  return (
    <section aria-labelledby="surec" className="container-page py-16 sm:py-24">
      <SectionHeading id="surec" eyebrow={o?.eyebrow ?? 'Çalışma şeklimiz'} title={o?.title ?? 'Gayrimenkul arayışınızda adım adım yanınızdayız'} description={o?.description} />
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary to-accent" aria-hidden />
            <span className="numeric inline-flex size-12 items-center justify-center rounded-xl bg-accent-soft font-display text-[1.5rem] leading-none text-accent-ink">
              0{i + 1}
            </span>
            <h3 className="mt-5 text-[17px] font-bold text-foreground">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OwnerCtaSection({ tenant, o, valuation = true, whatsapp = true }: { tenant: Tenant; o?: SectionOverride; valuation?: boolean; whatsapp?: boolean }) {
  const wa = !whatsapp ? null : whatsappHref(tenant.settings.whatsapp ?? tenant.settings.phone, 'Merhaba, gayrimenkulümü satmak/kiraya vermek istiyorum.');
  return (
    <section aria-labelledby="mulk-sahibi" className="container-page pb-16 sm:pb-24">
      <div className="glow-inverse relative isolate overflow-hidden rounded-[1.75rem] px-6 py-12 text-inverse-foreground shadow-lg sm:px-12 sm:py-16 lg:px-16">
        <div className="dots-inverse pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow eyebrow-line text-accent">{o?.eyebrow ?? 'Mülk sahipleri için'}</p>
            <h2 id="mulk-sahibi" className="mt-3 font-display text-display-lg text-white">
              {o?.title ?? 'Gayrimenkulünüzü satmak veya kiraya vermek mi istiyorsunuz?'}
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/75">
              {o?.description ??
                'Mülkünüzün bilgilerini paylaşın; bölgedeki güncel ilanları ve piyasa koşullarını birlikte değerlendirerek size dönüş yapalım. Resmi değerleme raporu gereken durumlarda lisanslı uzmanlara yönlendiririz.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            {(valuation || o?.ctaHref) && (
              <Button asChild size="lg" variant="inverse">
                <Link href={o?.ctaHref ?? '/degerleme'}>
                  {o?.ctaLabel ?? 'Değerleme talebi oluştur'} <ArrowRight />
                </Link>
              </Button>
            )}
            {wa && (
              <Button asChild size="lg" variant="whatsapp">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-5" /> WhatsApp&apos;tan yazın
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function BlogSection({ posts, o }: { posts: PostSummary[]; o?: SectionOverride }) {
  if (!posts.length) return null;
  return (
    <section aria-labelledby="rehber" className="container-page pb-16 sm:pb-24">
      <SectionHeading
        id="rehber"
        eyebrow={o?.eyebrow ?? 'Rehber'}
        title={o?.title ?? 'Gayrimenkul rehberi'}
        description={o?.description}
        action={{ href: o?.ctaHref ?? '/blog', label: o?.ctaLabel ?? 'Tüm yazılar' }}
      />
      <ul className="mt-10 grid gap-8 md:grid-cols-3">
        {posts.slice(0, 3).map((p) => (
          <li key={p.id}>
            <Link href={`/blog/${p.slug}`} className="group block">
              <div className="site-media relative aspect-[16/10] overflow-hidden rounded-2xl bg-surface-muted shadow-sm transition-shadow duration-500 group-hover:shadow-md">
                {p.cover && (
                  <MediaImage media={p.cover} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
                )}
              </div>
              <p className="mt-4 text-[13px] text-muted-foreground">{formatDate(p.publishedAt)}</p>
              <h3 className="mt-1.5 text-[17px] leading-snug font-bold text-foreground group-hover:underline">{p.title}</h3>
              {p.excerpt && <p className="mt-2 line-clamp-2 text-[14.5px] text-muted-foreground">{p.excerpt}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ContactBand({ tenant, o, whatsapp = true }: { tenant: Tenant; o?: SectionOverride; whatsapp?: boolean }) {
  const s = tenant.settings;
  const phone = telHref(s.phone);
  const wa = !whatsapp ? null : whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.');
  const address = [s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ');
  const hours = formatOpeningHours(parseOpeningHours(s.opening_hours));
  const directions =
    s.office_latitude !== null && s.office_longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${s.office_latitude},${s.office_longitude}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : null;
  if (!phone && !wa && !address && !s.email) return null;
  return (
    <section aria-labelledby="iletisim-ozet" className="border-t border-border bg-glow">
      <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div>
          <p className="eyebrow eyebrow-line">{o?.eyebrow ?? 'İletişim'}</p>
          <h2 id="iletisim-ozet" className="mt-3 font-display text-display-lg text-foreground">
            {o?.title ?? 'Sorularınız için buradayız'}
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted-foreground">
            {o?.description ?? 'Aradığınız gayrimenkulü tarif edin veya ilgilendiğiniz ilan hakkında bilgi alın.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {phone && (
              <Button asChild size="lg">
                <a href={phone}>
                  <Phone /> Arayın
                </a>
              </Button>
            )}
            {wa && (
              <Button asChild size="lg" variant="whatsapp">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-5" /> WhatsApp&apos;tan sorun
                </a>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link href="/iletisim">İletişim formu</Link>
            </Button>
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {s.phone && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <dt className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-ink"><Phone className="size-4" aria-hidden /></span> Telefon
              </dt>
              <dd className="numeric mt-2 text-[17px] font-semibold">{formatPhoneDisplay(s.phone)}</dd>
            </div>
          )}
          {s.email && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <dt className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-ink"><Mail className="size-4" aria-hidden /></span> E-posta
              </dt>
              <dd className="mt-2 text-[16px] font-semibold break-all">{s.email}</dd>
            </div>
          )}
          {address && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:col-span-2">
              <dt className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-ink"><MapPin className="size-4" aria-hidden /></span> Ofis adresi
              </dt>
              <dd className="mt-2 text-[16px] font-semibold">{address}</dd>
              {directions && (
                <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
                  Yol tarifi al <ArrowUpRight className="size-4" aria-hidden />
                </a>
              )}
            </div>
          )}
          {(hours.length > 0 || s.working_hours_note) && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:col-span-2">
              <dt className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-ink"><Clock className="size-4" aria-hidden /></span> Çalışma saatleri
              </dt>
              <dd className="mt-2 space-y-0.5 text-[15.5px] font-medium">
                {hours.map((h) => (
                  <p key={h} className="numeric">
                    {h}
                  </p>
                ))}
                {s.working_hours_note && <p className="text-muted-foreground">{s.working_hours_note}</p>}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

/** Serbest metin bölümü (ör. Hakkımızda özeti, hizmetler): başlık + paragraflar + isteğe bağlı düğme */
export function TextSection({ id, o, body }: { id: string; o?: SectionOverride; body?: string }) {
  const paragraphs = (body ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!o?.title && paragraphs.length === 0) return null;
  const headingId = `bolum-${id}`;
  return (
    <section aria-labelledby={o?.title ? headingId : undefined} className="container-page py-14 sm:py-20">
      <div className="max-w-3xl">
        {o?.eyebrow && <p className="eyebrow eyebrow-line">{o.eyebrow}</p>}
        {o?.title && (
          <h2 id={headingId} className={cn('font-display text-display-lg text-foreground', o.eyebrow && 'mt-3')}>
            {o.title}
          </h2>
        )}
        {o?.description && <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">{o.description}</p>}
        {paragraphs.length > 0 && (
          <div className="prose-content mt-6">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        {o?.ctaHref && o.ctaLabel && (
          <Button asChild size="lg" className="mt-8">
            <Link href={o.ctaHref}>
              {o.ctaLabel} <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
