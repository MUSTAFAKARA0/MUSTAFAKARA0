import type { Metadata } from 'next';
import { BrandForm } from '@/components/site-editor/brand-form';
import { brandValues } from '@/site-editor/brand-values';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'İletişim · Site yönetimi' };

/** İletişim ve sosyal medya (marka taslağının iletişim alanları) */
export default async function Page() {
  const { site } = await getOfficeSite();
  return <BrandForm groups={['contact', 'social']} initial={brandValues(site.brand)} pendingFields={Object.keys(site.draft.brand)} />;
}
