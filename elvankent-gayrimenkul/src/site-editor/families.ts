import 'server-only';
import type { FamilyOption } from '@/components/site-editor/design-family-picker';
import { DEFAULT_HOME_SECTIONS, type SiteConfig } from '@/site-config/schema';
import { compileDesign } from '@/site-factory/compile';
import { FAMILY_META, type FamilyMeta } from '@/site-factory/catalog-meta';
import { DESIGN_FAMILIES, familyParts } from '@/site-factory/families';
import { findSiteType, DEFAULT_SITE_TYPE } from '@/site-factory/site-types';
import { findPalette } from '@/theme-engine/palettes';
import { resolveStyle, THEMES } from '@/theme-engine/themes';
import { FONT_CATALOG } from '@/theme-engine/typography/catalog';

/**
 * Tasarım ailesi seçicisinin verisi (KARAY ve ofis ortak). Aileler SUNUCUDA derlenir; tarayıcıya
 * yalnızca önizlemenin tema girdisi gider. `allowed` verilirse (ofis) yalnızca o aileler döner:
 * izinsiz ailelerin adı, açıklaması veya tasarım girdisi istemciye hiç ulaşmaz.
 * `opts.darkAllowed === false` ise koyu paletli aileler (ör. Gece Premium) listeden çıkarılır: koyu görünüm
 * kapalı sitede koyu palet açık bir yedek palete düşer, yani seçilen aile gördüğünüzden farklı çizilirdi.
 */
export function familyOptions(draft: SiteConfig, allowed?: readonly string[], opts: { darkAllowed?: boolean } = {}): FamilyOption[] {
  // Manifestin kaynağı (origin) yalnızca kayıttır; görünüm karşılaştırmasına girmez
  const withoutOrigin = (style: SiteConfig['style']) => Object.fromEntries(Object.entries(style).filter(([k]) => k !== 'origin'));
  const sectionsKey = (list: { type: string; enabled: boolean }[]) => JSON.stringify(list.map((s) => [s.type, s.enabled]));
  const d = draft;
  const recommended = new Set(findSiteType(d.style.origin?.siteType ?? '')?.recommendedFamilies ?? findSiteType(DEFAULT_SITE_TYPE)?.recommendedFamilies ?? []);
  const needsDark = (id: string) => findPalette(DESIGN_FAMILIES.find((f) => f.id === id)?.palette)?.scheme === 'dark';
  return DESIGN_FAMILIES.filter((f) => (!allowed || allowed.includes(f.id)) && (opts.darkAllowed !== false || !needsDark(f.id))).map((f) => {
    const c = compileDesign(f, d);
    const active =
      d.theme === c.theme &&
      JSON.stringify(d.colors) === JSON.stringify(c.colors) &&
      JSON.stringify(d.typography) === JSON.stringify(c.typography) &&
      JSON.stringify(withoutOrigin(d.style)) === JSON.stringify(withoutOrigin(c.style)) &&
      sectionsKey(d.home?.sections ?? DEFAULT_HOME_SECTIONS) === sectionsKey(c.home.sections);
    const config = { theme: c.theme, colors: c.colors, typography: c.typography, style: c.style, header: { style: d.header.style, brand: d.header.brand, showTagline: d.header.showTagline, showFavorites: d.header.showFavorites, cta: d.header.cta } };
    const palette = findPalette(c.colors.preset);
    const heading = FONT_CATALOG[c.typography.heading ?? THEMES[c.theme].fonts.heading];
    const headingId = c.typography.heading ?? THEMES[c.theme].fonts.heading;
    const meta: FamilyMeta = FAMILY_META[f.id] ?? { segments: [], tags: [], bestFor: [f.audience], mood: [], density: 'balanced', contrast: palette?.scheme === 'dark' ? 'dark' : 'light' };
    const t = palette?.tokens;
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      audience: f.audience,
      config,
      active,
      parts: familyParts(f, resolveStyle(config)),
      meta,
      recommended: recommended.has(f.id),
      swatch: t ? [t.primary, t.secondary, t.accent, t.background] : [],
      paletteName: palette?.name ?? '',
      headingName: heading.name,
      headingFontId: headingId,
    };
  });
}
