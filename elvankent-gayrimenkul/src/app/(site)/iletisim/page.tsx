import type { Metadata } from 'next';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { ContactForm } from '@/components/forms/contact-form';
import { LazyMap } from '@/components/map/lazy-map';
import { Button } from '@/components/ui/button';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { getSiteSettings } from '@/lib/data/settings';
import { formatPhoneDisplay } from '@/lib/format';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  title: 'İletişim',
  description: 'Satılık ve kiralık ilanlar, mülk değerlendirme ve tüm sorularınız için bize telefon, WhatsApp veya form ile ulaşın.',
  alternates: { canonical: '/iletisim' },
};

export default async function ContactPage() {
  const s = await getSiteSettings();
  const tel = telHref(s.phone);
  const wa = whatsappHref(s.whatsapp ?? s.phone, `Merhaba, ${s.business_name} web sitesinden yazıyorum.`);
  const hasOffice = s.office_latitude !== null && s.office_longitude !== null;

  return (
    <>
      <PageHeader
        title="İletişim"
        path="/iletisim"
        eyebrow="Size nasıl yardımcı olabiliriz?"
        description="Formu doldurun ya da telefon ve WhatsApp üzerinden doğrudan bize ulaşın. Mesajlarınıza en kısa sürede dönüş yaparız."
      />
      <div className="container-page grid gap-8 py-12 sm:py-16 lg:grid-cols-[1fr_1.25fr]">
        <div className="space-y-4">
          {(tel || wa) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {wa && (
                <Button asChild variant="whatsapp" size="lg">
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="size-5!" /> WhatsApp ile yazın
                  </a>
                </Button>
              )}
              {tel && (
                <Button asChild size="lg">
                  <a href={tel}>
                    <Phone /> Hemen arayın
                  </a>
                </Button>
              )}
            </div>
          )}
          <ul className="divide-y divide-line rounded-2xl bg-surface ring-1 ring-line/80">
            {s.phone && (
              <InfoRow icon={Phone} label="Telefon">
                <a href={tel ?? undefined} className="hover:text-brand-700">
                  {formatPhoneDisplay(s.phone)}
                </a>
              </InfoRow>
            )}
            {s.email && (
              <InfoRow icon={Mail} label="E-posta">
                <a href={`mailto:${s.email}`} className="break-all hover:text-brand-700">
                  {s.email}
                </a>
              </InfoRow>
            )}
            {s.address && (
              <InfoRow icon={MapPin} label="Adres">
                <span className="whitespace-pre-line">{s.address}</span>
              </InfoRow>
            )}
            {s.working_hours && (
              <InfoRow icon={Clock} label="Çalışma saatleri">
                <span className="whitespace-pre-line">{s.working_hours}</span>
              </InfoRow>
            )}
            {!s.phone && !s.email && !s.address && (
              <li className="p-5 text-sm text-sand-600">İletişim bilgileri yakında eklenecektir. Lütfen formu kullanın.</li>
            )}
          </ul>
          {hasOffice && (
            <LazyMap
              className="h-72 overflow-hidden rounded-2xl ring-1 ring-line/80"
              center={{ lat: Number(s.office_latitude), lng: Number(s.office_longitude) }}
              mode="pin"
              zoom={16}
              attribution={publicEnv.mapAttribution}
              ariaLabel={`${s.business_name} ofis konumu`}
            />
          )}
        </div>
        <section aria-labelledby="form-baslik" className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-8">
          <h2 id="form-baslik" className="font-display text-2xl text-ink">
            Bize yazın
          </h2>
          <p className="mt-1.5 mb-6 text-sm text-sand-600">Telefon veya e-posta bilgilerinizden en az birini paylaşmanız yeterlidir.</p>
          <ContactForm />
        </section>
      </div>
    </>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 text-[15px]">
        <p className="text-[12.5px] font-semibold text-sand-500">{label}</p>
        <div className="mt-0.5 font-semibold text-ink">{children}</div>
      </div>
    </li>
  );
}
