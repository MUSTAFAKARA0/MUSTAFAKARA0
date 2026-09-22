import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { ContactCta } from '@/components/home/home-sections';
import { SERVICES } from '@/content/site-content';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { getSiteSettings } from '@/lib/data/settings';

export const metadata: Metadata = {
  title: 'Hizmetlerimiz',
  description: 'Satış danışmanlığı, kiralama, piyasa ve fiyat analizi, tapu ve evrak süreçlerinde destek.',
  alternates: { canonical: '/hizmetlerimiz' },
};

export default async function ServicesPage() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHeader
        title="Hizmetlerimiz"
        path="/hizmetlerimiz"
        eyebrow="Uçtan uca destek"
        description="Mülkünüzü satarken, kiraya verirken ya da yeni bir ev ararken sürecin her adımında yanınızdayız."
      />
      <div className="container-page space-y-16 py-12 sm:py-16">
        <ul className="grid gap-6 md:grid-cols-2">
          {SERVICES.map(({ slug, icon: Icon, title, summary, details }) => (
            <li key={slug} id={slug} className="scroll-mt-24 rounded-3xl bg-surface p-6 ring-1 ring-line/80 sm:p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon className="size-6" aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-2xl text-ink">{title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-sand-700">{summary}</p>
              <ul className="mt-5 space-y-2.5">
                {details.map((d) => (
                  <li key={d} className="flex gap-2.5 text-sm text-sand-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> {d}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <ContactCta tel={telHref(s.phone)} whatsapp={whatsappHref(s.whatsapp ?? s.phone, `Merhaba, ${s.business_name} web sitesinden yazıyorum.`)} />
      </div>
    </>
  );
}
