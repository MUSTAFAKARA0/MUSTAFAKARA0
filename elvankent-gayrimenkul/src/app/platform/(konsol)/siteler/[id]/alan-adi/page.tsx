import type { Metadata } from 'next';
import { ExternalLink, Globe, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/admin/action-controls';
import { Panel } from '@/components/admin/ui';
import { DomainForm } from '@/components/platform/org-controls';
import { Badge } from '@/components/ui/badge';
import { removeDomain } from '@/app/actions/platform';
import { formatDate } from '@/lib/format';
import { createServiceClient } from '@/lib/supabase/server';
import { vercelDnsRecords } from '@/modules/domains/provider';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Alan adı · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/alan-adi'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  const orgId = site.org.id;
  // Alan adları süper admin doğrulandıktan sonra sunucu istemcisiyle okunur (askıdaki siteler dâhil)
  const service = createServiceClient();
  const [domainsRes, tenant] = await Promise.all([
    service ? service.from('organization_domains').select('id, hostname, is_primary, created_at').eq('organization_id', orgId).order('created_at') : Promise.resolve({ data: [] }),
    site.org.status === 'active' ? getTenant(site.org.slug) : Promise.resolve(null),
  ]);
  const domains = domainsRes.data ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel title="Alan adları" description="Alan adı burada kiracıya bağlanır; DNS kaydı ve barındırma (Vercel) projesine ekleme ayrıca yapılmalıdır.">
        {domains.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">Özel alan adı yok; site {site.org.isDefault ? 'ana adreste' : `${site.org.slug} alt alan adında`} yayınlanır.</p>
        ) : (
          <ul className="mb-5 divide-y divide-border rounded-xl border border-border">
            {domains.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Globe className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{d.hostname}</span>
                {d.is_primary && <Badge variant="primary-soft">Birincil</Badge>}
                <span className="text-[12.5px] text-muted-foreground">{formatDate(d.created_at)}</span>
                <ActionButton
                  size="xs"
                  variant="danger-ghost"
                  confirm={{ title: `${d.hostname} kaldırılsın mı?`, description: 'Bu alan adından gelen ziyaretçiler siteye ulaşamaz.', confirmLabel: 'Kaldır', destructive: true }}
                  action={async () => {
                    'use server';
                    return removeDomain(d.id, orgId);
                  }}
                >
                  <Trash2 /> Kaldır
                </ActionButton>
                <p className="w-full text-[12.5px] break-words text-muted-foreground">
                  DNS:{' '}
                  {vercelDnsRecords(d.hostname).map((r) => (
                    <code key={r.type} className="numeric mr-1 rounded bg-surface-muted px-1.5 py-0.5">
                      {r.type} {r.name} → {r.value}
                    </code>
                  ))}{' '}
                  (Vercel panelinde projeye özel değer gösterilirse o kullanılır.)
                </p>
              </li>
            ))}
          </ul>
        )}
        <DomainForm orgId={orgId} />
      </Panel>
      <aside className="space-y-6">
        <Panel title="Geçerli adres">
          {tenant ? (
            <a href={tenant.baseUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 font-semibold break-all text-primary hover:underline">
              {tenant.baseUrl.replace(/^https?:\/\//, '')} <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Organizasyon aktif değil; site yayında değil.</p>
          )}
          <p className="mt-3 text-[12.5px] text-muted-foreground">Birincil alan adı; site haritası, kanonik adres ve paylaşım bağlantılarında kullanılır.</p>
        </Panel>
        <Panel title="Nasıl bağlanır?">
          <ol className="list-decimal space-y-2 pl-5 text-[13.5px] text-foreground/85">
            <li>Alan adını buraya ekleyin.</li>
            <li>Vercel › Proje › Settings › Domains ekranında aynı alan adını ekleyin.</li>
            <li>Alan adı sağlayıcınızın DNS ekranında gösterilen kaydı oluşturun.</li>
            <li>DNS yayıldıktan sonra (birkaç dakika–48 saat) site bu adreste açılır; SSL Vercel tarafından verilir.</li>
          </ol>
        </Panel>
      </aside>
    </div>
  );
}
