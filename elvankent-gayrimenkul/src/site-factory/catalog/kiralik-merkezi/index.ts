import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'kiralik-merkezi',
  name: 'Kiralık Merkezi',
  description:
    'Kiralık odaklı hızlı tarama: sekmeli arama (daha çok ilanı olan tür önce), üst şeritli header, filtre çubuğu ve sıkı satır kartları.',
  audience: 'Kiralık portföyü ağırlıklı ofisler',
  theme: 'kent',
  palette: 'rental-coral',
  style: {
    hero: 'tabbed',
    headerLayout: 'utility',
    card: 'flat',
    cardLayout: 'compact',
    footerLayout: 'classic',
    motion: 'subtle',
    slots: { search: 'map-first', grid: 'standard', listingDetail: 'information-first' },
  },
  home: ['hero', 'latest', 'categories', 'regions', 'process', 'contact'],
});
