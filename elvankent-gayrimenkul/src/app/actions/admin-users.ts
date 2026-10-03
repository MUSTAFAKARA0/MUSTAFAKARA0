'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isUuid } from '@/lib/utils';
import { createServiceClient, type DB } from '@/lib/supabase/server';
import { ActionError, assertNoDbError, ForbiddenError, NotFoundError, runAction, type ActionResult } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import { ROLES, type OrgRole } from '@/platform/auth/permissions';
import { requirePermission, type OrgContext } from '@/platform/auth/session';

/**
 * Ekip yönetimi. Üyelik satırları oturum istemcisiyle (RLS: users.manage)
 * yazılır; organization_members_guard tetikleyicisi sahip (owner) kurallarını,
 * son sahip korumasını, kişinin kendi üyeliğini değiştirememesini ve plan
 * kullanıcı limitini VERİTABANINDA uygular. Yalnızca Auth hesabı oluşturma ve
 * şifre belirleme sunucuda service_role ile yapılır (anahtar tarayıcıya gitmez).
 * Şifreler hiçbir koşulda loglanmaz.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Okunması kolay, güçlü geçici şifre (ör. "Kp7m-X9qa-3TtR-w8Zc") */
function temporaryPassword(): string {
  for (;;) {
    const groups = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''));
    const value = groups.join('-');
    if (/\d/.test(value) && /[a-z]/.test(value) && /[A-Z]/.test(value)) return value;
  }
}

function requireService(): DB {
  const service = createServiceClient();
  if (!service) throw new ActionError('Sunucu yapılandırması eksik: SUPABASE_SERVICE_ROLE_KEY tanımlı değil.', 'config');
  return service;
}

async function findUserIdByEmail(service: DB, email: string): Promise<string | null> {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new ActionError('Kullanıcı hesabı kontrol edilemedi. Lütfen tekrar deneyin.');
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function loadMember(ctx: OrgContext, userId: string) {
  if (!isUuid(userId)) throw new NotFoundError('Kullanıcı bulunamadı.');
  const { data, error } = await ctx.supabase
    .from('organization_members')
    .select('user_id, role, status')
    .eq('organization_id', ctx.org.id)
    .eq('user_id', userId)
    .maybeSingle();
  assertNoDbError(error);
  if (!data) throw new NotFoundError('Kullanıcı bu ekipte bulunamadı.');
  return data;
}

function assertNotSelf(ctx: OrgContext, userId: string) {
  if (userId === ctx.user.id) throw new ActionError('Kendi rolünüzü, durumunuzu veya üyeliğinizi değiştiremezsiniz.', 'cannot_modify_self');
}

function assertOwnerRules(ctx: OrgContext, ...roles: OrgRole[]) {
  if (roles.includes('owner') && ctx.role !== 'owner') throw new ForbiddenError('Sahip (owner) rolüyle ilgili işlemleri yalnızca bir sahip yapabilir.');
}

const refresh = () => revalidatePath('/admin/kullanicilar');

// -----------------------------------------------------------------------------
// Yeni kullanıcı
// -----------------------------------------------------------------------------
const memberSchema = z.object({
  full_name: z
    .string()
    .max(200)
    .transform((v) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, { error: 'Ad soyad en az 2 karakter olmalıdır.' }).max(100, { error: 'Ad soyad en fazla 100 karakter olabilir.' })),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, { error: 'E-posta çok uzun.' })
    .pipe(z.email({ error: 'Geçerli bir e-posta adresi girin.' })),
  role: z.enum(ROLES as [OrgRole, ...OrgRole[]], { error: 'Rol seçin.' }),
});

export type MemberInput = z.input<typeof memberSchema>;

