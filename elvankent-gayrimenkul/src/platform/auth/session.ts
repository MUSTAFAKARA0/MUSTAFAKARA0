import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/server-env';
import { createSessionClient, type DB } from '@/lib/supabase/server';
import { getTenantFromRequest } from '@/platform/tenant/tenant';
import { ForbiddenError, UnauthenticatedError } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import { PERMISSIONS, type OrgRole, type Permission } from '@/platform/auth/permissions';
import type { Enums } from '@/types/supabase';

export const ACTIVE_ORG_COOKIE = 'eg_active_org';

/**
 * Oturum alanı: KARAY platformu ile emlak ofisi paneli AYRI oturumlardır.
 *   'platform' → yalnızca /platform/giris ile açılan oturum; /platform açılır, /admin açılmaz
 *   'office'   → /admin/giris ile (veya şifre sıfırlama bağlantısıyla) açılan oturum; /platform açılmaz
 * Aynı kişi hem süper admin hem bir ofisin üyesi olsa bile iki alan arasında geçiş için
 * diğer girişten yeniden şifre girmesi gerekir. Çerez yalnızca alanı seçer; yetkinin kaynağı
 * her zaman veritabanıdır (is_super_admin, üyelikler, RLS) — çerezi değiştirmek yetki vermez.
 */
export const SESSION_SCOPE_COOKIE = 'eg_scope';
export type SessionScope = 'platform' | 'office';

/** Oturum kimliği (Supabase erişim belirtecindeki session_id; belirteç yenilense de aynı kalır) */
export function sessionIdFromAccessToken(token: string | null | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from((token ?? '').split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: unknown };
    return typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch {
    return null;
  }
}

/**
 * İmzalı alan değeri: kullanıcıya VE o girişte açılan oturuma bağlıdır. Elle yazılan,
 * başka bir girişten kalan veya başka kullanıcıya ait değer geçersizdir (→ ofis alanı).
 * İmza anahtarı yalnızca sunucudadır; yoksa platform alanı açılmaz (güvenli varsayılan).
 */
export function sessionScopeValue(scope: SessionScope, userId: string, sessionId: string | null): string | null {
  const key = serverEnv.supabaseServiceRoleKey || serverEnv.ipHashSalt;
  if (!key || !sessionId) return null;
  const signature = createHmac('sha256', key).update(`eg-scope|${scope}|${userId}|${sessionId}`).digest('base64url');
  return `${scope}.${signature}`;
}

export interface Membership {
  orgId: string;
  slug: string;
  name: string;
  status: Enums<'org_status'>;
  role: OrgRole;
  /** Ofis, sahip ve yöneticiler için iki adımlı doğrulamayı zorunlu kılmış mı */
  requireAdminMfa: boolean;
}

/** İki adımlı doğrulama (TOTP) durumu */
export interface MfaState {
  /** Oturumun doğrulama seviyesi: aal2 = kod girilmiş */
  aal: 'aal1' | 'aal2';
  /** Kurulumu tamamlanmış TOTP faktörü */
  factorId: string | null;
}

export interface PlanInfo {
  id: string | null;
  status: Enums<'subscription_status'> | null;
  limits: { users: number | null; properties: number | null; storageMb: number | null };
  features: { crm: boolean; analytics: boolean; pdf: boolean; customDomain: boolean };
}

export interface SessionUser {
  supabase: DB;
  user: User;
  profile: { fullName: string | null; isSuperAdmin: boolean; passwordChangeRequired: boolean };
  mfa: MfaState;
}

export interface OrgContext extends SessionUser {
  org: { id: string; slug: string; name: string; referencePrefix: string };
  role: OrgRole;
  permissions: ReadonlySet<Permission>;
  memberships: Membership[];
  plan: PlanInfo;
  can: (permission: Permission) => boolean;
}

/** Oturumdaki kullanıcıyı Auth sunucusunda doğrular (JWT imzası + oturum). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const [{ data: profile }, { data: aal }] = await Promise.all([
    supabase.from('profiles').select('full_name, is_super_admin, password_change_required').eq('id', data.user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const factor = (data.user.factors ?? []).find((f) => f.factor_type === 'totp' && f.status === 'verified');
  return {
    supabase,
    user: data.user,
    profile: {
      fullName: profile?.full_name ?? null,
      isSuperAdmin: profile?.is_super_admin ?? false,
      passwordChangeRequired: profile?.password_change_required ?? false,
    },
    mfa: { aal: aal?.currentLevel === 'aal2' ? 'aal2' : 'aal1', factorId: factor?.id ?? null },
  };
});

/** Oturumun alanı (çerez başka bir kullanıcıya aitse veya yoksa: ofis) */
export const getSessionScope = cache(async (): Promise<SessionScope> => {
  const session = await getSessionUser();
  if (!session) return 'office';
  const value = (await cookies()).get(SESSION_SCOPE_COOKIE)?.value;
  if (!value?.startsWith('platform.')) return 'office';
  // getUser() belirteci Auth sunucusunda doğruladı; oturum kimliği aynı belirteçten okunur
  const { data } = await session.supabase.auth.getSession();
  const expected = sessionScopeValue('platform', session.user.id, sessionIdFromAccessToken(data.session?.access_token));
  if (!expected || expected.length !== value.length) return 'office';
  return timingSafeEqual(Buffer.from(expected), Buffer.from(value)) ? 'platform' : 'office';
});

