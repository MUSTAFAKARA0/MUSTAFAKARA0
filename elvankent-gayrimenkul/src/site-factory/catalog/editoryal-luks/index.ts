import { defineFamily } from '@/site-factory/types';

// Tasarım ailesi paketi: yalnızca veri. Sözleşme: src/site-factory/catalog/index.ts
export default defineFamily({
  id: 'editoryal-luks',
  name: 'Editoryal Lüks',
  description: 'Dergi düzeni: asimetrik hero, ortalı logolu header, kutusuz editoryal kartlar, seçilmiş ilan sayfası ve sade footer.',
  audience: 'Butik ve lüks konut markaları',
  theme: 'prestij',
  palette: 'luxury-estate',
  style: { hero: 'editorial', headerLayout: 'centered', cardLayout: 'editorial', footerLayout: 'minimal', motion: 'subtle' },
  home: ['hero', 'spotlight', 'latest', 'regions', 'blog', 'contact'],
});
