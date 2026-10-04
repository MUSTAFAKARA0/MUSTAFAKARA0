'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequestFingerprint } from '@/lib/request';
import { createServiceClient, createSessionClient } from '@/lib/supabase/server';
import { logSecurityEvent } from '@/platform/audit';
import { authPasswordErrorMessage, passwordSchema } from '@/platform/auth/password-policy';
import { writeSessionScopeCookie } from '@/platform/auth/scope-cookie';
import { ACTIVE_ORG_COOKIE } from '@/platform/auth/session';
import { hashInvitationToken, isInvitationTokenFormat } from '@/modules/platform/invitations/token';

/**
 * Davetle hesap etkinleştirme (P0.4) — yeni hesap kurulumu. Şifre sıfırlamadan AYRIDIR:
 * yalnızca hiç etkinleştirilmemiş (e-postası doğrulanmamış, hiç giriş yapmamış) davetli hesapta çalışır.
 *
 *  • İstemciden yalnızca token ve şifre alınır. Organizasyon, kullanıcı, e-posta ve rol
 *    token → sunucudaki davet kaydı zincirinden gelir; formdaki başka alanlar yok sayılır.
 *  • Tüm kurallar (süre, tek kullanım, e-posta / kiracı / rol bağı, iptal) veritabanındaki
 *    invitation_accept fonksiyonundadır; geçersiz durumların hepsi AYNI yanıtı alır.
 *  • Şifre Supabase Auth'a yazılır (kendi politikası da uygulanır); oturum Supabase Auth'un
 *    normal şifreli girişiyle açılır (çerezler @supabase/ssr ile). Yönlendirme sabittir: /admin.
 *  • Token loglanmaz ve hata mesajına girmez.
 */

const INVALID = 'Bu davet artık geçerli değil. Bağlantının süresi dolmuş, daha önce kullanılmış veya iptal edilmiş olabilir. Yeni davet için platform yöneticinizle iletişime geçin.';
const RATE_LIMITED = 'Kısa sürede çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.';
const UNAVAILABLE = 'Hesap etkinleştirme şu anda yapılamıyor. Lütfen daha sonra tekrar deneyin.';

export type InvitationPreview = { ok: true; email: string; organization: string; expiresAt: string } | { ok: false; error: string };

export interface ActivationState {
  error?: string;
  invalid?: boolean;
}

export async function inspectInvitation(token: unknown): Promise<InvitationPreview> {
  if (!isInvitationTokenFormat(token)) return { ok: false, error: INVALID };
  const service = createServiceClient();
  if (!service) return { ok: false, error: UNAVAILABLE };
  const { ipHash } = await getRequestFingerprint();
  const { data, error } = await service.rpc('invitation_lookup', { p_token_hash: hashInvitationToken(token), p_ip_hash: ipHash });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: UNAVAILABLE };
  if (row.result === 'rate_limited') return { ok: false, error: RATE_LIMITED };
  if (row.result !== 'ok' || !row.email || !row.organization_name || !row.expires_at) return { ok: false, error: INVALID };
  return { ok: true, email: row.email, organization: row.organization_name, expiresAt: row.expires_at };
}

export async function activateInvitation(_prev: ActivationState, formData: FormData): Promise<ActivationState> {
  const token = formData.get('token');
  if (!isInvitationTokenFormat(token)) return { error: INVALID, invalid: true };
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (password !== confirm) return { error: 'Şifreler birbiriyle eşleşmiyor.' };

  const service = createServiceClient();
  if (!service) return { error: UNAVAILABLE };
  const { ipHash } = await getRequestFingerprint();

  // 1) Tek kullanımlık kabul (yarış güvenli): yalnızca bir istek satırı alır
  const { data, error } = await service.rpc('invitation_accept', { p_token_hash: hashInvitationToken(token), p_ip_hash: ipHash });
  const claim = data?.[0];
  if (error || !claim) return { error: UNAVAILABLE };
  if (claim.result === 'rate_limited') return { error: RATE_LIMITED };
  if (claim.result !== 'ok' || !claim.user_id || !claim.organization_id || !claim.email || !claim.invitation_id) return { error: INVALID, invalid: true };

  // 2) Şifre Supabase Auth'ta belirlenir; e-posta, davet bağlantısıyla doğrulanmış olur
  const updated = await service.auth.admin.updateUserById(claim.user_id, { password: parsed.data, email_confirm: true });
  if (updated.error) {
    // Telafi: davet yeniden bekler (hesap hâlâ etkinleştirilmemiş); kullanıcı başka şifreyle tekrar deneyebilir
    await service.rpc('invitation_release', { p_invitation: claim.invitation_id });
    return { error: authPasswordErrorMessage(updated.error.message) };
  }
  await service.from('profiles').update({ password_change_required: false }).eq('id', claim.user_id);

  // 3) Oturum: Supabase Auth'un normal şifreli girişi (özel oturum / token yok)
  const supabase = await createSessionClient();
  const signIn = await supabase.auth.signInWithPassword({ email: claim.email, password: parsed.data });
  if (signIn.error || !signIn.data.user) {
    redirect('/admin/giris');
  }
  await logSecurityEvent({ orgId: claim.organization_id, action: 'auth.login_success', actorId: claim.user_id, ipHash, metadata: { area: 'office', via: 'invitation' } });
  await writeSessionScopeCookie('office', claim.user_id, signIn.data.session?.access_token);
  // Aktif ofis: davetin organizasyonu (istemciden değil)
  (await cookies()).set(ACTIVE_ORG_COOKIE, claim.organization_id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  redirect('/admin');
}
