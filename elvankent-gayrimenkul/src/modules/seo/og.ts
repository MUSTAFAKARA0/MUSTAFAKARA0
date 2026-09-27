import { brandingUrl } from '@/modules/media/variants';
import type { Tenant } from '@/platform/tenant/tenant';

export interface OgImageRef {
  url: string;
  width: number;
  height: number;
  alt: string;
}

function version(value: string | null | undefined): string {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time.toString(36) : '0';
}

/**
 * Sitenin paylaşım görseli: yönetim panelinden yüklenen görsel varsa o,
 * yoksa dinamik üretilen marka görseli (/og). Sürüm parametresi ayarlar
 * değiştiğinde önbelleği boşaltır.
 */
export function siteOgImage(tenant: Tenant): OgImageRef {
  const custom = brandingUrl(tenant.settings.og_image_url);
  return {
    url: custom ?? `/og?v=${version(tenant.settings.updated_at)}`,
    width: 1200,
    height: 630,
    alt: tenant.settings.display_name,
  };
}

/** İlan paylaşım görseli: kapak fotoğrafı + başlık + fiyat (/ilan/{slug}/og) */
export function listingOgImage(p: { slug: string; title: string; updatedAt: string }): OgImageRef {
  return { url: `/ilan/${p.slug}/og?v=${version(p.updatedAt)}`, width: 1200, height: 630, alt: p.title };
}

/** Sayfa düzeyindeki openGraph nesnesi yerleşimdekini tamamen değiştirdiği için ortak alanlar */
export function baseOpenGraph(tenant: Tenant) {
  return { locale: 'tr_TR', siteName: tenant.settings.display_name } as const;
}
