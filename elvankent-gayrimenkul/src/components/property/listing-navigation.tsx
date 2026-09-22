'use client';

import { createContext, useCallback, useContext, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PropertyGridSkeleton } from './property-skeletons';

interface ListingNav {
  isPending: boolean;
  navigate: (href: string) => void;
}

const Ctx = createContext<ListingNav>({ isPending: false, navigate: () => undefined });

/**
 * Filtre ve sıralama değişikliklerini geçiş (transition) içinde yapar;
 * sonuç alanı bu sırada iskelet görünüm gösterir.
 */
export function ListingNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => {
      startTransition(() => router.push(href, { scroll: false }));
      document.getElementById('sonuclar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [router],
  );
  return <Ctx.Provider value={{ isPending, navigate }}>{children}</Ctx.Provider>;
}

export function useListingNavigation() {
  return useContext(Ctx);
}

export function ListingResults({ children }: { children: React.ReactNode }) {
  const { isPending } = useListingNavigation();
  if (isPending) return <PropertyGridSkeleton count={6} />;
  return <>{children}</>;
}
