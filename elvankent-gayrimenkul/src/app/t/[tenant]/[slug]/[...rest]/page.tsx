import { notFound } from 'next/navigation';
import { findRedirect } from '@/modules/properties/queries';
import { followRedirect } from '@/modules/seo/redirects';
import { requireSiteTenant } from '@/site-config/load';

/** Eski sitenin çok parçalı adresleri: yönlendirme tanımlıysa uygula, yoksa 404 */
export default async function LegacyPathPage({ params }: PageProps<'/t/[tenant]/[slug]/[...rest]'>) {
  const { tenant: key, slug, rest } = await params;
  const tenant = await requireSiteTenant(key);
  const target = await findRedirect(tenant.id, `/${[slug, ...rest].join('/')}`);
  if (target) followRedirect(target);
  notFound();
}
