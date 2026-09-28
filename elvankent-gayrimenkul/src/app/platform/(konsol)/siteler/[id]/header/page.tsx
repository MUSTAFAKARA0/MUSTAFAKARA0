import type { Metadata } from 'next';
import { HeaderForm } from '@/components/platform/site/structure-forms';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Header · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/header'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return <HeaderForm orgId={site.org.id} initial={site.draft.header} />;
}
