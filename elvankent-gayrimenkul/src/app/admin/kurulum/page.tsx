import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { SetupFlow } from '@/components/admin/setup-flow';
import { brandingUrl } from '@/modules/media/variants';
import { getOrgSetup } from '@/site-editor/setup';
import { initialFamily, resumeStep, shouldRedirectToSetup } from '@/modules/onboarding/setup-state';
import { selectableFamilies } from '@/modules/platform/design-access';
import { getSiteAdmin } from '@/modules/platform/sites';
import { requirePageContext } from '@/platform/auth/session';
import { familyOptions } from '@/site-editor/families';
import { previewBrand } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'İlk kurulum' };

/**
 * PILOT · İlk kurulum (/admin/kurulum). Panel menüsü olmadan odaklı akış. Yalnız kurulumu açık ofiste ve ayar yetkisi
 * (settings.manage) olan kullanıcıya açılır; tamamlanmış kurulumda, eski ofiste ya da migration uygulanmamış
 * veritabanında /admin'e döner. Organizasyon oturumdan gelir; izinsiz ailelerin verisi bu sayfaya hiç girmez.
 */
export default async function SetupPage() {
  const ctx = await requirePageContext();
  if (!ctx.can('settings.manage')) redirect('/admin');
  const { setup } = await getOrgSetup(ctx.supabase, ctx.org.id);
  if (!setup || !shouldRedirectToSetup(setup, true)) redirect('/admin');

  const [site, access] = await Promise.all([getSiteAdmin(ctx, ctx.org.id), selectableFamilies(ctx.supabase, ctx.org.id)]);
  if (!site) notFound();
  const families = familyOptions(site.published, access.families);
  const allowed = families.map((f) => f.id);
  const address = [site.brand.address_line, site.brand.address_district, site.brand.address_city].filter(Boolean).join(', ');

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-8">
        <Logo name={site.brand.display_name || ctx.org.name} logoUrl={brandingUrl(site.brand.logo_url)} href="/admin/kurulum" />
      </div>
      <SetupFlow
        office={{ name: ctx.org.name, displayName: site.brand.display_name, phone: site.brand.phone, email: site.brand.email, address: address || null }}
        families={families}
        brand={previewBrand(site)}
        darkAllowed={site.overrides.dark_mode === true}
        initialStep={resumeStep(setup)}
        initialFamily={initialFamily(allowed, setup.selectedFamily, site.published.style.origin?.family ?? null)}
      />
    </main>
  );
}
