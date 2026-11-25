import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'arsa-tarla',
  name: 'Arsa & Tarla',
  description:
    'Harita ve parsel dili: arama + bölge dizini, bölge kısayollu filtre, numaralı ilan dizini, çizgili yatay kartlar ve konum öncelikli ilan detayı.',
  audience: 'Arsa, tarla, bağ ve bahçe portföyü sunan ofisler',
  theme: 'tarla',
  palette: 'field-earth',
  style: {
    hero: 'map-search',
    headerLayout: 'classic',
    card: 'outline',
    cardLayout: 'horizontal',
    footerLayout: 'structured',
    motion: 'subtle',
    slots: { search: 'map-first', grid: 'ruled-index', listingDetail: 'map-first', gallery: 'grid' },
  },
  home: ['hero', 'regions', 'latest', 'categories', 'process', 'contact'],
});
