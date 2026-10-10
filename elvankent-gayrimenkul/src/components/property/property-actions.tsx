'use client';

import { Check, GitCompareArrows, Heart, Link2, Share2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { FacebookIcon, WhatsAppIcon, XIcon } from '@/components/common/brand-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompare, useFavorites, useHydrated } from '@/hooks/use-local-list';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/modules/analytics/track';

type Variant = 'overlay' | 'outline' | 'ghost';

const variantClass: Record<Variant, string> = {
  overlay: 'size-10 rounded-full bg-white/92 text-foreground shadow-xs backdrop-blur hover:bg-white',
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
      aria-label={active ? 'Favorilerden çıkar' : 'Favorilere ekle'}
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

const noop = () => () => undefined;
const canNativeShare = () => typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Mobilde cihazın yerel paylaşım menüsü (Web Share API); masaüstünde WhatsApp,
 * Facebook, X ve bağlantı kopyalama seçenekleri.
 */
export function ShareButton({
  propertyId,
  url,
  title,
  variant = 'outline',
  className,
}: {
  propertyId: string;
  url: string;
  title: string;
  variant?: Variant;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const nativeShare = useSyncExternalStore(noop, canNativeShare, () => false);
  const text = `${title} – ${url}`;

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

  const buttonClass = cn('relative z-10 inline-flex items-center justify-center gap-2 transition active:scale-95', variantClass[variant], className);
  const content = (
    <>
      <Share2 className="size-[18px]" aria-hidden />
      {variant === 'outline' && <span>Paylaş</span>}
    </>
  );

  if (nativeShare) {
    return (
      <button
        type="button"
        aria-label="İlanı paylaş"
        className={buttonClass}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await navigator.share({ title, url });
            trackEvent(propertyId, 'share');
          } catch {
            // Kullanıcı paylaşımı iptal etti
          }
        }}
      >
        {content}
      </button>
    );
  }

  const items = [
    { label: 'WhatsApp', Icon: WhatsAppIcon, href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { label: 'Facebook', Icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: 'X', Icon: XIcon, href: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="İlanı paylaş" className={buttonClass} onClick={(e) => e.stopPropagation()}>
          {content}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map(({ label, Icon, href }) => (
          <DropdownMenuItem key={label} asChild>
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(propertyId, 'share')}>
              <Icon className="size-4" /> {label}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void copy();
          }}
        >
          {copied ? <Check className="text-success" /> : <Link2 />}
          {copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
