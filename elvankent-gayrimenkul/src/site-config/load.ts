import 'server-only';
import { cache } from 'react';
import { cookies, draftMode } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { parseSiteConfig, type FeatureOverrides, type SiteConfig, type SiteStatus } from '@/site-config/schema';
import { PREVIEW_COOKIE, verifyPreviewToken } from '@/site-config/preview';
import { applyBrandDraft, hasBrandDraft } from '@/site-config/brand';
import { requireTenant, type Tenant } from '@/platform/tenant/tenant';
import { resolveStyle, type ResolvedStyle } from '@/theme-engine/themes';

/** Kiracı sitesinin o istekteki görünümü */
export interface SiteView {
  config: SiteConfig;
  status: SiteStatus;
  maintenanceMessage: string | null;
  features: SiteFeatures;
  /** Theme Engine'in çözdüğü bileşen biçimleri (header, hero, kart, düğme, footer): Site Engine bunları yalnızca okur */
  style: ResolvedStyle;
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
  const config = parseSiteConfig(tenant.site.published);
  return {
    config,
    style: resolveStyle(config),
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
/** Önizleme açıksa bu kiracının taslağı (istek başına bir kez; kiracı kimliğine göre tekilleştirilir) */
const loadPreviewDraft = cache(async (orgId: string): Promise<unknown | null> => {
  let enabled = false;
  try {
    enabled = (await draftMode()).isEnabled;
  } catch {
    return null; // istek bağlamı yok (derleme)
  }
  if (!enabled) return null;
  const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (verifyPreviewToken(token) !== orgId) return null;
  const service = createServiceClient();
  const { data } = service ? await service.from('site_configs').select('draft').eq('organization_id', orgId).maybeSingle() : { data: null };
  return data ? data.draft : null;
});

/**
 * Önizlemede taslaktaki marka değişiklikleri (logo, ad, iletişim, renk) kiracı ayarlarının
 * üzerine bindirilir; önizleme yoksa kiracı aynen döner (ek sorgu yok).
 */
export async function withPreviewBrand(tenant: Tenant): Promise<Tenant> {
  const draft = await loadPreviewDraft(tenant.id);
  if (!draft) return tenant;
  const brand = parseSiteConfig(draft).brand;
  if (!hasBrandDraft(brand)) return tenant;
  return { ...tenant, settings: applyBrandDraft(tenant.settings, brand) };
}

/**
 * Kiracı sitesi sayfaları için kiracı: yoksa / askıdaysa 404; KARAY önizlemesi açıksa
 * taslak marka üste bindirilir (yalnızca o tarayıcıda).
 */
export async function requireSiteTenant(rawKey: string): Promise<Tenant> {
  return withPreviewBrand(await requireTenant(rawKey));
}

export const getSiteView = cache(async (tenant: Tenant): Promise<SiteView> => {
  const draft = await loadPreviewDraft(tenant.id);
  const raw: unknown = draft ?? tenant.site.published;
  const preview = draft !== null;
  const config = parseSiteConfig(raw);
  return {
    config,
    style: resolveStyle(config),
    status: tenant.site.status,
    maintenanceMessage: tenant.site.maintenanceMessage,
    features: siteFeatures(tenant.site.overrides),
    preview,
  };
});
