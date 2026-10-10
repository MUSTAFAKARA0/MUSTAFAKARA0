import { brandingUrl } from '@/modules/media/variants';
import type { Metadata } from 'next';
import { ThemeForm } from '@/components/site-editor/appearance-forms';
import { DesignFamilyPicker } from '@/components/site-editor/design-family-picker';
import { FamilyAccessForm } from '@/components/platform/site/family-access-form';
import { disabledFamilies, grantedFamilies } from '@/modules/platform/design-access';
import { DESIGN_FAMILIES } from '@/site-factory/families';
import { familyOptions } from '@/site-editor/families';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Tema · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/tema'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  const [access, global] = await Promise.all([grantedFamilies(session.supabase, site.org.id), disabledFamilies(session.supabase)]);
  const brand = { primary_color: site.brand.primary_color, accent_color: site.brand.accent_color, logoUrl: brandingUrl(site.brand.logo_url), tagline: site.brand.tagline };
  const d = site.draft;
  const families = familyOptions(d);
  // Aile uygulanınca form yeni taslakla yeniden başlar (eski durum kaydedilip aileyi geri almasın)
  const formKey = JSON.stringify([d.theme, d.style, d.colors]);
  return (
    <div className="space-y-10">
      <DesignFamilyPicker families={families} brand={brand} darkAllowed={site.overrides.dark_mode === true} name={site.brand.display_name} />
      <FamilyAccessForm
        orgId={site.org.id}
        available={access.available}
        granted={access.granted}
        families={DESIGN_FAMILIES.map((f) => ({ id: f.id, name: f.name, disabled: global.disabled.has(f.id) }))}
      />
      <ThemeForm
        key={formKey}
      draft={site.draft}
      brand={brand}
      darkAllowed={site.overrides.dark_mode === true}
      name={site.brand.display_name}
    />
    </div>
  );
}
