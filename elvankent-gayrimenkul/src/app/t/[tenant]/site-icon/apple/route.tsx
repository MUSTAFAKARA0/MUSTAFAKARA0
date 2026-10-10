import { ImageResponse } from 'next/og';
import { siteIconParts } from '@/modules/seo/site-icon';
import { routeCacheControl, siteTenantForRoute } from '@/site-config/load';

/** Ofisin otomatik ana ekran simgesi (iOS, 180×180 PNG) */
export async function GET(_request: Request, { params }: RouteContext<'/t/[tenant]/site-icon/apple'>) {
  const route = await siteTenantForRoute(decodeURIComponent((await params).tenant));
  if (!route) return new Response('Not found', { status: 404 });
  const { tenant, preview } = route;
  const { letter, background, foreground, accent } = siteIconParts(tenant.settings);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background }}>
        <div style={{ display: 'flex', fontSize: 104, fontWeight: 700, color: foreground, lineHeight: 1 }}>{letter}</div>
        <div style={{ display: 'flex', width: 78, height: 8, borderRadius: 4, background: accent, marginTop: 12 }} />
      </div>
    ),
    { width: 180, height: 180, headers: { 'Cache-Control': routeCacheControl(preview, 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400') } },
  );
}
