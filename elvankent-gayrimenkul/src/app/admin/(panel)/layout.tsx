import { AdminShell } from '@/components/admin/admin-shell';
import { filterNav } from '@/components/admin/nav-config';
import { brandingUrl } from '@/modules/media/variants';
import { ROLE_LABELS } from '@/platform/auth/permissions';
import { requirePageContext } from '@/platform/auth/session';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

export default async function PanelLayout({ children }: LayoutProps<'/admin'>) {
  const ctx = await requirePageContext();
  const [tenant, newLeads] = await Promise.all([
    getTenantFromRequest().catch(() => null),
    // Menüde "yeni talep" rozeti: ofisin henüz ilgilenmediği talepler
    ctx.can('leads.read')
      ? ctx.supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', ctx.org.id)
          .eq('status', 'new')
          .is('deleted_at', null)
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ]);
  const nav = filterNav(ctx.can, ctx.plan.features, ctx.profile.isSuperAdmin);
  // Aktif organizasyonun sitesi: bulunulan alan adı aynı ofisse göreli kök, değilse yok
  const siteUrl = tenant?.id === ctx.org.id ? '/' : null;
  // Aktif ofisin logosu (bulunulan alan adı aynı ofisse önbellekteki ayarlardan, değilse tek sorgu)
  const logoPath =
    tenant?.id === ctx.org.id
      ? tenant.settings.logo_url
      : ((await ctx.supabase.from('organization_settings').select('logo_url').eq('organization_id', ctx.org.id).maybeSingle()).data?.logo_url ?? null);
  return (
    <AdminShell
      nav={nav}
      org={{ id: ctx.org.id, name: ctx.org.name, logoUrl: brandingUrl(logoPath) }}
      orgs={ctx.memberships.map((m) => ({ id: m.orgId, name: m.name, roleLabel: ROLE_LABELS[m.role] }))}
      user={{ name: ctx.profile.fullName || ctx.user.email || 'Kullanıcı', email: ctx.user.email ?? '', roleLabel: ROLE_LABELS[ctx.role] }}
      siteUrl={siteUrl}
      canCreateListing={ctx.can('properties.create')}
      passwordChangeRequired={ctx.profile.passwordChangeRequired}
      badges={{ '/admin/talepler': newLeads }}
    >
      {children}
    </AdminShell>
  );
}
