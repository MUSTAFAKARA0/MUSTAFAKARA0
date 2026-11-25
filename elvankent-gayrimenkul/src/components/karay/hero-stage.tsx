'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { MOTION_EVENT, readMotionOff } from '@/components/karay/motion-state';
import { SETTLE_EPSILON, lerp, normalizePointer } from '@/components/karay/reveal-logic';

/**
 * Hero cihaz yığınının imleç paralaksı. İçerik sunucuda eksiksiz çizilir (durağan 3B poz CSS'tedir);
 * bu ada yalnızca fareli ve ince imleçli cihazda, hareket serbestken --px/--py (-1..1) değerlerini yazar.
 * Tek rAF döngüsü yalnızca değerler hedefe yaklaşana kadar çalışır; boşta döngü yoktur.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = ref.current;
    const hero = stage?.closest('section');
    if (!stage || !hero) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (min-width: 1024px)');
    let cur = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };
    let raf = 0;
    let pointer: { x: number; y: number } | null = null;
    const tick = () => {
      if (pointer) {
        // Ölçüm kare başına bir kez (olay başına değil)
        const r = hero.getBoundingClientRect();
        target = { x: normalizePointer(pointer.x - r.left, r.width), y: normalizePointer(pointer.y - r.top, r.height) };
      } else target = { x: 0, y: 0 };
      cur = { x: lerp(cur.x, target.x, 0.09), y: lerp(cur.y, target.y, 0.09) };
      stage.style.setProperty('--px', cur.x.toFixed(4));
      stage.style.setProperty('--py', cur.y.toFixed(4));
      const settled = Math.abs(cur.x - target.x) < SETTLE_EPSILON && Math.abs(cur.y - target.y) < SETTLE_EPSILON;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (readMotionOff()) return;
      pointer = { x: e.clientX, y: e.clientY };
      start();
    };
    const onLeave = () => {
      pointer = null;
      start();
    };
    const attach = () => {
      hero.addEventListener('pointermove', onMove, { passive: true });
      hero.addEventListener('pointerleave', onLeave);
    };
    const detach = () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      raf = 0;
      stage.style.removeProperty('--px');
      stage.style.removeProperty('--py');
    };
    // Animasyonları durdur anahtarı: dinleyiciler çıkar, paralaks sıfırlanır
    const sync = () => {
      detach();
      if (mq.matches && !readMotionOff()) attach();
    };
    sync();
    mq.addEventListener('change', sync);
    window.addEventListener(MOTION_EVENT, sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener(MOTION_EVENT, sync);
      detach();
    };
  }, []);
  return (
    <div ref={ref} className="ky-stage">
      {children}
    </div>
  );
}
