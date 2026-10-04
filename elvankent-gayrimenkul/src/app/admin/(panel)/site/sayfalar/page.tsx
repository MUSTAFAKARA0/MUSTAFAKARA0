import type { Metadata } from 'next';
import { PagesForm } from '@/components/site-editor/structure-forms';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Sayfalar · Site yönetimi' };

export default async function Page() {
  const { site } = await getOfficeSite();
  return <PagesForm initial={site.draft.pages} />;
}
