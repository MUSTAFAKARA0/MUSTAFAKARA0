'use client';

import { DropdownMenu } from 'radix-ui';
import { Check, Link2, Share2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { FacebookIcon, WhatsAppIcon, XIcon } from '@/components/common/brand-icons';
import { trackEvent } from '@/lib/track';
import { cn } from '@/lib/utils';

const noop = () => () => undefined;
const canNativeShare = () =>
  typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;

interface ShareButtonProps {
  propertyId: string;
  url: string;
  title: string;
  variant?: 'overlay' | 'outline';
  className?: string;
}

/**
 * Mobilde cihazın yerel paylaşım menüsünü (Web Share API), diğer
 * durumlarda WhatsApp / Facebook / X / bağlantı kopyalama menüsünü açar.
 */
export function ShareButton({ propertyId, url, title, variant = 'outline', className }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `${title} – ${url}`;

  const nativeShare = useSyncExternalStore(noop, canNativeShare, () => false);

  const shareNative = async () => {
    try {
      await navigator.share({ title, url });
      trackEvent(propertyId, 'share');
    } catch {
      // Kullanıcı paylaşımı iptal etti
    }
  };

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

  const items = [
    { label: 'WhatsApp', Icon: WhatsAppIcon, href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { label: 'Facebook', Icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: 'X', Icon: XIcon, href: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
  ];

  const buttonClass = cn(
    'inline-flex items-center justify-center gap-2 transition active:scale-95',
    variant === 'overlay' && 'size-10 rounded-full bg-white/92 text-sand-700 shadow-sm backdrop-blur hover:bg-white',
    variant === 'outline' &&
      'h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-brand-300 hover:bg-brand-50',
    className,
  );
  const buttonContent = (
    <>
      <Share2 className="size-[18px]" aria-hidden />
      {variant === 'outline' && <span>Paylaş</span>}
    </>
  );

  if (nativeShare) {
    return (
      <button type="button" onClick={shareNative} aria-label="İlanı paylaş" className={buttonClass}>
        {buttonContent}
      </button>
    );
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label="İlanı paylaş" className={buttonClass}>
          {buttonContent}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-52 animate-slide-up rounded-2xl bg-surface p-1.5 shadow-lift ring-1 ring-line"
        >
          {items.map(({ label, Icon, href }) => (
            <DropdownMenu.Item key={label} asChild>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent(propertyId, 'share')}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink outline-none data-[highlighted]:bg-sand-100"
              >
                <Icon className="size-[18px] text-sand-600" /> {label}
              </a>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              void copy();
            }}
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink outline-none data-[highlighted]:bg-sand-100"
          >
            {copied ? <Check className="size-[18px] text-success" /> : <Link2 className="size-[18px] text-sand-600" />}
            {copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
