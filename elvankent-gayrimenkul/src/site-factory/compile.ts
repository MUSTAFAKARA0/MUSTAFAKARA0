import type { SiteConfig } from '@/site-config/schema';
import type { DesignFamily } from '@/site-factory/types';
import { compileManifest, type CompiledManifest } from '@/site-factory/manifest';
import { DEFAULT_SITE_TYPE } from '@/site-factory/site-types';

/**
 * SITE COMPILER — mevcut bir sitenin TASARIMINI değiştirir (Site Builder › Tasarım ailesi):
 *
 *   tasarım ailesi → manifest (sitenin kayıtlı site tipiyle) → compileManifest() → { theme, colors, typography, style, home }
 *     → taslak (site_save_draft) → önizleme → yayın → Site Engine yalnızca manifesti çizer
 *
 * Site tipi değişmez (içerik mimarisi korunur); kaynağı olmayan eski siteler varsayılan tiptedir.
 * Ayrıntılar ve içerik koruma kuralları: manifest.ts › compileManifest.
 */
export type CompiledDesign = CompiledManifest['design'];

export function compileDesign(family: DesignFamily, current: SiteConfig): CompiledDesign {
  const siteType = current.style.origin?.siteType ?? DEFAULT_SITE_TYPE;
  return compileManifest({ siteType, designFamily: family.id }, current).design;
}
