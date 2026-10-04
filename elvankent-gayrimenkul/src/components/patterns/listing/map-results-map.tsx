'use client';

import { useEffect, useRef } from 'react';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPoint } from '@/components/patterns/contracts';
import type { PropertyCard } from '@/modules/properties/types';

/** Kısa fiyat etiketi: 18.500.000 → "18,5 M", 32.000 → "32 B" (para birimi ilanınki) */
function shortPrice(p: PropertyCard): string {
  if (p.price === null) return 'Fiyat sorunuz';
  const sym = p.currency === 'USD' ? '$' : p.currency === 'EUR' ? '€' : '₺';
  const n = p.price;
  const v = n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} B` : String(n);
  return `${v} ${sym}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Map First sonuç haritası (Leaflet; döşemeler mevcut /api/tiles proxy'sinden — harita arka ucu
 * değişmez). Her konumlu ilan bir fiyat işaretidir; kesin olmayan konumlar kesikli işaret ve
 * yaklaşık bölge dairesiyle gösterilir. Liste ile çift yönlü vurgu: active ↔ onSelect.
 */
export default function ResultsMap({
  items,
  points,
  active,
  onSelect,
  attribution,
  maxZoom,
}: {
  items: PropertyCard[];
  points: MapPoint[];
  active: string | null;
  onSelect: (id: string | null) => void;
  attribution: string;
  maxZoom: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let layer: LayerGroup | null = null;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !box.current) return;
      const map = mapRef.current ?? L.map(box.current, { center: [39, 35], zoom: 5, scrollWheelZoom: false, attributionControl: true });
      if (!mapRef.current) {
        L.tileLayer('/api/tiles/{z}/{x}/{y}', { maxZoom, minZoom: 5, attribution }).addTo(map);
        map.once('focus click', () => map.scrollWheelZoom.enable());
        mapRef.current = map;
      }
      layer = L.layerGroup().addTo(map);
      const byId = new Map(items.map((p) => [p.id, p]));
      markers.current.clear();
      const bounds: [number, number][] = [];
      for (const pt of points) {
        const p = byId.get(pt.id);
        if (!p) continue;
        const exact = pt.precision === 'exact';
        if (!exact) L.circle([pt.lat, pt.lng], { radius: pt.precision === 'neighborhood' ? 700 : 300, weight: 1, opacity: 0.5, fillOpacity: 0.08, className: 'kp-area' }).addTo(layer);
        const icon = L.divIcon({ className: 'kp-pin-wrap', html: `<span class="kp-pin${exact ? '' : ' kp-pin-approx'}">${esc(shortPrice(p))}</span>`, iconSize: undefined });
        const m = L.marker([pt.lat, pt.lng], { icon, title: p.title, keyboard: true, riseOnHover: true })
          .bindPopup(`<a class="kp-pop" href="/ilan/${encodeURIComponent(p.slug)}"><strong>${esc(p.title)}</strong><span>${esc(shortPrice(p))}${exact ? '' : ' · yaklaşık konum'}</span></a>`)
          .on('click', () => {
            selectRef.current(p.id);
            document.getElementById(`sonuc-${p.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          })
          .addTo(layer);
        markers.current.set(p.id, m);
        bounds.push([pt.lat, pt.lng]);
      }
      if (bounds.length === 1) map.setView(bounds[0], 15);
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      setTimeout(() => map.invalidateSize(), 0);
    })();
    return () => {
      cancelled = true;
      layer?.remove();
    };
  }, [items, points, attribution, maxZoom]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  // Liste → harita vurgusu
  useEffect(() => {
    for (const [id, m] of markers.current) {
      const el = m.getElement()?.querySelector('.kp-pin');
      el?.classList.toggle('kp-pin-active', id === active);
      if (id === active) m.setZIndexOffset(1000);
      else m.setZIndexOffset(0);
    }
  }, [active]);

  return <div ref={box} role="application" aria-label="İlanların haritası" className="h-full w-full" />;
}
