'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportClientError } from '@/modules/monitoring/client';

export default function TenantError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    // digest'li hatalar sunucuda oluşmuştur ve orada zaten raporlanmıştır
    if (!error.digest) reportClientError(error, 'boundary');
  }, [error]);
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="font-display text-display-lg">Sayfa şu anda yüklenemedi</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Geçici bir sorun oluştu; işleminiz etkilenmedi. Birkaç saniye sonra tekrar deneyebilir veya ana sayfaya dönebilirsiniz.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw /> Tekrar dene
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ana sayfaya dön</Link>
        </Button>
      </div>
      {error.digest && <p className="mt-6 text-xs text-muted-foreground">Hata kodu: {error.digest}</p>}
    </div>
  );
}
