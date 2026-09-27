import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PostEditor } from '@/components/admin/content/post-editor';
import { AdminPageHeader } from '@/components/admin/ui';
import { getAdminPost } from '@/modules/content/admin-queries';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Yazıyı düzenle' };

export const maxDuration = 60;

export default async function EditPostPage({ params }: PageProps<'/admin/icerikler/[id]'>) {
  const ctx = await requirePagePermission('content.manage');
  const { id } = await params;
  const [post, tenant] = await Promise.all([getAdminPost(ctx, id), getTenant(ctx.org.slug)]);
  if (!post) notFound();
  if (post.deletedAt) redirect('/admin/icerikler?durum=cop');
  return (
    <>
      <AdminPageHeader title="Yazıyı düzenle" back={{ href: '/admin/icerikler', label: 'Blog ve içerikler' }} />
      <PostEditor
        initial={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          body: post.body,
          status: post.status,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          cover: post.cover,
        }}
        siteBase={tenant?.baseUrl ?? ''}
        siteHost={tenant ? new URL(tenant.baseUrl).host : 'site'}
        canUpload={ctx.can('media.manage')}
      />
    </>
  );
}
