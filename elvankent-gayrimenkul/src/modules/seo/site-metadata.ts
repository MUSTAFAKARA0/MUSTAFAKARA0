import type { Metadata } from 'next';
import { brandingUrl } from '@/modules/media/variants';
import { baseOpenGraph, siteOgImage } from '@/modules/seo/og';
import type { SeoConfig } from '@/site-config/schema';
import type { OrgSettings } from '@/platform/tenant/tenant';

/**
 * SİTE GENELİ METADATA — tek, saf (veri → Metadata) üretici. Veritabanı, oturum veya istek
 * okumaz. Yayın ve önizleme AYNI fonksiyonu kullanır; fark yalnızca verilen verinin kaynağıdır:
 *
 *   yayın     → organization_settings (canlı) + site_configs.published.seo
 *   önizleme  → aynı ayarların üzerine taslak marka (withPreviewBrand) + site_configs.draft.seo
 *
 * Başlık / açıklama TEK kaynaktan gelir (seo bölümü); eski organization_settings.seo_* sütunları
 * P0.3 migration'ıyla seo bölümüne taşındı ve artık okunmaz. Sayfalar kanonik adresi göreli yazar;
 * metadataBase kiracının çözümlenmiş adresidir (alan adı / alt alan adı; sabit alan adı yok).
 */
export interface SiteMetadataInput {
  settings: Pick<OrgSettings, 'display_name' | 'description' | 'service_area' | 'favicon_url' | 'og_image_url' | 'google_site_verification' | 'updated_at'>;
  seo: Pick<SeoConfig, 'title' | 'description' | 'robots'>;
  /** Kiracının kanonik kök adresi (tenant.baseUrl) */
  baseUrl: string;
  /** Ortam arama motorlarına açık mı (demo/önizleme dağıtımı kapalıdır) */
  indexable: boolean;
  /** Site yayında mı (bakım / yayında değil → noindex) */
  active: boolean;
  /** İmzalı taslak önizlemesi (her zaman noindex) */
  preview: boolean;
  /** Ortam düzeyindeki yedek doğrulama kodu */
  envVerification?: string | null;
}

export function siteTitle(i: Pick<SiteMetadataInput, 'settings' | 'seo'>): string {
  return i.seo.title ?? `${i.settings.display_name} | Satılık ve kiralık gayrimenkuller`;
}

export function siteDescription(i: Pick<SiteMetadataInput, 'settings' | 'seo'>): string {
  const s = i.settings;
  return i.seo.description ?? s.description ?? `${s.display_name}: ${s.service_area ? `${s.service_area} ` : ''}satılık ve kiralık daire, villa, ticari gayrimenkul ve arsa ilanları.`;
}

/** Önizleme ve taslak sayfaları her koşulda arama motorlarına kapalıdır */
export function siteNoindex(i: Pick<SiteMetadataInput, 'indexable' | 'active' | 'preview' | 'seo'>): boolean {
  return i.preview || !i.indexable || !i.active || i.seo.robots === 'noindex';
}

export function buildSiteMetadata(i: SiteMetadataInput): Metadata {
  const s = i.settings;
  const name = s.display_name;
  const title = siteTitle(i);
  const description = siteDescription(i);
  const og = siteOgImage({ settings: s as never }, i.preview);
  const favicon = brandingUrl(s.favicon_url);
  const verification = s.google_site_verification ?? i.envVerification ?? undefined;
  return {
    metadataBase: new URL(i.baseUrl),
    title: { default: title, template: `%s | ${name}` },
    description,
    applicationName: name,
    // Kanonik adres ve og:url sayfa düzeyindedir (düzende verilirse alt sayfalara yanlış miras kalır)
    openGraph: { type: 'website', ...baseOpenGraph({ settings: s as never }), title, description, images: [og] },
    twitter: { card: 'summary_large_image', title, description, images: [og] },
    manifest: '/manifest.webmanifest',
    ...(siteNoindex(i) ? { robots: { index: false, follow: false } } : {}),
    // Ofisin yüklediği simge; yoksa ofis adından ve renginden üretilen otomatik simge
    icons: favicon ? { icon: favicon, apple: favicon } : { icon: { url: '/site-icon', type: 'image/svg+xml' }, apple: '/site-icon/apple' },
    ...(verification && !i.preview ? { verification: { google: verification } } : {}),
  };
}
