import type { Metadata } from 'next';
import { NotFoundView } from '@/components/common/error-view';
import { Logo } from '@/components/layout/logo';

export const metadata: Metadata = { title: 'Sayfa bulunamadı', robots: { index: false } };

export default function RootNotFound() {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center">
          <Logo businessName="Elvankent Gayrimenkul" />
        </div>
      </header>
      <main>
        <NotFoundView />
      </main>
    </>
  );
}
