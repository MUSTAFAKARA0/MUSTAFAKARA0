'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertCircle, HeartOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { PropertyCard } from '@/components/property/property-card';
import { PropertyGridSkeleton } from '@/components/property/property-skeletons';
import { getFavoriteCards } from '@/app/actions/favorites';
import { useFavorites } from '@/hooks/use-favorites';
import type { PropertyCardData } from '@/types/database';

type LoadState = { key: string; status: 'error' } | { key: string; status: 'ready'; items: PropertyCardData[] };

const noopSubscribe = () => () => undefined;

export function FavoritesView() {
  const { favorites, clear } = useFavorites();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const key = favorites.join(',');
  const [loaded, setLoaded] = useState<LoadState | null>(null);

  // Favoriden çıkarma gibi alt küme değişikliklerinde yeniden sorgu atma
  const covered = Boolean(loaded) && key.split(',').every((id) => loaded!.key.split(',').includes(id));

  useEffect(() => {
    if (!key || covered) return;
    let active = true;
    getFavoriteCards(key.split(','))
      .then((res) => active && setLoaded(res.ok ? { key, status: 'ready', items: res.items } : { key, status: 'error' }))
      .catch(() => active && setLoaded({ key, status: 'error' }));
    return () => {
      active = false;
    };
  }, [key, covered]);

  // Sunucu/ilk render ve yükleme sırasında iskelet göster
  const state: LoadState | null = !hydrated ? null : !key ? { key, status: 'ready', items: [] } : covered ? loaded : null;
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

  // Favori listesinde olan ancak yayından kalkmış ilanları gösterme
  const items = state.items.filter((p) => favorites.includes(p.id));
  const removedCount = favorites.length - state.items.length;

  if (!items.length) {
    return (
      <EmptyState
        icon={HeartOff}
        title="Henüz favori ilanınız bulunmuyor."
        description="Beğendiğiniz ilanlardaki kalp simgesine dokunarak favorilerinize ekleyebilir, daha sonra buradan kolayca ulaşabilirsiniz."
        action={
          <Button asChild>
            <Link href="/ilanlar">İlanları keşfedin</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-sand-600">
          <strong className="text-ink">{items.length}</strong> favori ilan
          {removedCount > 0 && <span className="ml-2 text-sand-500">({removedCount} ilan artık yayında değil)</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={clear}>
          Tümünü temizle
        </Button>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
        {items.map((p) => (
          <li key={p.id} className="flex">
            <PropertyCard property={p} className="w-full" />
          </li>
        ))}
      </ul>
    </>
  );
}
