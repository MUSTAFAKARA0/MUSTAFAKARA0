import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { removeBrandingImage } from '@/app/actions/admin-settings';
import { BrandingImageField } from '@/components/panel/branding-image-field';
import { CompanyForm } from '@/components/admin/settings/company-form';
import { AdminPageHeader } from '@/components/panel/ui';
import { parseOpeningHours } from '@/modules/content/hours';
import { publicMapConfig } from '@/modules/maps/providers';
import { brandingUrl } from '@/modules/media/variants';
import { getTaxonomy } from '@/modules/properties/taxonomy';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Marka ve görünüm' };

export default async function CompanySettingsPage() {
  const ctx = await requirePagePermission('settings.manage');
  const [{ data: s }, taxonomy] = await Promise.all([
    ctx.supabase.from('organization_settings').select('*').eq('organization_id', ctx.org.id).maybeSingle(),
    getTaxonomy(),
  ]);
  if (!s) notFound();
  const city = taxonomy.cities.find((c) => c.latitude !== null && c.longitude !== null);
  const str = (value: string | number | null | undefined) => (value === null || value === undefined ? '' : String(value));

  return (
    <>
      <AdminPageHeader
        title="Marka ve görünüm"
        description="Sitenizin kimliği: marka, renkler, iletişim ve adres bilgileri. Değişiklikler kaydedildiği anda sitede görünür."
      />
      <CompanyForm
        initial={{
          display_name: s.display_name,
          legal_name: str(s.legal_name),
          tagline: str(s.tagline),
          description: str(s.description),
          service_area: str(s.service_area),
          primary_color: s.primary_color,
          accent_color: s.accent_color,
          phone: str(s.phone),
          whatsapp: str(s.whatsapp),
          email: str(s.email),
          address_line: str(s.address_line),
          address_district: str(s.address_district),
          address_city: str(s.address_city),
          postal_code: str(s.postal_code),
          office_latitude: str(s.office_latitude),
          office_longitude: str(s.office_longitude),
          opening_hours: parseOpeningHours(s.opening_hours),
          working_hours_note: str(s.working_hours_note),
          instagram_url: str(s.instagram_url),
          facebook_url: str(s.facebook_url),
          x_url: str(s.x_url),
          youtube_url: str(s.youtube_url),
          linkedin_url: str(s.linkedin_url),
          tiktok_url: str(s.tiktok_url),
        }}
        map={publicMapConfig()}
        defaultCenter={city ? { lat: Number(city.latitude), lng: Number(city.longitude) } : { lat: 39.0, lng: 35.0 }}
        branding={
          <div className="grid gap-6 md:grid-cols-2">
            <BrandingImageField removeAction={removeBrandingImage}
              kind="logo"
              label="Logo"
              url={brandingUrl(s.logo_url)}
              hint="PNG (şeffaf zemin önerilir), JPG, WEBP veya AVIF. En fazla 1200×480 px'e küçültülür. Yüklenmezse şirket adı yazı olarak gösterilir."
            />
            <BrandingImageField removeAction={removeBrandingImage}
              kind="favicon"
              label="Site simgesi (favicon)"
              url={brandingUrl(s.favicon_url)}
              previewClassName="size-24"
              hint="Kare görsel önerilir; 512×512 px PNG'ye dönüştürülür. Tarayıcı sekmesinde ve ana ekrana eklemede görünür."
            />
          </div>
        }
      />
    </>
  );
}
