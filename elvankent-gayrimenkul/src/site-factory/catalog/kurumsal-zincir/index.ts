import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'kurumsal-zincir',
  name: 'Kurumsal Zincir',
  description:
    'Kurumsal ağ görünümü: bölünmüş hero, telefon ve çalışma saatli üst şerit, düz kartlar ve marka çağrı bantlı dört sütunlu footer.',
  audience: 'Kurumsal ve düzenli bir marka görünümü isteyen ofisler',
  theme: 'atlas',
  palette: 'franchise-crimson',
  typography: { heading: 'dm-sans', body: 'inter' },
  style: {
    hero: 'split',
    headerLayout: 'utility',
    card: 'flat',
    cardLayout: 'standard',
    footerLayout: 'band',
    motion: 'subtle',
    slots: { grid: 'standard', listingDetail: 'standard', gallery: 'grid' },
  },
  home: ['hero', 'stats', 'regions', 'latest', 'owner_cta', 'blog', 'contact'],
});
