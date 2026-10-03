import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageEditor } from '@/components/admin/content/page-editor';
import { AdminPageHeader } from '@/components/panel/ui';
import { getAdminPage } from '@/modules/content/admin-queries';
import { PAGE_DEFINITIONS, type PageKey } from '@/modules/content/default-pages';
import { placeholderValues } from '@/modules/content/queries';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Sayfayı düzenle' };

export default async function EditContentPage({ params }: PageProps<'/admin/icerikler/sayfa/[key]'>) {
  const ctx = await requirePagePermission('content.manage');
  const { key } = await params;
  if (!(key in PAGE_DEFINITIONS)) notFound();
  const def = PAGE_DEFINITIONS[key as PageKey];
  const [page, tenant] = await Promise.all([getAdminPage(ctx, def.key), getTenant(ctx.org.slug)]);
  return (
    <>
      <AdminPageHeader title={def.title} description={def.description} back={{ href: '/admin/icerikler?sekme=sayfalar', label: 'Sayfalar' }} />
      <PageEditor
        pageKey={def.key}
        path={def.path}
        legal={def.legal}
        initial={page}
        previewValues={tenant ? placeholderValues(tenant) : {}}
        siteBase={tenant?.baseUrl ?? ''}
        siteHost={tenant ? new URL(tenant.baseUrl).host : 'site'}
      />
    </>
  );
}
