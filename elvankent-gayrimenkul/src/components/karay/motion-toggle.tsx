'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { applyMotion, readMotionOff, subscribeMotion, writeMotionOff } from '@/components/karay/motion-state';
import { cn } from '@/lib/utils';

/**
 * Sayfa hareketini durdurur (WCAG 2.2.2): [data-motion="off"] tüm animasyon ve geçişleri, paralaksı ve yumuşak kaydırmayı kapatır;
 * tercih saklanır. Saklanan "kapalı" tercih sayfa açılırken satır içi küçük bir betikle (page.tsx; CSP 'unsafe-inline' izin verir)
 * hidratasyondan önce uygulanır, bu yüzden hareket bir an bile oynamaz.
 */
export function MotionToggle({ label = 'Animasyonları durdur', className }: { label?: string; className?: string }) {
  const off = useSyncExternalStore(subscribeMotion, readMotionOff, () => false);
  useEffect(() => applyMotion(off), [off]);
  return (
    <button
      type="button"
      onClick={() => writeMotionOff(!off)}
      aria-pressed={off}
      className={cn('inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-[13px] text-white/75 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fc0ff]', className)}
    >
      <span aria-hidden className={cn('relative h-5 w-9 rounded-full border border-white/50 transition-colors', off ? 'bg-[#2f6bff]' : 'bg-white/10')}>
        <span className={cn('absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white transition-transform', off && 'translate-x-4')} />
      </span>
      {label}
    </button>
  );
}
