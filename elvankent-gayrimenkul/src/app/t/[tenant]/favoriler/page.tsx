import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { FavoritesView } from '@/components/property/favorites-view';
import { requireTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = {
  title: 'Favorilerim',
  description: 'Favorilerinize eklediğiniz ilanlar.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/favoriler' },
};

export default async function FavoritesPage({ params }: PageProps<'/t/[tenant]/favoriler'>) {
  const tenant = await requireTenant((await params).tenant);
  return (
    <>
      <PageHeader
        tenant={tenant}
        title="Favorilerim"
        description="Beğendiğiniz ilanlar bu cihazda saklanır; üyelik gerekmez."
        crumbs={[{ name: 'Favorilerim', path: '/favoriler' }]}
      />
      <div className="container-page py-10 sm:py-14">
        <FavoritesView />
      </div>
    </>
  );
}
