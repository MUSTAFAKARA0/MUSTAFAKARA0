import type { Metadata } from 'next';
import { SeoForm } from '@/components/site-editor/structure-forms';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'SEO · Site yönetimi' };

/** Sitenin genel SEO ayarları (taslak). Yönlendirmeler ve sayfa bazlı SEO kayıtları /admin/seo'dadır. */
export default async function Page() {
  const { site } = await getOfficeSite();
  return (
    <SeoForm
      initial={site.draft.seo}
      fallback={{ title: site.brand.seo_title ?? site.brand.display_name, description: site.brand.seo_description ?? site.brand.description ?? '' }}
    />
  );
}
