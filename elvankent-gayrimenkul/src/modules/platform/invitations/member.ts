import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { ActionError } from '@/platform/actions';
import type { OrgContext } from '@/platform/auth/session';
import { isEmailConfigured, sendEmail } from '@/modules/notifications/email';
import { buildInvitationEmail } from '@/modules/platform/invitations/email';
import { createInvitationToken, invitationLink } from '@/modules/platform/invitations/token';
import { getTenant } from '@/platform/tenant/tenant';

/**
 * Ekip üyesi daveti (FAZ 1) — geçici şifre yerine. Sahip davetiyle (P0.4) AYNI token, e-posta,
 * aktivasyon ekranı ve kabul fonksiyonları kullanılır; yalnızca gönderen taraf farklıdır.
 *
 * Yetki: çağıran requirePermission('users.manage') ile oturumu doğrulamış olmalıdır. Veritabanı
 * fonksiyonu (org_send_member_invitation, yalnızca sunucu anahtarıyla) işlemi yapanın ofisteki
 * yetkisini, hedefin aktif üye ve etkinleştirilmemiş hesap olmasını, sahip kuralını ve hız sınırını
 * AYRICA doğrular. Organizasyon ve işlemi yapan oturumdan gelir; istemciden yalnızca kullanıcı kimliği.
 */
export function memberInvitationsAvailable(): boolean {
  return isEmailConfigured();
}

export type MemberInvitationResult = { email: string; expiresAt: string; sent: true } | { email: string; expiresAt: string; sent: false };

const DB_ERRORS: Record<string, string> = {
  forbidden: 'Bu kullanıcıya davet gönderme yetkiniz yok.',
  not_found: 'Kullanıcı bu ekipte bulunamadı.',
  account_active: 'Bu kullanıcının hesabı zaten etkin; davet gerekmez. Şifresini unuttuysa "Şifremi unuttum" ile yenileyebilir.',
  rate_limited: 'Kısa sürede çok fazla davet gönderildi. Lütfen bir süre sonra tekrar deneyin.',
};

export async function sendMemberInvitation(ctx: OrgContext, userId: string): Promise<MemberInvitationResult> {
  if (!isEmailConfigured()) throw new ActionError('E-posta gönderimi yapılandırılmamış; davet gönderilemez.', 'config');
  const service = createServiceClient();
  if (!service) throw new ActionError('Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY tanımlı değil.', 'config');
  const tenant = await getTenant(ctx.org.slug);
  if (!tenant) throw new ActionError('Ofis bulunamadı veya aktif değil.', 'not_found');

  const { token, hash } = createInvitationToken();
  const { data, error } = await service.rpc('org_send_member_invitation', { p_actor: ctx.user.id, p_org: ctx.org.id, p_user: userId, p_token_hash: hash });
  if (error) {
    const known = Object.keys(DB_ERRORS).find((k) => error.message?.includes(k));
    if (known) throw new ActionError(DB_ERRORS[known], known);
    console.error('[invitation] member invite failed', { org: ctx.org.id, code: error.code });
    throw new ActionError('Davet oluşturulamadı. Lütfen tekrar deneyin.');
  }
  const row = data?.[0];
  if (!row) throw new ActionError('Davet oluşturulamadı. Lütfen tekrar deneyin.');

  const message = buildInvitationEmail({ organizationName: ctx.org.name, link: invitationLink(tenant.panelBaseUrl, token), expiresAt: row.expires_at });
  const sent = await sendEmail({ ...message, to: [row.email] }, { idempotencyKey: `invitation/${row.invitation_id}/${hash.slice(0, 24)}` });
  if (!sent.ok) {
    console.error('[invitation] member email failed', { invitation: row.invitation_id, org: ctx.org.id, provider: sent.provider, error: sent.error });
    return { email: row.email, expiresAt: row.expires_at, sent: false };
  }
  // Teslim edildi: "gönderildi" durumu yalnızca e-posta sağlayıcısı kabul ettikten sonra
  await service.rpc('org_mark_member_invitation_sent', { p_invitation: row.invitation_id });
  return { email: row.email, expiresAt: row.expires_at, sent: true };
}
