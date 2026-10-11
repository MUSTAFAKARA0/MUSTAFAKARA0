import Link from 'next/link';
import { FacebookIcon, InstagramIcon, LinkedinIcon, TikTokIcon, XIcon, YoutubeIcon } from '@/components/common/brand-icons';
import { Logo } from '@/components/brand/logo';
import { CookiePreferencesLink } from '@/components/layout/site-extras';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { formatOpeningHours, parseOpeningHours } from '@/modules/content/hours';
import { brandingUrl } from '@/modules/media/variants';
import type { Tenant } from '@/platform/tenant/tenant';
import type { SiteView } from '@/site-config/load';
import { isHrefAvailable } from '@/site-config/nav';

/**
 * Footer desenlerinin ORTAK verisi (D7.4): sütunlar, iletişim, sosyal medya, yasal bağlantılar
 * ve çerez tercihleri — mevcut SiteFooter ile AYNI kurallar (KARAY Web Sitesi Yönetimi › Footer
 * ayarları; yoksa varsayılan sütunlar). Desenler yalnızca yerleşimi değiştirir.
 */
export interface FooterPatternInput {
  tenant: Tenant;
  view: SiteView;
  hasBlog: boolean;
  regions: { slug: string; name: string }[];
}

export interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

export function footerModel({ tenant, view, hasBlog, regions }: FooterPatternInput) {
  const s = tenant.settings;
  const f = view.config.footer;
  const available = (href: string) => isHrefAvailable(href, view, hasBlog);
  const columns: { id: string; title: string; links: FooterLink[] }[] = f.columns?.length
    ? f.columns.map((c) => ({
        id: c.id,
        title: c.title,
        links: c.links.filter((l) => l.visible && available(l.href)).map((l) => ({ href: l.href, label: l.label, external: /^https?:/.test(l.href) })),
      }))
    : [
        {
          id: 'ilanlar',
          title: 'İlanlar',
          links: [
            { href: '/satilik-daire', label: 'Satılık daire' },
            { href: '/kiralik-daire', label: 'Kiralık daire' },
            { href: '/satilik-villa', label: 'Satılık villa' },
            { href: '/arsa', label: 'Arsa' },
            { href: '/ticari', label: 'Ticari gayrimenkul' },
            { href: '/ilanlar', label: 'Tüm ilanlar' },
          ],
        },
        { id: 'bolgeler', title: 'Bölgeler', links: [...regions.slice(0, 6).map((r) => ({ href: `/bolgeler/${r.slug}`, label: r.name })), { href: '/bolgeler', label: 'Tüm bölgeler' }].filter((l) => available(l.href)) },
        {
          id: 'kurumsal',
          title: 'Kurumsal',
          links: [
            { href: '/hakkimizda', label: 'Hakkımızda' },
            { href: '/hizmetlerimiz', label: 'Hizmetlerimiz' },
            { href: '/degerleme', label: 'Değerleme talebi' },
            ...(hasBlog ? [{ href: '/blog', label: 'Rehber' }] : []),
            { href: '/iletisim', label: 'İletişim' },
          ].filter((l) => available(l.href)),
        },
      ];
  const socials = [
    { href: s.instagram_url, label: 'Instagram', Icon: InstagramIcon },
    { href: s.facebook_url, label: 'Facebook', Icon: FacebookIcon },
    { href: s.x_url, label: 'X', Icon: XIcon },
    { href: s.youtube_url, label: 'YouTube', Icon: YoutubeIcon },
    { href: s.linkedin_url, label: 'LinkedIn', Icon: LinkedinIcon },
    { href: s.tiktok_url, label: 'TikTok', Icon: TikTokIcon },
  ].filter((x): x is { href: string; label: string; Icon: typeof InstagramIcon } => Boolean(x.href));
  const logoUrl = brandingUrl(s.logo_url);
  const lightFooter = view.style.footer === 'light';
  return {
    s,
    f,
    columns,
    socials: f.showSocial ? socials : [],
    phone: f.showContact ? telHref(s.phone) : null,
    phoneLabel: f.showContact && s.phone ? formatPhoneDisplay(s.phone) : null,
    whatsapp: f.showContact && view.features.whatsapp ? whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.') : null,
    email: f.showContact ? s.email : null,
    address: f.showContact ? [s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ') || null : null,
    hours: f.showHours ? formatOpeningHours(parseOpeningHours(s.opening_hours)) : [],
    about: f.about ?? s.tagline ?? s.description,
    contactHref: available('/iletisim') ? '/iletisim' : null,
    copyright: `© ${new Date().getFullYear()} ${f.copyright ?? `${s.legal_name ?? s.display_name}. Tüm hakları saklıdır.`}`,
    logo: (className?: string) => (
      // Koyu/marka zeminde logo açık bir plaka üzerinde (mevcut footer ile aynı kural)
      <span className={logoUrl && !lightFooter ? 'inline-flex max-w-full min-w-0 rounded-2xl bg-white px-3.5 py-2.5 shadow-sm' : 'inline-flex max-w-full min-w-0'}>
        <Logo name={s.display_name} logoUrl={logoUrl} tone={logoUrl && !lightFooter ? 'dark' : 'light'} size="footer" display={view.config.header.brand} className={className ?? 'max-w-full'} />
      </span>
    ),
  };
}
export type FooterModel = ReturnType<typeof footerModel>;

export const LEGAL_LINKS = [
  { href: '/kvkk', label: 'KVKK' },
  { href: '/gizlilik-politikasi', label: 'Gizlilik' },
  { href: '/cerez-politikasi', label: 'Çerezler' },
  { href: '/kullanim-kosullari', label: 'Kullanım koşulları' },
];

export function FooterLinkItem({ l, className }: { l: FooterLink; className?: string }) {
  return l.external ? (
    <a href={l.href} target="_blank" rel="noopener noreferrer" className={className}>
      {l.label}
    </a>
  ) : (
    <Link href={l.href} className={className}>
      {l.label}
    </Link>
  );
}

/** Yasal satır: telif + yasal sayfalar + çerez tercihleri (her footer deseninde zorunlu) */
export function LegalRow({ m, className }: { m: FooterModel; className?: string }) {
  return (
    <div className={className}>
      <p>{m.copyright}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {LEGAL_LINKS.map((l) => (
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
  );
}

export function SocialList({ m, className }: { m: FooterModel; className?: string }) {
  if (!m.socials.length) return null;
  return (
    <ul className={className ?? 'flex flex-wrap gap-2'} aria-label="Sosyal medya">
      {m.socials.map(({ href, label, Icon }) => (
        <li key={label}>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="kp-ftr-social">
            <Icon className="size-[18px]" />
          </a>
        </li>
      ))}
    </ul>
  );
}
