import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'map-first',
  name: 'Map First',
  description:
    'Harita merkezli keşif: arama öncelikli giriş ve bölge dizini, filtre + bölge kısayolları, masaüstünde liste ↔ harita yan yana (telefonda geçiş), konum bağlamı öncelikli ilan detayı.',
  audience: 'Yoğun portföylü, şehir içi ve yatırım odaklı ofisler',
  theme: 'atlas',
  palette: 'corporate-navy',
  typography: { heading: 'dm-sans', body: 'inter' },
  style: {
    hero: 'map-search',
    headerLayout: 'classic',
    card: 'outline',
    cardLayout: 'standard',
    footerLayout: 'contact',
    motion: 'none',
    slots: { search: 'map-first', grid: 'map-results', listingDetail: 'map-first', gallery: 'carousel', mapList: 'map-first' },
  },
  home: ['hero', 'latest', 'regions', 'categories', 'contact'],
});
