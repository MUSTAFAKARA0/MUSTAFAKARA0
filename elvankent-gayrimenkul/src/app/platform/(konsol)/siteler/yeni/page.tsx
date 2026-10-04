import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/panel/ui';
import { SiteWizard, type WizardCatalog } from '@/components/platform/site-wizard/site-wizard';
import { serverEnv } from '@/lib/server-env';
import { disabledFamilies } from '@/modules/platform/design-access';
import { listPlans } from '@/modules/platform/queries';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { DESIGN_FAMILIES, familyParts, SURFACE_PART_LABELS } from '@/site-factory/families';
import { FIXED_SLOT_LABELS, VARIANT_LABELS } from '@/site-factory/labels';
import { SITE_TYPES } from '@/site-factory/site-types';
import { FONT_IDS } from '@/theme-engine/ids';
import { PALETTES } from '@/theme-engine/palettes';
import { resolveStyle, THEMES } from '@/theme-engine/themes';
import { FONT_CATALOG } from '@/theme-engine/typography/catalog';

export const metadata: Metadata = { title: 'Yeni site oluştur' };

/**
 * YENİ SİTE OLUŞTUR (KARAY süper admin): site bilgileri → site tipi → tasarım ailesi →
 * tasarım seçenekleri → gerçek önizleme → onay ve oluşturma. Katalog verisi sunucuda
 * hazırlanır (yalnızca görüntülenecek alanlar); sihirbaz istemcide yalnızca manifest kurar.
 */
export default async function NewSitePage() {
  const session = await requireSuperAdminPage();
  const [plans, global] = await Promise.all([listPlans(session), disabledFamilies(session.supabase)]);
  const catalog: WizardCatalog = {
    siteTypes: SITE_TYPES.map((t) => ({ id: t.id, name: t.name, description: t.description, recommended: t.recommendedFamilies, required: t.requiredSections, excluded: t.excludedSections })),
    families: DESIGN_FAMILIES.map((f) => {
      const theme = THEMES[f.theme];
      const palette = PALETTES.find((p) => p.id === f.palette)!;
      const heading = f.typography?.heading ?? theme.fonts.heading;
      const body = f.typography?.body ?? theme.fonts.body;
      const style = resolveStyle({ theme: f.theme, style: f.style });
      return {
        id: f.id,
        name: f.name,
        description: f.description,
        audience: f.audience,
        palette: f.palette,
        swatch: [palette.tokens.primary, palette.tokens.accent, palette.tokens.background, palette.tokens.text],
        fonts: { heading, body, headingName: FONT_CATALOG[heading].name, bodyName: FONT_CATALOG[body].name },
        defaults: { theme: f.theme, hero: style.hero, header: style.headerLayout, card: style.card, cardLayout: style.cardLayout, footer: style.footerLayout, motion: style.motion },
        parts: familyParts(f, style),
        surfaces: Object.fromEntries(Object.entries(f.style.slots ?? {}).flatMap(([k, v]) => (typeof v === 'string' && SURFACE_PART_LABELS[k]?.[v] ? [[k, SURFACE_PART_LABELS[k][v]]] : []))),
        disabled: global.disabled.has(f.id),
      };
    }),
    palettes: PALETTES.filter((p) => p.scheme === 'light').map((p) => ({ id: p.id, name: p.name, swatch: [p.tokens.primary, p.tokens.accent, p.tokens.background] })),
    fonts: FONT_IDS.map((id) => ({ id, name: FONT_CATALOG[id].name, kind: FONT_CATALOG[id].kind })),
    variantLabels: { ...VARIANT_LABELS, theme: Object.fromEntries(Object.values(THEMES).map((t) => [t.id, t.name])) },
    fixedSlots: FIXED_SLOT_LABELS,
    plans: plans.map((p) => ({ id: p.id, name: p.name })),
    rootDomain: serverEnv.platformRootDomain || null,
  };
  return (
    <>
      <AdminPageHeader
        title="Yeni site oluştur"
        description="Müşteri için yeni bir web sitesi açın: site tipini ve tasarımı seçin, gerçek bileşenlerle önizleyin, oluşturun. Site yalnızca seçilen tasarım paketini taşır."
        back={{ href: '/platform/siteler', label: 'Web Siteleri' }}
      />
      <SiteWizard catalog={catalog} />
    </>
  );
}
