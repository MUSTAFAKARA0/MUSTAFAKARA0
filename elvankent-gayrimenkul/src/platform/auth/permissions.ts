import type { Enums } from '@/types/supabase';

/**
 * Merkezi yetki listesi. Veritabanındaki role_permissions tablosunun birebir
 * aynısıdır (tests/security/permissions.test.mjs ikisini karşılaştırır).
 * Güvenlik kararı VERİTABANINDA (RLS) verilir; bu dosya arayüzde hangi
 * menü/butonların gösterileceğini belirlemek ve sunucu tarafında erken
 * reddetmek içindir.
 */
export const PERMISSIONS = [
  'properties.read',
  'properties.create',
  'properties.update',
  'properties.publish',
  'properties.delete',
  'media.manage',
  'leads.read',
  'leads.create',
  'leads.update',
  'leads.delete',
  'appointments.read',
  'appointments.manage',
  'collections.manage',
  'content.manage',
  'seo.manage',
  'settings.manage',
  'users.manage',
  'analytics.read',
  'audit.read',
  'data.export',
  'billing.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type OrgRole = Enums<'org_role'>;

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== 'billing.manage'),
  agent: [
    'properties.read',
    'properties.create',
    'properties.update',
    'properties.publish',
    'media.manage',
    'leads.read',
    'leads.create',
    'leads.update',
    'appointments.read',
    'appointments.manage',
    'collections.manage',
    'analytics.read',
  ],
  editor: ['properties.read', 'properties.create', 'properties.update', 'media.manage', 'content.manage', 'seo.manage'],
  viewer: ['properties.read', 'leads.read', 'appointments.read', 'analytics.read'],
};

export const ROLES: readonly OrgRole[] = ['owner', 'admin', 'agent', 'editor', 'viewer'];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Sahip',
  admin: 'Yönetici',
  agent: 'Danışman',
  editor: 'Editör',
  viewer: 'İzleyici',
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Tüm yetkiler, abonelik ve sahiplik işlemleri.',
  admin: 'Kullanıcı, ayar ve tüm içerik yönetimi (abonelik hariç).',
  agent: 'İlan ekler, yayınlar; müşteri, talep ve randevuları yönetir.',
  editor: 'İlan ve içerik hazırlar; yayın için onaya gönderir.',
  viewer: 'Sadece görüntüler; değişiklik yapamaz.',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'properties.read': 'İlanları görüntüleme',
  'properties.create': 'İlan oluşturma',
  'properties.update': 'İlan düzenleme',
  'properties.publish': 'İlan yayınlama / yayından kaldırma',
  'properties.delete': 'İlan silme ve geri yükleme',
  'media.manage': 'Fotoğraf ve medya yönetimi',
  'leads.read': 'Müşteri ve talepleri görüntüleme',
  'leads.create': 'Müşteri / talep oluşturma',
  'leads.update': 'Müşteri / talep güncelleme',
  'leads.delete': 'Müşteri / talep silme',
  'appointments.read': 'Randevuları görüntüleme',
  'appointments.manage': 'Randevu yönetimi',
  'collections.manage': 'Müşteri koleksiyonları',
  'content.manage': 'Blog, sayfa ve bölge içerikleri',
  'seo.manage': 'SEO ayarları ve yönlendirmeler',
  'settings.manage': 'Şirket ve site ayarları',
  'users.manage': 'Kullanıcı ve rol yönetimi',
  'analytics.read': 'Analitik raporlar',
  'audit.read': 'Güvenlik ve işlem kayıtları',
  'data.export': 'Veri dışa aktarma (CSV/JSON)',
  'billing.manage': 'Plan ve abonelik',
};

export function roleHasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Bir kullanıcının atayabileceği roller (sahip rolünü yalnızca sahip atar). */
export function assignableRoles(actorRole: OrgRole): OrgRole[] {
  return actorRole === 'owner' ? [...ROLES] : ROLES.filter((r) => r !== 'owner');
}
