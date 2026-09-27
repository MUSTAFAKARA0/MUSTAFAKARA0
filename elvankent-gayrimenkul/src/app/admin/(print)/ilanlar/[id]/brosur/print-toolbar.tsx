'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft /> İlana dön
          </Link>
        </Button>
        <p className="hidden text-[13px] text-muted-foreground sm:block">Yazdırma penceresinde “PDF olarak kaydet” seçeneğini kullanabilirsiniz.</p>
        <Button size="sm" onClick={() => window.print()}>
          <Printer /> Yazdır / PDF
        </Button>
      </div>
    </div>
  );
}
