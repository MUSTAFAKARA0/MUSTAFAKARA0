import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { filterNav } from '@/components/admin/nav-config';
import { brandingUrl } from '@/modules/media/variants';
import { siteIconSvg } from '@/modules/seo/site-icon';
import { ROLE_LABELS } from '@/platform/auth/permissions';
import { buildTheme, themeCss } from '@/platform/branding/theme';
import { getOrgContext, requirePageContext } from '@/platform/auth/session';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

/** Panel simgesi = aktif ofisin simgesi (yüklenmişse), yoksa ofis adından üretilen otomatik simge */
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext();
  if (!ctx) return {};
  const { data } = await ctx.supabase
    .from('organization_settings')
    .select('display_name, primary_color, accent_color, favicon_url')
    .eq('organization_id', ctx.org.id)
    .maybeSingle();
  if (!data) return {};
  const icon = brandingUrl(data.favicon_url) ?? `data:image/svg+xml,${encodeURIComponent(siteIconSvg(data))}`;
  return { icons: { icon } };
}

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
  const nav = filterNav(ctx.can, ctx.plan.features);
  // Aktif organizasyonun sitesi: bulunulan alan adı aynı ofisse göreli kök, değilse yok
  const siteUrl = tenant?.id === ctx.org.id ? '/' : null;
  // Panelin markası = giriş yapan kullanıcının AKTİF ofisi (bulunulan alan adının ofisi değil).
  // Aynı ofisse önbellekteki ayarlar, değilse tek sorgu (RLS: yalnızca üyesi olduğu ofis).
  const brand =
    tenant?.id === ctx.org.id
      ? {
          logo_url: tenant.settings.logo_url,
          primary_color: tenant.settings.primary_color,
          accent_color: tenant.settings.accent_color,
        }
      : ((await ctx.supabase.from('organization_settings').select('logo_url, primary_color, accent_color').eq('organization_id', ctx.org.id).maybeSingle())
          .data ?? null);
  const scope = `[data-org-theme="${ctx.org.id}"],body:has([data-org-theme="${ctx.org.id}"])`;
  return (
    <div data-org-theme={ctx.org.id} className="contents">
      <style href={`org-theme-${ctx.org.id}`} precedence="high">
        {themeCss(buildTheme(brand?.primary_color, brand?.accent_color), scope)}
      </style>
      <AdminShell
        nav={nav}
        org={{
          id: ctx.org.id,
          name: ctx.org.name,
          logoUrl: brandingUrl(brand?.logo_url),
        }}
        orgs={ctx.memberships.map((m) => ({
          id: m.orgId,
          name: m.name,
          roleLabel: ROLE_LABELS[m.role],
        }))}
        user={{
          name: ctx.profile.fullName || ctx.user.email || 'Kullanıcı',
          email: ctx.user.email ?? '',
          roleLabel: ROLE_LABELS[ctx.role],
        }}
        siteUrl={siteUrl}
        canCreateListing={ctx.can('properties.create')}
        passwordChangeRequired={ctx.profile.passwordChangeRequired}
        badges={{ '/admin/talepler': newLeads }}
      >
        {children}
      </AdminShell>
    </div>
  );
}
