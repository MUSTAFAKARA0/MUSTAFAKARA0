import { brandingUrl } from '@/modules/media/variants';
import type { Metadata } from 'next';
import { ThemeForm } from '@/components/platform/site/appearance-forms';
import { DesignFamilyPicker, type FamilyOption } from '@/components/platform/site/design-family-picker';
import { compileDesign } from '@/site-factory/compile';
import { DESIGN_FAMILIES, familyParts } from '@/site-factory/families';
import { resolveStyle } from '@/theme-engine/themes';
import { DEFAULT_HOME_SECTIONS } from '@/site-config/schema';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Tema · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/tema'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  const brand = { primary_color: site.brand.primary_color, accent_color: site.brand.accent_color, logoUrl: brandingUrl(site.brand.logo_url), tagline: site.brand.tagline };
  // Site Factory: aileler sunucuda derlenir; tarayıcıya yalnızca önizlemenin tema girdisi gider
  const d = site.draft;
  const sectionsKey = (list: { type: string; enabled: boolean }[]) => JSON.stringify(list.map((s) => [s.type, s.enabled]));
  const families: FamilyOption[] = DESIGN_FAMILIES.map((f) => {
    const c = compileDesign(f, d);
    const active =
      d.theme === c.theme &&
      JSON.stringify(d.colors) === JSON.stringify(c.colors) &&
      JSON.stringify(d.typography) === JSON.stringify(c.typography) &&
      JSON.stringify(d.style) === JSON.stringify(c.style) &&
      sectionsKey(d.home?.sections ?? DEFAULT_HOME_SECTIONS) === sectionsKey(c.home.sections);
    const config = { theme: c.theme, colors: c.colors, typography: c.typography, style: c.style, header: { style: d.header.style, brand: d.header.brand, showTagline: d.header.showTagline, showFavorites: d.header.showFavorites, cta: d.header.cta } };
    return { id: f.id, name: f.name, description: f.description, audience: f.audience, config, active, parts: familyParts(f, resolveStyle(config)) };
  });
  // Aile uygulanınca form yeni taslakla yeniden başlar (eski durum kaydedilip aileyi geri almasın)
  const formKey = JSON.stringify([d.theme, d.style, d.colors]);
  return (
    <div className="space-y-10">
      <DesignFamilyPicker orgId={site.org.id} families={families} brand={brand} darkAllowed={site.overrides.dark_mode === true} name={site.brand.display_name} />
      <ThemeForm
        key={formKey}
      orgId={site.org.id}
      draft={site.draft}
      brand={brand}
      darkAllowed={site.overrides.dark_mode === true}
      name={site.brand.display_name}
    />
    </div>
  );
}
