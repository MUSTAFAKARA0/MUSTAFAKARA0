import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/panel/ui';
import { FamilyCatalogAdmin } from '@/components/platform/site/family-catalog-admin';
import { disabledFamilies } from '@/modules/platform/design-access';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { DESIGN_FAMILIES, familyParts } from '@/site-factory/families';
import { PALETTES } from '@/theme-engine/palettes';
import { resolveStyle, THEMES } from '@/theme-engine/themes';
import { FONT_CATALOG } from '@/theme-engine/typography/catalog';

export const metadata: Metadata = { title: 'Tasarım kataloğu' };

/** KARAY › Tasarım kataloğu: bütün aileler; global açma/kapama (kullanan sitelerin yayını değişmez) */
export default async function DesignCatalogPage() {
  const session = await requireSuperAdminPage();
  const [global, usage] = await Promise.all([disabledFamilies(session.supabase), session.supabase.rpc('platform_sites')]);
  const sites = usage.data ?? [];
  const configs = sites.length ? await session.supabase.from('site_configs').select('published').in('organization_id', sites.map((s) => s.organization_id)) : { data: [] };
  const usedBy = new Map<string, number>();
  for (const c of configs.data ?? []) {
    const fam = (c.published as { style?: { origin?: { family?: string } } } | null)?.style?.origin?.family;
    if (fam) usedBy.set(fam, (usedBy.get(fam) ?? 0) + 1);
  }
  const families = DESIGN_FAMILIES.map((f) => {
    const theme = THEMES[f.theme];
    const p = PALETTES.find((x) => x.id === f.palette)!;
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      audience: f.audience,
      swatch: [p.tokens.primary, p.tokens.accent, p.tokens.background, p.tokens.text],
      headingName: FONT_CATALOG[f.typography?.heading ?? theme.fonts.heading].name,
      heading: f.typography?.heading ?? theme.fonts.heading,
      bodyName: FONT_CATALOG[f.typography?.body ?? theme.fonts.body].name,
      parts: familyParts(f, resolveStyle({ theme: f.theme, style: f.style })),
      enabled: !global.disabled.has(f.id),
      sites: usedBy.get(f.id) ?? 0,
    };
  });
  return (
    <>
      <AdminPageHeader
        title="Tasarım kataloğu"
        description="KARAY'ın tasarım aileleri. Kapatılan aile yeni sitelerde ve ofis panellerinde seçenek olarak görünmez; o aileyi kullanan sitelerin yayındaki görünümü değişmez."
        back={{ href: '/platform/siteler', label: 'Web Siteleri' }}
      />
      <FamilyCatalogAdmin available={global.available} families={families} />
    </>
  );
}
