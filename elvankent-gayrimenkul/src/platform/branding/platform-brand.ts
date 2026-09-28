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
 * LOGO: KARAY logosu henüz teslim edilmedi. Logo gelene kadar yazı tabanlı marka
 * (wordmark) kullanılır; logo uydurulmaz. Logo dosyası geldiğinde public/platform/
 * klasörüne konur ve aşağıdaki logoUrl / iconUrl alanları doldurulur (platform
 * başlığı, platform girişi ve platform favicon'u otomatik olarak onu kullanır).
 */
export const PLATFORM_BRAND = {
  /** Platform sahibi şirket */
  name: 'KARAY',
  /** Ürün adı (başlıkta şirket adının altında) */
  product: 'Gayrimenkul Platformu',
  /** Platform yönetim alanının adı */
  consoleName: 'Platform yönetimi',
  /** Logo teslim edilince: '/platform/karay-logo.svg' gibi (şimdilik yok → yazı tabanlı marka) */
  logoUrl: null as string | null,
  /** Favicon teslim edilince: '/platform/karay-icon.svg' gibi (şimdilik nötr yer tutucu) */
  iconUrl: '/platform/placeholder-icon.svg',
  /** Platform renkleri (kiracı renklerinden bağımsız). Logo ile birlikte kesinleşecek. */
  primaryColor: '#1f2a44',
  accentColor: '#4a63d9',
  /** Platform arayüz yüzeyleri */
  headerBackground: '#111827',
  pageBackground: '#f3f4f6',
} as const;

/**
 * Platform temasının CSS'i. Seçici, platform kapsayıcısına (ve açılır menüler /
 * diyaloglar body altına taşındığı için, kapsayıcı sayfadayken body'ye) uygulanır;
 * sayfadan ayrılınca hiçbir yeri etkilemez. Başlık yazı tipi de platformda sans-serif
 * olur (kiracıların serif başlık kimliği platformda kullanılmaz).
 */
export const PLATFORM_SCOPE = 'platform-scope';

export function platformThemeCss(): string {
  const selector = `.${PLATFORM_SCOPE},body:has(.${PLATFORM_SCOPE})`;
  return `${themeCss(buildTheme(PLATFORM_BRAND.primaryColor, PLATFORM_BRAND.accentColor), selector)}${selector}{--font-display-face:var(--font-sans-face);--background:${PLATFORM_BRAND.pageBackground};}`;
}
