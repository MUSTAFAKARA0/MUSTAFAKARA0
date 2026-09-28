import { cookies, draftMode } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { PREVIEW_COOKIE, PREVIEW_MAX_AGE, verifyPreviewToken } from '@/platform/site/preview';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

/**
 * Site önizlemesi: KARAY panelindeki "Önizle" bağlantısı buraya gelir.
 *   ?token=…  → belirteç bu alan adının kiracısına aitse taslak görünüm açılır
 *   ?cikis=1  → önizleme kapatılır
 * Taslak yalnızca bu tarayıcıda görünür; canlı site etkilenmez.
 */
function safePath(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
}

/**
 * Göreli yönlendirme: istek hangi alan adına geldiyse (kiracının kendi alan adı) orada kalır.
 * (request.url, barındırmaya göre iç sunucu adresini gösterebilir.)
 */
function redirectTo(path: string, headers: Record<string, string>) {
  return new NextResponse(null, { status: 307, headers: { ...headers, Location: path } });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const draft = await draftMode();
  const jar = await cookies();
  const noStore = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

  if (url.searchParams.get('cikis') === '1') {
    draft.disable();
    jar.delete(PREVIEW_COOKIE);
    return redirectTo(safePath(url.searchParams.get('to')), noStore);
  }

  const token = url.searchParams.get('token');
  const orgId = verifyPreviewToken(token);
  const tenant = await getTenantFromRequest().catch(() => null);
  if (!orgId || !tenant || tenant.id !== orgId) {
    return new NextResponse('Önizleme bağlantısı geçersiz veya süresi dolmuş. KARAY panelinden yeni bağlantı oluşturun.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...noStore },
    });
  }
  draft.enable();
  jar.set(PREVIEW_COOKIE, token!, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: PREVIEW_MAX_AGE });
  return redirectTo(safePath(url.searchParams.get('to')), noStore);
}
