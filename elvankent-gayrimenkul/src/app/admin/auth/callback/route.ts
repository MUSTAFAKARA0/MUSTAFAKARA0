import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSessionClient } from '@/lib/supabase/server';

const OTP_TYPES: EmailOtpType[] = ['recovery', 'invite', 'magiclink', 'email', 'signup', 'email_change'];

function safeNext(value: string | null): string {
  return value && /^\/admin(\/|\?|$)/.test(value) && !value.startsWith('//') ? value : '/admin';
}

/**
 * E-posta bağlantılarının dönüş adresi (şifre sıfırlama, davet).
 *  - PKCE akışı: ?code=... → oturuma çevrilir
 *  - Özel e-posta şablonu: ?token_hash=...&type=recovery → doğrulanır
 * Başarılıysa oturum çerezi yazılır ve `next` adresine gidilir.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const supabase = await createSessionClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = new URL(ok ? next : '/admin/sifremi-unuttum?hata=gecersiz', request.url);
  const response = NextResponse.redirect(target);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
