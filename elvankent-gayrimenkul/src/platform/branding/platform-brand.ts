import { buildTheme, themeCss } from '@/platform/branding/theme';

/**
 * Platform sahibinin (KARAYS) marka kimliği — platform seviyesinde, kodla gelir.
 *
 * Hiyerarşi:
 *   KARAYS (platform sahibi, SaaS altyapı sağlayıcısı)
 *     └─ Kiracılar (müşteri emlak ofisleri): her biri kendi markası ve alan adıyla
 *
 * Kiracı markası (logo, renk, şirket bilgisi) organization_settings tablosunda ve
 * yalnızca o kiracının sitesinde / ofis panelinde kullanılır. Bu dosyadaki platform
 * markası ise yalnızca /platform (süper admin) alanında kullanılır. İkisi birbirini
 * etkilemez: kiracı tema değişikliği platformu, platform teması kiracıyı değiştirmez.
 *
 * Görünen ad KARAYS'tır (eski adı KARAY). Görseller onaylı KARAYS paketindendir (K-16; dosyalar
 * VARLIK_LISTESI.json ile doğrulandı ve değiştirilmeden kopyalandı):
 *  - Sayfada çizilen logo, amblem ve maskotlar src/platform/branding/assets/ altındadır; bileşenler
 *    onları statik import eder (next/image boyutlandırır, değişmez önbellekle /_next/static/media'dan
 *    sunar; bu yol proxy'den geçmez).
 *  - Sabit adresle istenen dosyalar burada: sekme ve ana ekran simgeleri public/brand/karays/,
 *    paylaşım görseli public/karay/ altında. Simgeler /platform altında tutulmaz: o yol konsol
 *    rotasıdır ve proxy oturumsuz isteği giriş sayfasına yönlendirir (K-15).
 * Logo yeniden çizilmez, oranı ve renkleri değiştirilmez. Yazısı koyu lacivert ve pakette beyaz logo
 * yok: koyu zeminde açık bir plaka üzerinde gösterilir (PlatformWordmark). /karay rotası, KARAY_HOSTS,
 * veritabanı ve kod adları teknik kimliktir; marka geçişinde değişmez.
 */
export const PLATFORM_BRAND = {
  /** Platform sahibi şirket */
  name: 'KARAYS',
  /** Resmî slogan */
  product: 'Gayrimenkul Teknolojileri',
  /** Platform yönetim alanının adı */
  consoleName: 'Platform yönetimi',
  icons: {
    /** 64 × 64 sekme simgesi (01_LOGOLAR/favicon.ico) */
    ico: '/brand/karays/favicon.ico',
    /** 192 × 192 PNG simge */
    png: '/brand/karays/karays-icon-192.png',
    /** 180 × 180 ana ekran simgesi (apple-touch-icon) */
    apple: '/brand/karays/karays-icon-180.png',
    /** 512 × 512 uygulama simgesi (KARAYS sayfasının yapılandırılmış verisindeki logo) */
    app: '/brand/karays/karays-icon-512.png',
  },
  /**
   * Paylaşım (Open Graph) görseli, 1200 × 630. Pakette paylaşım görseli olmadığından onaylı yatay logo
   * ile KARO açık bir zemine, oranları korunarak yerleştirildi (yeni çizim veya yazı eklenmedi).
   * /karay altındadır: yalnızca KARAYS sayfasının sunulduğu adreslerde açılır (kiracı adresinde 404).
   */
  ogImage: { url: '/karay/og-karays.png', width: 1200, height: 630 },
  /** Platform renkleri: lacivert, sinyal mavisi, turkuaz, arduvaz, bulut */
  colors: { navy: '#0b1b3a', signal: '#2f6bff', turquoise: '#1cc8b6', slate: '#5b6b85', cloud: '#f4f7fb' },
  /** Tema: butonlar lacivert, vurgu sinyal mavisi */
  primaryColor: '#0b1b3a',
  accentColor: '#2f6bff',
  headerBackground: '#0b1b3a',
  pageBackground: '#f4f7fb',
} as const;

/**
 * Platform temasının CSS'i. Seçici, platform kapsayıcısına (ve açılır menüler /
 * diyaloglar body altına taşındığı için, kapsayıcı sayfadayken belge köküne) uygulanır.
 * Kök gerekir: `--font-sans` gibi türetilmiş değişkenler :root'ta çözülür, body'de
 * verilen `--font-sans-face` portallara ulaşmaz;
 * sayfadan ayrılınca hiçbir yeri etkilemez. Yazı tipi platformda Poppins'tir
 * (kiracıların yazı tipleri platformda kullanılmaz).
 */
export const PLATFORM_SCOPE = 'platform-scope';

export function platformThemeCss(fontFamily: string): string {
  const selector = `.${PLATFORM_SCOPE},:root:has(.${PLATFORM_SCOPE})`;
  const font = fontFamily.replace(/[^\w\s,'"-]/g, '');
  return `${themeCss(buildTheme(PLATFORM_BRAND.primaryColor, PLATFORM_BRAND.accentColor), selector)}${selector}{--font-sans-face:${font};--font-display-face:${font};--background:${PLATFORM_BRAND.pageBackground};}`;
}
