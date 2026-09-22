import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { PropertyForm } from '@/components/admin/property-form';
import { requireAdminPage } from '@/lib/auth';
import { getTaxonomy } from '@/lib/data/taxonomy';

export const metadata: Metadata = { title: 'Yeni İlan' };

export default async function NewPropertyPage() {
  await requireAdminPage();
  const tax = await getTaxonomy();
  return (
    <>
      <AdminPageHeader
        title="Yeni İlan Ekle"
        description="Zorunlu alanlar * ile işaretlidir. Diğer bilgileri daha sonra da ekleyebilirsiniz."
      />
      <PropertyForm options={tax} />
    </>
  );
}
