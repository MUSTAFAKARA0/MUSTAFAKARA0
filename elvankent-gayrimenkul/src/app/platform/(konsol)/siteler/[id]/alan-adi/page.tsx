import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { Panel } from '@/components/panel/ui';
import { PlatformDomainsPanel } from '@/components/platform/domains-panel';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Alan adı · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/alan-adi'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  const tenant = site.org.status === 'active' ? await getTenant(site.org.slug) : null;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel title="Alan adları" description="Alan adı önce TXT kaydıyla doğrulanır, sonra KARAY&apos;a yönlendirilir; site yalnızca AKTİF alan adında açılır.">
        <PlatformDomainsPanel session={session} orgId={site.org.id} fallbackUrl={tenant?.siteAddress ?? null} />
      </Panel>
      <aside className="space-y-6">
        <Panel title="Geçerli adres">
          {tenant?.siteAddress ? (
            <a href={tenant.siteAddress} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 font-semibold break-all text-primary hover:underline">
              {tenant.siteAddress.replace(/^https?:\/\//, '')} <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          ) : tenant ? (
            <p className="text-sm text-muted-foreground">Sitenin henüz bir adresi yok: alan adı bağlanana (veya KARAY alt alan adı tanımlanana) kadar site hiçbir adreste açılmaz.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Organizasyon aktif değil; site yayında değil.</p>
          )}
          <p className="mt-3 text-[12.5px] text-muted-foreground">Birincil (aktif) alan adı; site haritası, kanonik adres ve paylaşım bağlantılarında kullanılır.</p>
        </Panel>
        <Panel title="Nasıl bağlanır?">
          <ol className="list-decimal space-y-2 pl-5 text-[13.5px] text-foreground/85">
            <li>Alan adını ekleyin; gösterilen TXT kaydını alan adının DNS&apos;ine girin ve &quot;Doğrula&quot;ya basın.</li>
            <li>Doğrulandıktan sonra alan adını barındırma projesine (Vercel › Domains) ekleyin ve gösterilen yönlendirme kaydını DNS&apos;e girin.</li>
            <li>&quot;Bağlantıyı kontrol et&quot; ile aktif edin (hedef yapılandırılmamışsa barındırmada kontrol edip elle onaylayın).</li>
          </ol>
        </Panel>
      </aside>
    </div>
  );
}
