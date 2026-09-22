import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundView() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-[5rem] leading-none text-brand-200 sm:text-[7rem]">404</p>
      <h1 className="mt-4 font-display text-2xl text-ink sm:text-3xl">Aradığınız sayfa bulunamadı</h1>
      <p className="mt-3 max-w-md text-[15px] text-sand-600">
        Sayfa taşınmış, ilan yayından kaldırılmış veya adres hatalı yazılmış olabilir. Güncel ilanlarımıza göz atabilirsiniz.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/ilanlar">
            <Search /> İlanlara göz at
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <Home /> Ana sayfa
          </Link>
        </Button>
      </div>
    </div>
  );
}
