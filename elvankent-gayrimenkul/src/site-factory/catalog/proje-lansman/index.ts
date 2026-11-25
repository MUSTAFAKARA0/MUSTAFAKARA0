import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'proje-lansman',
  name: 'Proje Lansman',
  description:
    'Afiş düzeni: koyu zeminde iri başlık, gerçek envanter sayaçları, görsel üstü kartlar, geniş görselli seçki, editoryal ilan detayı ve tam genişlik galeri.',
  audience: 'Yeni konut projesi ve müteahhit satışı yapan ofisler',
  theme: 'rezidans',
  palette: 'launch-indigo',
  style: {
    hero: 'poster',
    headerLayout: 'transparent',
    card: 'bezel',
    cardLayout: 'overlay',
    footerLayout: 'editorial',
    motion: 'expressive',
    slots: { grid: 'gallery-wide', listingDetail: 'immersive', gallery: 'fullscreen', interactions: ['scroll-header'] },
  },
  home: ['hero', 'stats', 'showcase', 'spotlight', 'process', 'owner_cta', 'contact'],
});
