import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Sunucu hatası', robots: { index: false, follow: false } };

/** Statik 500 sayfası (ör. bakım/yönlendirme için doğrudan bağlantı verilebilir) */
export default function ServerErrorPage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-[5rem] leading-none text-accent-200 sm:text-[7rem]">500</p>
      <h1 className="mt-4 font-display text-2xl text-ink sm:text-3xl">Sunucu hatası</h1>
      <p className="mt-3 max-w-md text-[15px] text-sand-600">
        İsteğiniz işlenirken bir sorun oluştu. Lütfen birkaç dakika sonra tekrar deneyin.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Ana sayfaya dön</Link>
      </Button>
    </div>
  );
}
