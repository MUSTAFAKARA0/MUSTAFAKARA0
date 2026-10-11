# map — harita yüzeyi (Map First altyapısı)

Sözleşme: `MapPatternProps` (`contracts.ts`). Manifest: `style.slots.mapList`.
Standart: `components/common/maps/lazy-map.tsx` (kilitli; harita arka ucu değişmez). Çizim: `surface.tsx`.
Harita tarayıcı kodu taşıdığı için yeni harita desenleri YALNIZCA istemci yükleyicisinden tembel
yüklenir; Map First seçmeyen site bu kodu indirmez (bundle regresyon testi).
Sözleşmesi hazır (D7.3+): map-first (`surfaces.ts`).
