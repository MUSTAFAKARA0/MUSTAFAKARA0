import type { Metadata } from 'next';
import { History, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/admin/action-controls';
import { AuditList } from '@/components/admin/audit-list';
import { EmptyPanel, Panel } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { rollbackSite } from '@/app/actions/site-builder';
import { formatDateTime } from '@/lib/format';
import { listAuditLogs } from '@/modules/audit/queries';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Geçmiş · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/gecmis'>) {
  const session = await requireSuperAdminPage();
  const { id } = await params;
  // Sürümler yalnızca süper admine açıktır (RLS); içerik (config) listede okunmaz.
  // Site kaydı, sürümler ve işlem kaydı paralel okunur.
  const [site, revisions, logs] = await Promise.all([
    getSiteOr404(session, id),
    session.supabase.from('site_config_revisions').select('version, note, created_at, created_by').eq('organization_id', id).order('version', { ascending: false }).limit(50),
    listAuditLogs(session.supabase, { orgId: id, category: 'site', page: 1 }),
  ]);
  const orgId = site.org.id;
  const rows = revisions.data ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Panel title="Yayın sürümleri" description="Her yayın yeni bir sürüm oluşturur. Geri yükleme, seçilen sürümü yeni bir sürüm olarak yayınlar; geçmiş silinmez." bodyClassName="p-0 sm:p-0">
        {rows.length === 0 ? (
          <EmptyPanel icon={History} title="Henüz yayın yok" description="İlk yayından sonra sürümler burada listelenir." />
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.version} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="numeric flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-[13px] font-bold">v{r.version}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {r.note || 'Not eklenmemiş'}
                    {r.version === site.version && (
                      <Badge variant="success" className="ml-2 align-middle">
                        Yayında
                      </Badge>
                    )}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">{formatDateTime(r.created_at)}</p>
                </div>
                {r.version !== site.version && (
                  <ActionButton
                    size="xs"
                    confirm={{
                      title: `Sürüm ${r.version} geri yüklensin mi?`,
                      description: 'Bu sürüm canlı siteye alınır ve yeni sürüm olarak kaydedilir. Taslaktaki yayınlanmamış değişiklikler bu sürümle değiştirilir.',
                      confirmLabel: 'Geri yükle',
                    }}
                    action={async () => {
                      'use server';
                      return rollbackSite(orgId, r.version);
                    }}
                  >
                    <RotateCcw /> Geri yükle
                  </ActionButton>
                )}
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <Panel title="Site işlem kaydı" description="Taslak, yayın, geri alma, durum, özellik, marka ve alan adı işlemleri." bodyClassName="p-0 sm:p-0">
        {logs.rows.length === 0 ? <EmptyPanel icon={History} title="Kayıt yok" /> : <AuditList rows={logs.rows.slice(0, 40)} linkTargets={false} />}
      </Panel>
    </div>
  );
}
