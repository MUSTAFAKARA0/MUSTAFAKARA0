import type { Metadata } from 'next';
import { ColorsForm } from '@/components/platform/site/appearance-forms';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Renkler · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/renkler'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return (
    <ColorsForm
      orgId={site.org.id}
      draft={site.draft}
      brand={{ primary_color: site.settings.primary_color, accent_color: site.settings.accent_color }}
      darkAllowed={site.overrides.dark_mode === true}
      name={site.settings.display_name}
    />
  );
}
