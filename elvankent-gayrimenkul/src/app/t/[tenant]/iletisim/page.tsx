import type { Metadata } from 'next';
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { PageHeader } from '@/components/common/page-header';
import { LeadForm } from '@/components/forms/lead-form';
import { LazyMap } from '@/components/maps/lazy-map';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { formatOpeningHours, parseOpeningHours } from '@/modules/content/hours';
import { publicMapConfig } from '@/modules/maps/providers';
import { requireTenant } from '@/platform/tenant/tenant';
import { applyPageSeo, guardSitePage, sitePageSettings } from '@/platform/site/pages';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/iletisim'>): Promise<Metadata> {
  const tenant = await requireTenant((await params).tenant);
  return applyPageSeo(await sitePageSettings(tenant, 'iletisim'), {
    title: 'İletişim',
    description: `${tenant.settings.display_name} iletişim bilgileri: telefon, WhatsApp, e-posta, ofis adresi ve çalışma saatleri.`,
    alternates: { canonical: '/iletisim' },
  });
}

export default async function ContactPage({ params }: PageProps<'/t/[tenant]/iletisim'>) {
  const tenant = await requireTenant((await params).tenant);
  await guardSitePage(tenant, 'iletisim');
  const s = tenant.settings;
  const phone = telHref(s.phone);
  const wa = tenant.site.overrides.whatsapp === false ? null : whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.');
  const address = [s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ');
  const hours = formatOpeningHours(parseOpeningHours(s.opening_hours));
  const hasOffice = s.office_latitude !== null && s.office_longitude !== null;
  const map = publicMapConfig();
  const directions = hasOffice
    ? `https://www.google.com/maps/dir/?api=1&destination=${s.office_latitude},${s.office_longitude}`
    : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null;

  const items = [
    s.phone && phone ? { icon: Phone, label: 'Telefon', value: formatPhoneDisplay(s.phone), href: phone } : null,
    wa ? { icon: WhatsAppIcon, label: 'WhatsApp', value: 'Mesaj gönderin', href: wa, external: true } : null,
    s.email ? { icon: Mail, label: 'E-posta', value: s.email, href: `mailto:${s.email}` } : null,
    address ? { icon: MapPin, label: 'Adres', value: address, href: directions, external: true } : null,
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string | null; external?: boolean }[];

  return (
    <>
      <PageHeader
        tenant={tenant}
        title="İletişim"
        description="Aradığınız gayrimenkulü tarif edin, ilgilendiğiniz ilanı sorun veya ofisimize uğrayın."
        crumbs={[{ name: 'İletişim', path: '/iletisim' }]}
      />
      <div className="container-page grid gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="space-y-8">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {items.map(({ icon: Icon, label, value, href, external }) => (
              <li key={label}>
                {href ? (
                  <a
                    href={href}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong hover:shadow-sm"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-muted-foreground">{label}</span>
                      <span className="numeric mt-0.5 block font-semibold break-words text-foreground">{value}</span>
                    </span>
                    {external && <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          {(hours.length > 0 || s.working_hours_note) && (
            <div className="rounded-2xl bg-surface-muted p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Clock className="size-4" aria-hidden /> Çalışma saatleri
              </p>
              <div className="mt-2 space-y-0.5 font-medium">
                {hours.map((h) => (
                  <p key={h} className="numeric">
                    {h}
                  </p>
                ))}
                {s.working_hours_note && <p className="text-muted-foreground">{s.working_hours_note}</p>}
              </div>
            </div>
          )}
          {hasOffice && (
            <LazyMap
              center={{ lat: Number(s.office_latitude), lng: Number(s.office_longitude) }}
              mode="pin"
              zoom={16}
              attribution={map.attribution}
              maxZoom={map.maxZoom}
              ariaLabel={`${s.display_name} ofis konumu`}
              className="h-[320px] overflow-hidden rounded-2xl border border-border"
            />
          )}
        </div>
        <div className="rounded-[1.5rem] border border-border bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-2xl">Bize yazın</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">Mesajınızı bırakın; en kısa sürede size dönüş yapalım.</p>
          <LeadForm kind="contact" className="mt-6" />
        </div>
      </div>
    </>
  );
}
