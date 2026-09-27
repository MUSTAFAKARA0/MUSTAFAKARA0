import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { MediaImage } from '@/components/gallery/media-image';
import { SectionHeading } from '@/components/home/section-heading';
import { FeaturedPropertyCard } from '@/components/property/featured-property-card';
import { PropertyGrid } from '@/components/property/property-grid';
import { Button } from '@/components/ui/button';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatDate, formatPhoneDisplay } from '@/lib/format';
import { formatOpeningHours, parseOpeningHours } from '@/modules/content/hours';
import type { PostSummary, RegionPage } from '@/modules/content/queries';
import type { MediaSource } from '@/modules/media/variants';
import type { PropertyCard } from '@/modules/properties/types';
import type { Tenant } from '@/platform/tenant/tenant';

export function ShowcaseSection({ items }: { items: PropertyCard[] }) {
  if (!items.length) return null;
  const [first, ...rest] = items;
  return (
    <section aria-labelledby="vitrin" className="container-page py-16 sm:py-24">
      <SectionHeading
        id="vitrin"
        eyebrow="Seçkiler"
        title="Öne çıkan gayrimenkuller"
        description="Ekibimizin öne çıkardığı, ayrıntılı bilgi ve fotoğraflarıyla yayındaki ilanlar."
        action={{ href: '/ilanlar?one_cikan=1', label: 'Tüm öne çıkanlar' }}
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

export function CategorySection({ tiles }: { tiles: CategoryTile[] }) {
  const visible = tiles.filter((t) => t.count > 0);
  if (visible.length < 2) return null;
  return (
    <section aria-labelledby="kategoriler" className="bg-surface py-16 sm:py-24">
      <div className="container-page">
        <SectionHeading id="kategoriler" eyebrow="Keşfedin" title="Ne tür bir gayrimenkul arıyorsunuz?" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="group relative flex aspect-[4/5] items-end overflow-hidden rounded-2xl bg-surface-inverse p-5 sm:aspect-[3/4]"
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
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-foreground transition group-hover:bg-white">
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

export function LatestSection({ items }: { items: PropertyCard[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="yeni-ilanlar" className="container-page py-16 sm:py-24">
      <SectionHeading id="yeni-ilanlar" eyebrow="Güncel" title="Yeni eklenen ilanlar" action={{ href: '/ilanlar', label: 'Tüm ilanlar' }} />
      <PropertyGrid items={items} columns={4} className="mt-10" />
    </section>
  );
}

export function RegionsSection({ regions, counts }: { regions: RegionPage[]; counts: Map<string, number> }) {
  if (!regions.length) return null;
  return (
    <section aria-labelledby="bolgeler" className="border-y border-border bg-surface py-16 sm:py-20">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <SectionHeading
          id="bolgeler"
          eyebrow="Bölgeler"
          title="Çalıştığımız bölgeleri yakından tanıyın"
          description="Bölge sayfalarında güncel ilanları ve yayındaki ilanlara göre hesaplanan fiyat aralıklarını bulabilirsiniz."
          action={{ href: '/bolgeler', label: 'Tüm bölgeler' }}
        />
        <ul className="divide-y divide-border border-y border-border">
          {regions.slice(0, 6).map((r) => (
            <li key={r.slug}>
              <Link href={`/bolgeler/${r.slug}`} className="group flex items-center justify-between gap-4 py-5">
                <span>
                  <span className="block font-display text-[1.4rem] text-foreground">{r.name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {[r.districtName && r.districtName !== r.name ? r.districtName : null, r.cityName].filter(Boolean).join(', ')}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="numeric text-sm font-semibold text-muted-foreground">{counts.get(r.slug) ?? 0} ilan</span>
                  <ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" aria-hidden />
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

export function ProcessSection() {
  return (
    <section aria-labelledby="surec" className="container-page py-16 sm:py-24">
      <SectionHeading id="surec" eyebrow="Çalışma şeklimiz" title="Gayrimenkul arayışınızda adım adım yanınızdayız" />
      <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-t-2 border-foreground pt-6">
            <span className="numeric font-display text-[2.25rem] leading-none text-accent-ink">0{i + 1}</span>
            <h3 className="mt-4 text-[17px] font-bold text-foreground">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OwnerCtaSection({ tenant }: { tenant: Tenant }) {
  const wa = whatsappHref(tenant.settings.whatsapp ?? tenant.settings.phone, 'Merhaba, gayrimenkulümü satmak/kiraya vermek istiyorum.');
  return (
    <section aria-labelledby="mulk-sahibi" className="container-page pb-16 sm:pb-24">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-surface-inverse px-6 py-12 text-inverse-foreground sm:px-12 sm:py-16 lg:px-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="eyebrow text-accent">Mülk sahipleri için</p>
            <h2 id="mulk-sahibi" className="mt-3 font-display text-display-lg text-white">
              Gayrimenkulünüzü satmak veya kiraya vermek mi istiyorsunuz?
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/75">
              Mülkünüzün bilgilerini paylaşın; bölgedeki güncel ilanları ve piyasa koşullarını birlikte değerlendirerek size
              dönüş yapalım. Resmi değerleme raporu gereken durumlarda lisanslı uzmanlara yönlendiririz.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button asChild size="lg" variant="inverse">
              <Link href="/degerleme">
                Değerleme talebi oluştur <ArrowRight />
              </Link>
            </Button>
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

export function BlogSection({ posts }: { posts: PostSummary[] }) {
  if (!posts.length) return null;
  return (
    <section aria-labelledby="rehber" className="container-page pb-16 sm:pb-24">
      <SectionHeading id="rehber" eyebrow="Rehber" title="Gayrimenkul rehberi" action={{ href: '/blog', label: 'Tüm yazılar' }} />
      <ul className="mt-10 grid gap-8 md:grid-cols-3">
        {posts.slice(0, 3).map((p) => (
          <li key={p.id}>
            <Link href={`/blog/${p.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-surface-muted">
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

export function ContactBand({ tenant }: { tenant: Tenant }) {
  const s = tenant.settings;
  const phone = telHref(s.phone);
  const wa = whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.');
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
    <section aria-labelledby="iletisim-ozet" className="border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div>
          <p className="eyebrow">İletişim</p>
          <h2 id="iletisim-ozet" className="mt-3 font-display text-display-lg text-foreground">
            Sorularınız için buradayız
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted-foreground">
            Aradığınız gayrimenkulü tarif edin veya ilgilendiğiniz ilan hakkında bilgi alın.
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
        <dl className="grid gap-6 sm:grid-cols-2">
          {s.phone && (
            <div className="rounded-2xl bg-surface-muted p-5">
              <dt className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Phone className="size-4" aria-hidden /> Telefon
              </dt>
              <dd className="numeric mt-2 text-[17px] font-semibold">{formatPhoneDisplay(s.phone)}</dd>
            </div>
          )}
          {s.email && (
            <div className="rounded-2xl bg-surface-muted p-5">
              <dt className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Mail className="size-4" aria-hidden /> E-posta
              </dt>
              <dd className="mt-2 text-[16px] font-semibold break-all">{s.email}</dd>
            </div>
          )}
          {address && (
            <div className="rounded-2xl bg-surface-muted p-5 sm:col-span-2">
              <dt className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <MapPin className="size-4" aria-hidden /> Ofis adresi
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
            <div className="rounded-2xl bg-surface-muted p-5 sm:col-span-2">
              <dt className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Clock className="size-4" aria-hidden /> Çalışma saatleri
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
