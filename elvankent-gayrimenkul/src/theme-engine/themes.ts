import type { CardLayout, CardSurface, FontId, FooterLayout, HeaderLayout, HeroLayout, MotionLevel, ThemeId } from '@/theme-engine/ids';
import type { ThemeInput } from '@/theme-engine/types';

/**
 * Tema kayıt sistemi. Her tema aynı sayfa/veri yapısını farklı SUNUMLA gösterir. Tema
 * yalnızca renk değildir: yazı tipi çifti, başlık ağırlığı ve harf aralığı, köşe
 * yuvarlaklığı, kart, header, hero düzeni, düğme ve footer biçimi, görsel çerçevesi ve
 * "eyebrow" (üst etiket) stili temadan gelir (ayrıntılı farklar globals.css'te
 * [data-site-theme] kurallarıdır). Renkler kiracının seçimidir; her temanın bir
 * ÖNERİLEN paleti vardır (galeride ve "önerilen paletle uygula" seçeneğinde kullanılır).
 *
 * Yeni tema = THEME_IDS'e kimlik + buraya tanım (+ gerekirse CSS kuralları). Tema
 * değişikliği ilanları, CRM'i, kullanıcıları, URL'leri ve SEO verisini değiştirmez.
 */
export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  /** Galeride kısa açıklama */
  description: string;
  /** Hangi ofis için uygun */
  audience: string;
  fonts: { heading: FontId; body: FontId };
  headingWeight: 400 | 500 | 600 | 700;
  /** Köşe yuvarlaklığı ölçeği (Tailwind --radius-* değişkenleri) */
  radius: 'soft' | 'sharp' | 'medium' | 'round';
  card: 'elevated' | 'outline' | 'flat';
  hero: 'overlay' | 'centered' | 'split';
  header: 'light' | 'dark';
  button: 'rounded' | 'pill' | 'square';
  footer: 'dark' | 'light' | 'brand';
  /** Görsel işleme: rounded (varsayılan) · square (köşesiz) · frame (ince çerçeve) · organic (büyük yuvarlak) */
  image: 'rounded' | 'square' | 'frame' | 'organic';
  /** Önerilen renk paleti (palettes.ts kimliği) */
  palette: string;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  klasik: {
    id: 'klasik',
    name: 'Klasik',
    description: 'Serif başlıklar, yumuşak köşeler ve fotoğraf üzerinde arama. Sıcak ve güven veren varsayılan görünüm.',
    audience: 'Yerel ve köklü emlak ofisleri',
    fonts: { heading: 'fraunces', body: 'manrope' },
    headingWeight: 400,
    radius: 'soft',
    card: 'elevated',
    hero: 'overlay',
    header: 'light',
    button: 'rounded',
    footer: 'dark',
    image: 'rounded',
    palette: 'modern-green',
  },
  marble: {
    id: 'marble',
    name: 'Marble',
    description: 'Zarif ve sade: ince çizgiler, keskin köşeler, ortalanmış büyük başlık.',
    audience: 'Butik ve seçkin portföyler',
    fonts: { heading: 'playfair', body: 'inter' },
    headingWeight: 500,
    radius: 'sharp',
    card: 'outline',
    hero: 'centered',
    header: 'light',
    button: 'square',
    footer: 'dark',
    image: 'rounded',
    palette: 'minimal-black',
  },
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    description: 'Modern kurumsal: kalın sans-serif başlıklar, koyu header, bölünmüş kahraman alanı.',
    audience: 'Çok şubeli, kurumsal ofisler',
    fonts: { heading: 'dm-sans', body: 'dm-sans' },
    headingWeight: 700,
    radius: 'medium',
    card: 'flat',
    hero: 'split',
    header: 'dark',
    button: 'rounded',
    footer: 'dark',
    image: 'rounded',
    palette: 'corporate-navy',
  },
  prestij: {
    id: 'prestij',
    name: 'Prestij',
    description: 'Lüks segment için: ince klasik serif, geniş harf aralıklı etiketler, çerçeveli görseller, koyu header.',
    audience: 'Lüks konut ve yüksek segment markalar',
    fonts: { heading: 'cormorant', body: 'inter' },
    headingWeight: 500,
    radius: 'sharp',
    card: 'outline',
    hero: 'centered',
    header: 'dark',
    button: 'square',
    footer: 'dark',
    image: 'frame',
    palette: 'luxury-estate',
  },
  kent: {
    id: 'kent',
    name: 'Kent',
    description: 'Şehirli ve dinamik: grotesk yazı, sıkı başlıklar, blok vurgular, bölünmüş hero, marka renginde footer.',
    audience: 'Şehir merkezi ve ticari gayrimenkul ofisleri',
    fonts: { heading: 'space-grotesk', body: 'inter' },
    headingWeight: 700,
    radius: 'medium',
    card: 'flat',
    hero: 'split',
    header: 'light',
    button: 'square',
    footer: 'brand',
    image: 'square',
    palette: 'modern-urban',
  },
  yalin: {
    id: 'yalin',
    name: 'Yalın',
    description: 'Az ve öz: tek yazı tipi, bol boşluk, köşesiz görseller, çizgisiz kartlar, açık footer.',
    audience: 'Sade ve güçlü marka görünümü isteyen ofisler',
    fonts: { heading: 'inter', body: 'inter' },
    headingWeight: 600,
    radius: 'sharp',
    card: 'flat',
    hero: 'centered',
    header: 'light',
    button: 'pill',
    footer: 'light',
    image: 'square',
    palette: 'minimal-black',
  },
  rezidans: {
    id: 'rezidans',
    name: 'Rezidans',
    description: 'Proje satışı hissi: güçlü serif başlık, derin gölgeli kartlar, fotoğraf odaklı hero, koyu header.',
    audience: 'Proje, rezidans ve yeni konut satışları',
    fonts: { heading: 'playfair', body: 'manrope' },
    headingWeight: 600,
    radius: 'soft',
    card: 'elevated',
    hero: 'overlay',
    header: 'dark',
    button: 'pill',
    footer: 'dark',
    image: 'rounded',
    palette: 'premium-gold',
  },
  doga: {
    id: 'doga',
    name: 'Doğa',
    description: 'Organik ve sıcak: büyük yuvarlak köşeler, yumuşak serif başlık, doğal tonlar, marka renginde footer.',
    audience: 'Villa, arsa ve doğa içi yaşam',
    fonts: { heading: 'lora', body: 'dm-sans' },
    headingWeight: 600,
    radius: 'round',
    card: 'flat',
    hero: 'overlay',
    header: 'light',
    button: 'pill',
    footer: 'brand',
    image: 'organic',
    palette: 'natural-estate',
  },
  dergi: {
    id: 'dergi',
    name: 'Dergi',
    description: 'Editoryal: dergi tipografisi, ince ayırıcı çizgiler, köşesiz görseller, bölünmüş hero, açık footer.',
    audience: 'İçerik, rehber ve bölge yazıları üreten markalar',
    fonts: { heading: 'newsreader', body: 'inter' },
    headingWeight: 500,
    radius: 'sharp',
    card: 'outline',
    hero: 'split',
    header: 'light',
    button: 'square',
    footer: 'light',
    image: 'square',
    palette: 'warm-beige',
  },
  grafit: {
    id: 'grafit',
    name: 'Grafit',
    description: 'Teknolojik ve güçlü: geometrik yazı, koyu header, yüksek kontrast, gölgeli kartlar.',
    audience: 'Yenilikçi, dijital odaklı ofisler',
    fonts: { heading: 'outfit', body: 'inter' },
    headingWeight: 600,
    radius: 'medium',
    card: 'elevated',
    hero: 'split',
    header: 'dark',
    button: 'rounded',
    footer: 'dark',
    image: 'rounded',
    palette: 'graphite-teal',
  },
};

