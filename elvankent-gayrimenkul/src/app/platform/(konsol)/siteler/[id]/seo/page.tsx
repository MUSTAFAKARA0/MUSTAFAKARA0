import type { Metadata } from 'next';
import { SeoForm } from '@/components/site-editor/structure-forms';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'SEO · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/seo'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return (
    <SeoForm
      initial={site.draft.seo}
      fallback={{ title: site.brand.display_name, description: site.brand.description ?? '' }}
    />
  );
}
