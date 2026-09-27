import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegionEditor } from '@/components/admin/content/region-editor';
import { AdminPageHeader } from '@/components/admin/ui';
import { getAdminRegion } from '@/modules/content/admin-queries';
import { getTaxonomy } from '@/modules/properties/taxonomy';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Bölge sayfasını düzenle' };

export default async function EditRegionPage({ params }: PageProps<'/admin/bolgeler/[id]'>) {
  const ctx = await requirePagePermission('content.manage');
  const { id } = await params;
  const [region, taxonomy, tenant] = await Promise.all([getAdminRegion(ctx, id), getTaxonomy(), getTenant(ctx.org.slug)]);
  if (!region) notFound();
  return (
    <>
      <AdminPageHeader title={region.name} description="Bölge sayfasını düzenleyin." back={{ href: '/admin/bolgeler', label: 'Bölge sayfaları' }} />
      <RegionEditor
        initial={region}
        locations={{
          cities: taxonomy.cities.map((c) => ({ id: c.id, name: c.name })),
          districts: taxonomy.districts.map((d) => ({ id: d.id, city_id: d.city_id, name: d.name })),
          neighborhoods: taxonomy.neighborhoods.map((n) => ({ id: n.id, district_id: n.district_id, name: n.name })),
        }}
        siteBase={tenant?.baseUrl ?? ''}
        siteHost={tenant ? new URL(tenant.baseUrl).host : 'site'}
      />
    </>
  );
}