/** Kullanıcının üyelikleri (RLS: yalnızca kendi satırları + ekip) */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const session = await getSessionUser();
  if (!session) return [];
  const { data } = await session.supabase
    .from('organization_members')
    .select('role, status, organization:organizations(id, slug, name, status, require_admin_mfa)')
    .eq('user_id', session.user.id)
    .eq('status', 'active');
  return (data ?? [])
    .map((m) => {
      const org = Array.isArray(m.organization) ? m.organization[0] : m.organization;
      return org
        ? { orgId: org.id, slug: org.slug, name: org.name, status: org.status, role: m.role, requireAdminMfa: org.require_admin_mfa }
        : null;
    })
    .filter((m): m is Membership => m !== null);
});

/**
 * İki adımlı doğrulama gereksinimi:
 *   'challenge' → kullanıcının kurulu faktörü var, bu oturumda kod girilmedi
 *   'enroll'    → ofis politikası (sahip/yönetici) veya platform politikası
 *                 (süper admin) gereği kurulum yapılmalı
 * Veritabanı (RLS) aynı kuralları ayrıca uygular; bu kontrol kullanıcıyı doğru
 * sayfaya yönlendirmek içindir.
 */
export type MfaRequirement = 'challenge' | 'enroll' | null;

export const getMfaRequirement = cache(async (): Promise<MfaRequirement> => {
  const session = await getSessionUser();
  if (!session) return null;
  if (session.mfa.factorId) return session.mfa.aal === 'aal2' ? null : 'challenge';
  const memberships = await getMemberships();
  const orgRequires = memberships.some((m) => m.requireAdminMfa && (m.role === 'owner' || m.role === 'admin'));
  const platformRequires = session.profile.isSuperAdmin && process.env.PLATFORM_ADMIN_MFA_REQUIRED === 'true';
  return orgRequires || platformRequires ? 'enroll' : null;
});

/** Doğrulama sayfasının adresi (geri dönüş adresiyle) */
export function mfaUrl(next?: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? `/admin/dogrulama?next=${encodeURIComponent(next)}` : '/admin/dogrulama';
}

/**
 * Aktif organizasyon bağlamı. Organizasyon, istemciden gelen bir değere göre
 * DEĞİL; kullanıcının veritabanındaki gerçek üyeliklerine göre seçilir.
 * Tercih sırası: seçili organizasyon çerezi → bulunulan alan adının kiracısı →
 * ilk aktif üyelik. Çerez yalnızca bir tercihtir; üyelik yoksa yok sayılır.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const session = await getSessionUser();
  if (!session) return null;
  // Platform (KARAY) oturumu ofis paneline erişemez: ofis girişi ayrıca yapılmalıdır
  if ((await getSessionScope()) === 'platform') return null;
  // İki adımlı doğrulama tamamlanmadan organizasyon bağlamı verilmez
  if (await getMfaRequirement()) return null;
  const memberships = await getMemberships();
  const active = memberships.filter((m) => m.status === 'active');
  if (active.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  let chosen = active.find((m) => m.orgId === preferred);
  if (!chosen) {
    const tenant = await getTenantFromRequest().catch(() => null);
    chosen = active.find((m) => m.orgId === tenant?.id) ?? active[0];
  }

  const [{ data: org }, { data: perms }, { data: plan }] = await Promise.all([
    session.supabase.from('organizations').select('id, slug, name, reference_prefix').eq('id', chosen.orgId).single(),
    session.supabase.from('role_permissions').select('permission').eq('role', chosen.role),
    session.supabase.rpc('org_plan', { p_org: chosen.orgId }),
  ]);
  if (!org) return null;

  const known = new Set<string>(PERMISSIONS);
  const permissions = new Set((perms ?? []).map((p) => p.permission).filter((p): p is Permission => known.has(p)));
  const p = plan?.[0];

  return {
    ...session,
    org: { id: org.id, slug: org.slug, name: org.name, referencePrefix: org.reference_prefix },
    role: chosen.role,
    permissions,
    memberships,
    plan: {
      id: p?.plan_id ?? null,
      status: p?.subscription_status ?? null,
      limits: { users: p?.max_users ?? null, properties: p?.max_properties ?? null, storageMb: p?.max_storage_mb ?? null },
      features: {
        crm: p?.crm_enabled ?? false,
        analytics: p?.analytics_enabled ?? false,
        pdf: p?.pdf_enabled ?? false,
        customDomain: p?.custom_domain_enabled ?? false,
      },
    },
    can: (permission) => permissions.has(permission),
  };
});

/** Server action / route handler: oturum + organizasyon zorunlu. */
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) {
    if (!(await getSessionUser())) throw new UnauthenticatedError();
    if ((await getSessionScope()) === 'platform') throw new ForbiddenError('Ofis paneli için ofis giriş sayfasından oturum açın.');
    if (await getMfaRequirement()) throw new ForbiddenError('Bu işlem için iki adımlı doğrulama gerekiyor. Sayfayı yenileyip doğrulama kodunu girin.');
    throw new ForbiddenError('Aktif bir organizasyon üyeliğiniz bulunmuyor.');
  }
  return ctx;
}

