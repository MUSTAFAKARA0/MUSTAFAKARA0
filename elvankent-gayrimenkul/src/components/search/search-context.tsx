'use client';

import { createContext, useCallback, useContext, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ListingSearchContext {
  pending: boolean;
  navigate: (href: string) => void;
}

const Ctx = createContext<ListingSearchContext>({ pending: false, navigate: () => undefined });

/**
 * Filtre/sıralama değişikliklerini URL'ye yazar (paylaşılabilir, geri tuşu
 * çalışır) ve geçiş sırasında sonuçları soluklaştırır.
 */
export function ListingSearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => {
      startTransition(() => router.push(href, { scroll: false }));
      const target = document.getElementById('sonuclar');
      if (target && target.getBoundingClientRect().top < 0) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [router],
  );
  return <Ctx.Provider value={{ pending, navigate }}>{children}</Ctx.Provider>;
}

export function useListingSearch() {
  return useContext(Ctx);
}

export function ListingResults({ children }: { children: React.ReactNode }) {
  const { pending } = useListingSearch();
  return (
    <div aria-busy={pending} className={cn('transition-opacity duration-200', pending && 'pointer-events-none opacity-45')}>
      {children}
    </div>
  );
}
