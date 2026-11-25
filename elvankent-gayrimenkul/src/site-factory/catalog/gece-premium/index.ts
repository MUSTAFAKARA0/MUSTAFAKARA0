import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'gece-premium',
  name: 'Gece Premium',
  description:
    'Koyu premium sunum: kenardan kenara hero, pirinç ince çizgiler, gölge yerine parıltı, görsel üstü kartlar ve tam genişlik galeri. Koyu görünüm açık olan sitelerde kullanılır.',
  audience: 'Koyu tema ile premium sunum isteyen markalar (koyu görünüm gerekir)',
  theme: 'gece',
  palette: 'midnight-brass',
  style: {
    hero: 'immersive',
    headerLayout: 'transparent',
    card: 'bezel',
    cardLayout: 'overlay',
    footerLayout: 'editorial',
    motion: 'expressive',
    slots: { grid: 'gallery-wide', listingDetail: 'immersive', gallery: 'fullscreen', interactions: ['scroll-header'] },
  },
  home: ['hero', 'spotlight', 'showcase', 'stats', 'regions', 'contact'],
});