/**
 * Server action / route handler: yetki zorunlu. Yetkisiz deneme güvenlik
 * kaydına yazılır. (Buton gizlemek güvenlik değildir; RLS ayrıca korur.)
 */
export async function requirePermission(permission: Permission): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (!ctx.can(permission)) {
    await logSecurityEvent({
      orgId: ctx.org.id,
      action: 'auth.forbidden',
      actorId: ctx.user.id,
      metadata: { permission, role: ctx.role },
    });
    throw new ForbiddenError();
  }
  return ctx;
}

export type PlanFeature = keyof PlanInfo['features'];

const FEATURE_NAMES: Record<PlanFeature, string> = {
  crm: 'CRM (müşteri ve talep yönetimi)',
  analytics: 'Analitik',
  pdf: 'PDF broşür',
  customDomain: 'Özel alan adı',
};

export function requireFeature(ctx: OrgContext, feature: PlanFeature): void {
  if (!ctx.plan.features[feature]) {
    throw new ForbiddenError(`${FEATURE_NAMES[feature]} özelliği planınızda bulunmuyor.`);
  }
}

/** Sayfalar için: oturum yoksa girişe, organizasyon yoksa erişim sayfasına yönlendirir. */
export async function requirePageContext(next?: string): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (ctx) return ctx;
  if (!(await getSessionUser())) redirect(next ? `/admin/giris?next=${encodeURIComponent(next)}` : '/admin/giris');
  if ((await getSessionScope()) === 'platform') redirect('/admin/giris?alan=platform');
  if (await getMfaRequirement()) redirect(mfaUrl(next));
  redirect('/admin/erisim-yok');
}

/** Sayfalar için yetki: yoksa yetkisiz sayfasına yönlendirir. */
export async function requirePagePermission(permission: Permission): Promise<OrgContext> {
  const ctx = await requirePageContext();
  if (!ctx.can(permission)) redirect(`/admin/yetkisiz?izin=${encodeURIComponent(permission)}`);
  return ctx;
}

/** Süper admin (platform). Veritabanı fonksiyonları ayrıca is_super_admin() doğrular. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) throw new UnauthenticatedError();
  if (session.profile.isSuperAdmin && (await getSessionScope()) !== 'platform') {
    throw new ForbiddenError('Platform işlemleri için platform girişinden oturum açın.');
  }
  if (session.profile.isSuperAdmin && (await getMfaRequirement())) throw new ForbiddenError('Bu işlem için iki adımlı doğrulama gerekiyor.');
  if (!session.profile.isSuperAdmin) {
    await logSecurityEvent({ orgId: null, action: 'auth.forbidden', actorId: session.user.id, metadata: { area: 'platform' } });
    throw new ForbiddenError();
  }
  return session;
}

export async function requireSuperAdminPage(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect('/platform/giris');
  if (!session.profile.isSuperAdmin) {
    // Kiracı (emlak ofisi) kullanıcısı için platform alanı YOKTUR: 404 (varlığı da gösterilmez).
    // Adresi elle yazma denemesi güvenlik kaydına işlenir.
    await logSecurityEvent({ orgId: null, action: 'auth.forbidden', actorId: session.user.id, metadata: { area: 'platform' } });
    notFound();
  }
  // Ofis panelinden açılmış oturumla platforma geçilemez: platform girişi (şifre) gerekir
  if ((await getSessionScope()) !== 'platform') redirect('/platform/giris');
  if (await getMfaRequirement()) redirect(mfaUrl('/platform'));
  return session;
}
