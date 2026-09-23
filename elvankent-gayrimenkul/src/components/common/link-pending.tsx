'use client';

import { useLinkStatus } from 'next/link';
import { Loader2 } from 'lucide-react';

/**
 * Bir <Link> içine yerleştirilir; gezinme beklerken en yakın konumlu
 * ataya (ör. ilan kartı) yarı saydam bir yükleniyor katmanı çizer.
 */
export function LinkPendingOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span aria-hidden className="absolute inset-0 z-20 flex animate-fade-in items-center justify-center bg-white/55 backdrop-blur-[1px]">
      <Loader2 className="size-7 animate-spin text-brand-700" />
    </span>
  );
}
