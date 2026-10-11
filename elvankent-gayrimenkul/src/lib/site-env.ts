/**
 * Dağıtım ortamı. Arama motoru dizinlemesi ve "DEMO" uyarıları buna göre
 * belirlenir; yanlışlıkla demo/önizleme sitesinin Google'a girmesini önler.
 *
 * SITE_ENV açıkça verilmezse Vercel'in VERCEL_ENV değeri kullanılır:
 *   production → production, preview → preview, diğerleri → development.
 * Demo projesi için Vercel'de SITE_ENV=demo tanımlanır.
 */
export type SiteEnv = 'production' | 'demo' | 'preview' | 'development';

export function siteEnv(): SiteEnv {
  const explicit = (process.env.SITE_ENV ?? '').toLowerCase();
  if (explicit === 'production' || explicit === 'demo' || explicit === 'preview' || explicit === 'development') return explicit;
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

/** Yalnızca production sitesi arama motorlarına açıktır. */
export function isIndexable(): boolean {
  return siteEnv() === 'production';
}

/** Ziyaretçiye ve panele "bu bir demo" şeridi gösterilir mi? */
export function showsDemoNotice(): boolean {
  const env = siteEnv();
  return env === 'demo' || env === 'preview';
}
