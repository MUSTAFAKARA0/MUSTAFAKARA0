import type { ThemeId } from '@/theme-engine/ids';
import type { StyleConfig, TypographyConfig } from '@/theme-engine/settings';
import type { FeatureKey, HomeSectionType, PageKey } from '@/site-config/schema';

/**
 * SITE FACTORY sözleşmeleri (yalnızca tipler). Katalog bu tiplere uyan VERİDİR; kod değildir.
 *
 *   Site tipi      → İÇERİK ve ÖZELLİK mimarisi (hangi bölümler/sayfalar/özellikler)
 *   Tasarım ailesi → GÖRSEL dil (tema, renk, tipografi, parçalar, bölüm sırası ve vurgusu)
 *
 * İkisi birbirinden bağımsız seçilir ve compileManifest() ile sitenin manifestine derlenir.
 */

/** Ana sayfa kompozisyonu: ailenin bölüm sırasına uygulanan önceden tanımlı vurgu */
export const HOMEPAGE_COMPOSITIONS = ['family', 'featured-first', 'listings-first'] as const;
export type HomepageComposition = (typeof HOMEPAGE_COMPOSITIONS)[number];

export interface DesignFamily {
  /** Kimlik = katalog klasörünün adı (src/site-factory/catalog/<id>/) */
  id: string;
  name: string;
  /** Kısa tasarım dili açıklaması */
  description: string;
  /** Hangi ofis için uygun */
  audience: string;
  theme: ThemeId;
  /** Renk sistemi: Theme Engine paleti (palettes.ts) */
  palette: string;
  /** Yapısal parçalar (boş alan = temanın varsayılanı) */
  style: Omit<StyleConfig, 'origin'>;
  /** Tipografi sistemi (boş = temanın yazı tipi çifti ve ağırlığı) */
  typography?: TypographyConfig;
  /** Ana sayfa kompozisyonu (tema ≠ sayfa: aynı tema farklı kompozisyonla kullanılabilir) */
  home: HomeSectionType[];
}

export interface SiteType {
  id: string;
  name: string;
  description: string;
  /** Ana sayfada mutlaka bulunan bölümler (ailede yoksa iletişimden önce eklenir) */
  requiredSections: HomeSectionType[];
  /** Bu site tipinde gösterilmeyen bölümler (aile önerse bile) */
  excludedSections: HomeSectionType[];
  /** Site özellikleri (site_set_features): yalnızca belirtilenler değiştirilir */
  features: Partial<Record<FeatureKey, boolean>>;
  /** Varsayılan olarak gizlenen sayfalar */
  hiddenPages: PageKey[];
  /** Önerilen tasarım aileleri (sihirbazda "önerilen" rozeti; zorunlu değildir) */
  recommendedFamilies: string[];
}

/** Katalog klasörlerinin varsayılan dışa aktarımı bu yardımcıyla tanımlanır (tip denetimi) */
export function defineFamily(family: DesignFamily): DesignFamily {
  return family;
}
