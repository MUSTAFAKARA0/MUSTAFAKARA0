'use client';

import * as React from 'react';
import { Tooltip as Primitive } from 'radix-ui';

export const TooltipProvider = Primitive.Provider;

/** Simge butonları için kısa açıklama. Dokunmatik cihazlarda aria-label yeterlidir. */
export function Tooltip({ content, children, side = 'top' }: { content: string; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Primitive.Root delayDuration={250}>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 rounded-md bg-surface-inverse px-2 py-1 text-xs font-medium text-inverse-foreground shadow-sm data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
