import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { CompareView } from '@/components/property/compare-view';
import { requireSiteTenant } from '@/site-config/load';

export const metadata: Metadata = {
  title: 'İlan karşılaştırma',
  description: 'Seçtiğiniz ilanları fiyat, alan, oda, kat, bina yaşı ve özelliklerine göre yan yana karşılaştırın.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/karsilastir' },
};

export default async function ComparePage({ params }: PageProps<'/t/[tenant]/karsilastir'>) {
  const tenant = await requireSiteTenant((await params).tenant);
  return (
    <>
      <PageHeader
        tenant={tenant}
        title="İlan karşılaştırma"
        description="En fazla 4 ilanı yan yana karşılaştırabilirsiniz. İlan kartlarındaki “Karşılaştır” ile ekleyin."
        crumbs={[{ name: 'Karşılaştır', path: '/karsilastir' }]}
      />
      <div className="container-page py-10 sm:py-14">
        <CompareView />
      </div>
    </>
  );
}
