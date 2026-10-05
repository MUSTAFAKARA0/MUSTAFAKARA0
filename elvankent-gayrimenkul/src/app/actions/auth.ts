'use server';

import { createHash, createHmac } from 'node:crypto';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { maskEmail } from '@/lib/format';
import { getRequestFingerprint } from '@/lib/request';
import { serverEnv } from '@/lib/server-env';
import { createServiceClient, createSessionClient } from '@/lib/supabase/server';
import { isEmailConfigured } from '@/modules/notifications/email';
import { sendPasswordResetEmail } from '@/modules/notifications/auth-emails';
import { logSecurityEvent } from '@/platform/audit';
import { authPasswordErrorMessage, passwordSchema } from '@/platform/auth/password-policy';
import { writeSessionScopeCookie } from '@/platform/auth/scope-cookie';
import {
  ACTIVE_ORG_COOKIE,
  getMemberships,
  getSessionUser,
  SESSION_SCOPE_COOKIE,
  type SessionScope,
} from '@/platform/auth/session';
import { requestHostSurface } from '@/platform/tenant/config';
import { platformConsoleAllowed } from '@/platform/tenant/host';
import { getTenantFromRequest, trustedRequestOrigin } from '@/platform/tenant/tenant';

export interface AuthFormState {
  error?: string;
  message?: string;
  email?: string;
}

const emailField = z.email({ error: 'Geçerli bir e-posta adresi girin.' }).max(160);

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(6, { error: 'Şifre en az 6 karakter olmalıdır.' }).max(200),
});

/** Ofis girişi yalnızca ofis paneli içine döner (platform adresine asla; açık yönlendirme de yok) */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  if (value.startsWith('//') || value.includes('\\')) return '/admin';
  return /^\/(admin|onizleme)(\/|\?|$)/.test(value) ? value : '/admin';
}

/** Oturumun alanını (platform / ofis) işaretler — bkz. SESSION_SCOPE_COOKIE */
async function setSessionScope(scope: SessionScope, userId: string, accessToken: string | undefined) {
  await writeSessionScopeCookie(scope, userId, accessToken);
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const parsed = loginSchema.safeParse({ email, password: String(formData.get('password') ?? '') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const { ipHash } = await getRequestFingerprint();
  const platformLogin = formData.get('scope') === 'platform';
  // KARAY platform girişi kiracı (müşteri) alan adında yapılamaz: oturum hiç açılmaz,
  // platform çerezi müşteri alan adına yazılmaz (proxy de /platform'u burada 404 yapar).
  // Kimlik doğrulamadan önce reddedildiği için kayıt yazılmaz (kayıt tablosu doldurulamaz).
  if (platformLogin && !(await platformScopeAllowedHere())) {
    return { error: 'Bu adreste platform girişi yapılamaz.', email };
  }
  const tenant = await getTenantFromRequest().catch(() => null);
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    // Şifre ve token ASLA kaydedilmez; e-posta maskelenir
    await logSecurityEvent({
      orgId: tenant?.id ?? null,
      action: 'auth.login_failed',
      metadata: { email: maskEmail(email), reason: error?.status === 429 ? 'rate_limited' : 'invalid_credentials' },
      ipHash,
    });
    return {
      error:
        error?.status === 429
          ? 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.'
          : 'E-posta veya şifre hatalı.',
      email,
    };
  }

  // Yönetim paneline erişim: en az bir aktif organizasyon üyeliği veya süper admin
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('is_super_admin, password_change_required').eq('id', data.user.id).maybeSingle(),
    supabase
      .from('organization_members')
      .select('organization_id, organization:organizations(status)')
      .eq('user_id', data.user.id)
      .eq('status', 'active'),
  ]);
  const activeOrgIds = (memberships ?? [])
    .filter((m) => {
      const org = Array.isArray(m.organization) ? m.organization[0] : m.organization;
      return org?.status === 'active';
    })
    .map((m) => m.organization_id);
  const isSuperAdmin = profile?.is_super_admin ?? false;

  // Platform (KARAY) girişi yalnızca süper admin içindir; ofis kullanıcısı buradan giremez
  if (platformLogin && !isSuperAdmin) {
    await logSecurityEvent({ orgId: null, action: 'auth.login_denied', actorId: data.user.id, metadata: { reason: 'not_platform_admin' }, ipHash });
    await supabase.auth.signOut();
    return { error: 'Bu hesap platform yöneticisi değil. Ofis paneline ofisinizin giriş sayfasından girin.', email };
  }

  // Ofis girişi yalnızca bir ofise üye hesaplar içindir (platform yöneticisi de olsa)
  if (!platformLogin && activeOrgIds.length === 0) {
    await logSecurityEvent({ orgId: tenant?.id ?? null, action: 'auth.login_denied', actorId: data.user.id, metadata: { reason: 'no_membership' }, ipHash });
    await supabase.auth.signOut();
    return { error: 'Bu hesabın aktif bir ofis üyeliği bulunmuyor. Yöneticinizle iletişime geçin.', email };
  }

  const orgId = platformLogin ? null : activeOrgIds.includes(tenant?.id ?? '') ? (tenant?.id ?? null) : (activeOrgIds[0] ?? null);
  await logSecurityEvent({ orgId, action: 'auth.login_success', actorId: data.user.id, ipHash, metadata: { area: platformLogin ? 'platform' : 'office' } });
  await setSessionScope(platformLogin ? 'platform' : 'office', data.user.id, data.session?.access_token);
  const destination = platformLogin ? '/platform' : safeNext(formData.get('next'));

  // İki adımlı doğrulama kurulu ise şifreden sonra kod istenir
  if ((data.user.factors ?? []).some((f) => f.status === 'verified')) {
    redirect(`/admin/dogrulama?next=${encodeURIComponent(destination)}`);
  }
  if (!platformLogin && profile?.password_change_required) redirect('/admin/hesap?sifre=degistir');
  redirect(destination);
}