export async function createMember(raw: MemberInput): Promise<ActionResult<{ temporaryPassword: string | null; existing: boolean; email: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('users.manage');
    const input = memberSchema.parse(raw);
    assertOwnerRules(ctx, input.role);
    const service = requireService();

    // Plan limiti (veritabanı da uygular; burada hesap boşuna oluşturulmasın diye önceden bakılır)
    const { data: usage } = await ctx.supabase.rpc('org_usage', { p_org: ctx.org.id });
    const u = usage as { limits?: { users?: number | null }; usage?: { users?: number } } | null;
    if (u?.limits?.users && (u.usage?.users ?? 0) >= u.limits.users) {
      throw new ActionError('Planınızın kullanıcı limitine ulaşıldı. Yeni kullanıcı için planınızı yükseltin veya pasif bir kullanıcıyı çıkarın.', 'plan_limit_users');
    }

    let userId: string;
    let existing = false;
    const password = temporaryPassword();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: input.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (createError || !created?.user) {
      const exists = createError?.code === 'email_exists' || /already (been )?registered|already exists/i.test(createError?.message ?? '');
      if (!exists) {
        console.warn('[users] create failed', createError?.code);
        throw new ActionError('Kullanıcı hesabı oluşturulamadı. Lütfen tekrar deneyin.');
      }
      const found = await findUserIdByEmail(service, input.email);
      if (!found) throw new ActionError('Bu e-posta adresiyle kayıtlı hesap bulunamadı. Lütfen tekrar deneyin.');
      userId = found;
      existing = true;
    } else {
      userId = created.user.id;
      await service.from('profiles').update({ full_name: input.full_name, password_change_required: true }).eq('id', userId);
    }

    const { data: current } = await ctx.supabase.from('organization_members').select('status').eq('organization_id', ctx.org.id).eq('user_id', userId).maybeSingle();
    if (current) {
      throw new ActionError(
        current.status === 'disabled' ? 'Bu kişi ekibinizde devre dışı durumda. Listeden yeniden etkinleştirebilirsiniz.' : 'Bu kişi zaten ekibinizde.',
        'member_exists',
      );
    }

    const { error: memberError } = await ctx.supabase
      .from('organization_members')
      .insert({ organization_id: ctx.org.id, user_id: userId, role: input.role, status: 'active', created_by: ctx.user.id });
    if (memberError) {
      // Yeni açılan hesap üyeliksiz kalmasın
      if (!existing) await service.auth.admin.deleteUser(userId);
      assertNoDbError(memberError);
    }

    if (!existing) {
      await logSecurityEvent({ orgId: ctx.org.id, action: 'user.created', actorId: ctx.user.id, targetType: 'user', targetId: userId, targetLabel: input.full_name, metadata: { role: input.role } });
    }
    refresh();
    return { temporaryPassword: existing ? null : password, existing, email: input.email };
  });
}

// -----------------------------------------------------------------------------
// Rol, durum, çıkarma
// -----------------------------------------------------------------------------
export async function updateMemberRole(userId: string, role: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('users.manage');
    const next = z.enum(ROLES as [OrgRole, ...OrgRole[]], { error: 'Geçersiz rol.' }).parse(role);
    assertNotSelf(ctx, userId);
    const member = await loadMember(ctx, userId);
    assertOwnerRules(ctx, member.role, next);
    if (member.role === next) return null;
    const { error } = await ctx.supabase.from('organization_members').update({ role: next }).eq('organization_id', ctx.org.id).eq('user_id', userId);
    assertNoDbError(error);
    refresh();
    return null;
  }, 'Rol güncellendi.');
}

export async function setMemberStatus(userId: string, status: 'active' | 'disabled'): Promise<ActionResult<null>> {
  return runAction(
    async () => {
      const ctx = await requirePermission('users.manage');
      const next = z.enum(['active', 'disabled']).parse(status);
      assertNotSelf(ctx, userId);
      const member = await loadMember(ctx, userId);
      assertOwnerRules(ctx, member.role);
      const { error } = await ctx.supabase.from('organization_members').update({ status: next }).eq('organization_id', ctx.org.id).eq('user_id', userId);
      assertNoDbError(error);
      refresh();
      return null;
    },
    status === 'disabled' ? 'Kullanıcı devre dışı bırakıldı; panele erişemez.' : 'Kullanıcı yeniden etkinleştirildi.',
  );
}

