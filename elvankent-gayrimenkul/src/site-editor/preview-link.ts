import 'server-only';
import { isUuid } from '@/lib/utils';
import { ActionError } from '@/platform/actions';
import type { SessionUser } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';
import { createPreviewToken } from '@/site-config/preview';

export const NO_SITE_ADDRESS =
  'Bu sitenin henüz bir adresi yok. Önizleme ve yayın için alan adı bağlanmalı (Alan adı) veya KARAY platform alt alan adı (PLATFORM_ROOT_DOMAIN) tanımlanmalıdır.';

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
  // Önizleme sitenin kendi adresinde açılır (belirteç yalnızca o adresin kiracısında geçerlidir)
  if (!tenant.siteAddress) throw new ActionError(NO_SITE_ADDRESS);
  const to = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/';
  return `${tenant.siteAddress}/api/site-preview?token=${encodeURIComponent(token)}&to=${encodeURIComponent(to)}`;
}
