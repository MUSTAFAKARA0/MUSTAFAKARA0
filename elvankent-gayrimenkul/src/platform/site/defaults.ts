import { mainNav } from '@/platform/site/nav';
import type { FooterConfig, NavItemConfig } from '@/platform/site/schema';

/** Yapılandırılmamış siteler için yönetim ekranında gösterilen başlangıç menüsü (bugünkü site menüsü) */
export function defaultNavigation(): NavItemConfig[] {
  return mainNav(true).map((i) => ({
    id: i.href.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ana-sayfa',
    label: i.label,
    href: i.href,
    visible: true,
    children: [],
  }));
}

/** Footer için başlangıç sütunları (bugünkü footer'ın sabit bağlantıları) */
export function defaultFooterColumns(): NonNullable<FooterConfig['columns']> {
  const link = (id: string, label: string, href: string) => ({ id, label, href, visible: true });
  return [
    {
      id: 'ilanlar',
      title: 'İlanlar',
      links: [
        link('satilik-daire', 'Satılık daire', '/satilik-daire'),
        link('kiralik-daire', 'Kiralık daire', '/kiralik-daire'),
        link('satilik-villa', 'Satılık villa', '/satilik-villa'),
        link('arsa', 'Arsa', '/arsa'),
        link('ticari', 'Ticari gayrimenkul', '/ticari'),
        link('ilanlar', 'Tüm ilanlar', '/ilanlar'),
      ],
    },
    {
      id: 'kurumsal',
      title: 'Kurumsal',
      links: [
        link('hakkimizda', 'Hakkımızda', '/hakkimizda'),
        link('hizmetlerimiz', 'Hizmetlerimiz', '/hizmetlerimiz'),
        link('degerleme', 'Değerleme talebi', '/degerleme'),
        link('bolgeler', 'Bölgeler', '/bolgeler'),
        link('iletisim', 'İletişim', '/iletisim'),
      ],
    },
  ];
}
