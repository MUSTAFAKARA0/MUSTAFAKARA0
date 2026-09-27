import 'server-only';
import { serverEnv } from '@/lib/server-env';

/**
 * Harita sağlayıcı soyutlaması. Döşemeler tarayıcıya /api/tiles üzerinden
 * (sunucu proxy'si) gelir → API anahtarı hiçbir zaman tarayıcıya gönderilmez.
 * Sağlayıcı ortam değişkeniyle değiştirilir (MAP_PROVIDER, MAP_API_KEY, MAP_STYLE).
 *
 *  osm      OpenStreetMap (anahtarsız; yoğun trafikte kullanım politikası gereği önerilmez)
 *  maptiler MapTiler raster döşemeleri (MAP_API_KEY, isteğe bağlı MAP_STYLE: streets-v2)
 *  mapbox   Mapbox Static Tiles (MAP_API_KEY = access token, MAP_STYLE: mapbox/streets-v12)
 *  custom   MAP_TILE_URL şablonu ({z}/{x}/{y})
 *
 * Google Maps: Google'ın kullanım koşulları döşemelerin proxy/önbellek ile
 * sunulmasına izin vermediği için bu mimaride desteklenmez; gerekirse istemci
 * tarafı bir sağlayıcı bileşeni (alan adı kısıtlamalı anahtarla) eklenebilir.
 */
export type MapProviderId = 'osm' | 'maptiler' | 'mapbox' | 'custom';

export interface MapProvider {
  id: MapProviderId;
  /** Tarayıcıya gönderilebilir atıf metni (HTML) */
  attribution: string;
  maxZoom: number;
  tileUrl: (z: number, x: number, y: number) => string;
}

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar';

function fill(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

export function getMapProvider(): MapProvider {
  const { provider, apiKey, style, tileUrl, attribution } = serverEnv.map;
  if (provider === 'maptiler' && apiKey) {
    const s = style || 'streets-v2';
    return {
      id: 'maptiler',
      attribution: attribution || `&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ${OSM_ATTRIBUTION}`,
      maxZoom: 19,
      tileUrl: (z, x, y) => `https://api.maptiler.com/maps/${encodeURIComponent(s)}/256/${z}/${x}/${y}.png?key=${encodeURIComponent(apiKey)}`,
    };
  }
  if (provider === 'mapbox' && apiKey) {
    const s = style || 'mapbox/streets-v12';
    return {
      id: 'mapbox',
      attribution: attribution || `&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ${OSM_ATTRIBUTION}`,
      maxZoom: 19,
      tileUrl: (z, x, y) => `https://api.mapbox.com/styles/v1/${s}/tiles/256/${z}/${x}/${y}?access_token=${encodeURIComponent(apiKey)}`,
    };
  }
  if (provider === 'custom' && tileUrl) {
    return { id: 'custom', attribution: attribution || OSM_ATTRIBUTION, maxZoom: 19, tileUrl: (z, x, y) => fill(tileUrl, z, x, y) };
  }
  return {
    id: 'osm',
    attribution: attribution || OSM_ATTRIBUTION,
    maxZoom: 19,
    tileUrl: (z, x, y) => fill('https://tile.openstreetmap.org/{z}/{x}/{y}.png', z, x, y),
  };
}

/** İstemci bileşenlerine gönderilebilir yapılandırma (anahtar içermez) */
export function publicMapConfig(): { attribution: string; maxZoom: number } {
  const p = getMapProvider();
  return { attribution: p.attribution, maxZoom: p.maxZoom };
}
