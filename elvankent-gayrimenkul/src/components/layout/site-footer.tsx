import Link from 'next/link';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from './logo';
import { LEGAL_NAV } from './nav-items';
import { FacebookIcon, InstagramIcon, LinkedinIcon, XIcon, YoutubeIcon } from '@/components/common/brand-icons';
import { telHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import type { SiteSettings } from '@/types/database';

const LISTING_LINKS = [
  { href: '/satilik-daire', label: 'Satılık Daire' },
  { href: '/kiralik-daire', label: 'Kiralık Daire' },
  { href: '/satilik-konut', label: 'Satılık Konut' },
  { href: '/arsa', label: 'Arsa' },
  { href: '/isyeri', label: 'İş Yeri' },
  { href: '/ankara-etimesgut-elvankent', label: 'Elvankent İlanları' },
];

const CORPORATE_LINKS = [
  { href: '/hakkimizda', label: 'Hakkımızda' },
  { href: '/hizmetlerimiz', label: 'Hizmetlerimiz' },
  { href: '/iletisim', label: 'İletişim' },
  { href: '/favoriler', label: 'Favorilerim' },
];

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const tel = telHref(settings.phone);
  const socials = [
    { href: settings.instagram_url, label: 'Instagram', Icon: InstagramIcon },
    { href: settings.facebook_url, label: 'Facebook', Icon: FacebookIcon },
    { href: settings.x_url, label: 'X', Icon: XIcon },
    { href: settings.youtube_url, label: 'YouTube', Icon: YoutubeIcon },
    { href: settings.linkedin_url, label: 'LinkedIn', Icon: LinkedinIcon },
  ].filter((s): s is typeof s & { href: string } => Boolean(s.href));

  return (
    <footer className="mt-20 bg-brand-900 text-brand-100">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo businessName={settings.business_name} logoUrl={settings.logo_url} tone="light" />
          {settings.tagline && <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-200">{settings.tagline}</p>}
          {socials.length > 0 && (
            <ul className="mt-5 flex gap-2" aria-label="Sosyal medya">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex size-10 items-center justify-center rounded-xl bg-white/8 text-brand-100 transition hover:bg-white/15 hover:text-white"
                  >
                    <Icon className="size-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FooterColumn title="İlanlar" links={LISTING_LINKS} className="lg:col-span-2" />
        <FooterColumn title="Kurumsal" links={CORPORATE_LINKS} className="lg:col-span-2" />

        <div className="lg:col-span-4">
          <h2 className="text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">İletişim</h2>
          <ul className="mt-4 space-y-3 text-sm text-brand-100">
            {tel && (
              <li>
                <a href={tel} className="flex items-center gap-3 transition hover:text-white">
                  <Phone className="size-4 shrink-0 text-accent-300" aria-hidden />
                  {formatPhoneDisplay(settings.phone)}
                </a>
              </li>
            )}
            {settings.email && (
              <li>
                <a href={`mailto:${settings.email}`} className="flex items-center gap-3 break-all transition hover:text-white">
                  <Mail className="size-4 shrink-0 text-accent-300" aria-hidden />
                  {settings.email}
                </a>
              </li>
            )}
            {settings.address && (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden />
                <span className="whitespace-pre-line">{settings.address}</span>
              </li>
            )}
            {settings.working_hours && (
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden />
                <span className="whitespace-pre-line">{settings.working_hours}</span>
              </li>
            )}
            {!tel && !settings.email && !settings.address && (
              <li>
                <Link href="/iletisim" className="underline underline-offset-4 hover:text-white">
                  İletişim formu ile bize ulaşın
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-[13px] text-brand-200 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {settings.business_name}. Tüm hakları saklıdır.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links, className }: { title: string; links: { href: string; label: string }[]; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-brand-100 transition hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
