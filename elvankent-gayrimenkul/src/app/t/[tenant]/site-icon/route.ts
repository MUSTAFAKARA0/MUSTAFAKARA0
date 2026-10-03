import { siteIconSvg } from '@/modules/seo/site-icon';
import { getTenant } from '@/platform/tenant/tenant';

/** Ofisin otomatik site simgesi (/site-icon → /t/{kiracı}/site-icon), SVG */
export async function GET(_request: Request, { params }: RouteContext<'/t/[tenant]/site-icon'>) {
  const tenant = await getTenant(decodeURIComponent((await params).tenant));
  if (!tenant) return new Response('Not found', { status: 404 });
  return new Response(siteIconSvg(tenant.settings), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
