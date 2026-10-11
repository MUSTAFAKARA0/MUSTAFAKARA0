import type { Metadata } from 'next';
import { brandingUrl } from '@/modules/media/variants';
import { HeaderForm } from '@/components/site-editor/structure-forms';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Header · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/header'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  return (
    <HeaderForm
      initial={site.draft.header}
      preview={{
        draft: site.draft,
        brand: { primary_color: site.brand.primary_color, accent_color: site.brand.accent_color, logoUrl: brandingUrl(site.brand.logo_url), tagline: site.brand.tagline },
        darkAllowed: site.overrides.dark_mode === true,
        name: site.brand.display_name,
      }}
    />
  );
}
