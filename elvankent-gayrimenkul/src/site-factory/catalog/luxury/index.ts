import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
// Aile = BİLGİ MİMARİSİ (yüzey desenleri); tema/palet = görünüm. Tema ayrıca seçilebilir (manifest: variants.theme).
export default defineFamily({
  id: 'luxury',
  name: 'Luxury',
  description:
    'Premium portföy: kenardan kenara görselle açılan sayfa, az ama etkili arayüz, iki sütunlu geniş görselli seçki, tam genişlik galeri ve editoryal tek sütun ilan detayı.',
  audience: 'Yüksek segment konut, villa ve proje portföyü sunan ofisler',
  theme: 'prestij',
  palette: 'premium-gold',
  typography: { heading: 'cormorant', body: 'manrope' },
  style: {
    hero: 'immersive',
    headerLayout: 'centered',
    card: 'flat',
    cardLayout: 'editorial',
    footerLayout: 'minimal',
    motion: 'subtle',
    slots: { grid: 'gallery-wide', listingDetail: 'immersive', gallery: 'fullscreen' },
  },
  home: ['hero', 'spotlight', 'showcase', 'regions', 'contact'],
});
