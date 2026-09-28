import type { Metadata } from 'next';
import { PagesForm } from '@/components/platform/site/structure-forms';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Sayfalar · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/sayfalar'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return <PagesForm orgId={site.org.id} initial={site.draft.pages} />;
}
