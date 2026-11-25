import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'butik-ofis',
  name: 'Butik Ofis',
  description:
    'Az ama seçkin portföy: ortalı hero ve logo, çizgili editoryal kartlar, ilk ilanı büyük gösteren seçki ve sade footer.',
  audience: 'Seçkin portföy sunan, kişisel danışmanlık veren butik ofisler',
  theme: 'marble',
  palette: 'warm-beige',
  style: {
    hero: 'centered',
    headerLayout: 'centered',
    card: 'outline',
    cardLayout: 'editorial',
    footerLayout: 'minimal',
    motion: 'subtle',
    slots: { grid: 'feature-first', listingDetail: 'standard', gallery: 'grid' },
  },
  home: ['hero', 'spotlight', 'latest', 'text', 'contact'],
});
