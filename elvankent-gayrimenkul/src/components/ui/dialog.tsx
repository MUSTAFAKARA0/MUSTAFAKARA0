'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  hideTitle,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string; hideTitle?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-950/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-surface p-6 shadow-lift data-[state=open]:animate-slide-up',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className={cn('pr-8 font-display text-xl text-ink', hideTitle && 'sr-only')}>
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1.5 text-sm text-sand-600">{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        {children}
        <DialogPrimitive.Close
          className="absolute top-4 right-4 rounded-lg p-1.5 text-sand-500 transition hover:bg-sand-100 hover:text-ink"
          aria-label="Kapat"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Yandan açılan panel (mobil menü, mobil filtreler) */
export function SheetContent({
  className,
  children,
  title,
  side = 'right',
  footer,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  side?: 'left' | 'right';
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-950/45 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-0 bottom-0 z-50 flex w-[min(24rem,100vw)] flex-col bg-surface shadow-lift',
          side === 'right' ? 'right-0 data-[state=open]:animate-slide-in-right' : 'left-0 data-[state=open]:animate-slide-in-left',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <DialogPrimitive.Title className="text-base font-bold text-ink">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          <DialogPrimitive.Close
            className="-mr-1.5 rounded-lg p-1.5 text-sand-500 transition hover:bg-sand-100 hover:text-ink"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <div className="safe-bottom border-t border-line px-5 pt-3">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
