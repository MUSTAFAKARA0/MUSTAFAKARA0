import type { Metadata } from 'next';
import { PagesForm } from '@/components/site-editor/structure-forms';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Sayfalar · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/sayfalar'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return <PagesForm initial={site.draft.pages} />;
}
