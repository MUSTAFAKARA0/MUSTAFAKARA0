export interface NavItem {
  href: string;
  label: string;
  /** Aktif sayılacak yol önekleri */
  match?: string[];
}

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
