'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getRequestFingerprint } from '@/lib/request';
import { ActionError, ForbiddenError, UnauthenticatedError, runAction, type ActionResult } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import { getMemberships, getSessionUser, requirePermission } from '@/platform/auth/session';

const codeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, { error: 'Uygulamadaki 6 haneli kodu girin.' }));

async function session() {
  const s = await getSessionUser();
  if (!s) throw new UnauthenticatedError();
  return s;
}

async function primaryOrgId(): Promise<string | null> {
  const memberships = await getMemberships();
  return memberships[0]?.orgId ?? null;
}

export interface MfaEnrollment {
  factorId: string;
  /** SVG QR kodu (data: adresi) */
  qrCode: string;
  /** Uygulamaya elle girmek için gizli anahtar (yalnızca kullanıcının kendisine gösterilir) */
  secret: string;
}

/** Kurulumu başlatır: yarım kalmış kurulumlar temizlenir, yeni TOTP faktörü oluşturulur. */
export async function startMfaEnrollment(): Promise<ActionResult<MfaEnrollment>> {
  return runAction(async () => {
    const s = await session();
    if (s.mfa.factorId) throw new ActionError('İki adımlı doğrulama zaten açık.');
    const { data: list } = await s.supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.factor_type === 'totp' && f.status !== 'verified') await s.supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const memberships = await getMemberships();
    const { data, error } = await s.supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Doğrulama uygulaması ${new Date().toISOString().slice(0, 10)}`,
      issuer: memberships[0]?.name ?? 'Emlak Paneli',
    });
    if (error || !data) throw new ActionError('Kurulum başlatılamadı. Lütfen tekrar deneyin.');
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  });
}

/** Kurulumu, uygulamadaki ilk kodla tamamlar (oturum aal2 olur). */
export async function confirmMfaEnrollment(factorId: string, rawCode: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const s = await session();
    const code = codeSchema.parse(rawCode);
    const { error } = await s.supabase.auth.mfa.challengeAndVerify({ factorId: z.uuid().parse(factorId), code });
    if (error) throw new ActionError('Kod doğrulanamadı. Telefonunuzun saatinin doğru olduğundan emin olup yeni kodu girin.');
    await logSecurityEvent({ orgId: await primaryOrgId(), action: 'user.mfa_enabled', actorId: s.user.id, targetType: 'user', targetId: s.user.id });
    revalidatePath('/admin', 'layout');
    return null;
  }, 'İki adımlı doğrulama açıldı.');
}

/** Girişte istenen doğrulama kodu (aal1 → aal2). */
export async function verifyMfaCode(rawCode: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const s = await session();
    if (!s.mfa.factorId) throw new ActionError('Hesabınızda iki adımlı doğrulama kurulu değil.');
    const code = codeSchema.parse(rawCode);
    const { error } = await s.supabase.auth.mfa.challengeAndVerify({ factorId: s.mfa.factorId, code });
    const { ipHash } = await getRequestFingerprint();
    if (error) {
      await logSecurityEvent({ orgId: await primaryOrgId(), action: 'auth.mfa_failed', actorId: s.user.id, ipHash });
      throw new ActionError(error.status === 429 ? 'Çok fazla deneme yapıldı. Lütfen biraz bekleyin.' : 'Kod hatalı veya süresi dolmuş. Uygulamadaki güncel kodu girin.');
    }
    await logSecurityEvent({ orgId: await primaryOrgId(), action: 'auth.mfa_verified', actorId: s.user.id, ipHash });
    revalidatePath('/admin', 'layout');
    return null;
  });
}

/** Kendi faktörünü kaldırır. Ofis politikası gerektiriyorsa kaldırılamaz. */
export async function removeMyMfa(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const s = await session();
    if (!s.mfa.factorId) throw new ActionError('İki adımlı doğrulama zaten kapalı.');
    if (s.mfa.aal !== 'aal2') throw new ForbiddenError('Önce doğrulama kodunu girin.');
    const memberships = await getMemberships();
    if (memberships.some((m) => m.requireAdminMfa && (m.role === 'owner' || m.role === 'admin'))) {
      throw new ActionError('Ofis politikası gereği sahip ve yöneticiler iki adımlı doğrulamayı kapatamaz.');
    }
    if (s.profile.isSuperAdmin && process.env.PLATFORM_ADMIN_MFA_REQUIRED === 'true') {
      throw new ActionError('Platform politikası gereği süper admin hesaplarında iki adımlı doğrulama kapatılamaz.');
    }
    const { error } = await s.supabase.auth.mfa.unenroll({ factorId: s.mfa.factorId });
    if (error) throw new ActionError('İki adımlı doğrulama kapatılamadı.');
    await logSecurityEvent({ orgId: await primaryOrgId(), action: 'user.mfa_disabled', actorId: s.user.id, targetType: 'user', targetId: s.user.id });
    revalidatePath('/admin', 'layout');
    return null;
  }, 'İki adımlı doğrulama kapatıldı.');
}

/** Ofis politikası: sahip ve yöneticiler için MFA zorunluluğu (yalnızca sahip). */
export async function setRequireAdminMfa(value: boolean): Promise<ActionResult<null>> {
  return runAction(
    async () => {
      const ctx = await requirePermission('users.manage');
      if (ctx.role !== 'owner') throw new ForbiddenError('Bu ayarı yalnızca ofis sahibi değiştirebilir.');
      const { error } = await ctx.supabase.rpc('set_require_admin_mfa', { p_org: ctx.org.id, p_value: z.boolean().parse(value) });
      if (error) {
        if (error.message === 'mfa_required') throw new ActionError('Zorunluluğu açmadan önce kendi hesabınızda iki adımlı doğrulamayı açın.');
        throw new ActionError('Ayar kaydedilemedi.');
      }
      revalidatePath('/admin', 'layout');
      return null;
    },
    value ? 'Sahip ve yöneticiler için iki adımlı doğrulama zorunlu.' : 'Zorunluluk kaldırıldı.',
  );
}
