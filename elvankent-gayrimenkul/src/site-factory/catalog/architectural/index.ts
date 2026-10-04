import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'architectural',
  name: 'Architectural',
  description:
    'Mimari ve kurumsal: 12 sütunlu ızgara, numaralı portföy dizini, çizgilerle bölünmüş ilan listesi, teknik künye öncelikli ilan detayı ve numaralı düzenli galeri.',
  audience: 'Kurumsal portföy, ticari gayrimenkul ve proje ofisleri',
  theme: 'kent',
  palette: 'minimal-black',
  typography: { heading: 'space-grotesk', body: 'inter' },
  style: {
    hero: 'blueprint',
    headerLayout: 'classic',
    card: 'outline',
    cardLayout: 'standard',
    footerLayout: 'classic',
    motion: 'none',
    slots: { grid: 'ruled-index', listingDetail: 'information-first', gallery: 'grid' },
  },
  home: ['hero', 'stats', 'latest', 'categories', 'process', 'contact'],
});
