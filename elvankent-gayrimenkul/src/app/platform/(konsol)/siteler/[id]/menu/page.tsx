import type { Metadata } from 'next';
import { NavigationForm } from '@/components/platform/site/structure-forms';
import { defaultNavigation } from '@/site-config/defaults';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Menü · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/menu'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return <NavigationForm orgId={site.org.id} initial={site.draft.navigation} defaults={defaultNavigation()} />;
}
