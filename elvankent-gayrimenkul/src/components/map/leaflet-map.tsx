'use client';

import { useEffect, useRef, useState } from 'react';
import type { Circle, Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  lat: number;
  lng: number;
}

interface LeafletMapProps {
  center: MapPoint;
  zoom?: number;
  /** 'pin': kesin konum, 'area': yaklaşık bölge dairesi */
  mode: 'pin' | 'area';
  radiusMeters?: number;
  /** Yönetim panelinde konum seçimi */
  editable?: boolean;
  onChange?: (p: MapPoint) => void;
  attribution: string;
  className?: string;
  ariaLabel: string;
}

const PIN_HTML = `<svg width="36" height="46" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 45s15-15.6 15-27A15 15 0 1 0 3 18c0 11.4 15 27 15 27Z" fill="#0e4d45" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="18" r="6" fill="#cc9a50"/></svg>`;

/**
 * Leaflet haritası (dinamik yüklenir; ana JS paketini büyütmez).
 * Döşemeler /api/tiles proxy'si üzerinden gelir.
 */
export default function LeafletMapView({
  center,
  zoom = 15,
  mode,
  radiusMeters = 400,
  editable,
  onChange,
  attribution,
  className,
  ariaLabel,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const onChangeRef = useRef(onChange);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    let errorCount = 0;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;
      const tiles = L.tileLayer('/api/tiles/{z}/{x}/{y}', { maxZoom: 19, minZoom: 5, attribution });
      tiles.on('tileerror', () => {
        errorCount += 1;
        if (errorCount >= 4) setTileError(true);
      });
      tiles.on('tileload', () => setTileError(false));
      tiles.addTo(map);

      const icon = L.divIcon({ html: PIN_HTML, className: '', iconSize: [36, 46], iconAnchor: [18, 45] });
      if (mode === 'pin' || editable) {
        const marker = L.marker([center.lat, center.lng], { icon, draggable: Boolean(editable), keyboard: true, title: ariaLabel });
        marker.addTo(map);
        markerRef.current = marker;
        if (editable) {
          marker.on('dragend', () => {
            const p = marker.getLatLng();
            onChangeRef.current?.({ lat: p.lat, lng: p.lng });
          });
          map.on('click', (e) => {
            marker.setLatLng(e.latlng);
            onChangeRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
          });
        }
      } else {
        circleRef.current = L.circle([center.lat, center.lng], {
          radius: radiusMeters,
          color: '#0e4d45',
          weight: 2,
          fillColor: '#2f7c6e',
          fillOpacity: 0.18,
        }).addTo(map);
      }
      // İlk etkileşimde tekerlek ile yakınlaştırmayı aç (sayfa kaydırmasını engellememek için)
      map.once('focus click', () => map.scrollWheelZoom.enable());
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Harita yalnızca bir kez kurulur; merkez değişiklikleri aşağıdaki effect ile uygulanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dışarıdan gelen merkez değişikliği (ör. yönetim panelinde mahalle seçimi)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.setLatLng([center.lat, center.lng]);
    circleRef.current?.setLatLng([center.lat, center.lng]);
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center.lat, center.lng]);

  return (
    <div className={className} style={{ position: 'relative' }}>
      <div ref={containerRef} role="application" aria-label={ariaLabel} className="h-full w-full" />
      {tileError && (
        <p className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-center text-xs text-sand-700 shadow">
          Harita görüntüsü şu anda yüklenemiyor. Konum işareti yine de doğrudur.
        </p>
      )}
    </div>
  );
}
