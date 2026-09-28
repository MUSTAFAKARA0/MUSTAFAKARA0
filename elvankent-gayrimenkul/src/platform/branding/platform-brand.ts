import { buildTheme, themeCss } from '@/platform/branding/theme';

/**
 * Platform sahibinin (KARAY) marka kimliği — platform seviyesinde, kodla gelir.
 *
 * Hiyerarşi:
 *   KARAY (platform sahibi, SaaS altyapı sağlayıcısı)
 *     └─ Kiracılar (müşteri emlak ofisleri): Elvankent Gayrimenkul, …
 *
 * Kiracı markası (logo, renk, şirket bilgisi) organization_settings tablosunda ve
 * yalnızca o kiracının sitesinde / ofis panelinde kullanılır. Bu dosyadaki platform
 * markası ise yalnızca /platform (süper admin) alanında kullanılır. İkisi birbirini
 * etkilemez: kiracı tema değişikliği platformu, platform teması kiracıyı değiştirmez.
 *
 * Logo ve renkler KARAY logo paketinden alınmıştır (public/platform/). Logo dosyaları
 * düzenlenmez, yeniden çizilmez; oranları ve renkleri değiştirilmez (paket kuralları).
 */
export const PLATFORM_BRAND = {
  /** Platform sahibi şirket */
  name: 'KARAY',
  /** Resmî slogan (sloganlı logoda da yer alır) */
  product: 'Gayrimenkul Teknolojileri',
  /** Platform yönetim alanının adı */
  consoleName: 'Platform yönetimi',
  logos: {
    /** Açık zemin, sloganlı (ana versiyon; en küçük genişlik 200 px) */
    light: '/platform/karay-logo-yatay.svg',
    /** Koyu zemin, sloganlı */
    dark: '/platform/karay-logo-yatay-koyu-zemin.svg',
    /** Açık zemin, slogansız (küçük alanlar; en küçük genişlik 110 px) */
    lightCompact: '/platform/karay-logo-yatay-sade.svg',
    /** Koyu zemin, slogansız */
    darkCompact: '/platform/karay-logo-yatay-sade-koyu-zemin.svg',
  },
  /** Logo en-boy oranı (SVG viewBox 718.57 × 192) */
  logoAspect: 718.57 / 192,
  icons: {
    ico: '/platform/favicon.ico',
    svg: '/platform/favicon.svg',
    apple: '/platform/apple-touch-icon.png',
  },
  /** Paket renkleri: KARAY Lacivert, Sinyal Mavisi, Turkuaz, Arduvaz, Bulut */
  colors: { navy: '#0b1b3a', signal: '#2f6bff', turquoise: '#1cc8b6', slate: '#5b6b85', cloud: '#f4f7fb' },
  /** Tema: butonlar lacivert, vurgu sinyal mavisi */
  primaryColor: '#0b1b3a',
  accentColor: '#2f6bff',
  headerBackground: '#0b1b3a',
  pageBackground: '#f4f7fb',
} as const;

/**
 * Platform temasının CSS'i. Seçici, platform kapsayıcısına (ve açılır menüler /
 * diyaloglar body altına taşındığı için, kapsayıcı sayfadayken body'ye) uygulanır;
 * sayfadan ayrılınca hiçbir yeri etkilemez. Yazı tipi platformda Poppins'tir
 * (kiracıların yazı tipleri platformda kullanılmaz).
 */
export const PLATFORM_SCOPE = 'platform-scope';

export function platformThemeCss(fontFamily: string): string {
  const selector = `.${PLATFORM_SCOPE},body:has(.${PLATFORM_SCOPE})`;
  const font = fontFamily.replace(/[^\w\s,'"-]/g, '');
  return `${themeCss(buildTheme(PLATFORM_BRAND.primaryColor, PLATFORM_BRAND.accentColor), selector)}${selector}{--font-sans-face:${font};--font-display-face:${font};--background:${PLATFORM_BRAND.pageBackground};}`;
}
