import { notFound } from 'next/navigation';
import { ExternalLink, Globe } from 'lucide-react';
import Link from '@/components/common/intent-link';
import { DiscardDraftButton, PreviewButton, PublishButton } from '@/components/platform/site/site-actions';
import { SiteTabs } from '@/components/platform/site/site-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { publicEnv } from '@/lib/env';
import { formatRelativeDate } from '@/lib/format';
import { isUuid } from '@/lib/utils';
import { brandingUrl } from '@/modules/media/variants';
import { ORG_STATUS_LABELS } from '@/modules/platform/queries';
import { getSiteAdmin, SITE_STATUS_META } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

/** Taslakta özelleştirilmiş bölümler → sekmede işaret */
const SECTION_TAB: Record<string, string> = {
  theme: 'tema',
  colors: 'renkler',
  typography: 'tipografi',
  header: 'header',
  navigation: 'menu',
  home: 'ana-sayfa',
  footer: 'footer',
  pages: 'sayfalar',
  seo: 'seo',
};

/**
 * Site Kontrol Merkezi: bir müşterinin (kiracı) web sitesi. Üstte kimlik ve yayın durumu,
 * altında bölüm sekmeleri. Görünüm ayarları taslağa kaydedilir; "Değişiklikleri yayınla"
 * ile canlıya alınır (yarım tasarım yanlışlıkla yayına çıkmaz).
 */
export default async function SiteControlLayout({ children, params }: LayoutProps<'/platform/siteler/[id]'>) {
  const session = await requireSuperAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const site = await getSiteAdmin(session, id);
  if (!site) notFound();
  const status = SITE_STATUS_META[site.status];
  const orgStatus = ORG_STATUS_LABELS[site.org.status];
  const domain = site.primaryDomain ?? (site.org.isDefault ? new URL(publicEnv.siteUrl).host : null);
  const siteUrl = domain ? (site.primaryDomain ? `https://${domain}` : publicEnv.siteUrl) : null;
  const logo = brandingUrl(site.settings.logo_url);
  const customized = Object.keys(site.draftRaw)
    .map((k) => SECTION_TAB[k])
    .filter(Boolean);
  return (
    <>
      <nav aria-label="Konum" className="mb-3 text-[13px] text-muted-foreground">
        <Link href="/platform/siteler" className="hover:text-foreground">
          Web Siteleri
        </Link>
        <span aria-hidden> › </span>
        <span className="text-foreground">{site.org.name}</span>
      </nav>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface sm:flex">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="max-h-10 max-w-12 object-contain" />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">{site.org.name.slice(0, 1)}</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[1.6rem] leading-tight font-semibold text-foreground sm:text-[1.9rem]">{site.org.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {site.org.status !== 'active' && orgStatus ? <Badge variant={orgStatus.tone}>{orgStatus.label}</Badge> : <Badge variant={status.tone}>● {status.label}</Badge>}
              {site.hasUnpublishedChanges && <Badge variant="info">Yayınlanmamış değişiklik</Badge>}
              {domain && (
                <span className="inline-flex items-center gap-1">
                  <Globe className="size-3.5" aria-hidden /> {domain}
                </span>
              )}
              <span>{site.version > 0 ? `Sürüm ${site.version}${site.publishedAt ? ` · ${formatRelativeDate(site.publishedAt)}` : ''}` : 'Varsayılan görünüm'}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {siteUrl && site.org.status === 'active' && (
            <Button asChild variant="outline" size="sm">
              <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Siteyi gör
              </a>
            </Button>
          )}
          {site.org.status === 'active' && <PreviewButton orgId={site.org.id} />}
          {site.hasUnpublishedChanges && <DiscardDraftButton orgId={site.org.id} />}
          <PublishButton orgId={site.org.id} disabled={!site.hasUnpublishedChanges} />
        </div>
      </div>
      <SiteTabs orgId={site.org.id} customized={customized} />
      <div className="pt-6">{children}</div>
    </>
  );
}
