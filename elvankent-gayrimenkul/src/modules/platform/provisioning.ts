import 'server-only';
import { randomInt } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { ActionError, assertNoDbError } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import type { SessionUser } from '@/platform/auth/session';
import { orgSchema, type CreateOrgInput } from '@/modules/platform/org-schema';

/**
 * Organizasyon açma çekirdeği (süper admin oturumuyla): sahip hesabı (yoksa geçici şifreyle) +
 * platform_create_organization (ayarlar, deneme aboneliği, sahip üyeliği, boş site kaydı).
 * Organizasyonlar sayfası ve "Yeni Site Oluştur" sihirbazı AYNI çekirdeği kullanır.
 * Çağıran requireSuperAdmin() ile oturumu doğrulamış olmalıdır; veritabanı ayrıca doğrular.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function temporaryPassword(): string {
  for (;;) {
    const value = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')).join('-');
    if (/\d/.test(value) && /[a-z]/.test(value) && /[A-Z]/.test(value)) return value;
  }
}

export async function provisionOrganization(session: SessionUser, raw: CreateOrgInput): Promise<{ id: string; temporaryPassword: string | null; ownerEmail: string }> {
  const input = orgSchema.parse(raw);
  const service = createServiceClient();
  if (!service) throw new ActionError('Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY tanımlı değil.', 'config');

  // Sahip hesabı: varsa mevcut hesap, yoksa geçici şifreyle yeni hesap
  const { data: found } = await session.supabase.rpc('platform_users', { p_search: input.owner_email, p_limit: 20 });
  let ownerId = (found ?? []).find((u) => u.email?.toLowerCase() === input.owner_email)?.user_id ?? null;
  let password: string | null = null;
  let createdUser = false;
  if (!ownerId) {
    password = temporaryPassword();
    const { data, error } = await service.auth.admin.createUser({
      email: input.owner_email,
      password,
      email_confirm: true,
      user_metadata: { full_name: input.owner_name },
    });
    if (error || !data.user) throw new ActionError('Sahip hesabı oluşturulamadı. Lütfen tekrar deneyin.');
    ownerId = data.user.id;
    createdUser = true;
    await service.from('profiles').update({ full_name: input.owner_name, password_change_required: true }).eq('id', ownerId);
  }

  const { data: orgId, error } = await session.supabase.rpc('platform_create_organization', {
    p_slug: input.slug,
    p_name: input.name,
    p_prefix: input.prefix,
    p_plan: input.plan,
    p_owner: ownerId,
  });
  if (error) {
    if (createdUser) await service.auth.admin.deleteUser(ownerId);
    if (error.code === '23505') throw new ActionError('Lütfen işaretli alanları kontrol edin.', 'validation', { slug: ['Bu kısa ad veya önek başka bir organizasyonda kullanılıyor.'] });
    assertNoDbError(error);
  }
  if (createdUser) {
    await logSecurityEvent({ orgId: orgId as string, action: 'user.created', actorId: session.user.id, targetType: 'user', targetId: ownerId, targetLabel: input.owner_name, metadata: { role: 'owner' } });
  }
  return { id: orgId as string, temporaryPassword: password, ownerEmail: input.owner_email };
}