export async function signOut() {
  const session = await getSessionUser();
  if (session) {
    await logSecurityEvent({ orgId: null, action: 'auth.logout', actorId: session.user.id });
    await session.supabase.auth.signOut();
  }
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  (await cookies()).delete(SESSION_SCOPE_COOKIE);
  redirect('/admin/giris');
}

/** Platform (KARAY) konsolundan çıkış: platform giriş sayfasına döner */
export async function signOutPlatform() {
  const session = await getSessionUser();
  if (session) {
    await logSecurityEvent({ orgId: null, action: 'auth.logout', actorId: session.user.id });
    await session.supabase.auth.signOut();
  }
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  (await cookies()).delete(SESSION_SCOPE_COOKIE);
  redirect('/platform/giris');
}

/** Aktif organizasyonu değiştirir — yalnızca kullanıcının GERÇEK üyeliği varsa */
export async function switchOrganization(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.orgId === orgId && m.status === 'active')) redirect('/admin/yetkisiz');
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  revalidatePath('/admin', 'layout');
  redirect('/admin');
}

const RESET_SENT_MESSAGE = 'Bu adrese kayıtlı bir hesap varsa şifre yenileme bağlantısı gönderildi. Gelen kutunuzu (ve istenmeyen klasörünü) kontrol edin.';

/** Platform (KARAY) kapsamlı işlemler yalnızca KARAY/platform alan adlarında yapılır */
async function platformScopeAllowedHere(): Promise<boolean> {
  return platformConsoleAllowed(await requestHostSurface());
}

/** Şifre sıfırlama hız sınırı anahtarı: e-postanın tuzlu özeti (düz e-posta veritabanına yazılmaz) */
function resetEmailHash(email: string): string {
  const key = serverEnv.ipHashSalt || serverEnv.supabaseServiceRoleKey || 'eg-default-salt';
  return createHmac('sha256', key).update(`eg-password-reset|${email}`).digest('hex');
}

/**
 * Şifre sıfırlama bağlantısı ister. Hesabın var olup olmadığı açığa çıkarılmaz: yanıt metni ve
 * süresi aynıdır (bağlantı üretimi ve gönderim yanıttan SONRA, after() içinde yapılır).
 *
 * Üretim yolu (FAZ 0): e-posta KARAY'ın sağlayıcısıyla gider (EMAIL_PROVIDER). Bağlantı Auth
 * yönetici API'siyle (generateLink) üretilir ve GÜVENİLİR kök adrese (trustedRequestOrigin) ait
 * /admin/auth/callback?token_hash=… adresine işaret eder; hız sınırı veritabanında (e-posta başına
 * saatte 3, IP başına 10). E-posta yapılandırılmamışsa (yerel geliştirme) Supabase Auth'un kendi
 * e-postasına (resetPasswordForEmail) düşülür.
 */
