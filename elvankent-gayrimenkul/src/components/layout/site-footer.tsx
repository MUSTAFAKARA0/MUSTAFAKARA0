import Link from 'next/link';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TikTokIcon,
  WhatsAppIcon,
  XIcon,
  YoutubeIcon,
} from '@/components/common/brand-icons';
import { Logo } from '@/components/layout/logo';
import { CookiePreferencesLink } from '@/components/layout/site-extras';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { formatOpeningHours, parseOpeningHours } from '@/modules/content/hours';
import { brandingUrl } from '@/modules/media/variants';
import type { Tenant } from '@/platform/tenant/tenant';

interface FooterRegion {
  slug: string;
  name: string;
}

export function SiteFooter({ tenant, regions, hasBlog }: { tenant: Tenant; regions: FooterRegion[]; hasBlog: boolean }) {
  const s = tenant.settings;
  const phone = telHref(s.phone);
  const wa = whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.');
  const address = [s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ');
  const hours = formatOpeningHours(parseOpeningHours(s.opening_hours));
  const socials = [
    { href: s.instagram_url, label: 'Instagram', Icon: InstagramIcon },
    { href: s.facebook_url, label: 'Facebook', Icon: FacebookIcon },
    { href: s.x_url, label: 'X', Icon: XIcon },
    { href: s.youtube_url, label: 'YouTube', Icon: YoutubeIcon },
    { href: s.linkedin_url, label: 'LinkedIn', Icon: LinkedinIcon },
    { href: s.tiktok_url, label: 'TikTok', Icon: TikTokIcon },
  ].filter((x): x is { href: string; label: string; Icon: typeof InstagramIcon } => Boolean(x.href));

  const listingLinks = [
    { href: '/satilik-daire', label: 'Satılık daire' },
    { href: '/kiralik-daire', label: 'Kiralık daire' },
    { href: '/satilik-villa', label: 'Satılık villa' },
    { href: '/arsa', label: 'Arsa' },
    { href: '/ticari', label: 'Ticari gayrimenkul' },
    { href: '/ilanlar', label: 'Tüm ilanlar' },
  ];
  const companyLinks = [
    { href: '/hakkimizda', label: 'Hakkımızda' },
    { href: '/hizmetlerimiz', label: 'Hizmetlerimiz' },
    { href: '/degerleme', label: 'Değerleme talebi' },
    ...(hasBlog ? [{ href: '/blog', label: 'Rehber' }] : []),
    { href: '/iletisim', label: 'İletişim' },
  ];
  const legalLinks = [
    { href: '/kvkk', label: 'KVKK' },
    { href: '/gizlilik-politikasi', label: 'Gizlilik' },
    { href: '/cerez-politikasi', label: 'Çerezler' },
    { href: '/kullanim-kosullari', label: 'Kullanım koşulları' },
  ];

  const heading = 'mb-4 text-[12px] font-bold tracking-[0.14em] text-white/55 uppercase';
  const linkClass = 'text-[14.5px] text-white/80 transition-colors hover:text-white';

  return (
    <footer className="bg-surface-inverse text-inverse-foreground">
      <div className="container-page grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-20">
        <div className="max-w-sm">
          <Logo name={s.display_name} logoUrl={brandingUrl(s.logo_url)} tone="light" />
          {(s.tagline || s.description) && (
            <p className="mt-5 text-[14.5px] leading-relaxed text-white/70">{s.tagline ?? s.description}</p>
          )}
          <ul className="mt-6 space-y-2.5 text-[14.5px] text-white/80">
            {phone && s.phone && (
              <li>
                <a href={phone} className="flex items-center gap-2.5 hover:text-white">
                  <Phone className="size-4 text-white/50" aria-hidden /> <span className="numeric">{formatPhoneDisplay(s.phone)}</span>
                </a>
              </li>
            )}
            {wa && (
              <li>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-white">
                  <WhatsAppIcon className="size-4 text-white/50" /> WhatsApp ile yazın
                </a>
              </li>
            )}
            {s.email && (
              <li>
                <a href={`mailto:${s.email}`} className="flex items-center gap-2.5 break-all hover:text-white">
                  <Mail className="size-4 shrink-0 text-white/50" aria-hidden /> {s.email}
                </a>
              </li>
            )}
            {address && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden /> <span>{address}</span>
              </li>
            )}
            {(hours.length > 0 || s.working_hours_note) && (
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden />
                <span>
                  {hours.map((h) => (
                    <span key={h} className="block">
                      {h}
                    </span>
                  ))}
                  {s.working_hours_note && <span className="block text-white/60">{s.working_hours_note}</span>}
                </span>
              </li>
            )}
          </ul>
          {socials.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Sosyal medya">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex size-10 items-center justify-center rounded-xl bg-white/8 text-white/80 transition hover:bg-white/15 hover:text-white"
                  >
                    <Icon className="size-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label="İlanlar">
          <h2 className={heading}>İlanlar</h2>
          <ul className="space-y-2.5">
            {listingLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Bölgeler">
          <h2 className={heading}>Bölgeler</h2>
          <ul className="space-y-2.5">
            {regions.slice(0, 6).map((r) => (
              <li key={r.slug}>
                <Link href={`/bolgeler/${r.slug}`} className={linkClass}>
                  {r.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/bolgeler" className={linkClass}>
                Tüm bölgeler
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Kurumsal">
          <h2 className={heading}>Kurumsal</h2>
          <ul className="space-y-2.5">
            {companyLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-[13px] text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {s.legal_name ?? s.display_name}. Tüm hakları saklıdır.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <CookiePreferencesLink className="hover:text-white" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
