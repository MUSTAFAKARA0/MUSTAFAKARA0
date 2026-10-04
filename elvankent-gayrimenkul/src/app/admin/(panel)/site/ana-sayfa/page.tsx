import type { Metadata } from 'next';
import { HomeForm } from '@/components/site-editor/structure-forms';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Ana Sayfa · Site yönetimi' };

export default async function Page() {
  const { site } = await getOfficeSite();
  return <HomeForm initial={site.draft.home?.sections ?? null} />;
}
