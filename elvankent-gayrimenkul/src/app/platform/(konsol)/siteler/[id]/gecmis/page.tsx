import type { Metadata } from 'next';
import { History } from 'lucide-react';
import { AuditList } from '@/components/panel/audit-list';
import { EmptyPanel, Panel } from '@/components/panel/ui';
import { RevisionList } from '@/components/site-editor/revision-list';
import { rollbackSite } from '@/app/actions/site-builder';
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
  // Yayınlayan: işlem kaydındaki site.published / site.rolled_back (sürüm numarasıyla eşleşir; ek sorgu yok)
  const publisher = new Map<number, string>();
  for (const l of logs.rows) {
    const m = (l.metadata ?? {}) as { version?: number; new_version?: number };
    const v = l.action === 'site.published' ? m.version : l.action === 'site.rolled_back' ? m.new_version : undefined;
    if (typeof v === 'number' && l.actor_label && !publisher.has(v)) publisher.set(v, l.actor_label);
  }
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Panel title="Yayın sürümleri" description="Her yayın yeni bir sürüm oluşturur. Geri yükleme, seçilen sürümü yeni bir sürüm olarak yayınlar; geçmiş silinmez." bodyClassName="p-0 sm:p-0">
        <RevisionList rows={rows} currentVersion={site.version} publisher={publisher} rollback={rollbackSite.bind(null, orgId)} />
      </Panel>
      <Panel title="Site işlem kaydı" description="Taslak, yayın, geri alma, durum, özellik, marka ve alan adı işlemleri." bodyClassName="p-0 sm:p-0">
        {logs.rows.length === 0 ? <EmptyPanel icon={History} title="Kayıt yok" /> : <AuditList rows={logs.rows.slice(0, 40)} linkTargets={false} />}
      </Panel>
    </div>
  );
}
