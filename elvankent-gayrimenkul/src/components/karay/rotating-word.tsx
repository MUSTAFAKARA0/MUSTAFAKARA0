'use client';

import { useEffect, useState } from 'react';
import { MOTION_EVENT, readMotionOff } from '@/components/karay/motion-state';
import { rotorSchedule } from '@/components/karay/rotor-logic';
import { cn } from '@/lib/utils';

const STEP_MS = 900;

/**
 * "Hepsi tek panelde: web siteniz, ilanlarınız, ..." satırı. Cümle her zaman eksiksiz ve yerinde durur (düzen kayması,
 * ekran okuyucu ve JavaScript'siz çizim için aynı metin); hareket açıkken sözcükler sırayla vurgulanır (tek geçiş,
 * 5 sn'yi geçmez) ve durağan cümleye döner. Vurgu yalnızca renk ve alt çizgidir; her iki durum da AA kontrastını geçer.
 */
export function RotatingWord({ words, lead, className }: { words: readonly string[]; lead: string; className?: string }) {
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || readMotionOff()) return;
    const { steps, total } = rotorSchedule(words, STEP_MS);
    const timers = steps.map((s) => window.setTimeout(() => setActive(s.index), 700 + s.at));
    timers.push(window.setTimeout(() => setActive(null), 700 + total));
    // "Animasyonları durdur": vurgu hemen biter
    const stop = () => {
      if (!readMotionOff()) return;
      timers.forEach(window.clearTimeout);
      setActive(null);
    };
    window.addEventListener(MOTION_EVENT, stop);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener(MOTION_EVENT, stop);
    };
  }, [words]);
  return (
    <p className={cn('ky-rotor', className)}>
      <span className="ky-rotor-lead">{lead}</span>{' '}
      {words.map((w, i) => (
        <span key={w}>
          <span className="ky-rotor-word" data-active={active === i ? 'true' : undefined}>
            {w}
          </span>
          {i < words.length - 1 ? ', ' : '.'}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
