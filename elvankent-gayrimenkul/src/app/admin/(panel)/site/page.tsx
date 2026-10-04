import type { Metadata } from 'next';
import { removeBrandingImage } from '@/app/actions/admin-settings';
import { BrandingImageField } from '@/components/panel/branding-image-field';
import { Panel } from '@/components/panel/ui';
import { BrandForm } from '@/components/site-editor/brand-form';
import { brandingUrl } from '@/modules/media/variants';
import { brandValues } from '@/site-editor/brand-values';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Site yönetimi' };

const FORMATS = 'PNG, JPG, WEBP veya güvenli SVG (sunucuda denetlenip optimize edilir).';

/**
 * Genel: firma kimliği, marka renkleri ve marka görselleri. P0.2: görseller de TASLAĞA yüklenir;
 * canlı site yayına kadar eski görseli gösterir, önizleme yenisini gösterir.
 */
export default async function Page() {
  const { site } = await getOfficeSite();
  const s = site.brand;
  const pending = Object.keys(site.draft.brand);
  const hint = (col: string) => (pending.includes(col) ? ' · Taslakta: yayınlanınca sitede görünür.' : '');
  return (
    <div className="space-y-6">
      <BrandForm groups={['identity', 'colors']} initial={brandValues(site.brand)} pendingFields={pending} />
      <Panel title="Logo ve görseller" description="Görseller taslağa yüklenir; önizlemede hemen, sitede yayınladığınızda görünür. Eski görseller silinmez (geri alma için saklanır).">
        <div className="grid gap-6 lg:grid-cols-2">
          <BrandingImageField removeAction={removeBrandingImage} kind="logo" label="Logo" url={brandingUrl(s.logo_url)} hint={`Yatay logo önerilir. ${FORMATS}${hint('logo_url')}`} />
          <BrandingImageField
            removeAction={removeBrandingImage}
            kind="logo_mobile"
            label="Mobil logo"
            url={brandingUrl(s.logo_mobile_url)}
            hint={`İsteğe bağlı; telefonda dar başlıkta gösterilir. Boşsa ana logo kullanılır.${hint('logo_mobile_url')}`}
            previewClassName="h-24 w-24"
          />
          <BrandingImageField removeAction={removeBrandingImage} kind="favicon" label="Site simgesi (favicon)" url={brandingUrl(s.favicon_url)} hint={`Kare görsel; 512×512 önerilir.${hint('favicon_url')}`} previewClassName="size-24" />
          <BrandingImageField
            removeAction={removeBrandingImage}
            kind="hero"
            label="Ana sayfa görseli"
            url={brandingUrl(s.hero_image_url)}
            hint={`Ana sayfanın üst bölümünde kullanılır.${hint('hero_image_url')}`}
            previewClassName="aspect-[16/9] w-full max-w-sm"
            stacked
          />
        </div>
      </Panel>
    </div>
  );
}
