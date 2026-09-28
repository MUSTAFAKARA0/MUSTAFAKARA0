import 'server-only';
import { cache } from 'react';
import { cookies, draftMode } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { parseSiteConfig, type FeatureOverrides, type SiteConfig, type SiteStatus } from '@/platform/site/schema';
import { PREVIEW_COOKIE, verifyPreviewToken } from '@/platform/site/preview';
import type { Tenant } from '@/platform/tenant/tenant';

/** Kiracı sitesinin o istekteki görünümü */
export interface SiteView {
  config: SiteConfig;
  status: SiteStatus;
  maintenanceMessage: string | null;
  features: SiteFeatures;
  /** Taslak önizleniyor mu (yalnızca geçerli önizleme belirteciyle) */
  preview: boolean;
}

export interface SiteFeatures {
  blog: boolean;
  valuation: boolean;
  whatsapp: boolean;
  favorites: boolean;
  advancedSeo: boolean;
  darkMode: boolean;
}

function siteFeatures(o: FeatureOverrides): SiteFeatures {
  return {
    blog: o.blog ?? true,
    valuation: o.valuation ?? true,
    whatsapp: o.whatsapp ?? true,
    favorites: o.favorites ?? true,
    advancedSeo: o.advanced_seo ?? true,
    darkMode: o.dark_mode ?? false,
  };
}

/** Yalnızca yayındaki sürüm (önizleme çerezine bakmaz): site haritası gibi çıktılar için */
export function publishedSiteView(tenant: Tenant): SiteView {
  return {
    config: parseSiteConfig(tenant.site.published),
    status: tenant.site.status,
    maintenanceMessage: tenant.site.maintenanceMessage,
    features: siteFeatures(tenant.site.overrides),
    preview: false,
  };
}

/**
 * Yayındaki yapılandırma kiracı yüklemesiyle AYNI önbellekli çağrıda gelir (ek sorgu yok).
 * Önizleme: Next draft mode açık VE önizleme çerezi bu kiracıya ait geçerli bir belirteçse
 * taslak okunur (sunucu istemcisiyle, önbelleksiz). Taslak başka hiçbir durumda okunmaz.
 */
export const getSiteView = cache(async (tenant: Tenant): Promise<SiteView> => {
  let raw: unknown = tenant.site.published;
  let preview = false;
  if ((await draftMode()).isEnabled) {
    const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
    if (verifyPreviewToken(token) === tenant.id) {
      const service = createServiceClient();
      const { data } = service ? await service.from('site_configs').select('draft').eq('organization_id', tenant.id).maybeSingle() : { data: null };
      if (data) {
        raw = data.draft;
        preview = true;
      }
    }
  }
  return {
    config: parseSiteConfig(raw),
    status: tenant.site.status,
    maintenanceMessage: tenant.site.maintenanceMessage,
    features: siteFeatures(tenant.site.overrides),
    preview,
  };
});