export const THEME_LIST = Object.values(THEMES);

/**
 * Sitenin çözülmüş tasarım manifesti (bileşen kısmı): tema varsayılanı + Tema › Bileşen
 * stilleri ayarları. Site Engine yalnızca bunu okur; katalog (Site Factory) runtime'a girmez.
 * Mevcut temaların varsayılanları (classic/standard/none) bugünkü görünümün aynısıdır.
 */
export interface ResolvedStyle {
  card: CardSurface;
  cardLayout: CardLayout;
  hero: HeroLayout;
  button: ThemeDefinition['button'];
  footer: ThemeDefinition['footer'];
  footerLayout: FooterLayout;
  header: ThemeDefinition['header'];
  headerLayout: HeaderLayout;
  image: ThemeDefinition['image'];
  motion: MotionLevel;
}

export function resolveStyle(config: Pick<ThemeInput, 'theme' | 'style' | 'header'>): ResolvedStyle {
  const theme = THEMES[config.theme];
  return {
    card: config.style.card ?? theme.card,
    cardLayout: config.style.cardLayout ?? 'standard',
    hero: config.style.hero ?? theme.hero,
    button: config.style.button ?? theme.button,
    footer: config.style.footer ?? theme.footer,
    footerLayout: config.style.footerLayout ?? 'classic',
    header: config.header?.style ?? theme.header,
    headerLayout: config.style.headerLayout ?? 'classic',
    image: theme.image,
    motion: config.style.motion ?? 'none',
  };
}
