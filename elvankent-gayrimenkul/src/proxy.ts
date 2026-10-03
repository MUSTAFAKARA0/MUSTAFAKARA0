import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { DEFAULT_TENANT_KEY, defaultHostsFromSiteUrl, isUnderPath, karayHostConfigFromEnv, resolveRequestSurface, tenantKeyForHost, type TenantHostConfig } from '@/platform/tenant/host';

/**
 * İstek yönlendirici (Next.js 16 proxy, Node.js çalışma zamanı).
 *
 * 1) Çok kiracılı site: alan adından kiracı anahtarı çözülür ve istek
 *    /t/{anahtar}{yol} rotasına YENİDEN YAZILIR (adres çubuğu değişmez).
 *    Böylece her ofisin sayfaları ISR önbelleğinde ayrı tutulur.
 * 2) Güvenlik: istemcinin gönderdiği `x-tenant-key` başlığı HER ZAMAN sunucuda
 *    hesaplanan değerle değiştirilir; /t/* iç rotalarına doğrudan erişim kapalıdır.
 * 2b) Yüzey ayrımı (resolveRequestSurface): kiracı alan adında KARAY konsolu
 *    (/platform, /api/platform) ve KARAY sayfası (/karay) 404'tür.
 * 3) /admin, /platform ve /onizleme: Supabase oturum çerezleri yenilenir,
 *    oturum yoksa giriş sayfasına yönlendirilir. Yetki (rol/izin) kontrolü
 *    ayrıca sunucuda ve veritabanında (RLS) yapılır — proxy tek başına
 *    güvenlik sınırı değildir.
 */

const TENANT_HEADER = 'x-tenant-key';
const PUBLIC_AUTH_PATHS = new Set(['/admin/giris', '/admin/sifremi-unuttum', '/admin/sifre-yenile', '/admin/auth/callback', '/platform/giris', '/platform/sifremi-unuttum', '/platform/sifre-yenile']);

// Yapılandırma bir kez okunur; yüzey ve kiracı çözümlemesi aynı (küçük harfli) kök alan adını kullanır
const SURFACE_CONFIG = karayHostConfigFromEnv(process.env);
const HOST_CONFIG: TenantHostConfig = {
  // Kodda kiracı adı yok: env'de tanımlı değilse veritabanındaki varsayılan kiracı (is_default)
  defaultSlug: process.env.DEFAULT_TENANT_SLUG?.trim() || DEFAULT_TENANT_KEY,
  platformRootDomain: SURFACE_CONFIG.platformRootDomain,
  defaultHosts: defaultHostsFromSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
};

/** Bu adreste böyle bir yüzey yok: sade 404 (oturum yenilenmez, çerez yazılmaz) */
function notFound(): NextResponse {
  return new NextResponse('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' },
  });
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

  // Performans: proxy yalnızca oturum çerezini yeniler (süresi dolmuşsa) ve oturumsuz
  // ziyaretçiyi giriş sayfasına yönlendirir; bunun için Auth sunucusuna gitmez (getSession
  // yerel okur). Güvenlik sınırı burası DEĞİLDİR: her sayfa ve işlem getUser() ile oturumu
  // Auth sunucusunda doğrular, veritabanı ayrıca RLS uygular. Önceden her istekte burada da
  // getUser() çağrılıyordu (istek başına fazladan bir ağ gidiş-dönüşü).
  const { data } = await supabase.auth.getSession();
  return { response, hasUser: data.session !== null };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host');

  // Yüzey kararı (KARAY ↔ kiracı) oturum çerezlerine dokunulmadan ÖNCE verilir: kiracı
  // alan adında /platform, /api/platform ve /karay hiç işlenmez, çerez yazılmaz.
  const { route } = resolveRequestSurface(pathname, host, SURFACE_CONFIG);
  if (route.kind === 'not-found') return notFound();

  const tenantKey = tenantKeyForHost(host, HOST_CONFIG);
  const requestHeaders = new Headers(request.headers);
  // İstemcinin gönderdiği değer her zaman sunucuda hesaplananla değiştirilir
  requestHeaders.set(TENANT_HEADER, tenantKey);

  // Yönetim paneli ve süper admin: oturum zorunlu (giriş/şifre sayfaları hariç)
  if (route.kind === 'panel') {
    const { response, hasUser } = await withSession(request, requestHeaders, null);
    if (!hasUser && !PUBLIC_AUTH_PATHS.has(pathname)) {
      // Platform (KARAY) ve ofis paneli ayrı giriş sayfalarına sahiptir
      if (route.area === 'platform') return privateHeaders(NextResponse.redirect(new URL('/platform/giris', request.url)));
      const loginUrl = new URL('/admin/giris', request.url);
      const next = pathname + request.nextUrl.search;
      if (next !== '/admin') loginUrl.searchParams.set('next', next);
      return privateHeaders(NextResponse.redirect(loginUrl));
    }
    return privateHeaders(response);
  }

  // API rotaları yeniden yazılmaz; kiracı başlığı güvenilir değerle iletilir
  if (route.kind === 'api' || route.kind === 'karay') {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  if (route.kind === 'karay-rewrite') {
    // KARAY'a ayrılmış alan adında kök ve diğer yollar KARAY sayfasına gider
    const target = request.nextUrl.clone();
    target.pathname = `/karay${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(target, { request: { headers: requestHeaders } });
  }

  const destination = request.nextUrl.clone();
  destination.pathname = `/t/${encodeURIComponent(tenantKey)}${pathname === '/' ? '' : pathname}`;

  // Taslak önizleme: oturum çerezi gerekir (sayfa ayrıca yetki kontrolü yapar)
  if (isUnderPath(pathname, '/onizleme')) {
    const { response } = await withSession(request, requestHeaders, destination);
    return privateHeaders(response);
  }

  const response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  if (isUnderPath(pathname, '/koleksiyon')) {
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
    // Uygulama rotaları dosya uzantısıyla bitse bile (ör. /platform/x.png) proxy'den geçer:
    // yüzey ayrımı ve kiracı başlığı uzantı hilesiyle atlatılamaz
    '/platform/:path*',
    '/site-onizleme/:path*',
    '/admin/:path*',
    '/api/:path*',
    '/karay/:path*',
    '/t/:path*',
  ],
};
