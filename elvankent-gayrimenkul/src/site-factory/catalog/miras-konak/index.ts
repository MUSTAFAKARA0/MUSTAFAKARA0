import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'miras-konak',
  name: 'Miras Konak',
  description:
    'Geleneksel doku: kemerli görsel kadrajları, çini esinli yıldız deseni, serif başlıklar, ilk ilanı büyük gösteren seçki ve editoryal footer.',
  audience: 'Tarihi doku, konak, yalı ve köklü semt portföyü sunan ofisler',
  theme: 'miras',
  palette: 'iznik-ink',
  style: {
    hero: 'editorial',
    headerLayout: 'classic',
    card: 'outline',
    cardLayout: 'editorial',
    footerLayout: 'editorial',
    motion: 'subtle',
    slots: { grid: 'feature-first', listingDetail: 'immersive', gallery: 'grid', interactions: ['image-reveal'] },
  },
  home: ['hero', 'spotlight', 'regions', 'blog', 'showcase', 'contact'],
});
