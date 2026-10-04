import type { Metadata } from 'next';
import { HeaderForm } from '@/components/site-editor/structure-forms';
import { getOfficeSite, previewBrand } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Header · Site yönetimi' };

export default async function Page() {
  const { site } = await getOfficeSite();
  return (
    <HeaderForm
      initial={site.draft.header}
      preview={{ draft: site.draft, brand: previewBrand(site), darkAllowed: site.overrides.dark_mode === true, name: site.brand.display_name }}
    />
  );
}
