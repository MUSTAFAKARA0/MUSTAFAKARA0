import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { filterNav } from '@/components/admin/nav-config';
import { brandingUrl } from '@/modules/media/variants';
import { siteIconSvg } from '@/modules/seo/site-icon';
import { ROLE_LABELS } from '@/platform/auth/permissions';
import { buildTheme, themeCss } from '@/platform/branding/theme';
import { getOrgBrand, requirePageContext } from '@/platform/auth/session';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

/** Panel simgesi = aktif ofisin simgesi (yüklenmişse), yoksa ofis adından üretilen otomatik simge */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getOrgBrand();
  if (!brand) return {};
  const icon =
    brandingUrl(brand.faviconUrl) ??
    `data:image/svg+xml,${encodeURIComponent(siteIconSvg({ display_name: brand.displayName ?? '', primary_color: brand.primaryColor ?? '', accent_color: brand.accentColor ?? '' }))}`;
  return { icons: { icon } };
}

export default async function PanelLayout({ children }: LayoutProps<'/admin'>) {
  const ctx = await requirePageContext();
  // Marka (tema/logo) oturum bağlamıyla aynı çağrıda gelir (ek sorgu yok); rozet sayımı paralel
  const [tenant, newLeads, brand] = await Promise.all([
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
    getOrgBrand(),
  ]);
  const nav = filterNav(ctx.can, ctx.plan.features);
  // Aktif organizasyonun sitesi: bulunulan alan adı aynı ofisse göreli kök, değilse yok
  const siteUrl = tenant?.id === ctx.org.id ? '/' : null;
  const scope = `[data-org-theme="${ctx.org.id}"],body:has([data-org-theme="${ctx.org.id}"])`;
  return (
    <div data-org-theme={ctx.org.id} className="contents">
      <style href={`org-theme-${ctx.org.id}`} precedence="high">
        {themeCss(buildTheme(brand?.primaryColor, brand?.accentColor), scope)}
      </style>
      <AdminShell
        nav={nav}
        org={{
          id: ctx.org.id,
          name: ctx.org.name,
          logoUrl: brandingUrl(brand?.logoUrl),
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
