import type { ThemeId } from '@/theme-engine/ids';
import type { StyleConfig, TypographyConfig } from '@/theme-engine/settings';
import type { HomeSectionType } from '@/site-config/schema';

/**
 * SITE FACTORY — KARAY'ın iç tasarım üretim kataloğu.
 *
 * Bir "tasarım ailesi", parçaların (tema karakteri, renk sistemi, hero, header, ilan kartı,
 * footer, hareket dili ve ana sayfa kompozisyonu) önceden düşünülmüş bir birleşimidir. Aile
 * müşteriye gösterilen bir ayar değildir: KARAY süper admini yeni bir site kurarken seçer,
 * derleyici (compile.ts) seçimi sitenin yapılandırmasına (manifest) yazar.
 *
 * Bu katalog MÜŞTERİ SİTESİNİN ÇALIŞMA ZAMANINA GİRMEZ: Site Engine bu modülü içe aktaramaz
 * (ESLint kuralı + tests/unit/boundaries.test.mjs). Yayındaki site yalnızca kendi manifestini
 * okur ("ben hangi aileden geldim" diye karar vermez); yeni bir aile eklemek mevcut hiçbir
 * kiracının sayfasını değiştirmez.
 *
 * Yeni aile = buraya veri. Yeni bir PARÇA (ör. yeni hero düzeni) = Theme Engine'de kimlik +
 * Site Engine'de bileşen/CSS parçası; seçilmeyen sitelere yine hiçbir şey gitmez.
 */
export interface DesignFamily {
  id: string;
  name: string;
  /** Kısa tasarım dili açıklaması */
  description: string;
  /** Hangi ofis için uygun */
  audience: string;
  theme: ThemeId;
  /** Renk sistemi: Theme Engine paleti (palettes.ts) */
  palette: string;
  /** Yapısal parçalar (boş alan = temanın varsayılanı) */
  style: StyleConfig;
  /** Tipografi sistemi (boş = temanın yazı tipi çifti ve ağırlığı) */
  typography?: TypographyConfig;
  /** Ana sayfa kompozisyonu (tema ≠ sayfa: aynı tema farklı kompozisyonla kullanılabilir) */
  home: HomeSectionType[];
}

export const DESIGN_FAMILIES: readonly DesignFamily[] = [
  {
    id: 'klasik-guven',
    name: 'Klasik Güven',
    description: 'Fotoğraf üzerinde arama, sıcak serif başlıklar, gölgeli kartlar. Bugünkü varsayılan görünüm.',
    audience: 'Yerel ve köklü emlak ofisleri',
    theme: 'klasik',
    palette: 'modern-green',
    style: {},
    home: ['hero', 'showcase', 'categories', 'latest', 'regions', 'process', 'owner_cta', 'blog', 'contact'],
  },
  {
    id: 'sinematik-vitrin',
    name: 'Sinematik Vitrin',
    description: 'Kenardan kenara fotoğraf, büyük tipografi, yüzen arama paneli ve ayrık header; görsel üstü ilan kartları, gerçek veriden rakamlar.',
    audience: 'Proje ve rezidans satışları, yüksek segment portföyler',
    theme: 'rezidans',
    palette: 'premium-gold',
    style: { hero: 'cinematic', headerLayout: 'floating', card: 'bezel', cardLayout: 'overlay', button: 'pill', footerLayout: 'contact', motion: 'subtle' },
    home: ['hero', 'stats', 'showcase', 'categories', 'spotlight', 'latest', 'owner_cta', 'contact'],
  },
  {
    id: 'editoryal-luks',
    name: 'Editoryal Lüks',
    description: 'Dergi düzeni: asimetrik hero, ortalı logolu header, kutusuz editoryal kartlar, seçilmiş ilan sayfası ve sade footer.',
    audience: 'Butik ve lüks konut markaları',
    theme: 'prestij',
    palette: 'luxury-estate',
    style: { hero: 'editorial', headerLayout: 'centered', cardLayout: 'editorial', footerLayout: 'minimal', motion: 'subtle' },
    home: ['hero', 'spotlight', 'latest', 'regions', 'blog', 'contact'],
  },
  {
    id: 'kurumsal-portfoy',
    name: 'Kurumsal Portföy',
    description: 'İlan öncelikli vitrin hero, yüzen header, yatay ilan kartları ve rakam şeridi. Yoğun portföy için düzenli bir yapı.',
    audience: 'Çok şubeli, kurumsal ofisler',
    theme: 'grafit',
    palette: 'graphite-teal',
    style: { hero: 'showcase', headerLayout: 'floating', card: 'outline', cardLayout: 'horizontal', footerLayout: 'classic', motion: 'subtle' },
    home: ['hero', 'stats', 'latest', 'categories', 'regions', 'owner_cta', 'contact'],
  },
  {
    id: 'yalin-galeri',
    name: 'Yalın Galeri',
    description: 'Bol boşluk, tek yazı ailesi, editoryal kartlar ve köşesiz görseller. Hareket yok; içerik ve fotoğraf öne çıkar.',
    audience: 'Sade ve güçlü marka görünümü isteyen ofisler',
    theme: 'yalin',
    palette: 'minimal-black',
    style: { hero: 'editorial', cardLayout: 'editorial', footerLayout: 'minimal', motion: 'none' },
    home: ['hero', 'latest', 'spotlight', 'regions', 'contact'],
  },
  {
    id: 'dogal-yasam',
    name: 'Doğal Yaşam',
    description: 'Organik köşeler, doğal tonlar, sinematik hero ve iletişim öncelikli footer; belirgin ama ölçülü hareket.',
    audience: 'Villa, arsa ve doğa içi yaşam',
    theme: 'doga',
    palette: 'natural-estate',
    style: { hero: 'cinematic', footerLayout: 'contact', motion: 'expressive' },
    home: ['hero', 'categories', 'spotlight', 'regions', 'process', 'owner_cta', 'contact'],
  },
];

export function findDesignFamily(id: string): DesignFamily | null {
  return DESIGN_FAMILIES.find((f) => f.id === id) ?? null;
}

const PART_LABELS: Record<string, Record<string, string>> = {
  hero: { overlay: 'Fotoğraf üstü hero', centered: 'Ortalı hero', split: 'Bölünmüş hero', cinematic: 'Sinematik hero', editorial: 'Editoryal hero', showcase: 'Vitrin hero' },
  headerLayout: { classic: 'Klasik header', centered: 'Ortalı logo', floating: 'Yüzen header' },
  cardLayout: { standard: 'Standart kart', overlay: 'Görsel üstü kart', editorial: 'Editoryal kart', horizontal: 'Yatay kart' },
  footerLayout: { classic: 'Sütunlu footer', contact: 'İletişim öncelikli footer', minimal: 'Minimal footer' },
  motion: { none: 'Hareketsiz', subtle: 'Ölçülü hareket', expressive: 'Belirgin hareket' },
};

/** Ailenin parçalarının kısa adları (Site Builder kartlarında) */
export function familyParts(f: DesignFamily, resolved: Record<'hero' | 'headerLayout' | 'cardLayout' | 'footerLayout' | 'motion', string>): string[] {
  return (['hero', 'headerLayout', 'cardLayout', 'footerLayout', 'motion'] as const).map((k) => PART_LABELS[k][resolved[k]] ?? resolved[k]).concat(`${f.home.length} bölüm`);
}
