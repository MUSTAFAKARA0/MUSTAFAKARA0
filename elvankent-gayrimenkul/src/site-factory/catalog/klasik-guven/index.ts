import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'klasik-guven',
  name: 'Klasik Güven',
  description: 'Fotoğraf üzerinde arama, sıcak serif başlıklar, gölgeli kartlar. Bugünkü varsayılan görünüm.',
  audience: 'Yerel ve köklü emlak ofisleri',
  theme: 'klasik',
  palette: 'modern-green',
  style: {},
  home: ['hero', 'showcase', 'categories', 'latest', 'regions', 'process', 'owner_cta', 'blog', 'contact'],
});
