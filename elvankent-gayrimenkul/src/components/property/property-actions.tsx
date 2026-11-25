'use client';

import { Check, GitCompareArrows, Heart, Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCompare, useFavorites, useHydrated } from '@/hooks/use-local-list';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/modules/analytics/track';

type Variant = 'overlay' | 'outline' | 'ghost';

const variantClass: Record<Variant, string> = {
  overlay: 'size-11 rounded-full bg-surface/92 text-foreground shadow-xs backdrop-blur hover:bg-surface',
  outline:
    'h-11 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-muted',
  ghost: 'size-9 rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground',
};

export function FavoriteButton({
  propertyId,
  title,
  variant = 'overlay',
  className,
}: {
  propertyId: string;
  title: string;
  variant?: Variant;
  className?: string;
}) {
  const { has, toggle } = useFavorites();
  const hydrated = useHydrated();
  const active = hydrated && has(propertyId);

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
      // Yalnızca simge gösteren düğmeye ad verilir; metinli düğmenin adı görünen metindir (sesli komutla
      // görünen adla çağrılabilsin, WCAG 2.5.3). Durum aria-pressed ile iletilir.
      aria-label={variant === 'outline' ? undefined : active ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      className={cn('relative z-10 inline-flex items-center justify-center gap-2 transition active:scale-95', variantClass[variant], className)}
    >
      <Heart className={cn('size-[19px] transition', active && 'fill-danger text-danger')} aria-hidden />
      {variant === 'outline' && <span>{active ? 'Favorilerde' : 'Favorile'}</span>}
    </button>
  );
}

export function CompareToggle({ propertyId, variant = 'ghost', className }: { propertyId: string; variant?: Variant | 'text'; className?: string }) {
  const { has, toggle, max } = useCompare();
  const hydrated = useHydrated();
  const active = hydrated && has(propertyId);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggle(propertyId);
    if (result === null) {
      toast.error(`En fazla ${max} ilan karşılaştırabilirsiniz.`, { description: 'Listeden bir ilan çıkarıp tekrar deneyin.' });
    } else if (result) {
      trackEvent(propertyId, 'compare_add');
      toast.success('Karşılaştırmaya eklendi', { duration: 2000 });
    }
  };

  if (variant === 'text') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'relative z-10 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold transition',
          active ? 'bg-primary-soft text-primary-ink' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
          className,
        )}
      >
        {active ? <Check className="size-3.5" aria-hidden /> : <GitCompareArrows className="size-3.5" aria-hidden />}
        {active ? 'Karşılaştırmada' : 'Karşılaştır'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? 'Karşılaştırmadan çıkar' : 'Karşılaştırmaya ekle'}
      className={cn(
        'relative z-10 inline-flex items-center justify-center gap-2 transition active:scale-95',
        variantClass[variant],
        active && 'text-primary-ink',
        className,
      )}
    >
      <GitCompareArrows className="size-[19px]" aria-hidden />
      {variant === 'outline' && <span>{active ? 'Karşılaştırmada' : 'Karşılaştır'}</span>}
    </button>
  );
}

/**
 * İlan bağlantısını kopyalar. WhatsApp / Facebook / X paylaşım düğmeleri ve cihazın yerel paylaşım menüsü bilinçli olarak
 * YOKTUR: Ticaret Bakanlığı EİDS kuralına göre sosyal medyada ve WhatsApp'ta yalnız EİDS doğrulamalı ilan bağlantısı
 * paylaşılabilir (13.06.2026 duyurusu; kurala aykırı paylaşımlara emlak işletmelerine idari para cezası uygulanıyor).
 * Ofis sitesindeki ilan bağlantısı EİDS doğrulamalı değildir; ziyaretçiye bu bağlantıyı sosyal ağlara gönderen düğme
 * sunmak ofisi cezaya açar. Bkz. docs/legal/HUKUK_UYUM_2026-11-22.md (R-1).
 */
export function ShareButton({
  propertyId,
  url,
  variant = 'outline',
  className,
}: {
  propertyId: string;
  url: string;
  title?: string;
  variant?: Variant;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Bağlantı kopyalandı');
      trackEvent(propertyId, 'share');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Bağlantı kopyalanamadı. Lütfen adres çubuğundan kopyalayın.');
    }
  };

  return (
    <button
      type="button"
      aria-label="İlan bağlantısını kopyala"
      className={cn('relative z-10 inline-flex items-center justify-center gap-2 transition active:scale-95', variantClass[variant], className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void copy();
      }}
    >
      {copied ? <Check className="size-[18px] text-success" aria-hidden /> : <Link2 className="size-[18px]" aria-hidden />}
      {variant === 'outline' && <span>{copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}</span>}
    </button>
  );
}
