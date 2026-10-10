import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'kurumsal-portfoy',
  name: 'Kurumsal Portföy',
  description: 'İlan öncelikli vitrin hero, yüzen header, yatay ilan kartları ve rakam şeridi. Yoğun portföy için düzenli bir yapı.',
  audience: 'Çok şubeli, kurumsal ofisler',
  theme: 'grafit',
  palette: 'graphite-teal',
  style: { hero: 'showcase', headerLayout: 'floating', card: 'outline', cardLayout: 'horizontal', footerLayout: 'classic', motion: 'subtle' },
  home: ['hero', 'stats', 'latest', 'categories', 'regions', 'owner_cta', 'contact'],
});
