import { serverEnv } from '@/lib/server-env';

/**
 * Harita döşeme proxy'si. Döşeme sağlayıcısının adresi ve varsa API anahtarı
 * yalnızca sunucuda (MAP_TILE_URL) tutulur; tarayıcıya hiçbir anahtar gitmez.
 * Yanıtlar CDN'de önbelleğe alınır.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/tiles/[z]/[x]/[y]'>) {
  const { z, x, y } = await ctx.params;
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y.replace(/\.png$/, ''));
  const max = 2 ** zi;
  if (![zi, xi, yi].every(Number.isInteger) || zi < 3 || zi > 19 || xi < 0 || yi < 0 || xi >= max || yi >= max) {
    return new Response('Geçersiz döşeme', { status: 400 });
  }

  const upstream = serverEnv.mapTileUrl
    .replace('{z}', String(zi))
    .replace('{x}', String(xi))
    .replace('{y}', String(yi));

  try {
    const res = await fetch(upstream, {
      headers: { 'User-Agent': 'ElvankentGayrimenkul/1.0 (+https://elvankentgayrimenkul.com)' },
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return new Response(null, { status: 502 });
    return new Response(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new Response(null, { status: 504 });
  }
}
