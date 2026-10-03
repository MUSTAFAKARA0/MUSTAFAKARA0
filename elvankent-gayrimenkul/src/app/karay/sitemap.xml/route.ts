import { karaySiteUrl } from '@/modules/karay/site';
import { getKarayProfile } from '@/modules/karay/profile';

/**
 * KARAY sayfasının site haritası (kiracı site haritalarından ayrı). Taslak yasal metinler
 * arama motorlarına kapalı olduğundan listelenmez. Dizine kapalıysa (KARAY ayarları) boş.
 */
export async function GET() {
  const [profile, base] = await Promise.all([getKarayProfile(), karaySiteUrl()]);
  const urls = profile.indexable ? [`${base.origin}${base.path('/')}`] : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `<url><loc>${u}</loc><priority>1.0</priority></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
