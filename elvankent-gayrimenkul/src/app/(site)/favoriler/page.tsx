import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { FavoritesView } from './favorites-view';

export const metadata: Metadata = {
  title: 'Favorilerim',
  description: 'Favorilerinize eklediğiniz ilanlar.',
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return (
    <>
      <PageHeader
        title="Favorilerim"
        path="/favoriler"
        description="Üyelik gerekmez: favorileriniz bu cihazdaki tarayıcınızda saklanır."
      />
      <div className="container-page py-10 sm:py-12">
        <FavoritesView />
      </div>
    </>
  );
}
