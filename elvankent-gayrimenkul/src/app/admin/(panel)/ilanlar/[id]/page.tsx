import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { parseEditorStep } from '@/components/admin/editor/editor-steps';
import { PropertyEditor } from '@/components/admin/editor/property-editor';
import { firstParam } from '@/lib/utils';
import { publicMapConfig } from '@/modules/maps/providers';
import { getEditorData } from '@/modules/properties/admin-queries';
import { getTaxonomy } from '@/modules/properties/taxonomy';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'İlan düzenle' };

// Büyük fotoğrafların işlenmesi (varyant üretimi) için sunucu işlem süresi
export const maxDuration = 60;

export default async function EditListingPage({ params, searchParams }: PageProps<'/admin/ilanlar/[id]'>) {
  const ctx = await requirePagePermission('properties.read');
  const { id } = await params;
  const [data, taxonomy, tenant] = await Promise.all([getEditorData(ctx, id), getTaxonomy(), getTenantFromRequest().catch(() => null)]);
  if (!data) notFound();
  const step = parseEditorStep(firstParam((await searchParams).adim));
  return (
    <PropertyEditor
      data={data}
      initialStep={step}
      siteHost={tenant ? new URL(tenant.baseUrl).host : 'site'}
      map={publicMapConfig()}
      perms={{
        update: ctx.can('properties.update'),
        publish: ctx.can('properties.publish'),
        media: ctx.can('media.manage'),
        delete: ctx.can('properties.delete'),
        pdf: ctx.plan.features.pdf,
      }}
      taxonomy={{
        cities: taxonomy.cities.map((c) => ({ id: c.id, name: c.name, latitude: c.latitude, longitude: c.longitude })),
        districts: taxonomy.districts.map((d) => ({ id: d.id, city_id: d.city_id, name: d.name, latitude: d.latitude, longitude: d.longitude })),
        // Yalnızca ilanın ilçesindeki mahalleler; diğer ilçeler seçilince istenir
        neighborhoods: taxonomy.neighborhoods
          .filter((n) => n.district_id === data.property.district_id)
          .map((n) => ({ id: n.id, district_id: n.district_id, name: n.name, latitude: n.latitude, longitude: n.longitude })),
        propertyTypes: taxonomy.propertyTypes.map((t) => ({ id: t.id, category: t.category, name: t.name })),
        features: taxonomy.features.map((f) => ({ id: f.id, label: f.label, feature_group: f.feature_group })),
      }}
    />
  );
}
