import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CollectionForm } from '@/components/admin/crm/collection-form';
import { CopyLinkButton } from '@/components/admin/crm/copy-link-button';
import { AdminPageHeader } from '@/components/panel/ui';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { getCollection, getPickerOptions } from '@/modules/crm/admin-queries';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant, tenantUrl } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Seçki' };

export default async function CollectionDetailPage({ params }: PageProps<'/admin/koleksiyonlar/[id]'>) {
  const ctx = await requirePagePermission('collections.manage');
  const { id } = await params;
  const [collection, picker, tenant] = await Promise.all([getCollection(ctx, id), getPickerOptions(ctx, { onlyPublic: true }), getTenant(ctx.org.slug)]);
  if (!collection) notFound();
  const url = tenant ? tenantUrl(tenant, `/koleksiyon/${collection.token}`) : `/koleksiyon/${collection.token}`;
  return (
    <>
      <AdminPageHeader
        title={collection.title}
        back={{ href: '/admin/koleksiyonlar', label: 'Koleksiyonlar' }}
        description={`${collection.view_count} açılma · oluşturma ${formatDate(collection.created_at)}${collection.expires_at ? ` · bitiş ${formatDate(collection.expires_at)}` : ''}${collection.revoked_at ? ` · iptal ${formatRelativeDate(collection.revoked_at)}` : ''}`}
        actions={!collection.revoked_at && <CopyLinkButton url={url} />}
      />
      <CollectionForm
        initial={{ id: collection.id, title: collection.title, message: collection.message, customer_id: collection.customer_id, items: collection.items }}
        customers={picker.customers}
        properties={picker.properties}
        siteBase={tenant?.baseUrl ?? ''}
      />
    </>
  );
}
