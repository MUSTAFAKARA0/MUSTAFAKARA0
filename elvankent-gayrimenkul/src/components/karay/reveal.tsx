'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { shouldForceReveal, shouldPend } from '@/components/karay/reveal-logic';

/*
 * Kaydırmayla giriş. Öğeler varsayılan olarak SON halindedir (sunucu çıktısı, JavaScript'siz, "hareketi azalt").
 * Yalnızca ilk çizimde ekranın tamamen altında kalanlar "pending" işaretlenir; paylaşılan tek IntersectionObserver
 * görününce "in" yapar. Metin hiçbir zaman opacity ile gizlenmez (yalnızca transform + en çok 4px bulanıklık).
 */

type Tag = 'div' | 'li' | 'p' | 'ul' | 'ol' | 'section' | 'figure' | 'span';

let observer: IntersectionObserver | null = null;
let safetyTimer: number | undefined;

function reveal(el: Element) {
  el.setAttribute('data-reveal', 'in');
  observer?.unobserve(el);
}

function getObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) reveal(e.target);
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  return observer;
}

/** Gözlemci bir nedenle tetiklememişse (sekme arka planda, tarayıcı hatası) şu an ekranda olan bekleyenler gösterilir */
function armSafety() {
  if (safetyTimer !== undefined) return;
  safetyTimer = window.setTimeout(() => {
    for (const el of document.querySelectorAll('[data-reveal="pending"]')) {
      if (shouldForceReveal(el.getBoundingClientRect(), window.innerHeight)) reveal(el);
    }
  }, 2500);
}

/**
 * Tüm Reveal öğelerinin konumları TEK geçişte okunur, sonra yazılır (öğe başına okuma-yazma dönüşümü yüzlerce zorunlu
 * yeniden düzen üretirdi: ana iş parçacığı hidratasyon sırasında meşgul kalır).
 */
const queued = new Set<HTMLElement>();
let flushing = false;
function enqueue(el: HTMLElement) {
  queued.add(el);
  if (flushing) return;
  flushing = true;
  requestAnimationFrame(() => {
    flushing = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vh = window.innerHeight;
    const pend = [...queued].filter((e) => shouldPend(e.getBoundingClientRect(), vh, reduced));
    queued.clear();
    for (const e of pend) {
      e.setAttribute('data-reveal', 'pending');
      getObserver().observe(e);
    }
    if (pend.length) armSafety();
  });
}

export function Reveal({
  as = 'div',
  variant = 'rise',
  i = 0,
  spot = false,
  className,
  children,
}: {
  as?: Tag;
  variant?: 'rise' | 'scale' | 'slide-l' | 'slide-r';
  /** Aşamalı giriş sırası (70 ms adım) */
  i?: number;
  /** SpotGrid içindeki kart: imleç ışığı için işaretlenir */
  spot?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    enqueue(el);
    return () => {
      queued.delete(el);
      observer?.unobserve(el);
    };
  }, []);
  const Tag = as as 'div';
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} className={className} data-reveal="idle" data-variant={variant} data-spot={spot ? '' : undefined} style={{ '--ky-i': i } as CSSProperties}>
      {children}
    </Tag>
  );
}

/**
 * Izgara üzerinde imleci izleyen ışık: tek yetkilendirilmiş (delegated) pointermove, rAF ile kısıtlı,
 * yalnızca ince imleçli (fare) cihazda. Hiçbir işlev buna bağlı değildir (yalnızca görsel ışık).
 */
export function SpotGrid({ as = 'ul', className, children }: { as?: 'ul' | 'div'; className?: string; children?: ReactNode }) {
  const frame = useRef(0);
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || frame.current) return;
    const { clientX, clientY } = e;
    const target = e.target as HTMLElement;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const card = target.closest<HTMLElement>('[data-spot]');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${clientX - r.left}px`);
      card.style.setProperty('--my', `${clientY - r.top}px`);
    });
  };
  const Tag = as as 'div';
  return (
    <Tag className={className} onPointerMove={onMove}>
      {children}
    </Tag>
  );
}
