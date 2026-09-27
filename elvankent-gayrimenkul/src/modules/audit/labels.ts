import { STATUS_LABELS, type ListingStatus } from '@/modules/properties/constants';
import { ROLE_LABELS, type OrgRole } from '@/platform/auth/permissions';

/**
 * Denetim kayıtlarının Türkçe anlatımı: "kim, ne yaptı, ne zaman, neye".
 * Kayıtlarda şifre, token veya oturum bilgisi bulunmaz; burada yalnızca
 * eylem adı, hedef etiketi ve değişen alan adları kullanılır.
 */

export type AuditCategory = 'auth' | 'property' | 'team' | 'settings' | 'content' | 'crm' | 'media' | 'data' | 'platform';

export const AUDIT_CATEGORIES: Record<AuditCategory, { label: string; prefixes: string[] }> = {
  auth: { label: 'Oturum ve yetki', prefixes: ['auth.'] },
  property: { label: 'İlanlar', prefixes: ['property.'] },
  team: { label: 'Kullanıcılar', prefixes: ['member.', 'user.'] },
  settings: { label: 'Ayarlar', prefixes: ['settings.', 'domain.'] },
  content: { label: 'İçerik', prefixes: ['content.'] },
  crm: { label: 'Müşteri ilişkileri', prefixes: ['collection.', 'customer.', 'lead.'] },
  media: { label: 'Medya', prefixes: ['media.'] },
  data: { label: 'Veri dışa aktarma', prefixes: ['data.'] },
  platform: { label: 'Platform', prefixes: ['organization.', 'plan.', 'subscription.'] },
};

const MEMBER_STATUS: Record<string, string> = { active: 'aktif', disabled: 'devre dışı' };

const FIELD_LABELS: Record<string, string> = {
  title: 'başlık',
  description: 'açıklama',
  price: 'fiyat',
  status: 'durum',
  slug: 'adres',
  body: 'içerik',
  display_name: 'şirket adı',
  logo_url: 'logo',
  favicon_url: 'site simgesi',
  hero_image_url: 'ana sayfa görseli',
  hero_title: 'ana sayfa başlığı',
  hero_subtitle: 'ana sayfa alt başlığı',
  og_image_url: 'paylaşım görseli',
  primary_color: 'ana renk',
  accent_color: 'vurgu rengi',
  phone: 'telefon',
  whatsapp: 'WhatsApp',
  email: 'e-posta',
  seo_title: 'SEO başlığı',
  seo_description: 'SEO açıklaması',
  opening_hours: 'çalışma saatleri',
  address_line: 'adres',
  default_location_precision: 'konum gösterimi',
  google_site_verification: 'Search Console kodu',
};

export interface AuditRow {
  action: string;
  actor_label: string | null;
  target_type: string | null;
  target_label: string | null;
  metadata: unknown;
}

function meta(row: AuditRow): Record<string, unknown> {
  return row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {};
}

function fieldList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const names = value.map((f) => FIELD_LABELS[String(f)] ?? String(f).replace(/_/g, ' ')).slice(0, 6);
  if (!names.length) return null;
  return `Değişen alanlar: ${names.join(', ')}${value.length > 6 ? ` ve ${value.length - 6} alan daha` : ''}`;
}

const status = (v: unknown) => STATUS_LABELS[v as ListingStatus] ?? String(v ?? '');
const role = (v: unknown) => ROLE_LABELS[v as OrgRole] ?? String(v ?? '');
const money = (v: unknown, currency: unknown) =>
  v === null || v === undefined ? '—' : `${Number(v).toLocaleString('tr-TR')} ${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'}`;

