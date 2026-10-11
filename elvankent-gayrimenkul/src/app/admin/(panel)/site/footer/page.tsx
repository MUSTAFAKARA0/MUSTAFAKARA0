import type { Metadata } from 'next';
import { FooterForm } from '@/components/site-editor/structure-forms';
import { defaultFooterColumns } from '@/site-config/defaults';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Footer · Site yönetimi' };

export default async function Page() {
  const { site } = await getOfficeSite();
  return <FooterForm initial={site.draft.footer} defaults={defaultFooterColumns()} />;
}
