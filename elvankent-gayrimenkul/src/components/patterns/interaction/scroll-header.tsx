'use client';

import { useEffect } from 'react';
import { markPattern } from '@/components/patterns/interaction/mark';

/**
 * Etkileşim adası: sayfa kaydırılınca <html data-site-scrolled> (header belirginleşir; CSS
 * interaction/styles.ts). Kaydırma dinleyicisi pasif ve kare başına en fazla bir kez çalışır.
 * Yalnızca bu deseni seçen sitenin tarayıcısına iner (islands.tsx).
 */
export default function ScrollHeaderIsland() {
  useEffect(() => {
    const root = document.documentElement;
    const unmark = markPattern('karay-pattern:interaction/scroll-header');
    let frame = 0;
    const update = () => {
      frame = 0;
      root.toggleAttribute('data-site-scrolled', window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      root.removeAttribute('data-site-scrolled');
      unmark();
    };
  }, []);
  return null;
}
