import type { Metadata } from 'next';
import { Eye } from 'lucide-react';
import Link from '@/components/common/intent-link';
import { ThemeForm } from '@/components/site-editor/appearance-forms';
import { DesignFamilyPicker } from '@/components/site-editor/design-family-picker';
import { Button } from '@/components/ui/button';
import { selectableFamilies } from '@/modules/platform/design-access';
import { familyOptions } from '@/site-editor/families';
import { getOfficeSite, previewBrand } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Tasarım · Site yönetimi' };

/**
 * Ofis › Site yönetimi › Tasarım: yalnızca KARAY'ın bu ofise izin verdiği (ve global açık) aileler
 * listelenir; diğer ailelerin verisi bu sayfanın HTML'ine/JS'ine girmez (sunucuda süzülür). Aile
 * TASLAĞA uygulanır; önizleyip yayınlayınca sitede görünür. Tema ve varyantlar aynı formla düzenlenir.
 */
export default async function Page() {
  const { ctx, site } = await getOfficeSite();
  const access = await selectableFamilies(ctx.supabase, ctx.org.id);
  const d = site.draft;
  const families = familyOptions(d, access.families);
  const brand = previewBrand(site);
  const formKey = JSON.stringify([d.theme, d.style, d.colors]);
  return (
    <div className="space-y-10">
      {families.length > 0 ? (
        <div className="space-y-3">
          <DesignFamilyPicker families={families} brand={brand} darkAllowed={site.overrides.dark_mode === true} name={site.brand.display_name} />
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/tasarim/onizleme">
              <Eye /> Tasarımları sitenizin verisiyle önizle
            </Link>
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface px-5 py-4 text-[13.5px] text-muted-foreground" data-testid="no-families">
          Ofisiniz için açılmış bir tasarım ailesi yok. Yeni tasarımlar için KARAY ile iletişime geçin. Tema ve varyantları aşağıdan düzenleyebilirsiniz.
        </p>
      )}
      <ThemeForm key={formKey} draft={site.draft} brand={brand} darkAllowed={site.overrides.dark_mode === true} name={site.brand.display_name} />
    </div>
  );
}
