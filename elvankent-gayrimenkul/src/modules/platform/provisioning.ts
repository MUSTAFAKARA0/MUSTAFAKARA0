import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { ActionError, assertNoDbError } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import type { SessionUser } from '@/platform/auth/session';
import { orgSchema, type CreateOrgInput } from '@/modules/platform/org-schema';
import { createInvitationToken } from '@/modules/platform/invitations/token';

/**
 * Organizasyon açma çekirdeği (süper admin oturumuyla). Organizasyonlar sayfası ve "Yeni Site
 * Oluştur" sihirbazı AYNI çekirdeği kullanır. Çağıran requireSuperAdmin() ile oturumu
 * doğrulamış olmalıdır; veritabanı ayrıca doğrular.
 *
 * Sahip hesabı (P0.4):
 *   • E-posta kayıtlıysa mevcut hesap sahip olarak eklenir (şifresi / durumu DEĞİŞMEZ).
 *   • Değilse Supabase Auth'ta şifre VERİLMEDEN (Auth kimsenin bilmediği rastgele bir şifre özeti
 *     yazar) ve e-postası doğrulanmamış hesap açılır (giriş yapılamaz); platform_create_organization
 *     organizasyon + sahip üyeliği + bekleyen daveti TEK işlemde oluşturur. Geçici şifre yoktur; sahip şifresini davet bağlantısıyla kendisi
 *     belirler. Davet e-postası platform ekranındaki "Davet gönder" ile gönderilir.
 *   • Organizasyon açılamazsa yeni açılan hesap silinir (yarım müşteri / sahipsiz hesap kalmaz).
 */
export type OwnerAccountState = 'invitation_pending' | 'existing_account';

export async function provisionOrganization(session: SessionUser, raw: CreateOrgInput): Promise<{ id: string; ownerEmail: string; ownerAccount: OwnerAccountState }> {
  const input = orgSchema.parse(raw);
  const service = createServiceClient();
  if (!service) throw new ActionError('Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY tanımlı değil.', 'config');

  const { data: found } = await session.supabase.rpc('platform_users', { p_search: input.owner_email, p_limit: 20 });
  let ownerId = (found ?? []).find((u) => u.email?.toLowerCase() === input.owner_email)?.user_id ?? null;
  let createdUser = false;
  if (!ownerId) {
    const { data, error } = await service.auth.admin.createUser({
      email: input.owner_email,
      email_confirm: false,
      user_metadata: { full_name: input.owner_name },
    });
    if (error || !data.user) throw new ActionError('Sahip hesabı oluşturulamadı. Lütfen tekrar deneyin.');
    ownerId = data.user.id;
    createdUser = true;
    await service.from('profiles').update({ full_name: input.owner_name }).eq('id', ownerId);
  }

  // Ham token burada atılır: ilk e-posta "Davet gönder" ile YENİ token üretir (bu özet hiçbir
  // bağlantıya karşılık gelmez, yalnızca bekleyen davet kaydını oluşturur)
  const invite = createdUser ? createInvitationToken() : null;
  const { data: orgId, error } = await session.supabase.rpc('platform_create_organization', {
    p_slug: input.slug,
    p_name: input.name,
    p_prefix: input.prefix,
    p_plan: input.plan,
    p_owner: ownerId,
    ...(invite ? { p_invite_token_hash: invite.hash } : {}),
  });
  if (error) {
    if (createdUser) await service.auth.admin.deleteUser(ownerId);
    if (error.code === '23505') throw new ActionError('Lütfen işaretli alanları kontrol edin.', 'validation', { slug: ['Bu kısa ad veya önek başka bir organizasyonda kullanılıyor.'] });
    assertNoDbError(error);
  }
  if (createdUser) {
    await logSecurityEvent({ orgId: orgId as string, action: 'user.created', actorId: session.user.id, targetType: 'user', targetId: ownerId, targetLabel: input.owner_name, metadata: { role: 'owner', activation: 'invitation' } });
  }
  return { id: orgId as string, ownerEmail: input.owner_email, ownerAccount: createdUser ? 'invitation_pending' : 'existing_account' };
}
