import type { Metadata } from 'next';
import { Panel } from '@/components/panel/ui';
import { RevisionList } from '@/components/site-editor/revision-list';
import { rollbackOfficeSite } from '@/app/actions/admin-site';
import { listRevisions } from '@/site-editor/service';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Geçmiş · Site yönetimi' };

/** Yayın sürümleri: ofis kendi sitesinin önceki sürümüne dönebilir (RLS: yalnızca kendi ofisi) */
export default async function Page() {
  const { ctx, site } = await getOfficeSite();
  const rows = await listRevisions(ctx.supabase, ctx.org.id);
  return (
    <Panel title="Yayın sürümleri" description="Her yayın yeni bir sürüm oluşturur. Geri yükleme, seçilen sürümü yeni bir sürüm olarak yayınlar; geçmiş silinmez." bodyClassName="p-0 sm:p-0">
      <RevisionList rows={rows} currentVersion={site.version} rollback={rollbackOfficeSite} />
    </Panel>
  );
}
