import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { HeroSearch } from '@/components/home/hero-search';
import { ContactCta, PopularRegions, SectionHeading, SeeAllLink, ServicesGrid, WhyUs } from '@/components/home/home-sections';
import { PropertyGrid } from '@/components/property/property-grid';
import { POPULAR_SEARCHES } from '@/content/site-content';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { getFeaturedProperties, getLatestProperties, getRegionCounts } from '@/lib/data/properties';
import { getSiteSettings } from '@/lib/data/settings';
import { getTaxonomy } from '@/lib/data/taxonomy';

export const revalidate = 300;

export default async function HomePage() {
  const [settings, tax, featured, latest, regions] = await Promise.all([
    getSiteSettings(),
    getTaxonomy(),
    getFeaturedProperties(6),
    getLatestProperties(8),
    getRegionCounts(),
  ]);
  const tel = telHref(settings.phone);
  const wa = whatsappHref(settings.whatsapp ?? settings.phone, `Merhaba, ${settings.business_name} web sitesinden yazıyorum.`);
  const featuredIds = new Set(featured.map((p) => p.id));
  const latestOnly = latest.filter((p) => !featuredIds.has(p.id)).slice(0, 8);
  const latestPool = latestOnly.length >= 4 ? latestOnly : latest;
  // Izgarada yarım satır kalmasın: 4'ün katı kadar göster
  const latestToShow = latestPool.length >= 4 ? latestPool.slice(0, Math.floor(latestPool.length / 4) * 4) : latestPool;

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-800">
        <HeroBackdrop />
        <div className="container-page relative pt-14 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3.5 py-1.5 text-[12.5px] font-semibold tracking-wide text-accent-200 ring-1 ring-white/10">
              <Building2 className="size-3.5" aria-hidden /> Elvankent · Eryaman · Etimesgut · Ankara
            </p>
            <h1 className="mt-5 font-display text-[2.35rem] leading-[1.08] text-white sm:text-[3.25rem] lg:text-[3.75rem]">
              Hayalinizdeki gayrimenkulü <span className="text-accent-300 italic">birlikte</span> bulalım
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-brand-100 sm:text-lg">
              Satılık ve kiralık daire, müstakil ev, iş yeri ve arsa ilanlarını inceleyin; aradığınız özellikteki mülk için bize tek
              tıkla ulaşın.
            </p>
          </div>
          <div className="mt-9 max-w-5xl">
            <HeroSearch
              options={{
                cities: tax.cities,
                districts: tax.districts,
                neighborhoods: tax.neighborhoods,
                propertyTypes: tax.propertyTypes,
              }}
            />
            <nav aria-label="Popüler aramalar" className="mt-5 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-semibold text-brand-200">Popüler:</span>
              {POPULAR_SEARCHES.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="rounded-full bg-white/8 px-3 py-1.5 font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>

      <div className="container-page space-y-20 py-16 sm:space-y-24 sm:py-20">
        {featured.length > 0 && (
          <section aria-labelledby="one-cikan">
            <SectionHeading
              id="one-cikan"
              eyebrow="Seçkin portföy"
              title="Öne Çıkan İlanlar"
              description="Konumu, fiyatı ve özellikleriyle öne çıkan, özenle seçilmiş ilanlarımız."
              action={<SeeAllLink href="/ilanlar">Tüm ilanlar</SeeAllLink>}
            />
            <PropertyGrid properties={featured} className="mt-8" preloadFirst={0} />
          </section>
        )}

        <section aria-labelledby="yeni-ilanlar-baslik">
          <SectionHeading
            id="yeni-ilanlar-baslik"
            eyebrow="Güncel"
            title="Yeni Eklenen İlanlar"
            action={<SeeAllLink href="/ilanlar">Tümünü gör</SeeAllLink>}
          />
          {latestToShow.length > 0 ? (
            <PropertyGrid properties={latestToShow} columns={4} className="mt-8" />
          ) : (
            <EmptyState
              className="mt-8"
              icon={Building2}
              title="Yeni ilanlar çok yakında"
              description="Portföyümüz güncelleniyor. Aradığınız özellikteki mülk için bize ulaşın, uygun ilanları size iletelim."
            />
          )}
        </section>

        {regions.some((r) => r.neighborhood_slug) && (
          <section aria-labelledby="bolgeler">
            <SectionHeading
              id="bolgeler"
              eyebrow="Bölgeler"
              title="Popüler Bölgeler"
              description="Etimesgut ve çevresinde en çok ilan bulunan mahalleleri keşfedin."
            />
            <div className="mt-8">
              <PopularRegions regions={regions} />
            </div>
          </section>
        )}

        <section aria-labelledby="hizmetler">
          <SectionHeading
            id="hizmetler"
            eyebrow="Hizmetlerimiz"
            title="Alım, satım ve kiralamada uçtan uca destek"
            action={<SeeAllLink href="/hizmetlerimiz">Hizmet detayları</SeeAllLink>}
          />
          <div className="mt-8">
            <ServicesGrid compact />
          </div>
        </section>

        <section aria-label="Neden biz">
          <WhyUs aboutText={settings.about_text} />
        </section>

        <section aria-label="İletişim">
          <ContactCta tel={tel} whatsapp={wa} />
        </section>
      </div>
    </>
  );
}

/** Hafif, görsel dosya gerektirmeyen dekoratif arka plan (LCP'yi etkilemez) */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--brand-600),transparent_60%)] opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--brand-950),transparent_55%)]" />
      <svg className="absolute right-0 bottom-0 h-[85%] w-auto max-w-none text-white opacity-[0.07]" viewBox="0 0 600 420" fill="none">
        <path d="M40 420V230l90-70 90 70v190" stroke="currentColor" strokeWidth="3" />
        <path d="M220 420V150h120v270" stroke="currentColor" strokeWidth="3" />
        <path d="M340 420V80l70-50 70 50v340" stroke="currentColor" strokeWidth="3" />
        <path d="M480 420V190h100v230" stroke="currentColor" strokeWidth="3" />
        {Array.from({ length: 6 }, (_, r) =>
          Array.from({ length: 2 }, (_, c) => (
            <rect key={`${r}-${c}`} x={362 + c * 50} y={110 + r * 48} width="24" height="28" stroke="currentColor" strokeWidth="2.5" />
          )),
        )}
        {Array.from({ length: 5 }, (_, r) => (
          <rect key={`b${r}`} x={250} y={180 + r * 46} width="60" height="24" stroke="currentColor" strokeWidth="2.5" />
        ))}
      </svg>
    </div>
  );
}
