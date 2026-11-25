'use client';

import { useEffect, useRef, useState } from 'react';
import type { DetailSectionNavItem } from '@/components/property/detail-nav-logic';

/**
 * Yapışkan bölüm gezintisi. Bağlantılar sunucuda çizilir (JS olmadan da çalışır); küçük ada yalnızca
 * (1) görünür bölümü aria-current ile işaretler, (2) sitenin yapışkan üst çubuğunun altına oturur.
 */
export function DetailSectionNav({ items }: { items: DetailSectionNavItem[] }) {
  const [current, setCurrent] = useState(items[0]?.id ?? '');
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const header = document.querySelector<HTMLElement>('.site-header');
    const root = document.documentElement;
    let observer: IntersectionObserver | null = null;
    const targets = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => Boolean(el));
    const seen = new Map<string, boolean>();

    // Üst boşluk gerçek ölçüden: (yapışkansa) üst çubuk + gezinti yüksekliği. Boyut değişince yeniden hesaplanır.
    const measure = () => {
      const headerH = header && getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0;
      nav.style.setProperty('--su-nav-top', `${headerH}px`);
      const offset = headerH + nav.offsetHeight;
      root.style.scrollPaddingTop = `${offset + 8}px`;
      observer?.disconnect();
      seen.clear();
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) seen.set(e.target.id, e.isIntersecting);
          const first = items.find((i) => seen.get(i.id));
          if (first) setCurrent(first.id);
        },
        { rootMargin: `-${offset + 8}px 0px -55% 0px` },
      );
      for (const t of targets) observer.observe(t);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    if (header) ro.observe(header);
    return () => {
      ro.disconnect();
      observer?.disconnect();
      root.style.removeProperty('scroll-padding-top');
    };
  }, [items]);

  return (
    <nav ref={ref} aria-label="İlan bölümleri" className="su-nav">
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} aria-current={current === i.id ? 'true' : undefined}>
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
