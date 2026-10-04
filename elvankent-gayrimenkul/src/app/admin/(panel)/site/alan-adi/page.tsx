import type { Metadata } from 'next';
import { ExternalLink, Globe } from 'lucide-react';
import { Panel } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { vercelDnsRecords } from '@/modules/domains/provider';
import { getTenant } from '@/platform/tenant/tenant';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Alan adı · Site yönetimi' };

/**
 * Alan adı (yalnızca görüntüleme): bağlı alan adları, doğrulama durumu ve gereken DNS kayıtları.
 * Alan adı ekleme/kaldırma ve barındırma bağlantısı KARAY tarafından yapılır (DNS otomasyonu yok).
 * Okuma oturum istemcisiyle yapılır (RLS: yalnızca kendi ofisinin alan adları).
 */
export default async function Page() {
  const { ctx, site } = await getOfficeSite();
  const [domainsRes, tenant] = await Promise.all([
    ctx.supabase.from('organization_domains').select('id, hostname, is_primary, verified_at, created_at').eq('organization_id', ctx.org.id).order('created_at'),
    site.org.status === 'active' ? getTenant(site.org.slug) : Promise.resolve(null),
  ]);
  const domains = domainsRes.data ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel title="Alan adları" description="Sitenize bağlı alan adları ve DNS kayıtları. Alan adı eklemek veya kaldırmak için KARAY ile iletişime geçin.">
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="no-domains">
            Özel alan adı bağlı değil; siteniz {site.org.isDefault ? 'ana adreste' : `${site.org.slug} alt alan adında`} yayınlanır.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {domains.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Globe className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{d.hostname}</span>
                {d.is_primary && <Badge variant="primary-soft">Birincil</Badge>}
                {d.verified_at ? <Badge variant="success">Doğrulandı · {formatDate(d.verified_at)}</Badge> : <Badge variant="warning">Doğrulama bekliyor · site bu adreste henüz açılmaz</Badge>}
                <p className="w-full text-[12.5px] break-words text-muted-foreground">
                  DNS:{' '}
                  {vercelDnsRecords(d.hostname).map((r) => (
                    <code key={r.type} className="numeric mr-1 rounded bg-surface-muted px-1.5 py-0.5">
                      {r.type} {r.name} → {r.value}
                    </code>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <aside className="space-y-6">
        <Panel title="Geçerli adres">
          {tenant ? (
            <a href={tenant.baseUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 font-semibold break-all text-primary hover:underline">
              {tenant.baseUrl.replace(/^https?:\/\//, '')} <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Siteniz şu anda yayında değil.</p>
          )}
        </Panel>
        <Panel title="DNS nasıl ayarlanır?">
          <ol className="list-decimal space-y-2 pl-5 text-[13.5px] text-foreground/85">
            <li>Alan adınızın sağlayıcısının DNS ekranını açın.</li>
            <li>Yukarıda alan adının yanında gösterilen kaydı (A veya CNAME) oluşturun.</li>
            <li>DNS yayılması birkaç dakika ile 48 saat sürebilir; KARAY doğrulamayı tamamlayınca durum &quot;Doğrulandı&quot; olur.</li>
          </ol>
        </Panel>
      </aside>
    </div>
  );
}
