import type { Metadata } from 'next';
import { PostEditor } from '@/components/admin/content/post-editor';
import { AdminPageHeader } from '@/components/admin/ui';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Yeni yazı' };

// Kapak görselinin işlenmesi (varyant üretimi) için sunucu işlem süresi
export const maxDuration = 60;

export default async function NewPostPage() {
  const ctx = await requirePagePermission('content.manage');
  const tenant = await getTenant(ctx.org.slug);
  return (
    <>
      <AdminPageHeader title="Yeni yazı" back={{ href: '/admin/icerikler', label: 'Blog ve içerikler' }} />
      <PostEditor initial={null} siteBase={tenant?.baseUrl ?? ''} siteHost={tenant ? new URL(tenant.baseUrl).host : 'site'} canUpload={ctx.can('media.manage')} />
    </>
  );
}
