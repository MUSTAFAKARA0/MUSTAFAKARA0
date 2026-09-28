import { notFound } from 'next/navigation';
import { ExternalLink, Globe } from 'lucide-react';
import Link from '@/components/common/intent-link';
import { DiscardDraftButton, PreviewButton, PublishButton } from '@/components/platform/site/site-actions';
import { SiteTabs } from '@/components/platform/site/site-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { publicEnv } from '@/lib/env';
import { formatRelativeDate } from '@/lib/format';
import { cn, isUuid } from '@/lib/utils';
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
  brand: 'marka',
  style: 'tema',
};

const TAB_LABEL: Record<string, string> = { marka: 'Marka', tema: 'Tema', renkler: 'Renkler', tipografi: 'Tipografi', header: 'Header', menu: 'Menü', 'ana-sayfa': 'Ana Sayfa', footer: 'Footer', sayfalar: 'Sayfalar', seo: 'SEO' };

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
  const logo = brandingUrl(site.brand.logo_url);
  const pending = [...new Set(site.pendingSections.map((k) => SECTION_TAB[k]).filter(Boolean))];
  const pendingLabels = pending.map((t) => TAB_LABEL[t]).filter(Boolean);
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
      {/* Canlı ↔ taslak durumu: kullanıcı neyin yayında olduğunu düşünmek zorunda kalmaz */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', site.status === 'active' && site.org.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden />
          <div className="min-w-0 text-[13.5px]">
            <p className="font-semibold text-foreground">
              Canlı site · {site.version > 0 ? `Sürüm ${site.version}` : 'Varsayılan görünüm'}
            </p>
            <p className="text-muted-foreground">
              {site.publishedAt ? `Son yayın ${formatRelativeDate(site.publishedAt)}` : 'Henüz yayın yapılmadı'} · ziyaretçiler bunu görür
            </p>
          </div>
        </div>
        <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', site.hasUnpublishedChanges ? 'border-amber-300 bg-amber-50' : 'border-border bg-surface')}>
          <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', site.hasUnpublishedChanges ? 'bg-amber-500' : 'bg-border-strong')} aria-hidden />
          <div className="min-w-0 text-[13.5px]">
            <p className={cn('font-semibold', site.hasUnpublishedChanges ? 'text-amber-900' : 'text-foreground')}>
              {site.hasUnpublishedChanges ? 'Taslakta yayınlanmamış değişiklikler var' : 'Taslak canlı siteyle aynı'}
            </p>
            <p className={site.hasUnpublishedChanges ? 'text-amber-900/80' : 'text-muted-foreground'}>
              {site.hasUnpublishedChanges
                ? `${pendingLabels.length ? pendingLabels.join(', ') : 'Bölümler'} · önizleyip yayınlayın`
                : 'Değişiklikler önce taslağa kaydedilir; yayınlayana kadar canlı site değişmez'}
            </p>
          </div>
        </div>
      </div>
      <SiteTabs orgId={site.org.id} pending={pending} />
      <div className="pt-6">{children}</div>
    </>
  );
}