/** Kayıt için kısa bir cümle ve (varsa) ayrıntı satırı */
export function describeAudit(row: AuditRow): { text: string; detail: string | null; tone: 'neutral' | 'danger' | 'warning' | 'success' } {
  const m = meta(row);
  const target = row.target_label ? `“${row.target_label}”` : '';
  switch (row.action) {
    case 'auth.login_success':
      return { text: 'Yönetim paneline giriş yaptı', detail: null, tone: 'success' };
    case 'auth.login_failed':
      return { text: 'Başarısız giriş denemesi', detail: typeof m.email === 'string' ? `E-posta: ${m.email}` : null, tone: 'danger' };
    case 'auth.login_denied':
      return { text: 'Giriş reddedildi (aktif üyelik yok)', detail: null, tone: 'warning' };
    case 'auth.logout':
      return { text: 'Oturumu kapattı', detail: null, tone: 'neutral' };
    case 'auth.password_changed':
      return { text: 'Şifresini değiştirdi', detail: null, tone: 'neutral' };
    case 'auth.password_reset_requested':
      return { text: 'Şifre sıfırlama bağlantısı istendi', detail: null, tone: 'neutral' };
    case 'auth.forbidden':
      return { text: 'Yetkisiz işlem denemesi engellendi', detail: typeof m.permission === 'string' ? `Gerekli yetki: ${m.permission}` : null, tone: 'danger' };
    case 'property.created':
      return { text: `${target} ilanını oluşturdu`, detail: null, tone: 'neutral' };
    case 'property.updated':
      return { text: `${target} ilanını güncelledi`, detail: fieldList(m.fields), tone: 'neutral' };
    case 'property.status_changed':
      return { text: `${target} ilanının durumunu değiştirdi`, detail: `${status(m.from)} → ${status(m.to)}`, tone: 'neutral' };
    case 'property.price_changed':
      return { text: `${target} ilanının fiyatını değiştirdi`, detail: `${money(m.from, m.currency)} → ${money(m.to, m.currency)}`, tone: 'neutral' };
    case 'property.deleted':
      return { text: `${target} ilanını çöp kutusuna taşıdı`, detail: null, tone: 'warning' };
    case 'property.restored':
      return { text: `${target} ilanını geri yükledi`, detail: null, tone: 'neutral' };
    case 'property.purged':
      return { text: `${target} ilanını kalıcı olarak sildi`, detail: null, tone: 'danger' };
    case 'member.added':
      return { text: `${target} kullanıcısını ekibe ekledi`, detail: m.role ? `Rol: ${role(m.role)}` : null, tone: 'neutral' };
    case 'member.removed':
      return { text: `${target} kullanıcısını ekipten çıkardı`, detail: null, tone: 'warning' };
    case 'member.role_changed':
      return { text: `${target} kullanıcısının rolünü değiştirdi`, detail: `${role(m.from)} → ${role(m.to)}`, tone: 'warning' };
    case 'member.status_changed':
      return { text: `${target} kullanıcısının durumunu değiştirdi`, detail: `${MEMBER_STATUS[String(m.from)] ?? m.from} → ${MEMBER_STATUS[String(m.to)] ?? m.to}`, tone: 'warning' };
    case 'user.created':
      return { text: `${target} için yeni kullanıcı hesabı oluşturdu`, detail: m.role ? `Rol: ${role(m.role)}` : null, tone: 'neutral' };
    case 'user.password_reset':
      return { text: 'Bir kullanıcı için geçici şifre oluşturdu', detail: null, tone: 'warning' };
    case 'settings.updated':
      return { text: 'Şirket / site ayarlarını güncelledi', detail: fieldList(m.fields), tone: 'neutral' };
    case 'domain.added':
      return { text: `${target} alan adını ekledi`, detail: null, tone: 'neutral' };
    case 'domain.removed':
      return { text: `${target} alan adını kaldırdı`, detail: null, tone: 'warning' };
    case 'domain.updated':
      return { text: `${target} alan adını güncelledi`, detail: null, tone: 'neutral' };
    case 'content.updated':
      return { text: `${target} içeriğini güncelledi`, detail: fieldList(m.fields), tone: 'neutral' };
    case 'content.published':
      return { text: `${target} içeriğini yayınladı`, detail: null, tone: 'success' };
    case 'content.deleted':
      return { text: `${target} içeriğini sildi`, detail: null, tone: 'warning' };
    case 'collection.created':
      return { text: `${target} seçkisini oluşturdu`, detail: null, tone: 'neutral' };
    case 'collection.revoked':
      return { text: `${target} seçkisinin bağlantısını iptal etti`, detail: null, tone: 'neutral' };
    case 'collection.deleted':
      return { text: `${target} seçkisini sildi`, detail: null, tone: 'warning' };
    case 'customer.deleted':
      return { text: `${target} müşteri kaydını sildi`, detail: null, tone: 'warning' };
    case 'lead.deleted':
      return { text: 'Bir talebi sildi', detail: null, tone: 'warning' };
    case 'media.deleted':
      return { text: 'Bir görseli sildi', detail: null, tone: 'neutral' };
    case 'data.exported':
      return { text: `Veri dışa aktardı: ${row.target_type ?? ''}`.trim(), detail: row.target_label, tone: 'warning' };
    case 'organization.created':
      return { text: `${target} organizasyonunu oluşturdu`, detail: null, tone: 'neutral' };
    case 'organization.status_changed':
      return { text: `${target} organizasyonunun durumunu değiştirdi`, detail: m.from || m.to ? `${m.from ?? ''} → ${m.to ?? ''}` : null, tone: 'warning' };
    case 'plan.updated':
      return { text: `${target} planını güncelledi`, detail: null, tone: 'neutral' };
    case 'subscription.changed':
      return { text: 'Abonelik planını değiştirdi', detail: m.plan ? `Plan: ${m.plan}` : null, tone: 'neutral' };
    default:
      return { text: row.action, detail: target || null, tone: 'neutral' };
  }
}


/** Hedef kaydın yönetim panelindeki sayfası (varsa) */
export function auditTargetHref(row: { target_type: string | null; target_id: string | null; action: string }): string | null {
  const id = row.target_id ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (row.target_type === 'property' && row.action !== 'property.purged') return `/admin/ilanlar/${id}`;
  if (row.target_type === 'collection' && row.action !== 'collection.deleted') return `/admin/koleksiyonlar/${id}`;
  return null;
}
