import type { Metadata } from 'next';
import { ArrowRight, ExternalLink, Search, Trash2, Waypoints } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { removeBrandingImage } from '@/app/actions/admin-settings';
import { BrandingImageField } from '@/components/panel/branding-image-field';
import { RedirectDialog } from '@/components/admin/seo/redirect-dialog';
import { SeoSettingsForm } from '@/components/admin/seo/seo-settings-form';
import { AdminPageHeader, EmptyPanel, Panel, TableWrap, td, th } from '@/components/panel/ui';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { deleteRedirect } from '@/app/actions/admin-content';
import { formatDate, formatNumber } from '@/lib/format';
import { firstParam, parsePositiveInt } from '@/lib/utils';
import { getSeoSettings, listRedirects } from '@/modules/content/admin-queries';
import { brandingUrl } from '@/modules/media/variants';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant, tenantUrl } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'SEO' };

export default async function SeoPage({ searchParams }: PageProps<'/admin/seo'>) {
  const ctx = await requirePagePermission('seo.manage');
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const page = Math.max(1, parsePositiveInt(firstParam(sp.sayfa), 10_000) ?? 1);
  const [settings, redirects, tenant] = await Promise.all([getSeoSettings(ctx), listRedirects(ctx, q, page), getTenant(ctx.org.slug)]);
  const siteLink = (path: string) => (tenant ? tenantUrl(tenant, path) : path);
  const siteHost = tenant ? new URL(tenant.baseUrl).host : 'site';
  const name = settings?.displayName ?? ctx.org.name;
  const ogUrl = brandingUrl(settings?.ogImageUrl);
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (p > 1) params.set('sayfa', String(p));
    const qs = params.toString();
    return qs ? `/admin/seo?${qs}#yonlendirmeler` : '/admin/seo#yonlendirmeler';
  };

  return (
    <>
      <AdminPageHeader
        title="SEO"
        description="Arama motorlarında ve sosyal medyada sitenizin nasıl görüneceği. İlan, blog ve bölge sayfalarının SEO alanları kendi düzenleyicilerindedir."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Ana sayfa ve site geneli" description="Boş bırakılan alanlar şirket adından otomatik oluşturulur.">
            <SeoSettingsForm
              initial={{ seoTitle: settings?.seoTitle ?? null, seoDescription: settings?.seoDescription ?? null, googleSiteVerification: settings?.googleSiteVerification ?? null }}
              siteHost={siteHost}
              fallbackTitle={`${name} | Satılık ve kiralık gayrimenkuller`}
              fallbackDescription={tenant?.settings.description ?? `${name}: satılık ve kiralık daire, villa, ticari gayrimenkul ve arsa ilanları.`}
            />
          </Panel>

          <Panel
            id="yonlendirmeler"
            title="Yönlendirmeler"
            description="Adresi değişen ilan, yazı ve bölge sayfaları için yönlendirmeler otomatik oluşturulur. Eski sitenizden kalan adresleri buradan ekleyebilirsiniz."
            actions={<RedirectDialog />}
            bodyClassName="p-0 sm:p-0"
          >
            <form action="/admin/seo#yonlendirmeler" role="search" className="relative border-b border-border p-4 sm:px-6">
              <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground sm:left-9" aria-hidden />
              <label htmlFor="redirect-search" className="sr-only">
                Yönlendirmelerde ara
              </label>
              <Input id="redirect-search" name="q" defaultValue={q} placeholder="Adreste ara (ör. /ilan/)" className="h-10 pl-10" />
            </form>
            {redirects.rows.length === 0 ? (
              <EmptyPanel icon={Waypoints} title={q ? 'Eşleşen yönlendirme yok' : 'Henüz yönlendirme yok'} description="Bir ilanın adresi değiştiğinde veya kalıcı silindiğinde yönlendirme burada görünür." />
            ) : (
              <TableWrap>
                <thead className="border-b border-border bg-surface-muted/50">
                  <tr>
                    <th className={th}>Eski adres</th>
                    <th className={th}>Yeni adres</th>
                    <th className={th}>Tür</th>
                    <th className={th}>Tarih</th>
                    <th className={th}>
                      <span className="sr-only">İşlemler</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {redirects.rows.map((r) => (
                    <tr key={r.id}>
                      <td className={`${td} max-w-72 min-w-44 font-mono text-[12.5px] [overflow-wrap:anywhere]`}>{r.fromPath}</td>
                      <td className={`${td} max-w-72 min-w-44 font-mono text-[12.5px] [overflow-wrap:anywhere]`}>
                        <span className="inline-flex items-start gap-1.5">
                          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          {r.toPath}
                        </span>
                      </td>
                      <td className={td}>
                        {r.statusCode === 302 || r.statusCode === 307 ? <Badge variant="warning">Geçici</Badge> : <Badge>Kalıcı</Badge>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDate(r.createdAt)}</td>
                      <td className={`${td} text-right whitespace-nowrap`}>
                        <RedirectDialog initial={r} />
                        <ActionButton
                          size="xs"
                          variant="danger-ghost"
                          confirm={{ title: 'Yönlendirme silinsin mi?', description: `${r.fromPath} adresine gelen ziyaretçiler artık yönlendirilmez.`, confirmLabel: 'Sil', destructive: true }}
                          action={async () => {
                            'use server';
                            return deleteRedirect(r.id);
                          }}
                        >
                          <Trash2 /> Sil
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
            {redirects.total > 0 && <p className="border-t border-border px-6 py-3 text-[12.5px] text-muted-foreground">{formatNumber(redirects.total)} yönlendirme</p>}
          </Panel>
          <Pagination page={page} pageCount={redirects.pageCount} hrefFor={hrefFor} />
        </div>

        <aside className="space-y-6">
          <Panel title="Paylaşım görseli" description="WhatsApp, Facebook, LinkedIn ve X'te site bağlantınız paylaşıldığında gösterilir.">
            <BrandingImageField removeAction={removeBrandingImage}
              kind="og"
              label="Site paylaşım görseli"
              url={ogUrl}
              stacked
              previewClassName="aspect-[1200/630] w-full"
              hint="1200×630 px'e kırpılır. Yüklenmezse şirket adı ve renklerinizle otomatik bir görsel üretilir. İlan sayfaları kendi fotoğraflarını kullanır."
            />
          </Panel>
          <Panel title="Arama motoru dosyaları">
            <ul className="space-y-3 text-[13.5px]">
              {[
                { path: '/sitemap.xml', label: 'Site haritası', desc: 'Yayındaki ilanlar, kategori, bölge ve blog sayfaları. Search Console’a bu adresi gönderin.' },
                { path: '/robots.txt', label: 'robots.txt', desc: 'Yönetim paneli, önizleme ve özel bağlantılar dizine kapalıdır.' },
              ].map((f) => (
                <li key={f.path}>
                  <a href={siteLink(f.path)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold hover:underline">
                    {f.label} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{f.desc}</p>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Google Search Console
              </a>
            </Button>
          </Panel>
        </aside>
      </div>
    </>
  );
}
