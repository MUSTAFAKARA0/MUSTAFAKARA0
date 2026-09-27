import type { Metadata } from 'next';
import { AdminPageHeader, Panel } from '@/components/admin/ui';
import { getTaxonomy } from '@/modules/properties/taxonomy';
import type { PropertyCategory } from '@/modules/properties/constants';
import { requirePagePermission } from '@/platform/auth/session';
import { NewListingForm } from './new-listing-form';

export const metadata: Metadata = { title: 'Yeni ilan' };

export default async function NewListingPage() {
  await requirePagePermission('properties.create');
  const taxonomy = await getTaxonomy();
  return (
    <>
      <AdminPageHeader
        title="Yeni ilan"
        description="Önce temel bilgileri girin; taslak oluşturulur ve sihirbaz sizi konum, özellikler, fotoğraflar ve yayın adımlarından geçirir. Tüm değişiklikler otomatik kaydedilir."
        back={{ href: '/admin/ilanlar', label: 'İlanlar' }}
      />
      <Panel className="max-w-2xl">
        <NewListingForm types={taxonomy.propertyTypes.map((t) => ({ id: t.id, name: t.name, category: t.category as PropertyCategory }))} />
      </Panel>
    </>
  );
}
