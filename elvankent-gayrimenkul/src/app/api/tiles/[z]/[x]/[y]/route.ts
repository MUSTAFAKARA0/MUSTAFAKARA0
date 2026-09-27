import { getMapProvider } from '@/modules/maps/providers';

/** Döşeme (x, y, z) → coğrafi sınırlar */
function tileBounds(z: number, x: number, y: number) {
  const n = 2 ** z;
  const lng = (tx: number) => (tx / n) * 360 - 180;
  const lat = (ty: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
  return { west: lng(x), east: lng(x + 1), north: lat(y), south: lat(y + 1) };
}

// Yakın yakınlaştırmalarda yalnızca Türkiye ve çevresi sunulur: proxy'nin
// başka amaçlarla (ücretli anahtar üzerinden) kullanılmasını sınırlar.
const REGION = { west: 24, east: 46, south: 34.5, north: 43.5 };

/**
 * Harita döşeme proxy'si. Sağlayıcı adresi ve API anahtarı yalnızca sunucuda
 * tutulur; tarayıcıya hiçbir anahtar gitmez. Yanıtlar CDN'de önbelleğe alınır.
 */
export async function GET(request: Request, ctx: RouteContext<'/api/tiles/[z]/[x]/[y]'>) {
  const { z, x, y } = await ctx.params;
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y.replace(/\.png$/, ''));
  const max = 2 ** zi;
  if (![zi, xi, yi].every(Number.isInteger) || zi < 3 || zi > 19 || xi < 0 || yi < 0 || xi >= max || yi >= max) {
    return new Response('Geçersiz döşeme', { status: 400 });
  }
  if (zi >= 7) {
    const b = tileBounds(zi, xi, yi);
    if (b.east < REGION.west || b.west > REGION.east || b.north < REGION.south || b.south > REGION.north) {
      return new Response('Bölge dışı', { status: 404 });
    }
  }
  // Başka sitelerin döşeme sunucusu olarak kullanmasını zorlaştır
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return new Response(null, { status: 403 });

  const provider = getMapProvider();
  try {
    const res = await fetch(provider.tileUrl(zi, xi, yi), {
      headers: { 'User-Agent': 'EmlakPlatform/2.0 (+tile-proxy)' },
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
