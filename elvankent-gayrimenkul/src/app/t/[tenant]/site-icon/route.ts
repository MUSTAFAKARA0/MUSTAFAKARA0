import { siteIconSvg } from '@/modules/seo/site-icon';
import { routeCacheControl, siteTenantForRoute } from '@/site-config/load';

/** Ofisin otomatik site simgesi (/site-icon → /t/{kiracı}/site-icon), SVG */
export async function GET(_request: Request, { params }: RouteContext<'/t/[tenant]/site-icon'>) {
  const route = await siteTenantForRoute(decodeURIComponent((await params).tenant));
  if (!route) return new Response('Not found', { status: 404 });
  const { tenant, preview } = route;
  return new Response(siteIconSvg(tenant.settings), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': routeCacheControl(preview, 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'),
    },
  });
}
