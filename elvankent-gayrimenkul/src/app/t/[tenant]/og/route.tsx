import { getShowcaseProperties } from '@/modules/properties/queries';
import { brandingUrl, mediaUrl } from '@/modules/media/variants';
import { imageAsJpegDataUrl, OG_CACHE_PUBLIC, OG_SIZE, renderSiteOgImage } from '@/modules/seo/og-image';
import { buildTheme } from '@/platform/branding/theme';
import { routeCacheControl, siteTenantForRoute } from '@/site-config/load';

/**
 * Sitenin dinamik paylaşım görseli (/og → /t/{kiracı}/og). Herkese açık istek YALNIZCA yayındaki
 * markayı çizer; taslak yalnızca bu kiracıya ait imzalı önizleme çerezi varsa (P0.3) ve yanıt
 * paylaşılan önbelleğe alınmaz. Sorgu parametresiyle taslak açılamaz.
 */
export async function GET(request: Request, { params }: RouteContext<'/t/[tenant]/og'>) {
  const route = await siteTenantForRoute(decodeURIComponent((await params).tenant));
  if (!route) return new Response('Not found', { status: 404 });
  const { tenant, preview } = route;
  const s = tenant.settings;
  const theme = buildTheme(s.primary_color, s.accent_color);

  let photoSrc = brandingUrl(s.hero_image_url);
  if (!photoSrc) {
    const showcase = await getShowcaseProperties(tenant.id, 1).catch(() => []);
    photoSrc = showcase[0]?.cover ? mediaUrl(showcase[0].cover, 1440) : null;
  }
  const photo = await imageAsJpegDataUrl(photoSrc, request.url, OG_SIZE.width, OG_SIZE.height);

  return renderSiteOgImage({
    brand: { name: s.display_name, primary: theme.primary, accent: theme.accent, domain: new URL(tenant.baseUrl).host },
    headline: s.hero_title ?? s.tagline ?? 'Satılık ve kiralık gayrimenkuller',
    subline: s.service_area ? `${s.service_area} satılık ve kiralık daire, villa, ticari gayrimenkul ve arsa ilanları` : s.description,
    photo,
    cacheControl: routeCacheControl(preview, OG_CACHE_PUBLIC),
  });
}
