import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/panel/ui';
import { KarayProfileForm } from '@/components/platform/karay-forms';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'KARAY ayarları' };

/** KARAY (platform sahibi) kurumsal bilgileri: şirket sayfası iletişim, sosyal, SEO, bildirim */
export default async function KarayProfilePage() {
  const session = await requireSuperAdminPage();
  const { data, error } = await session.supabase.from('platform_settings').select('*').eq('id', true).maybeSingle();
  const s = data;
  const v = (x: string | null | undefined) => x ?? '';
  return (
    <>
      <AdminPageHeader
        title="KARAY ayarları"
        description="KARAY'ın kendi şirket bilgileri. Emlak ofislerinin (kiracıların) marka ve iletişim bilgileri buradan değil, Web Siteleri › Marka sekmesinden yönetilir."
        actions={
          <a href="/karay" target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-semibold text-primary-ink hover:underline">
            KARAY sayfasını gör ↗
          </a>
        }
      />
      {error || !s ? (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Ayarlar yüklenemedi. KARAY migration&apos;ı (20261002000001) uygulanmış mı?</p>
      ) : (
        <KarayProfileForm
          initial={{
            company_name: s.company_name,
            tagline: v(s.tagline),
            contact_email: v(s.contact_email),
            contact_phone: v(s.contact_phone),
            whatsapp: v(s.whatsapp),
            address: v(s.address),
            city: v(s.city),
            website_url: v(s.website_url),
            linkedin_url: v(s.linkedin_url),
            instagram_url: v(s.instagram_url),
            x_url: v(s.x_url),
            youtube_url: v(s.youtube_url),
            seo_title: v(s.seo_title),
            seo_description: v(s.seo_description),
            indexable: s.indexable,
            lead_notify_emails: (s.lead_notify_emails ?? []).join(', '),
          }}
        />
      )}
    </>
  );
}
