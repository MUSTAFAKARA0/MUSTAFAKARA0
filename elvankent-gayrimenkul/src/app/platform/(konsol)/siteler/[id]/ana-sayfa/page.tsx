import type { Metadata } from 'next';
import { HomeForm } from '@/components/site-editor/structure-forms';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Ana Sayfa · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/ana-sayfa'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return <HomeForm initial={site.draft.home?.sections ?? null} />;
}
