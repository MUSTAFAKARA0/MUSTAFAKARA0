'use client';

import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/use-favorites';
import { trackEvent } from '@/lib/track';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  propertyId: string;
  title: string;
  variant?: 'overlay' | 'outline';
  className?: string;
}

export function FavoriteButton({ propertyId, title, variant = 'overlay', className }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(propertyId);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggle(propertyId);
    if (added) {
      trackEvent(propertyId, 'favorite_add');
      toast.success('Favorilere eklendi', { description: title, duration: 2500 });
    } else {
      toast('Favorilerden çıkarıldı', { duration: 2000 });
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      className={cn(
        'relative z-10 inline-flex items-center justify-center gap-2 transition active:scale-90',
        variant === 'overlay' &&
          'size-10 rounded-full bg-white/92 text-sand-700 shadow-sm backdrop-blur hover:bg-white hover:text-danger',
        variant === 'outline' &&
          'h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-red-200 hover:bg-red-50',
        className,
      )}
    >
      <Heart className={cn('size-5 transition', active && 'fill-danger text-danger')} aria-hidden />
      {variant === 'outline' && <span>{active ? 'Favorilerde' : 'Favorile'}</span>}
    </button>
  );
}
