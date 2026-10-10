'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportClientError } from '@/modules/monitoring/client';

/**
 * Panel içi hata ekranı (ofis paneli ve KARAY platformu). Hata yalnızca içerik alanını
 * etkiler; menü ve başlık yerinde kalır, kullanıcı tekrar deneyebilir veya ana ekrana döner.
 */
export function PanelError({ error, reset, homeHref, homeLabel }: { error: Error & { digest?: string }; reset: () => void; homeHref: string; homeLabel: string }) {
  useEffect(() => {
    console.error(error);
    if (!error.digest) reportClientError(error, 'boundary');
  }, [error]);
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-border bg-surface px-6 py-14 text-center">
      <h1 className="text-[1.35rem] font-semibold text-foreground">Bu ekran şu anda yüklenemedi</h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
        Geçici bir sorun oluştu. Kaydedilmiş verileriniz etkilenmedi. Tekrar deneyebilir veya ana ekrana dönebilirsiniz.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw /> Tekrar dene
        </Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
      {error.digest && <p className="mt-6 text-xs text-muted-foreground">Hata kodu: {error.digest}</p>}
    </div>
  );
}
