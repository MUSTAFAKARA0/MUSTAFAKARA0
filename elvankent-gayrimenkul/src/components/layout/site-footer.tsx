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
import { Logo } from '@/components/brand/logo';
import { CookiePreferencesLink } from '@/components/layout/site-extras';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { formatOpeningHours, parseOpeningHours } from '@/modules/content/hours';
import { brandingUrl } from '@/modules/media/variants';
import type { Tenant } from '@/platform/tenant/tenant';
import { isHrefAvailable } from '@/site-config/nav';
import { cn } from '@/lib/utils';
import type { SiteView } from '@/site-config/load';

interface FooterRegion {
  slug: string;
  name: string;
}

export function SiteFooter({ tenant, regions, hasBlog, view }: { tenant: Tenant; regions: FooterRegion[]; hasBlog: boolean; view: SiteView }) {
  const s = tenant.settings;
  const f = view.config.footer;
  const footerStyle = view.style.footer;
  const logo = brandingUrl(s.logo_url);
  const available = (href: string) => isHrefAvailable(href, view, hasBlog);
  const phone = telHref(s.phone);
  const wa = view.features.whatsapp ? whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.') : null;
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

  // Footer sütunları: KARAY Web Sitesi Yönetimi'nden (Footer) veya varsayılan
  const columns: { id: string; title: string; links: { href: string; label: string; external?: boolean }[] }[] = f.columns?.length
    ? f.columns.map((c) => ({
        id: c.id,
        title: c.title,
        links: c.links.filter((l) => l.visible && available(l.href)).map((l) => ({ href: l.href, label: l.label, external: /^https?:/.test(l.href) })),
      }))
    : [
        { id: 'ilanlar', title: 'İlanlar', links: listingLinks },
        { id: 'bolgeler', title: 'Bölgeler', links: [...regions.slice(0, 6).map((r) => ({ href: `/bolgeler/${r.slug}`, label: r.name })), { href: '/bolgeler', label: 'Tüm bölgeler' }].filter((l) => available(l.href)) },
        { id: 'kurumsal', title: 'Kurumsal', links: companyLinks.filter((l) => available(l.href)) },
      ];
  const about = f.about ?? s.tagline ?? s.description;

  const heading = 'mb-4 text-[12px] font-bold tracking-[0.14em] text-inverse-foreground/55 uppercase';
  const linkClass = 'text-[14.5px] text-inverse-foreground/80 transition-colors hover:text-inverse-foreground';

  const layout = view.style.footerLayout;
  // İletişim öncelikli düzende iletişim bilgileri üstteki bantta; marka sütununda tekrarlanmaz
  const contactBand = layout === 'contact' && f.showContact && Boolean((phone && s.phone) || wa || s.email || address);
  const showContactList = f.showContact && !contactBand;

  const brand = (
    <div className="max-w-sm min-w-0">
      {/* Koyu/marka zeminde logo açık bir plaka üzerinde: koyu renkli logolar kaybolmaz */}
      <div className={cn('inline-flex max-w-full min-w-0', logo && footerStyle !== 'light' && 'rounded-2xl bg-white px-3.5 py-2.5 shadow-sm')}>
        <Logo name={s.display_name} logoUrl={logo} tone={logo && footerStyle !== 'light' ? 'dark' : 'light'} size="footer" display={view.config.header.brand} className="max-w-full" />
      </div>
      {about && <p className="mt-5 text-[14.5px] leading-relaxed text-inverse-foreground/70">{about}</p>}
      <ul className={cn('mt-6 space-y-2.5 text-[14.5px] text-inverse-foreground/80', !showContactList && !f.showHours && 'hidden')}>
        {showContactList && phone && s.phone && (
          <li>
            <a href={phone} className="flex items-center gap-2.5 hover:text-inverse-foreground">
              <Phone className="size-4 text-inverse-foreground/50" aria-hidden /> <span className="numeric">{formatPhoneDisplay(s.phone)}</span>
            </a>
          </li>
        )}
        {showContactList && wa && (
          <li>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-inverse-foreground">
              <WhatsAppIcon className="size-4 text-inverse-foreground/50" /> WhatsApp ile yazın
            </a>
          </li>
        )}
        {showContactList && s.email && (
          <li>
            <a href={`mailto:${s.email}`} className="flex items-center gap-2.5 break-all hover:text-inverse-foreground">
              <Mail className="size-4 shrink-0 text-inverse-foreground/50" aria-hidden /> {s.email}
            </a>
          </li>
        )}
        {showContactList && address && (
          <li className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-inverse-foreground/50" aria-hidden /> <span>{address}</span>
          </li>
        )}
        {f.showHours && (hours.length > 0 || s.working_hours_note) && (
          <li className="flex items-start gap-2.5">
            <Clock className="mt-0.5 size-4 shrink-0 text-inverse-foreground/50" aria-hidden />
            <span>
              {hours.map((h) => (
                <span key={h} className="block">
                  {h}
                </span>
              ))}
              {s.working_hours_note && <span className="block text-inverse-foreground/60">{s.working_hours_note}</span>}
            </span>
          </li>
        )}
      </ul>
      {f.showSocial && socials.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Sosyal medya">
          {socials.map(({ href, label, Icon }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex size-10 items-center justify-center rounded-xl bg-inverse-foreground/8 text-inverse-foreground/80 transition hover:bg-inverse-foreground/15 hover:text-inverse-foreground"
              >
                <Icon className="size-[18px]" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const navs = (
    <>
      {columns.map((c) => (
        <nav key={c.id} aria-label={c.title}>
          <h2 className={heading}>{c.title}</h2>
          <ul className="space-y-2.5">
            {c.links.map((l) => (
              <li key={l.href + l.label}>
                {l.external ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {l.label}
                  </a>
                ) : (
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </>
  );
  const bottom = (
    <div className="border-t border-inverse-foreground/10">
      <div className="container-page flex flex-col gap-4 py-6 text-[13px] text-inverse-foreground/60 md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()} {f.copyright ?? `${s.legal_name ?? s.display_name}. Tüm hakları saklıdır.`}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {legalLinks.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-inverse-foreground">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <CookiePreferencesLink className="hover:text-inverse-foreground" />
          </li>
        </ul>
      </div>
    </div>
  );

  // Minimal: tek satır — marka, satır içi menü, sosyal bağlantılar; ardından yasal satır
  if (layout === 'minimal') {
    const inline = columns.flatMap((c) => c.links).slice(0, 8);
    return (
      <footer className="site-footer bg-surface-inverse text-inverse-foreground">
        <div className="container-page flex flex-col gap-8 py-12 lg:flex-row lg:items-center lg:justify-between lg:py-14">
          <div className={cn('inline-flex max-w-full min-w-0', logo && footerStyle !== 'light' && 'rounded-2xl bg-white px-3.5 py-2.5 shadow-sm')}>
            <Logo name={s.display_name} logoUrl={logo} tone={logo && footerStyle !== 'light' ? 'dark' : 'light'} size="footer" display={view.config.header.brand} className="max-w-full" />
          </div>
          <nav aria-label="Alt menü">
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {inline.map((l, i) => (
                <li key={`${i}-${l.href}`}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          {f.showSocial && socials.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Sosyal medya">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex size-10 items-center justify-center rounded-full bg-inverse-foreground/8 text-inverse-foreground/80 transition hover:bg-inverse-foreground/15 hover:text-inverse-foreground">
                    <Icon className="size-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {((f.showContact && (s.phone || s.email || address)) || (f.showHours && hours.length > 0)) && (
          <div className="container-page pb-10">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-inverse-foreground/75">
              {f.showContact && phone && s.phone && (
                <li>
                  <a href={phone} className="numeric inline-flex items-center gap-2 hover:text-inverse-foreground">
                    <Phone className="size-4 text-inverse-foreground/50" aria-hidden /> {formatPhoneDisplay(s.phone)}
                  </a>
                </li>
              )}
              {f.showContact && s.email && (
                <li>
                  <a href={`mailto:${s.email}`} className="inline-flex items-center gap-2 break-all hover:text-inverse-foreground">
                    <Mail className="size-4 shrink-0 text-inverse-foreground/50" aria-hidden /> {s.email}
                  </a>
                </li>
              )}
              {f.showContact && address && (
                <li className="inline-flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-inverse-foreground/50" aria-hidden /> {address}
                </li>
              )}
              {f.showHours && hours[0] && (
                <li className="inline-flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-inverse-foreground/50" aria-hidden /> {hours[0]}
                </li>
              )}
            </ul>
          </div>
        )}
        {bottom}
      </footer>
    );
  }

  return (
    <footer className="site-footer bg-surface-inverse text-inverse-foreground">
      {contactBand && (
        <div className="border-b border-inverse-foreground/10">
          <div className="container-page grid gap-8 py-12 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16 lg:py-16">
            <div>
              <p className={heading}>İletişim</p>
              <h2 className="font-display text-[clamp(2rem,4.2vw,3.4rem)] leading-[1.05] tracking-[-0.01em] text-balance text-inverse-foreground">Bir sonraki adresiniz için konuşalım.</h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {phone && s.phone && (
                <li>
                  <a href={phone} className="group flex items-center justify-between gap-3 rounded-2xl bg-inverse-foreground/8 px-5 py-4 transition hover:bg-inverse-foreground/14">
                    <span>
                      <span className="block text-[12px] font-semibold tracking-[0.12em] text-inverse-foreground/60 uppercase">Telefon</span>
                      <span className="numeric mt-0.5 block text-[17px] font-semibold">{formatPhoneDisplay(s.phone)}</span>
                    </span>
                    <Phone className="size-5 text-inverse-foreground/60 transition-transform group-hover:-rotate-12" aria-hidden />
                  </a>
                </li>
              )}
              {wa && (
                <li>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 rounded-2xl bg-inverse-foreground/8 px-5 py-4 transition hover:bg-inverse-foreground/14">
                    <span>
                      <span className="block text-[12px] font-semibold tracking-[0.12em] text-inverse-foreground/60 uppercase">WhatsApp</span>
                      <span className="mt-0.5 block text-[17px] font-semibold">Mesaj yazın</span>
                    </span>
                    <WhatsAppIcon className="size-5 text-inverse-foreground/60" />
                  </a>
                </li>
              )}
              {address && (
                <li className={cn(!s.email && 'sm:col-span-2')}>
                  <div className="flex h-full items-center justify-between gap-3 rounded-2xl bg-inverse-foreground/8 px-5 py-4">
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold tracking-[0.12em] text-inverse-foreground/60 uppercase">Ofis</span>
                      <span className="mt-0.5 block text-[15px] font-semibold">{address}</span>
                    </span>
                    <MapPin className="size-5 shrink-0 text-inverse-foreground/60" aria-hidden />
                  </div>
                </li>
              )}
              {s.email && (
                <li className={cn(!address && 'sm:col-span-2')}>
                  <a href={`mailto:${s.email}`} className="group flex items-center justify-between gap-3 rounded-2xl bg-inverse-foreground/8 px-5 py-4 transition hover:bg-inverse-foreground/14">
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold tracking-[0.12em] text-inverse-foreground/60 uppercase">E-posta</span>
                      <span className="mt-0.5 block truncate text-[17px] font-semibold">{s.email}</span>
                    </span>
                    <Mail className="size-5 shrink-0 text-inverse-foreground/60" aria-hidden />
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
      <div className={cn('container-page grid gap-12 py-14 md:grid-cols-2 lg:py-20', columns.length >= 3 ? 'lg:grid-cols-[1.4fr_1fr_1fr_1fr]' : 'lg:grid-cols-[1.4fr_1fr_1fr]')}>
        {brand}
        {navs}
      </div>
      {bottom}
    </footer>
  );
}
