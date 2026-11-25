import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'deniz-kiyisi',
  name: 'Deniz Kıyısı',
  description:
    'Ferah sahil dili: gerçek ilan kapaklarından üçlü fotoğraf mozaiği, yüzen header, yumuşak köşeli gölgeli kartlar ve keşif odaklı açık footer.',
  audience: 'Yazlık, sahil ve tatil evi portföyü sunan ofisler',
  theme: 'deniz',
  palette: 'aegean-sand',
  style: {
    hero: 'mosaic',
    headerLayout: 'floating',
    card: 'elevated',
    cardLayout: 'standard',
    footerLayout: 'discovery',
    motion: 'subtle',
    slots: { grid: 'standard', gallery: 'carousel', listingDetail: 'standard', interactions: ['image-reveal'] },
  },
  home: ['hero', 'categories', 'regions', 'latest', 'spotlight', 'contact'],
});
