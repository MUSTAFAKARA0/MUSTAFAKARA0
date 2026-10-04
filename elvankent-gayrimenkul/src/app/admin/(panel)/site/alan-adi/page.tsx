import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { Panel } from '@/components/panel/ui';
import { DomainManager } from '@/components/domains/domain-manager';
import {
  addOfficeDomain,
  connectOfficeDomain,
  removeOfficeDomain,
  rotateOfficeDomainVerification,
  setPrimaryOfficeDomain,
  verifyOfficeDomain,
} from '@/app/actions/admin-domains';
import { listDomains } from '@/modules/domains/service';
import { getTenant } from '@/platform/tenant/tenant';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Alan adı · Site yönetimi' };

/**
 * Özel alan adı (P0.5): ofis kendi alan adını ekler, TXT kaydıyla doğrular ve KARAY'a
 * yönlendirir. Organizasyon oturumdan gelir (settings.manage); başka ofisin alan adı görünmez.
 */
export default async function Page() {
  const { ctx, site } = await getOfficeSite();
  const [domains, tenant] = await Promise.all([
    listDomains({ userId: ctx.user.id, platform: false }, ctx.org.id),
    site.org.status === 'active' ? getTenant(site.org.slug) : Promise.resolve(null),
  ]);
  const canAdd = ctx.plan.features.customDomain;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel title="Alan adları" description="Kendi alan adınızı bağlayın: önce sahipliği TXT kaydıyla doğrulayın, sonra alan adını KARAY'a yönlendirin.">
        <DomainManager
          domains={domains}
          fallbackUrl={tenant?.baseUrl ?? null}
          canAdd={canAdd}
          addDisabledReason="Planınız özel alan adını içermiyor. Planınızı yükseltmek için KARAY ile iletişime geçin."
          actions={{
            add: addOfficeDomain,
            verify: verifyOfficeDomain,
            connect: connectOfficeDomain,
            rotate: rotateOfficeDomainVerification,
            primary: setPrimaryOfficeDomain,
            remove: removeOfficeDomain,
          }}
        />
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
        <Panel title="Nasıl bağlanır?">
          <ol className="list-decimal space-y-2 pl-5 text-[13.5px] text-foreground/85">
            <li>Alan adını ekleyin.</li>
            <li>Alan adı sağlayıcınızın DNS ekranında gösterilen TXT kaydını oluşturun ve &quot;Doğrula&quot;ya basın.</li>
            <li>Doğrulandıktan sonra gösterilen yönlendirme kaydını (CNAME veya A) ekleyin ve &quot;Bağlantıyı kontrol et&quot;e basın.</li>
            <li>DNS yayılması birkaç dakika ile 48 saat sürebilir. Site yalnızca alan adı &quot;Aktif&quot; olduğunda bu adreste açılır.</li>
          </ol>
        </Panel>
      </aside>
    </div>
  );
}
