'use client';

import * as React from 'react';
import { Popover as Primitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverClose = Primitive.Close;

export function PopoverContent({ className, sideOffset = 8, align = 'start', ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          'z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-surface p-4 shadow-md data-[state=open]:animate-scale-in',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
