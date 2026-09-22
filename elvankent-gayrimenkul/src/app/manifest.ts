import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Elvankent Gayrimenkul',
    short_name: 'Elvankent',
    description: 'Satılık ve kiralık konut, iş yeri ve arsa ilanları',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#0e4d45',
    lang: 'tr',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
