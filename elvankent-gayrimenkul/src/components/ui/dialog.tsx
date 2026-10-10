'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlayClass = 'fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in';

const closeButtonClass =
  'rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring';

/** Ortalanmış modal. ESC ile kapanır, odak modal içinde tutulur (Radix). */
export function DialogContent({
  className,
  children,
  title,
  description,
  hideTitle,
  size = 'md',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: React.ReactNode;
  hideTitle?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-surface p-5 shadow-lg data-[state=open]:animate-scale-in sm:p-6',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
          size === 'xl' && 'max-w-4xl',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className={cn('pr-9 font-display text-xl text-foreground', hideTitle && 'sr-only')}>
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        {children}
        <DialogPrimitive.Close className={cn(closeButtonClass, 'absolute top-4 right-4')} aria-label="Kapat">
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Yandan / alttan açılan panel (mobil menü, filtreler, yönetim çekmecesi) */
export function SheetContent({
  className,
  children,
  title,
  description,
  side = 'right',
  footer,
  hideHeader,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  side?: 'left' | 'right' | 'bottom';
  footer?: React.ReactNode;
  hideHeader?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col bg-surface shadow-lg',
          side === 'right' && 'top-0 right-0 bottom-0 w-[min(26rem,100vw)] data-[state=open]:animate-slide-in-right',
          side === 'left' && 'top-0 bottom-0 left-0 w-[min(20rem,88vw)] data-[state=open]:animate-slide-in-left',
          side === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl data-[state=open]:animate-slide-in-bottom',
          className,
        )}
        {...props}
      >
        <div className={cn('flex items-center justify-between gap-3 border-b border-border px-5 py-4', hideHeader && 'sr-only')}>
          <div>
            <DialogPrimitive.Title className="text-base font-bold text-foreground">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className={description ? 'mt-0.5 text-[13px] text-muted-foreground' : 'sr-only'}>
              {description ?? title}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close className={cn(closeButtonClass, '-mr-1.5')} aria-label="Kapat">
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <div className="safe-bottom border-t border-border bg-surface px-5 pt-3">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
