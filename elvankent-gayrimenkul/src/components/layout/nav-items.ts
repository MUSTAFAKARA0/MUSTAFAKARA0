export interface NavItem {
  href: string;
  label: string;
  /** Sadece geniş ekranda (xl) üst menüde gösterilir */
  wideOnly?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { href: '/satilik', label: 'Satılık' },
  { href: '/kiralik', label: 'Kiralık' },
  { href: '/konut', label: 'Konut', wideOnly: true },
  { href: '/arsa', label: 'Arsa' },
  { href: '/isyeri', label: 'İş Yeri' },
  { href: '/hizmetlerimiz', label: 'Hizmetlerimiz', wideOnly: true },
  { href: '/hakkimizda', label: 'Hakkımızda' },
  { href: '/iletisim', label: 'İletişim' },
];

export const LEGAL_NAV: NavItem[] = [
  { href: '/kvkk', label: 'KVKK Aydınlatma Metni' },
  { href: '/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { href: '/cerez-politikasi', label: 'Çerez Politikası' },
  { href: '/kullanim-kosullari', label: 'Kullanım Koşulları' },
];
