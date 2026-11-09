import 'server-only';
import { ActionError, assertNoDbError } from '@/platform/actions';
import type { SessionUser } from '@/platform/auth/session';
import { isEmailConfigured, sendEmail } from '@/modules/notifications/email';
import { buildInvitationEmail } from '@/modules/platform/invitations/email';
import { createInvitationToken, invitationLink } from '@/modules/platform/invitations/token';
import { getTenant } from '@/platform/tenant/tenant';

/**
 * Sahip daveti — platform (KARAY süper admin) tarafı. Çağıran requireSuperAdmin() ile oturumu
 * doğrulamış olmalıdır; her veritabanı fonksiyonu ayrıca assert_super_admin uygular.
 * Organizasyon kimliği yalnızca hangi ofis için işlem yapıldığını seçer: davetin e-postası,
 * kullanıcısı ve rolü veritabanında sahip üyeliğinden / mevcut davetten okunur.
 */

export type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'revoked';

export interface OwnerInvitation {
  id: string;
  email: string;
  status: InvitationStatus;
  expiresAt: string;
  lastSentAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  /** Hesap hâlâ etkinleştirilmemiş mi (false: sahip başka yoldan, ör. şifre sıfırlamayla etkinleştirmiş) */
  accountPending: boolean;
}

export async function getOwnerInvitation(session: SessionUser, orgId: string): Promise<OwnerInvitation | null> {
  const { data, error } = await session.supabase.rpc('platform_owner_invitation', { p_org: orgId });
  if (error) return null;
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    status: row.status as InvitationStatus,
    expiresAt: row.expires_at,
    lastSentAt: row.last_sent_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    accountPending: row.account_pending,
  };
}

/**
 * Daveti (yeniden) gönderir. Her gönderim YENİ token üretir ve süreyi baştan başlatır; önceki
 * bağlantı veritabanında özeti değiştiği için hemen geçersiz olur. E-posta gönderilemezse davet
 * bekler durumda kalır (kabul durumu ile teslim ayrı) ve yönetici tekrar gönderebilir.
 */
export async function sendOwnerInvitation(session: SessionUser, orgId: string): Promise<{ email: string; expiresAt: string; warning?: string }> {
  if (!isEmailConfigured()) {
    throw new ActionError('E-posta gönderimi yapılandırılmamış (EMAIL_PROVIDER). Davet bekliyor; e-posta ayarlandıktan sonra gönderebilirsiniz.', 'config');
  }
  const { data: org } = await session.supabase.from('organizations').select('slug, name').eq('id', orgId).maybeSingle();
  const tenant = org ? await getTenant(org.slug) : null;
  if (!org || !tenant) throw new ActionError('Organizasyon bulunamadı veya aktif değil.', 'not_found');

  const { token, hash } = createInvitationToken();
  const { data, error } = await session.supabase.rpc('platform_send_owner_invitation', { p_org: orgId, p_token_hash: hash });
  assertNoDbError(error);
  const row = data?.[0];
  if (!row) throw new ActionError('Davet oluşturulamadı. Lütfen tekrar deneyin.');

  const message = buildInvitationEmail({ organizationName: org.name, link: invitationLink(tenant.panelBaseUrl, token), expiresAt: row.expires_at });
  // Aynı token için yeniden deneme çift e-posta göndermez; "tekrar gönder" yeni token → yeni anahtar
  const sent = await sendEmail({ ...message, to: [row.email] }, { idempotencyKey: `invitation/${row.invitation_id}/${hash.slice(0, 24)}` });
  if (!sent.ok) {
    // Ayrıntı yalnızca güvenli tanımlayıcılarla loglanır (token / bağlantı / e-posta yok)
    console.error('[invitation] email failed', { invitation: row.invitation_id, org: orgId, provider: sent.provider, error: sent.error });
    throw new ActionError('Davet e-postası gönderilemedi. Davet bekliyor; birazdan "Daveti tekrar gönder" ile yeniden deneyin.', 'email_failed');
  }
  // E-posta sağlayıcısı kabul etti; "gönderildi" işareti yazılamazsa davet yine geçerlidir, yalnız ekranda uyarı gösterilir
  const marked = await session.supabase.rpc('platform_mark_invitation_sent', { p_invitation: row.invitation_id });
  if (marked.error) {
    console.warn('[invitation] mark sent failed', { invitation: row.invitation_id, org: orgId, code: marked.error.code });
    return { email: row.email, expiresAt: row.expires_at, warning: 'Davet e-postası gönderildi ancak gönderim zamanı kaydedilemedi; konsolda "gönderilmedi" görünebilir.' };
  }
  return { email: row.email, expiresAt: row.expires_at };
}

export async function revokeOwnerInvitation(session: SessionUser, orgId: string): Promise<void> {
  const { error } = await session.supabase.rpc('platform_revoke_owner_invitation', { p_org: orgId });
  if (error?.code === 'P0002') throw new ActionError('İptal edilecek bekleyen davet yok.', 'not_found');
  assertNoDbError(error);
}

/** Açılıştan hemen sonra gönderilen ilk sahip daveti: sonuç (e-posta sağlayıcısı kabul etti, hata ya da gereksiz) */
export type InitialInvitation =
  | { status: 'sent'; email: string; expiresAt: string; sentAt: string; warning?: string }
  | { status: 'failed'; error: string }
  | { status: 'not_applicable' };

/**
 * PILOT · Yeni ofis açılınca sahip daveti KENDİLİĞİNDEN gönderilir (aynı güvenli davet: tek kullanımlık, süreli, özeti
 * saklanan token, ofise bağlı; e-postada şifre yok). Yalnız yeni açılan, henüz etkinleşmemiş hesap için ('invitation_pending');
 * kayıtlı (mevcut) hesaba davet açılmaz, şifresine / hesabına dokunulmaz. Gönderim başarısız olursa organizasyon KALIR,
 * davet bekler ve konsoldaki "Daveti tekrar gönder" aynı davet kaydını yeni tokenla kullanır (yinelenen davet satırı yok).
 * "sent" = e-posta sağlayıcısı tarafından kabul edildi (alıcının gelen kutusuna teslim garantisi değildir).
 */
export async function sendInitialOwnerInvitation(session: SessionUser, orgId: string, ownerAccount: 'invitation_pending' | 'existing_account'): Promise<InitialInvitation> {
  if (ownerAccount !== 'invitation_pending') return { status: 'not_applicable' };
  try {
    const sent = await sendOwnerInvitation(session, orgId);
    return { status: 'sent', email: sent.email, expiresAt: sent.expiresAt, sentAt: new Date().toISOString(), ...(sent.warning ? { warning: sent.warning } : {}) };
  } catch (e) {
    return { status: 'failed', error: e instanceof ActionError ? e.message : 'Davet e-postası gönderilemedi. Davet bekliyor; "Davet gönder" ile yeniden deneyin.' };
  }
}
