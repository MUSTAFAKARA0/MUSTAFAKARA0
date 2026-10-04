import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/panel/ui';
import { OfficeDesignPicker, type OfficeFamily } from '@/components/admin/settings/office-design-picker';
import { selectableFamilies } from '@/modules/platform/design-access';
import { requirePagePermission } from '@/platform/auth/session';
import { parseSiteConfig } from '@/site-config/schema';
import { DESIGN_FAMILIES, familyParts, findDesignFamily, type DesignFamily } from '@/site-factory/families';
import { PALETTES } from '@/theme-engine/palettes';
import { resolveStyle, THEMES } from '@/theme-engine/themes';
import { FONT_CATALOG } from '@/theme-engine/typography/catalog';

export const metadata: Metadata = { title: 'Site tasarımı' };

function view(f: DesignFamily): OfficeFamily {
  const theme = THEMES[f.theme];
  const p = PALETTES.find((x) => x.id === f.palette)!;
  const heading = f.typography?.heading ?? theme.fonts.heading;
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    swatch: [p.tokens.primary, p.tokens.accent, p.tokens.background, p.tokens.text],
    heading,
    headingName: FONT_CATALOG[heading].name,
    bodyName: FONT_CATALOG[f.typography?.body ?? theme.fonts.body].name,
    parts: familyParts(f, resolveStyle({ theme: f.theme, style: f.style })),
  };
}

/**
 * Ofis yöneticisi › Site tasarımı: yalnızca KARAY'ın bu ofise izin verdiği (ve global açık) aileler
 * listelenir. Katalogdaki diğer aileler bu sayfanın HTML'ine veya JS'ine girmez (sunucuda süzülür).
 */
export default async function OfficeDesignPage() {
  const ctx = await requirePagePermission('settings.manage');
  const [access, site] = await Promise.all([
    selectableFamilies(ctx.supabase, ctx.org.id),
    ctx.supabase.from('site_configs').select('published').eq('organization_id', ctx.org.id).maybeSingle(),
  ]);
  const currentId = parseSiteConfig(site.data?.published).style.origin?.family ?? null;
  const current = currentId ? findDesignFamily(currentId) : null;
  const allowed = DESIGN_FAMILIES.filter((f) => access.families.includes(f.id)).map(view);
  return (
    <>
      <AdminPageHeader
        title="Site tasarımı"
        description="Sitenizin görsel dilini KARAY'ın sizin için açtığı tasarımlar arasından seçin. İlanlarınız, metinleriniz, menünüz ve markanız korunur; tasarım hemen yayınlanır."
      />
      <OfficeDesignPicker available={access.available} families={allowed} current={current ? { id: current.id, name: current.name } : null} />
    </>
  );
}
