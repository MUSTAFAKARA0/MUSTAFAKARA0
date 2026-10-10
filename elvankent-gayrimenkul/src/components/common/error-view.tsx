import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Profesyonel 404 görünümü */
export function NotFoundView({
  title = 'Aradığınız gayrimenkul bulunamadı.',
  description = 'Sayfa taşınmış, ilan yayından kaldırılmış veya adres hatalı yazılmış olabilir. Güncel ilanlarımıza göz atabilirsiniz.',
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="container-page flex flex-col items-center py-16 text-center sm:py-24">
      <p className="numeric font-display text-[5.5rem] leading-none text-primary/15 sm:text-[8rem]" aria-hidden>
        404
      </p>
      <h1 className="mt-2 max-w-2xl font-display text-display-lg text-foreground">{title}</h1>
      <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">
            <Home /> Ana sayfaya dön
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/ilanlar">
            <Search /> İlanlara git
          </Link>
        </Button>
      </div>
      {children}
    </div>
  );
}
