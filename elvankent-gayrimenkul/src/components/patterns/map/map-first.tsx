import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { LazyMap } from '@/components/common/maps/lazy-map';
import type { MapPatternProps } from '@/components/patterns/contracts';

/**
 * Harita deseni · map-first: mevcut harita bileşeni (aynı sağlayıcı, aynı döşeme proxy'si,
 * aynı hassasiyet kuralı) bölge bağlamıyla: haritanın üzerinde konum etiketi ve "bu bölgedeki
 * ilanlar" bağlantısı. Harita arka ucu değişmez; ek tarayıcı kodu yok.
 */
export function MapFirstMap({ area, className, ...props }: MapPatternProps) {
  return (
    <div data-pattern="karay-pattern:map/map-first" className={`relative ${className ?? ''}`}>
      <LazyMap {...props} className="h-full w-full" />
      {area && (
        <div className="kp-map-badge pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex items-center gap-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[13px] font-semibold text-foreground shadow-sm">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{area.label}</span>
          </span>
          {area.href && (
            <Link href={area.href} className="kp-events ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[13px] font-semibold text-background shadow-sm">
              Bölgedeki ilanlar <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
