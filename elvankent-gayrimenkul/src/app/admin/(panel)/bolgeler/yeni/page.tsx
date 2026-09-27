import type { Metadata } from 'next';
import { RegionEditor } from '@/components/admin/content/region-editor';
import { AdminPageHeader } from '@/components/admin/ui';
import { getTaxonomy } from '@/modules/properties/taxonomy';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Yeni bölge sayfası' };

export default async function NewRegionPage() {
  const ctx = await requirePagePermission('content.manage');
  const [taxonomy, tenant] = await Promise.all([getTaxonomy(), getTenant(ctx.org.slug)]);
  return (
    <>
      <AdminPageHeader title="Yeni bölge sayfası" back={{ href: '/admin/bolgeler', label: 'Bölge sayfaları' }} />
      <RegionEditor
        initial={null}
        locations={{
          cities: taxonomy.cities.map((c) => ({ id: c.id, name: c.name })),
          districts: taxonomy.districts.map((d) => ({ id: d.id, city_id: d.city_id, name: d.name })),
          neighborhoods: [],
        }}
        siteBase={tenant?.baseUrl ?? ''}
        siteHost={tenant ? new URL(tenant.baseUrl).host : 'site'}
      />
    </>
  );
}
