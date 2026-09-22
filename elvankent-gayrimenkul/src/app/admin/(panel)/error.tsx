'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl bg-surface p-8 text-center shadow-card ring-1 ring-line/70">
      <h1 className="font-display text-2xl text-ink">Sayfa yüklenemedi</h1>
      <p className="mt-2 text-sm text-sand-600">
        Veriler alınırken bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin. Oturumunuzun süresi dolduysa yeniden giriş
        yapmanız gerekebilir.
      </p>
      <Button onClick={reset} className="mt-6">
        <RefreshCw /> Tekrar dene
      </Button>
    </div>
  );
}
