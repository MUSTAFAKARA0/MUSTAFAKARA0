import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { defaultHostsFromSiteUrl, tenantKeyForHost, type TenantHostConfig } from '@/platform/tenant/host';

/**
 * İstek yönlendirici (Next.js 16 proxy, Node.js çalışma zamanı).
 *
 * 1) Çok kiracılı site: alan adından kiracı anahtarı çözülür ve istek
 *    /t/{anahtar}{yol} rotasına YENİDEN YAZILIR (adres çubuğu değişmez).
 *    Böylece her ofisin sayfaları ISR önbelleğinde ayrı tutulur.
 * 2) Güvenlik: istemcinin gönderdiği `x-tenant-key` başlığı HER ZAMAN
 *    silinip sunucuda hesaplanan değerle değiştirilir; /t/* iç rotalarına
 *    doğrudan erişim kapalıdır.
 * 3) /admin, /platform ve /onizleme: Supabase oturum çerezleri yenilenir,
 *    oturum yoksa giriş sayfasına yönlendirilir. Yetki (rol/izin) kontrolü
 *    ayrıca sunucuda ve veritabanında (RLS) yapılır — proxy tek başına
 *    güvenlik sınırı değildir.
 */

const TENANT_HEADER = 'x-tenant-key';
const PUBLIC_AUTH_PATHS = new Set(['/admin/giris', '/admin/sifremi-unuttum', '/admin/sifre-yenile', '/admin/auth/callback', '/platform/giris', '/platform/sifremi-unuttum', '/platform/sifre-yenile']);

function hostConfig(): TenantHostConfig {
  return {
    defaultSlug: process.env.DEFAULT_TENANT_SLUG || 'elvankent',
    platformRootDomain: process.env.PLATFORM_ROOT_DOMAIN || undefined,
    defaultHosts: defaultHostsFromSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  };
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function privateHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function withSession(request: NextRequest, requestHeaders: Headers, rewriteTo: URL | null): Promise<{ response: NextResponse; hasUser: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const build = () =>
    rewriteTo ? NextResponse.rewrite(rewriteTo, { request: { headers: requestHeaders } }) : NextResponse.next({ request: { headers: requestHeaders } });

  let response = build();
  if (!url || !key) return { response, hasUser: false };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        // Yenilenen çerezler hem sunucu bileşenlerine (istek) hem tarayıcıya (yanıt) iletilir
        requestHeaders.set('cookie', request.cookies.toString());
        response = build();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser(): JWT'yi Auth sunucusunda doğrular (yalnızca çerezi okumak yeterli değildir)
  const { data } = await supabase.auth.getUser();
  return { response, hasUser: Boolean(data.user) };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // İç kiracı rotaları yalnızca yeniden yazma ile kullanılabilir
  if (isUnder(pathname, '/t')) {
    return new NextResponse('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const tenantKey = tenantKeyForHost(request.headers.get('host'), hostConfig());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TENANT_HEADER, tenantKey);

  // Yönetim paneli ve süper admin: oturum zorunlu (giriş/şifre sayfaları hariç)
  if (isUnder(pathname, '/admin') || isUnder(pathname, '/platform')) {
    const { response, hasUser } = await withSession(request, requestHeaders, null);
    if (!hasUser && !PUBLIC_AUTH_PATHS.has(pathname)) {
      // Platform (KARAY) ve ofis paneli ayrı giriş sayfalarına sahiptir
      if (isUnder(pathname, '/platform')) return privateHeaders(NextResponse.redirect(new URL('/platform/giris', request.url)));
      const loginUrl = new URL('/admin/giris', request.url);
      const next = pathname + request.nextUrl.search;
      if (next !== '/admin') loginUrl.searchParams.set('next', next);
      return privateHeaders(NextResponse.redirect(loginUrl));
    }
    return privateHeaders(response);
  }

  // API rotaları yeniden yazılmaz; kiracı başlığı güvenilir değerle iletilir
  if (isUnder(pathname, '/api')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const destination = request.nextUrl.clone();
  destination.pathname = `/t/${encodeURIComponent(tenantKey)}${pathname === '/' ? '' : pathname}`;

  // Taslak önizleme: oturum çerezi gerekir (sayfa ayrıca yetki kontrolü yapar)
  if (isUnder(pathname, '/onizleme')) {
    const { response } = await withSession(request, requestHeaders, destination);
    return privateHeaders(response);
  }

  const response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  if (isUnder(pathname, '/koleksiyon')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: [
    // Statik dosyalar ve Next.js iç kaynakları hariç her istek (robots.txt, sitemap.xml, manifest dahil)
    '/((?!_next/static|_next/image|__nextjs|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|css|js|map|woff2?|ttf|otf)$).*)',
  ],
};
