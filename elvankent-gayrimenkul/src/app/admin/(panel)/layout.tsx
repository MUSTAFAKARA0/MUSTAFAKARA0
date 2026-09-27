import { AdminShell } from '@/components/admin/admin-shell';
import { filterNav } from '@/components/admin/nav-config';
import { ROLE_LABELS } from '@/platform/auth/permissions';
import { requirePageContext } from '@/platform/auth/session';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

export default async function PanelLayout({ children }: LayoutProps<'/admin'>) {
  const ctx = await requirePageContext();
  const tenant = await getTenantFromRequest().catch(() => null);
  const nav = filterNav(ctx.can, ctx.plan.features, ctx.profile.isSuperAdmin);
  // Aktif organizasyonun sitesi: bulunulan alan adı aynı ofisse göreli kök, değilse yok
  const siteUrl = tenant?.id === ctx.org.id ? '/' : null;
  return (
    <AdminShell
      nav={nav}
      org={{ id: ctx.org.id, name: ctx.org.name }}
      orgs={ctx.memberships.map((m) => ({ id: m.orgId, name: m.name, roleLabel: ROLE_LABELS[m.role] }))}
      user={{ name: ctx.profile.fullName || ctx.user.email || 'Kullanıcı', email: ctx.user.email ?? '', roleLabel: ROLE_LABELS[ctx.role] }}
      siteUrl={siteUrl}
      canCreateListing={ctx.can('properties.create')}
      passwordChangeRequired={ctx.profile.passwordChangeRequired}
    >
      {children}
    </AdminShell>
  );
}
