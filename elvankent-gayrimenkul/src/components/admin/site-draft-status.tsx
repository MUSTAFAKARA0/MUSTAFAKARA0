import Link from '@/components/common/intent-link';
import { DiscardDraftButton, PreviewButton, PublishButton } from '@/components/site-editor/site-actions';
import { SiteStatusCards } from '@/components/site-editor/site-status';
import { createOfficeSitePreviewLink, discardOfficeSiteDraft, publishOfficeSite } from '@/app/actions/admin-site';
import type { SiteAdmin } from '@/modules/platform/sites';

/**
 * Ofis paneli: marka / site içeriği düzenlenen sayfalarda (Marka ve görünüm, Ayarlar › Ana sayfa)
 * taslak durumu ve TEK yayın noktası. /admin/site ile aynı Önizle / Taslağı geri al / Yayınla
 * düğmeleri ve aynı ofis işlemleri (organizasyon oturumdan) kullanılır.
 */
export function SiteDraftStatus({ site, labels }: { site: SiteAdmin; labels: string[] }) {
  const active = site.org.status === 'active';
  return (
    <section aria-label="Site taslak durumu" className="mb-5">
      <SiteStatusCards
        live={site.status === 'active' && active}
        version={site.version}
        publishedAt={site.publishedAt}
        hasUnpublishedChanges={site.hasUnpublishedChanges}
        pendingLabels={labels}
      />
      <div className="flex flex-wrap items-center gap-2">
        {active && <PreviewButton action={createOfficeSitePreviewLink} />}
        {site.hasUnpublishedChanges && <DiscardDraftButton action={discardOfficeSiteDraft} />}
        <PublishButton action={publishOfficeSite} disabled={!site.hasUnpublishedChanges} />
        <Link href="/admin/site/gecmis" className="ml-auto text-[13px] font-semibold text-primary hover:underline">
          Yayın geçmişi ve geri alma
        </Link>
      </div>
    </section>
  );
}

/** Taslakta bekleyen bölümlerin kullanıcıya gösterilen adları */
export function pendingSectionLabels(site: SiteAdmin): string[] {
  const NAMES: Record<string, string> = {
    brand: 'Marka ve iletişim',
    theme: 'Tasarım',
    colors: 'Tasarım',
    typography: 'Tasarım',
    style: 'Tasarım',
    header: 'Header',
    navigation: 'Menü',
    home: 'Ana sayfa',
    footer: 'Footer',
    pages: 'Sayfalar',
    seo: 'SEO',
  };
  return [...new Set(site.pendingSections.map((k) => NAMES[k]).filter((x): x is string => !!x))];
}
