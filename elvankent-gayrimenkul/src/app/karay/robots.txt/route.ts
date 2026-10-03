import { karaySiteUrl } from '@/modules/karay/site';
import { getKarayProfile } from '@/modules/karay/profile';

/**
 * KARAY'a ayrılmış alan adının robots.txt'si (KARAY_HOSTS; proxy /robots.txt → buraya).
 * Paylaşılan platform adresinde robots.txt kiracınındır; KARAY site haritası orada ayrıca
 * duyurulmaz.
 */
export async function GET() {
  const [profile, base] = await Promise.all([getKarayProfile(), karaySiteUrl()]);
  const body = profile.indexable
    ? ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /platform', 'Disallow: /api/', '', `Sitemap: ${base.origin}${base.path('/sitemap.xml')}`, ''].join('\n')
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
