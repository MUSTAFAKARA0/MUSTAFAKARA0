import type { Metadata } from 'next';
import { AdminPageHeader, Panel } from '@/components/panel/ui';
import { PlanForm } from '@/components/platform/plan-form';
import { listPlans, listPlatformOrgs } from '@/modules/platform/queries';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Planlar' };

export default async function PlatformPlansPage() {
  const session = await requireSuperAdminPage();
  const [plans, orgs] = await Promise.all([listPlans(session), listPlatformOrgs(session)]);
  return (
    <>
      <AdminPageHeader
        title="Planlar"
        description="Plan sınırları ve özellikleri veritabanında uygulanır (ilan/kullanıcı limiti, depolama kotası, özellik erişimi). Ödeme altyapısı henüz bağlı değildir; abonelikler buradan elle yönetilir."
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <Panel key={p.id} title={p.name} description={`${p.id} · ${orgs.filter((o) => o.plan_id === p.id).length} organizasyon`}>
            <PlanForm plan={{ ...p, price_monthly: p.price_monthly === null ? null : Number(p.price_monthly) }} />
          </Panel>
        ))}
      </div>
    </>
  );
}
