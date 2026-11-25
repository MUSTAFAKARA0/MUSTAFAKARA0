'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ContextEmptyState } from '@/components/common/empty-state-variants';
import { PropertyCard } from '@/components/property/property-card';
import { PropertyGridSkeleton } from '@/components/property/property-skeletons';
import { Button } from '@/components/ui/button';
import { getPublicCards } from '@/app/actions/public';
import { useFavorites, useHydrated } from '@/hooks/use-local-list';
import type { PropertyCard as PropertyCardData } from '@/modules/properties/types';

type LoadState = { key: string; status: 'error' } | { key: string; status: 'ready'; items: PropertyCardData[] };

export function FavoritesView() {
  const { items: favorites, clear } = useFavorites();
  const hydrated = useHydrated();
  const key = favorites.join(',');
  const [loaded, setLoaded] = useState<LoadState | null>(null);

  // Favoriden çıkarma gibi alt küme değişikliklerinde yeniden sorgu atma
  const covered = loaded !== null && key.split(',').every((id) => loaded.key.split(',').includes(id));

  useEffect(() => {
    if (!key || covered) return;
    let active = true;
    getPublicCards(key.split(','))
      .then((res) => active && setLoaded(res.ok ? { key, status: 'ready', items: res.items } : { key, status: 'error' }))
      .catch(() => active && setLoaded({ key, status: 'error' }));
    return () => {
      active = false;
    };
  }, [key, covered]);

  const state: LoadState | null = !hydrated ? null : !key ? { key, status: 'ready', items: [] } : covered ? loaded : null;
  // Sunucu çıktısı ve yüklenme anı, boş durumla AYNI yüksekliği ayırır (CLS yok); kayıtlı favori varsa kart iskeleti
  if (!hydrated || (!state && !key)) return <div role="status" aria-label="Favoriler yükleniyor" className="su-skel min-h-[26rem] rounded-2xl" />;
  if (!state) return <PropertyGridSkeleton count={3} />;

  if (state.status === 'error') {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Favorileriniz yüklenemedi"
        description="Bağlantınızı kontrol edip sayfayı yenilemeyi deneyin."
        action={<Button onClick={() => window.location.reload()}>Sayfayı yenile</Button>}
      />
    );
  }

  const items = state.items.filter((p) => favorites.includes(p.id));
  const removedCount = favorites.length - state.items.length;

  if (!items.length) {
    return (
      <ContextEmptyState variant="favorites" className="min-h-[26rem] justify-center" />
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{items.length}</strong> favori ilan
          {removedCount > 0 && <span className="ml-2">({removedCount} ilan artık yayında değil)</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={clear}>
          Tümünü temizle
        </Button>
      </div>
      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => (
          <li key={p.id} className="flex">
            <PropertyCard property={p} className="w-full" />
          </li>
        ))}
      </ul>
    </>
  );
}
