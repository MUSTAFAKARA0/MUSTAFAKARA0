import type { SiteView } from '@/platform/site/load';
import type { NavItemConfig, PageKey } from '@/platform/site/schema';

export interface NavItem {
  href: string;
  label: string;
  /** Aktif sayılacak yol önekleri */
  match?: string[];
  external?: boolean;
  children?: NavItem[];
}

/** Varsayılan menü (yapılandırma yoksa; bugünkü site menüsü) */
export function mainNav(hasBlog: boolean): NavItem[] {
  return [
    { href: '/satilik', label: 'Satılık', match: ['/satilik'] },
    { href: '/kiralik', label: 'Kiralık', match: ['/kiralik'] },
    { href: '/bolgeler', label: 'Bölgeler', match: ['/bolgeler'] },
    { href: '/hizmetlerimiz', label: 'Hizmetler', match: ['/hizmetlerimiz', '/degerleme'] },
    ...(hasBlog ? [{ href: '/blog', label: 'Rehber', match: ['/blog'] }] : []),
    { href: '/hakkimizda', label: 'Hakkımızda', match: ['/hakkimizda'] },
    { href: '/iletisim', label: 'İletişim', match: ['/iletisim'] },
  ];
}

/** Site içi yolun hangi yönetilen sayfaya karşılık geldiği (gizli sayfa/özellik menüden düşer) */
const PAGE_BY_PATH: Record<string, PageKey> = {
  '/hakkimizda': 'hakkimizda',
  '/hizmetlerimiz': 'hizmetlerimiz',
  '/iletisim': 'iletisim',
  '/degerleme': 'degerleme',
  '/blog': 'blog',
  '/bolgeler': 'bolgeler',
};

/** Bağlantı sitede gösterilebilir mi (sayfa gizli veya özellik kapalıysa hayır) */
export function isHrefAvailable(href: string, view: SiteView, hasBlog: boolean): boolean {
  if (/^https?:|^tel:|^mailto:/.test(href)) return true;
  const path = href.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const root = `/${path.split('/')[1] ?? ''}`;
  if (root === '/blog' && (!view.features.blog || !hasBlog)) return false;
  if (root === '/degerleme' && !view.features.valuation) return false;
  if ((root === '/favoriler' || root === '/karsilastir') && !view.features.favorites) return false;
  const key = PAGE_BY_PATH[root];
  if (key && view.config.pages[key]?.visible === false) return false;
  return true;
}

function fromConfig(items: NavItemConfig[], view: SiteView, hasBlog: boolean): NavItem[] {
  return items
    .filter((i) => i.visible && isHrefAvailable(i.href, view, hasBlog))
    .map((i) => ({
      href: i.href,
      label: i.label,
      external: /^https?:/.test(i.href),
      match: /^\//.test(i.href) && i.href !== '/' ? [i.href.split(/[?#]/)[0]] : undefined,
      children: i.children
        .filter((c) => c.visible && isHrefAvailable(c.href, view, hasBlog))
        .map((c) => ({ href: c.href, label: c.label, external: /^https?:/.test(c.href) })),
    }));
}

/** Sitenin menüsü: yapılandırma varsa o, yoksa varsayılan; gizli sayfalar ve kapalı özellikler çıkarılır */
export function resolveNav(view: SiteView, hasBlog: boolean): NavItem[] {
  if (view.config.navigation && view.config.navigation.length > 0) return fromConfig(view.config.navigation, view, hasBlog);
  return mainNav(hasBlog && view.features.blog).filter((i) => isHrefAvailable(i.href, view, hasBlog));
}
