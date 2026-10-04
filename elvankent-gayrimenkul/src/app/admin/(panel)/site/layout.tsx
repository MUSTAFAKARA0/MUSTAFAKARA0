import { ExternalLink, Globe } from 'lucide-react';
import { AdminPageHeader } from '@/components/panel/ui';
import { DiscardDraftButton, PreviewButton, PublishButton, SiteEditorProvider } from '@/components/site-editor/site-actions';
import { SiteStatusCards } from '@/components/site-editor/site-status';
import { SiteTabs } from '@/components/site-editor/site-tabs';
import { Button } from '@/components/ui/button';
import {
  applyOfficeDesignFamily,
  createOfficeSitePreviewLink,
  discardOfficeSiteDraft,
  publishOfficeSite,
  saveOfficeSiteSection,
  updateOfficeSiteBrand,
} from '@/app/actions/admin-site';
import { getTenantFromRequest } from '@/platform/tenant/tenant';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

const TABS = [
  { slug: '', label: 'Genel' },
  { slug: 'tasarim', label: 'Tasarım' },
  { slug: 'ana-sayfa', label: 'Ana Sayfa' },
  { slug: 'header', label: 'Header' },
  { slug: 'footer', label: 'Footer' },
  { slug: 'menu', label: 'Menü' },
  { slug: 'sayfalar', label: 'Sayfalar' },
  { slug: 'seo', label: 'SEO' },
  { slug: 'iletisim', label: 'İletişim' },
  { slug: 'alan-adi', label: 'Alan Adı' },
  { slug: 'gecmis', label: 'Geçmiş' },
];

/** Taslakta değişen bölüm → sekme */
const SECTION_TABS: Record<string, string[]> = {
  theme: ['tasarim'],
  colors: ['tasarim'],
  typography: ['tasarim'],
  style: ['tasarim'],
  header: ['header'],
  navigation: ['menu'],
  home: ['ana-sayfa'],
  footer: ['footer'],
  pages: ['sayfalar'],
  seo: ['seo'],
  brand: ['', 'iletisim'],
};

/**
 * Ofis paneli › Site yönetimi. KARAY Site Builder ile AYNI formlar, aynı taslak/yayın servisi ve
 * aynı önizleme kullanılır; işlemler ofisin kendi yetkisiyle (settings.manage) çalışır ve
 * organizasyon oturumdan gelir. Değişiklikler önce taslağa kaydedilir; "Yayınla" ile canlıya çıkar.
 */
export default async function OfficeSiteLayout({ children }: LayoutProps<'/admin/site'>) {
  const [{ site }, tenant] = await Promise.all([getOfficeSite(), getTenantFromRequest().catch(() => null)]);
  const pending = [...new Set(site.pendingSections.flatMap((k) => SECTION_TABS[k] ?? []))];
  const pendingLabels = [...new Set(pending.map((slug) => TABS.find((t) => t.slug === slug)?.label).filter((x): x is string => !!x))];
  const siteUrl = tenant?.id === site.org.id ? '/' : site.primaryDomain ? `https://${site.primaryDomain}` : null;
  const active = site.org.status === 'active';
  return (
    <>
      <AdminPageHeader
        title="Site yönetimi"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Değişiklikler önce taslağa kaydedilir; önizleyip yayınladığınızda sitenizde görünür.</span>
            {site.primaryDomain && (
              <span className="inline-flex items-center gap-1">
                <Globe className="size-3.5" aria-hidden /> {site.primaryDomain}
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {siteUrl && active && (
              <Button asChild variant="outline" size="sm">
                <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Siteyi gör
                </a>
              </Button>
            )}
            {active && <PreviewButton action={createOfficeSitePreviewLink} />}
            {site.hasUnpublishedChanges && <DiscardDraftButton action={discardOfficeSiteDraft} />}
            <PublishButton action={publishOfficeSite} disabled={!site.hasUnpublishedChanges} />
          </div>
        }
      />
      <SiteStatusCards
        live={site.status === 'active' && active}
        version={site.version}
        publishedAt={site.publishedAt}
        hasUnpublishedChanges={site.hasUnpublishedChanges}
        pendingLabels={pendingLabels}
      />
      <SiteTabs base="/admin/site" tabs={TABS} pending={pending} />
      <SiteEditorProvider actions={{ saveSection: saveOfficeSiteSection, saveBrand: updateOfficeSiteBrand, applyFamily: applyOfficeDesignFamily }}>
        <div className="pt-6">{children}</div>
      </SiteEditorProvider>
    </>
  );
}
