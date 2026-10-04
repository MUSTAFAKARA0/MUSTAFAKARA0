import type { Permission } from '@/platform/auth/permissions';

export type AdminIconKey =
  | 'dashboard'
  | 'design'
  | 'listings'
  | 'customers'
  | 'leads'
  | 'appointments'
  | 'collections'
  | 'analytics'
  | 'media'
  | 'regions'
  | 'content'
  | 'seo'
  | 'settings'
  | 'users'
  | 'company'
  | 'security';

export type PlanFeatureKey = 'crm' | 'analytics' | 'pdf' | 'customDomain';

export interface AdminNavLink {
  href: string;
  label: string;
  permission?: Permission;
}

export interface AdminNavItem extends AdminNavLink {
  icon: AdminIconKey;
  feature?: PlanFeatureKey;
  /** Aktif sayılacak yol önekleri (varsayılan: href) */
  match?: string[];
  children?: AdminNavLink[];
}

export interface AdminNavSection {
  title?: string;
  items: AdminNavItem[];
}

/** Şartnamedeki menü yapısı; kullanıcının yetkisi/planı olmayan öğeler gösterilmez. */
export const ADMIN_NAV: AdminNavSection[] = [
  {
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'dashboard', match: ['/admin'] },
      {
        href: '/admin/ilanlar',
        label: 'İlanlar',
        icon: 'listings',
        permission: 'properties.read',
        match: ['/admin/ilanlar'],
        children: [
          { href: '/admin/ilanlar', label: 'Tüm ilanlar' },
          { href: '/admin/ilanlar/yeni', label: 'Yeni ilan', permission: 'properties.create' },
          { href: '/admin/ilanlar?durum=draft', label: 'Taslaklar' },
          { href: '/admin/ilanlar?durum=pending', label: 'Onay bekleyenler' },
          { href: '/admin/ilanlar?durum=published', label: 'Aktif ilanlar' },
          { href: '/admin/ilanlar?durum=sold', label: 'Satılanlar' },
          { href: '/admin/ilanlar?durum=rented', label: 'Kiralananlar' },
          { href: '/admin/ilanlar?durum=cop', label: 'Çöp kutusu', permission: 'properties.delete' },
        ],
      },
    ],
  },
  {
    title: 'Müşteri ilişkileri',
    items: [
      { href: '/admin/musteriler', label: 'Müşteriler', icon: 'customers', permission: 'leads.read', feature: 'crm' },
      { href: '/admin/talepler', label: 'Talepler', icon: 'leads', permission: 'leads.read' },
      { href: '/admin/randevular', label: 'Randevular', icon: 'appointments', permission: 'appointments.read', feature: 'crm' },
      { href: '/admin/koleksiyonlar', label: 'Koleksiyonlar', icon: 'collections', permission: 'collections.manage', feature: 'crm' },
      { href: '/admin/analitik', label: 'Favoriler / Etkileşimler', icon: 'analytics', permission: 'analytics.read', feature: 'analytics' },
    ],
  },
  {
    title: 'Web sitesi',
    items: [
      { href: '/admin/sirket', label: 'Marka ve Görünüm', icon: 'company', permission: 'settings.manage' },
      { href: '/admin/site', label: 'Site yönetimi', icon: 'design', permission: 'settings.manage', match: ['/admin/site', '/admin/tasarim'] },
      { href: '/admin/icerikler', label: 'Blog / İçerikler', icon: 'content', permission: 'content.manage' },
      { href: '/admin/bolgeler', label: 'Bölgeler', icon: 'regions', permission: 'content.manage' },
      { href: '/admin/medya', label: 'Medya', icon: 'media', permission: 'media.manage' },
      { href: '/admin/seo', label: 'SEO', icon: 'seo', permission: 'seo.manage' },
    ],
  },
  {
    title: 'Yönetim',
    items: [
      { href: '/admin/ayarlar', label: 'Ayarlar', icon: 'settings', permission: 'settings.manage' },
      { href: '/admin/kullanicilar', label: 'Kullanıcılar', icon: 'users', permission: 'users.manage' },
      { href: '/admin/guvenlik', label: 'Güvenlik / Loglar', icon: 'security', permission: 'audit.read' },
    ],
  },
];

export function filterNav(
  can: (p: Permission) => boolean,
  features: Record<PlanFeatureKey, boolean>,
): AdminNavSection[] {
  const sections: AdminNavSection[] = ADMIN_NAV.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => (!item.permission || can(item.permission)) && (!item.feature || features[item.feature]))
      .map((item) => ({ ...item, children: item.children?.filter((c) => !c.permission || can(c.permission)) })),
  })).filter((s) => s.items.length > 0);
  return sections;
}
