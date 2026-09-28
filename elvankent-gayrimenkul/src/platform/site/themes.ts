import type { FontId, ThemeId } from '@/platform/site/schema';

/**
 * Tema kayıt sistemi. Her tema aynı sayfa/veri yapısını farklı SUNUMLA gösterir:
 * yazı tipleri, köşe yuvarlaklığı, kart stili, header ve ana sayfa kahraman (hero)
 * düzeni. Yeni tema = bu listeye bir tanım (+ gerekirse CSS'te [data-site-theme]
 * kuralları). Tema değişikliği ilanları, CRM'i, kullanıcıları, URL'leri ve SEO
 * verisini değiştirmez.
 */
export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  fonts: { heading: FontId; body: FontId };
  headingWeight: 400 | 500 | 600 | 700;
  /** Köşe yuvarlaklığı ölçeği (Tailwind --radius-* değişkenleri) */
  radius: 'soft' | 'sharp' | 'medium';
  /** Kart görünümü */
  card: 'elevated' | 'outline' | 'flat';
  /** Ana sayfa kahraman düzeni */
  hero: 'overlay' | 'centered' | 'split';
  /** Varsayılan header stili (Header ayarından değiştirilebilir) */
  header: 'light' | 'dark';
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  klasik: {
    id: 'klasik',
    name: 'Klasik',
    description: 'Serif başlıklar, yumuşak köşeler, fotoğraf üzerinde arama. Mevcut görünüm.',
    fonts: { heading: 'fraunces', body: 'manrope' },
    headingWeight: 400,
    radius: 'soft',
    card: 'elevated',
    hero: 'overlay',
    header: 'light',
  },
  marble: {
    id: 'marble',
    name: 'Marble',
    description: 'Zarif ve sade: ince çizgiler, keskin köşeler, ortalanmış büyük başlık.',
    fonts: { heading: 'playfair', body: 'inter' },
    headingWeight: 500,
    radius: 'sharp',
    card: 'outline',
    hero: 'centered',
    header: 'light',
  },
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    description: 'Modern kurumsal: kalın sans-serif başlıklar, koyu header, bölünmüş kahraman alanı.',
    fonts: { heading: 'dm-sans', body: 'dm-sans' },
    headingWeight: 700,
    radius: 'medium',
    card: 'flat',
    hero: 'split',
    header: 'dark',
  },
};

export const THEME_LIST = Object.values(THEMES);
