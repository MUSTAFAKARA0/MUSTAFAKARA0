import type { Metadata } from 'next';
import { FooterForm } from '@/components/platform/site/structure-forms';
import { defaultFooterColumns } from '@/platform/site/defaults';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Footer · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/footer'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return <FooterForm orgId={site.org.id} initial={site.draft.footer} defaults={defaultFooterColumns()} />;
}
