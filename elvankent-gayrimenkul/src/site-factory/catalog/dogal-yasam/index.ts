import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'dogal-yasam',
  name: 'Doğal Yaşam',
  description: 'Organik köşeler, doğal tonlar, sinematik hero ve iletişim öncelikli footer; belirgin ama ölçülü hareket.',
  audience: 'Villa, arsa ve doğa içi yaşam',
  theme: 'doga',
  palette: 'natural-estate',
  style: { hero: 'cinematic', footerLayout: 'contact', motion: 'expressive' },
  home: ['hero', 'categories', 'spotlight', 'regions', 'process', 'owner_cta', 'contact'],
});