/** Ekipten çıkarır. Hesap silinmez (başka bir ofiste üyeliği olabilir). */
export async function removeMember(userId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('users.manage');
    assertNotSelf(ctx, userId);
    const member = await loadMember(ctx, userId);
    assertOwnerRules(ctx, member.role);
    const { error } = await ctx.supabase.from('organization_members').delete().eq('organization_id', ctx.org.id).eq('user_id', userId);
    assertNoDbError(error);
    refresh();
    return null;
  }, 'Kullanıcı ekipten çıkarıldı.');
}

/**
 * Geçici şifre belirler. Başka bir organizasyonun hesabını ele geçirmeye
 * dönüşmemesi için YALNIZCA sadece bu ekibe üye olan (ve platform yöneticisi
 * olmayan) kullanıcılar için yapılabilir.
 */
export async function resetMemberPassword(userId: string): Promise<ActionResult<{ temporaryPassword: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('users.manage');
    assertNotSelf(ctx, userId);
    const member = await loadMember(ctx, userId);
    assertOwnerRules(ctx, member.role);
    const service = requireService();
    const [{ count: otherOrgs }, { data: profile }] = await Promise.all([
      service.from('organization_members').select('user_id', { count: 'exact', head: true }).eq('user_id', userId).neq('organization_id', ctx.org.id),
      service.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle(),
    ]);
    if ((otherOrgs ?? 0) > 0 || profile?.is_super_admin) {
      throw new ForbiddenError('Bu kullanıcı başka bir ofiste de kayıtlı; şifresini yalnızca kendisi "Şifremi unuttum" ile yenileyebilir.');
    }
    const password = temporaryPassword();
    const { error } = await service.auth.admin.updateUserById(userId, { password });
    if (error) throw new ActionError('Şifre güncellenemedi. Lütfen tekrar deneyin.');
    await service.from('profiles').update({ password_change_required: true }).eq('id', userId);
    await logSecurityEvent({ orgId: ctx.org.id, action: 'user.password_reset', actorId: ctx.user.id, targetType: 'user', targetId: userId });
    refresh();
    return { temporaryPassword: password };
  });
}

/**
 * Telefonunu kaybeden üyenin iki adımlı doğrulamasını sıfırlar (tüm TOTP
 * faktörleri silinir; kişi bir sonraki girişte yeniden kurar). Geçici şifre ile
 * aynı kurallar: kendine uygulanamaz, sahibe yalnızca sahip uygulayabilir,
 * başka ofislere de üye olan kullanıcılar ve süper adminler bu yoldan sıfırlanamaz.
 */
export async function resetMemberMfa(userId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('users.manage');
    assertNotSelf(ctx, userId);
    const member = await loadMember(ctx, userId);
    assertOwnerRules(ctx, member.role);
    const service = requireService();
    const [{ count: otherOrgs }, { data: profile }] = await Promise.all([
      service.from('organization_members').select('user_id', { count: 'exact', head: true }).eq('user_id', userId).neq('organization_id', ctx.org.id),
      service.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle(),
    ]);
    if ((otherOrgs ?? 0) > 0 || profile?.is_super_admin) {
      throw new ForbiddenError('Bu kullanıcı başka bir ofiste de kayıtlı; iki adımlı doğrulaması yalnızca platform yöneticisi tarafından sıfırlanabilir.');
    }
    const { data, error } = await service.auth.admin.mfa.listFactors({ userId });
    if (error) throw new ActionError('Doğrulama bilgileri okunamadı.');
    if (!data.factors.length) throw new ActionError('Bu kullanıcıda iki adımlı doğrulama kurulu değil.');
    for (const factor of data.factors) {
      const res = await service.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
      if (res.error) throw new ActionError('İki adımlı doğrulama sıfırlanamadı. Lütfen tekrar deneyin.');
    }
    await logSecurityEvent({ orgId: ctx.org.id, action: 'user.mfa_reset', actorId: ctx.user.id, targetType: 'user', targetId: userId });
    refresh();
    return null;
  }, 'İki adımlı doğrulama sıfırlandı. Kişi bir sonraki girişte yeniden kurabilir.');
}
