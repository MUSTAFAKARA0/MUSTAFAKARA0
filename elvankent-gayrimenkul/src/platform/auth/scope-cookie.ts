import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_SCOPE_COOKIE, sessionIdFromAccessToken, sessionScopeValue, type SessionScope } from '@/platform/auth/session';

/** Oturumun alanını (platform / ofis) işaretleyen çerezi yazar — bkz. SESSION_SCOPE_COOKIE */
export async function writeSessionScopeCookie(scope: SessionScope, userId: string, accessToken: string | undefined): Promise<void> {
  const value = sessionScopeValue(scope, userId, sessionIdFromAccessToken(accessToken)) ?? 'office';
  (await cookies()).set(SESSION_SCOPE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
