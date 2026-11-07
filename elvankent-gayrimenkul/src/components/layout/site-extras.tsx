'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitCompareArrows, X } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { Button } from '@/components/ui/button';
import { useCompare, useHydrated } from '@/hooks/use-local-list';
import { cn } from '@/lib/utils';

/** Karşılaştırma listesi doluyken ekranın altında sabit çubuk */
export function CompareBar() {
  const { items, clear } = useCompare();
  const hydrated = useHydrated();
  const pathname = usePathname();
  if (!hydrated || items.length === 0 || pathname.startsWith('/karsilastir')) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur safe-bottom lg:bottom-6 lg:left-auto lg:right-6 lg:w-auto lg:rounded-2xl lg:border lg:shadow-lg">
      <div className="flex items-center gap-3 px-4 pt-3 lg:px-4 lg:pb-3">
        <GitCompareArrows className="size-5 shrink-0 text-primary-ink" aria-hidden />
        <p className="flex-1 text-sm">
          <strong>{items.length}</strong> ilan karşılaştırmada <span className="text-muted-foreground">(en fazla 4)</span>
        </p>
        <Button asChild size="sm">
          <Link href="/karsilastir">Karşılaştır</Link>
        </Button>
        <button
          type="button"
          onClick={clear}
          aria-label="Karşılaştırma listesini temizle"
          className="rounded-lg p-2.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Sağ altta WhatsApp kısayolu (ilan detayında alt iletişim çubuğu olduğu için gizlenir) */
export function FloatingWhatsApp({ href }: { href: string | null }) {
  const pathname = usePathname();
  const { items } = useCompare();
  const hydrated = useHydrated();
  if (!href || pathname.startsWith('/ilan/') || pathname.startsWith('/karsilastir')) return null;
  const raised = hydrated && items.length > 0;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp ile yazın"
      className={cn(
        'fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg transition hover:scale-105 hover:bg-whatsapp-hover sm:right-6',
        raised ? 'bottom-24 lg:bottom-28' : 'bottom-4 sm:bottom-6',
      )}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
