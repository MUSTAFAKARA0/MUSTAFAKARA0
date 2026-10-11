'use client';

import { useEffect } from 'react';
import { markPattern } from '@/components/patterns/interaction/mark';

/**
 * Etkileşim adası: sayfanın ana içeriğindeki görseller yüklendikçe yumuşakça belirir.
 * Yalnızca saydamlık değişir (düzen kayması yok); zaten yüklenmiş görsellere dokunulmaz;
 * hareketi azaltma tercihi varsa hiçbir şey yapmaz. Yalnızca seçen sitenin tarayıcısına iner.
 */
export default function ImageRevealIsland() {
  useEffect(() => {
    const unmark = markPattern('karay-pattern:interaction/image-reveal');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return unmark;
    const pending = new Set<HTMLImageElement>();
    const settle = (img: HTMLImageElement) => {
      img.removeAttribute('data-reveal-pending');
      pending.delete(img);
    };
    const track = (img: HTMLImageElement) => {
      if (img.complete || img.dataset.revealSeen) return;
      img.dataset.revealSeen = '1';
      img.setAttribute('data-reveal-pending', '');
      pending.add(img);
      img.addEventListener('load', () => settle(img), { once: true });
      img.addEventListener('error', () => settle(img), { once: true });
    };
    const main = document.querySelector('main') ?? document.body;
    const scan = () => main.querySelectorAll('img').forEach(track);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      pending.forEach(settle);
      unmark();
    };
  }, []);
  return null;
}
