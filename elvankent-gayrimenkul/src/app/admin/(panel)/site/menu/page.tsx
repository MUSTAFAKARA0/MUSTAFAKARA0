import type { Metadata } from 'next';
import { NavigationForm } from '@/components/site-editor/structure-forms';
import { defaultNavigation } from '@/site-config/defaults';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Menü · Site yönetimi' };

export default async function Page() {
  const { site } = await getOfficeSite();
  return <NavigationForm initial={site.draft.navigation} defaults={defaultNavigation()} />;
}