export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const parsed = emailField.safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };
  const platformReset = formData.get('scope') === 'platform';
  // Kiracı alan adında platform sıfırlaması yapılmaz (bağlantı orada 404 olan sayfaya giderdi).
  // Yanıt, hesabın varlığını açığa çıkarmamak için normal yanıtla aynıdır; e-posta gönderilmez.
  if (platformReset && !(await platformScopeAllowedHere())) return { message: RESET_SENT_MESSAGE };
  const origin = await trustedRequestOrigin();
  // KARAY platform girişinden istenen sıfırlama, KARAY markalı sayfaya döner (ofis paneline değil).
  const next = platformReset ? '/platform/sifre-yenile' : '/admin/sifre-yenile';
  const { ipHash } = await getRequestFingerprint();

  const service = createServiceClient();
  if (service && isEmailConfigured()) {
    const { data: allowed, error } = await service.rpc('auth_password_reset_allowed', { p_email_hash: resetEmailHash(parsed.data), p_ip_hash: ipHash });
    if (!error) {
      if (!allowed) return { error: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.', email };
      after(async () => {
        const { data, error: linkError } = await service.auth.admin.generateLink({ type: 'recovery', email: parsed.data });
        const tokenHash = data?.properties?.hashed_token;
        // Hesap yoksa (veya Auth hatası) e-posta gönderilmez; yanıt zaten aynıdır
        if (linkError || !tokenHash) return;
        const link = `${origin}/admin/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=${encodeURIComponent(next)}`;
        const sent = await sendPasswordResetEmail(parsed.data, { link, platform: platformReset, idempotencyKey: `password-reset/${createHash('sha256').update(tokenHash).digest('hex').slice(0, 32)}` });
        // Ayrıntı yalnızca güvenli tanımlayıcılarla loglanır (bağlantı / token / e-posta yok)
        if (!sent.ok && !sent.skipped) console.error('[password-reset] email failed', { provider: sent.provider, error: sent.error, attempts: sent.attempts });
      });
      return { message: RESET_SENT_MESSAGE };
    }
    // Fonksiyon yoksa (20261010000001 henüz uygulanmamış) Supabase Auth yoluna düşülür
    console.warn('[password-reset] rate check unavailable', error.code);
  }

  const supabase = await createSessionClient();
  // Dönüş adresi aynı callback'tir → Supabase'teki izinli adres listesinde tanımlı olmalıdır.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/admin/auth/callback?next=${next}`,
  });
  if (error?.status === 429) return { error: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.', email };
  await logSecurityEvent({ orgId: null, action: 'auth.password_reset_requested', metadata: { email: maskEmail(parsed.data) }, ipHash });
  return { message: RESET_SENT_MESSAGE };
}

/** Oturum açıkken (veya sıfırlama bağlantısıyla gelince) yeni şifre belirler */
export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const session = await getSessionUser();
  if (!session) return { error: 'Oturumunuzun süresi dolmuş. Lütfen şifre yenileme bağlantısını tekrar isteyin.' };
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (password !== confirm) return { error: 'Şifreler birbiriyle eşleşmiyor.' };

  const { error } = await session.supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { error: authPasswordErrorMessage(error.message) };
  }
  await session.supabase.rpc('clear_password_change_required');
  await logSecurityEvent({ orgId: null, action: 'auth.password_changed', actorId: session.user.id });
  revalidatePath('/admin', 'layout');
  return { message: 'Şifreniz güncellendi.' };
}

export async function updateProfileName(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const session = await getSessionUser();
  if (!session) return { error: 'Oturumunuzun süresi dolmuş.' };
  const name = String(formData.get('fullName') ?? '').trim();
  if (name.length < 2 || name.length > 100) return { error: 'Ad soyad 2–100 karakter olmalıdır.' };
  const { error } = await session.supabase.from('profiles').update({ full_name: name.replace(/[<>]/g, '') }).eq('id', session.user.id);
  if (error) return { error: 'Bilgiler kaydedilemedi. Lütfen tekrar deneyin.' };
  revalidatePath('/admin', 'layout');
  return { message: 'Bilgileriniz kaydedildi.' };
}
