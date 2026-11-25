'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { SiteConfig } from '@/site-config/schema';

/** Tema motoru (ve preview.css) yalnızca bölüm ekrana yaklaşınca yüklenir: ilk boyamayı engellemez */
const ThemeShowcase = dynamic(() => import('@/components/karay/theme-showcase').then((m) => m.ThemeShowcase), { ssr: false });

/** Yer tutucu aynı yüksekliği ayırır (düzen kayması yok); kapsayıcı ekrana ~700 px kala içerik yüklenir */
export function ThemeStage({ baseConfig }: { baseConfig: SiteConfig }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      const t = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '700px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="ky-theme-slot" data-ready={near ? "" : undefined}>
      {near ? <ThemeShowcase baseConfig={baseConfig} /> : <p className="sr-only">Tema vitrini yükleniyor</p>}
    </div>
  );
}
