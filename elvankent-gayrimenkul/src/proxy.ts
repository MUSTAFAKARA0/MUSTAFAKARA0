import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * /admin altındaki tüm istekler için:
 *  1) Supabase oturum çerezlerini yeniler,
 *  2) Oturumu olmayan kullanıcıyı giriş sayfasına yönlendirir.
 * Admin ROLÜ kontrolü ayrıca sunucuda (layout + her server action) ve
 * veritabanında (RLS) yapılır; proxy tek başına güvenlik sınırı değildir.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isLogin = request.nextUrl.pathname === '/admin/giris';

  if (!url || !key) {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL('/admin/giris', request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLogin) {
    const loginUrl = new URL('/admin/giris', request.url);
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== '/admin') loginUrl.searchParams.set('next', next);
    return NextResponse.redirect(loginUrl);
  }

  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
