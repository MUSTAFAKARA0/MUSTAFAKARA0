import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'sinematik-vitrin',
  name: 'Sinematik Vitrin',
  description: 'Kenardan kenara fotoğraf, büyük tipografi, yüzen arama paneli ve ayrık header; görsel üstü ilan kartları, gerçek veriden rakamlar.',
  audience: 'Proje ve rezidans satışları, yüksek segment portföyler',
  theme: 'rezidans',
  palette: 'premium-gold',
  style: { hero: 'cinematic', headerLayout: 'floating', card: 'bezel', cardLayout: 'overlay', button: 'pill', footerLayout: 'contact', motion: 'subtle' },
  home: ['hero', 'stats', 'showcase', 'categories', 'spotlight', 'latest', 'owner_cta', 'contact'],
});
