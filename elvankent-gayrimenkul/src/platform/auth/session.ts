import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createSessionClient, type DB } from '@/lib/supabase/server';
import { getTenantFromRequest } from '@/platform/tenant/tenant';
import { ForbiddenError, UnauthenticatedError } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import { PERMISSIONS, type OrgRole, type Permission } from '@/platform/auth/permissions';
import type { Enums } from '@/types/supabase';

export const ACTIVE_ORG_COOKIE = 'eg_active_org';

export interface Membership {
  orgId: string;
  slug: string;
  name: string;
  status: Enums<'org_status'>;
  role: OrgRole;
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_super_admin, password_change_required')
    .eq('id', data.user.id)
    .maybeSingle();
  return {
    supabase,
    user: data.user,
    profile: {
      fullName: profile?.full_name ?? null,
      isSuperAdmin: profile?.is_super_admin ?? false,
      passwordChangeRequired: profile?.password_change_required ?? false,
    },
  };
});

/** Kullanıcının üyelikleri (RLS: yalnızca kendi satırları + ekip) */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const session = await getSessionUser();
  if (!session) return [];
  const { data } = await session.supabase
    .from('organization_members')
    .select('role, status, organization:organizations(id, slug, name, status)')
    .eq('user_id', session.user.id)
    .eq('status', 'active');
  return (data ?? [])
    .map((m) => {
      const org = Array.isArray(m.organization) ? m.organization[0] : m.organization;
      return org ? { orgId: org.id, slug: org.slug, name: org.name, status: org.status, role: m.role } : null;
    })
    .filter((m): m is Membership => m !== null);
});

/**
 * Aktif organizasyon bağlamı. Organizasyon, istemciden gelen bir değere göre
 * DEĞİL; kullanıcının veritabanındaki gerçek üyeliklerine göre seçilir.
 * Tercih sırası: seçili organizasyon çerezi → bulunulan alan adının kiracısı →
 * ilk aktif üyelik. Çerez yalnızca bir tercihtir; üyelik yoksa yok sayılır.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const session = await getSessionUser();
  if (!session) return null;
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
  if (!session.profile.isSuperAdmin) {
    await logSecurityEvent({ orgId: null, action: 'auth.forbidden', actorId: session.user.id, metadata: { area: 'platform' } });
    throw new ForbiddenError();
  }
  return session;
}

export async function requireSuperAdminPage(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect('/admin/giris?next=/platform');
  if (!session.profile.isSuperAdmin) redirect('/admin/yetkisiz?izin=platform');
  return session;
}
