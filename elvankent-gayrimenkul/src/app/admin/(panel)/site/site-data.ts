import 'server-only';
import { notFound } from 'next/navigation';
import { brandingUrl } from '@/modules/media/variants';
import { getSiteAdmin } from '@/modules/platform/sites';
import { requirePagePermission } from '@/platform/auth/session';

/**
 * Ofis › Site yönetimi verisi. Organizasyon OTURUMDAN gelir (requirePagePermission →
 * ctx.org.id); adreste veya istemcide site kimliği yoktur. Okuma oturum istemcisiyle yapılır
 * (RLS: yalnızca kendi ofisi). Düzen ve sekme sayfası aynı isteği paylaşır (getSiteAdmin cache).
 */
export async function getOfficeSite() {
  const ctx = await requirePagePermission('settings.manage');
  const site = await getSiteAdmin(ctx, ctx.org.id);
  if (!site) notFound();
  return { ctx, site };
}

/** Canlı önizleme (form içi) için taslaktaki marka girdisi */
export function previewBrand(site: NonNullable<Awaited<ReturnType<typeof getSiteAdmin>>>) {
  return { primary_color: site.brand.primary_color, accent_color: site.brand.accent_color, logoUrl: brandingUrl(site.brand.logo_url), tagline: site.brand.tagline };
}
