import 'server-only';
import { isUuid } from '@/lib/utils';
import { ActionError } from '@/platform/actions';
import type { SessionUser } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';
import { createPreviewToken } from '@/site-config/preview';

/**
 * Taslak önizleme bağlantısı (KARAY ve ofis ortak; 1 saat geçerli, yalnızca bağlantıyı açan
 * tarayıcı taslağı görür). Organizasyon oturum istemcisiyle okunur: kiracı yalnızca kendi
 * organizasyonunu görebilir (RLS). Önizleme, canlı siteyle AYNI Site Engine'i taslak
 * yapılandırmayla çizer (/api/site-preview → draft mode → getSiteView).
 */
export async function createPreviewUrl(db: SessionUser['supabase'], orgId: string, path = '/'): Promise<string> {
  if (!isUuid(orgId)) throw new ActionError('Geçersiz site.');
  const { data: org } = await db.from('organizations').select('slug, status').eq('id', orgId).maybeSingle();
  if (!org) throw new ActionError('Site bulunamadı.');
  if (org.status !== 'active') throw new ActionError('Askıdaki sitenin önizlemesi açılamaz.');
  const tenant = await getTenant(org.slug);
  const token = createPreviewToken(orgId);
  if (!tenant || !token) throw new ActionError('Önizleme bağlantısı oluşturulamadı.');
  const to = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/';
  return `${tenant.baseUrl}/api/site-preview?token=${encodeURIComponent(token)}&to=${encodeURIComponent(to)}`;
}
