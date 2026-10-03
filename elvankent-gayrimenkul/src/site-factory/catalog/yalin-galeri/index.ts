import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'yalin-galeri',
  name: 'Yalın Galeri',
  description: 'Bol boşluk, tek yazı ailesi, editoryal kartlar ve köşesiz görseller. Hareket yok; içerik ve fotoğraf öne çıkar.',
  audience: 'Sade ve güçlü marka görünümü isteyen ofisler',
  theme: 'yalin',
  palette: 'minimal-black',
  style: { hero: 'editorial', cardLayout: 'editorial', footerLayout: 'minimal', motion: 'none' },
  home: ['hero', 'latest', 'spotlight', 'regions', 'contact'],
});
