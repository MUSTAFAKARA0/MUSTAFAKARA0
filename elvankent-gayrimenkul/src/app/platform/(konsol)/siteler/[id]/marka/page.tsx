import type { Metadata } from 'next';
import { Panel } from '@/components/admin/ui';
import { BrandingImageField } from '@/components/admin/branding-image-field';
import { BrandForm } from '@/components/platform/site/brand-form';
import { brandingUrl } from '@/modules/media/variants';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Marka · Web Sitesi' };

const FORMATS = 'PNG, JPG, WEBP veya güvenli SVG (sunucuda denetlenip optimize PNG\'ye çevrilir).';

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/marka'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  // Taslaktaki etkin değerler (canlı + bekleyen değişiklikler)
  const s = site.brand;
  const pending = Object.keys(site.draft.brand);
  const pendingHint = (col: string) => (pending.includes(col) ? ' · Taslakta: yayınlanınca canlıya geçer.' : '');
  const v = (x: string | null | undefined) => x ?? '';
  return (
    <div className="space-y-6">
      <Panel title="Logo ve görseller" description="Görseller taslağa yüklenir; önizlemede hemen, canlı sitede yayınlayınca görünür. Dosyalar sunucuda doğrulanır, yeniden kodlanır ve uygun boyuta küçültülür.">
        <div className="grid gap-6 lg:grid-cols-2">
          <BrandingImageField orgId={site.org.id} kind="logo" label="Logo" url={brandingUrl(s.logo_url)} hint={`Yatay logo önerilir. ${FORMATS}${pendingHint('logo_url')}`} />
          <BrandingImageField
            orgId={site.org.id}
            kind="logo_mobile"
            label="Mobil logo"
            url={brandingUrl(s.logo_mobile_url)}
            hint={`İsteğe bağlı; telefonda dar başlıkta gösterilir (ör. yalnızca amblem). Boşsa ana logo kullanılır.${pendingHint('logo_mobile_url')}`}
            previewClassName="h-24 w-24"
          />
          <BrandingImageField orgId={site.org.id} kind="favicon" label="Site simgesi (favicon)" url={brandingUrl(s.favicon_url)} hint={`Kare görsel; 512×512 önerilir.${pendingHint('favicon_url')}`} previewClassName="size-24" />
          <BrandingImageField orgId={site.org.id} kind="og" label="Paylaşım görseli" url={brandingUrl(s.og_image_url)} hint={`Bağlantı paylaşıldığında görünür (1200×630 önerilir).${pendingHint('og_image_url')}`} previewClassName="aspect-[1200/630] w-full max-w-sm" stacked />
          <BrandingImageField orgId={site.org.id} kind="hero" label="Ana sayfa görseli" url={brandingUrl(s.hero_image_url)} hint={`Ana sayfanın üst bölümünde kullanılır.${pendingHint('hero_image_url')}`} previewClassName="aspect-[16/9] w-full max-w-sm" stacked />
        </div>
      </Panel>
      <BrandForm
        orgId={site.org.id}
        pendingFields={pending}
        initial={{
          display_name: s.display_name,
          short_name: v(s.short_name),
          legal_name: v(s.legal_name),
          tagline: v(s.tagline),
          description: v(s.description),
          phone: v(s.phone),
          whatsapp: v(s.whatsapp),
          email: v(s.email),
          address_line: v(s.address_line),
          address_district: v(s.address_district),
          address_city: v(s.address_city),
          maps_url: v(s.maps_url),
          instagram_url: v(s.instagram_url),
          facebook_url: v(s.facebook_url),
          x_url: v(s.x_url),
          youtube_url: v(s.youtube_url),
          linkedin_url: v(s.linkedin_url),
          tiktok_url: v(s.tiktok_url),
          primary_color: s.primary_color,
          accent_color: s.accent_color,
        }}
      />
    </div>
  );
}
