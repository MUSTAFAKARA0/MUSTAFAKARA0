import type { Metadata } from 'next';
import { CollectionForm } from '@/components/admin/crm/collection-form';
import { AdminPageHeader } from '@/components/panel/ui';
import { getPickerOptions } from '@/modules/crm/admin-queries';
import { requireFeature, requirePagePermission } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Yeni seçki' };

export default async function NewCollectionPage() {
  const ctx = await requirePagePermission('collections.manage');
  requireFeature(ctx, 'crm');
  const [picker, tenant] = await Promise.all([getPickerOptions(ctx, { onlyPublic: true }), getTenant(ctx.org.slug)]);
  return (
    <>
      <AdminPageHeader title="Yeni seçki" back={{ href: '/admin/koleksiyonlar', label: 'Koleksiyonlar' }} description="Yalnızca yayındaki (veya satılmış/kiralanmış) ilanlar eklenebilir." />
      <CollectionForm customers={picker.customers} properties={picker.properties} siteBase={tenant?.baseUrl ?? ''} />
    </>
  );
}
