import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'plaza-ofis',
  name: 'Plaza Ofis',
  description:
    'Portal düzeni: marka bantlı sekmeli arama kartı, gerçek sayı şeridi, ızgaralı header, sıkı satır ilan kartları ve künye öncelikli detay.',
  audience: 'Ticari gayrimenkul: ofis, dükkan ve depo portföyleri',
  theme: 'plaza',
  palette: 'steel-glass',
  style: {
    hero: 'tabbed',
    headerLayout: 'structured',
    card: 'flat',
    cardLayout: 'compact',
    footerLayout: 'structured',
    motion: 'subtle',
    slots: { grid: 'standard', listingDetail: 'information-first', gallery: 'grid' },
  },
  home: ['hero', 'stats', 'categories', 'latest', 'regions', 'owner_cta', 'contact'],
});
