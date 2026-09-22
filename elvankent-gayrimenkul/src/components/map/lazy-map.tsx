'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { MapPoint } from './leaflet-map';

const LeafletMapView = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-none" aria-hidden />,
});

interface LazyMapProps {
  center: MapPoint;
  mode: 'pin' | 'area';
  radiusMeters?: number;
  zoom?: number;
  attribution: string;
  ariaLabel: string;
  className?: string;
  editable?: boolean;
  onChange?: (p: MapPoint) => void;
}

/** Harita, görünüm alanına yaklaştığında yüklenir (ilk yükleme hızını korur) */
export function LazyMap({ className, ...props }: LazyMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {visible ? (
        <LeafletMapView {...props} className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-sand-100 text-sand-400">
          <MapPin className="size-8" aria-hidden />
        </div>
      )}
    </div>
  );
}
