import { brandingUrl } from '@/modules/media/variants';
import { buildTheme } from '@/platform/branding/theme';
import { routeCacheControl, siteTenantForRoute } from '@/site-config/load';

/** Kiracıya özel web uygulaması bildirimi (ad, renkler, simgeler) */
export async function GET(_request: Request, { params }: RouteContext<'/t/[tenant]/manifest.webmanifest'>) {
  // Yayında canlı marka; imzalı önizlemede taslak marka (önbelleğe alınmaz)
  const route = await siteTenantForRoute(decodeURIComponent((await params).tenant));
  if (!route) return new Response('Not found', { status: 404 });
  const { tenant, preview } = route;
  const s = tenant.settings;
  const theme = buildTheme(s.primary_color, s.accent_color);
  const favicon = brandingUrl(s.favicon_url);
  const manifest = {
    name: s.display_name,
    short_name: s.display_name.length > 12 ? s.display_name.split(/\s+/)[0] : s.display_name,
    description: s.tagline ?? s.description ?? `${s.display_name} gayrimenkul ilanları`,
    lang: 'tr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fbfaf8',
    theme_color: theme.primary,
    icons: favicon
      ? [{ src: favicon, sizes: 'any', type: favicon.endsWith('.svg') ? 'image/svg+xml' : 'image/png', purpose: 'any' }]
      : [
          { src: '/site-icon', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/site-icon/apple', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': routeCacheControl(preview, 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'),
    },
  });
}
