'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Sayfa düzeyinde beklenmeyen hata (500). Kullanıcıya teknik detay gösterilmez. */
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-[5rem] leading-none text-accent-200 sm:text-[7rem]">500</p>
      <h1 className="mt-4 font-display text-2xl text-ink sm:text-3xl">Bir şeyler ters gitti</h1>
      <p className="mt-3 max-w-md text-[15px] text-sand-600">
        Sayfa yüklenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin; sorun devam ederse bize telefon veya WhatsApp ile
        ulaşabilirsiniz.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw /> Tekrar dene
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ana sayfa</Link>
        </Button>
      </div>
    </div>
  );
}
