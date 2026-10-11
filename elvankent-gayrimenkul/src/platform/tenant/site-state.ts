/**
 * Kiracı sitesinin işletim durumu: yayın durumu ve özellik bayrakları (site_configs
 * satırının site_status / feature_overrides sütunları). Site yapılandırma belgesinden
 * (tasarım: tema, menü, bölümler) ayrıdır ve kiracı çözümlemesinin (core) parçasıdır;
 * bu yüzden site-config katmanında değil burada durur. site-config bunları yeniden dışa aktarır.
 */
export const FEATURE_KEYS = ['crm', 'analytics', 'pdf', 'custom_domain', 'blog', 'valuation', 'whatsapp', 'favorites', 'advanced_seo', 'dark_mode'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureOverrides = Partial<Record<FeatureKey, boolean>>;

export function parseFeatureOverrides(raw: unknown): FeatureOverrides {
  const out: FeatureOverrides = {};
  if (raw && typeof raw === 'object') {
    for (const k of FEATURE_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out[k] = v;
    }
  }
  return out;
}

export type SiteStatus = 'active' | 'maintenance' | 'draft';
