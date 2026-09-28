import type { Metadata } from 'next';
import { AdminPageHeader, Panel } from '@/components/admin/ui';
import { CreateOrgForm } from '@/components/platform/org-controls';
import { listPlans } from '@/modules/platform/queries';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Yeni organizasyon' };

export default async function NewOrgPage() {
  const session = await requireSuperAdminPage();
  const plans = await listPlans(session);
  return (
    <>
      <AdminPageHeader
        title="Yeni organizasyon"
        description="Yeni bir emlak ofisi (kiracı) açar: boş site ayarları, deneme aboneliği ve sahip (owner) hesabı oluşturulur."
        back={{ href: '/platform/organizasyonlar', label: 'Organizasyonlar' }}
      />
      <Panel className="max-w-3xl">
        <CreateOrgForm plans={plans.map((p) => ({ id: p.id, name: p.name }))} />
      </Panel>
    </>
  );
}
