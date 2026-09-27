import { getTenant, tenantUrl } from '@/platform/tenant/tenant';

/**
 * Kiracıya özel robots.txt. Yönetim paneli, API, önizleme ve özel seçki
 * bağlantıları taranmaz. Filtreli liste sayfaları ENGELLENMEZ: bu sayfalar
 * kanonik etiket ve gerektiğinde "noindex" ile yönetilir (engellenirse Google
 * noindex etiketini göremez).
 */
export async function GET(_request: Request, { params }: RouteContext<'/t/[tenant]/robots.txt'>) {
  const tenant = await getTenant(decodeURIComponent((await params).tenant));
  if (!tenant) return new Response('User-agent: *\nDisallow: /\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /platform',
    'Disallow: /api/',
    'Disallow: /onizleme/',
    'Disallow: /koleksiyon/',
    'Disallow: /favoriler',
    'Disallow: /karsilastir',
    '',
    `Sitemap: ${tenantUrl(tenant, '/sitemap.xml')}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
