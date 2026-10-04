import 'server-only';
import type { FamilyOption } from '@/components/site-editor/design-family-picker';
import { DEFAULT_HOME_SECTIONS, type SiteConfig } from '@/site-config/schema';
import { compileDesign } from '@/site-factory/compile';
import { DESIGN_FAMILIES, familyParts } from '@/site-factory/families';
import { resolveStyle } from '@/theme-engine/themes';

/**
 * Tasarım ailesi seçicisinin verisi (KARAY ve ofis ortak). Aileler SUNUCUDA derlenir; tarayıcıya
 * yalnızca önizlemenin tema girdisi gider. `allowed` verilirse (ofis) yalnızca o aileler döner:
 * izinsiz ailelerin adı, açıklaması veya tasarım girdisi istemciye hiç ulaşmaz.
 */
export function familyOptions(draft: SiteConfig, allowed?: readonly string[]): FamilyOption[] {
  // Manifestin kaynağı (origin) yalnızca kayıttır; görünüm karşılaştırmasına girmez
  const withoutOrigin = (style: SiteConfig['style']) => Object.fromEntries(Object.entries(style).filter(([k]) => k !== 'origin'));
  const sectionsKey = (list: { type: string; enabled: boolean }[]) => JSON.stringify(list.map((s) => [s.type, s.enabled]));
  const d = draft;
  return DESIGN_FAMILIES.filter((f) => !allowed || allowed.includes(f.id)).map((f) => {
    const c = compileDesign(f, d);
    const active =
      d.theme === c.theme &&
      JSON.stringify(d.colors) === JSON.stringify(c.colors) &&
      JSON.stringify(d.typography) === JSON.stringify(c.typography) &&
      JSON.stringify(withoutOrigin(d.style)) === JSON.stringify(withoutOrigin(c.style)) &&
      sectionsKey(d.home?.sections ?? DEFAULT_HOME_SECTIONS) === sectionsKey(c.home.sections);
    const config = { theme: c.theme, colors: c.colors, typography: c.typography, style: c.style, header: { style: d.header.style, brand: d.header.brand, showTagline: d.header.showTagline, showFavorites: d.header.showFavorites, cta: d.header.cta } };
    return { id: f.id, name: f.name, description: f.description, audience: f.audience, config, active, parts: familyParts(f, resolveStyle(config)) };
  });
}
