import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AdminPageHeader, Panel } from '@/components/admin/ui';
import { OrgTable } from '@/components/platform/org-table';
import { Button } from '@/components/ui/button';
import { listPlans, listPlatformOrgs } from '@/modules/platform/queries';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Organizasyonlar' };

export default async function PlatformOrgsPage() {
  const session = await requireSuperAdminPage();
  const [orgs, plans] = await Promise.all([listPlatformOrgs(session), listPlans(session)]);
  return (
    <>
      <AdminPageHeader
        title="Organizasyonlar"
        description="Her organizasyon (emlak ofisi) kendi verisine, kullanıcılarına, markasına ve alan adına sahiptir; veriler veritabanında birbirinden yalıtılmıştır."
        actions={
          <Button asChild>
            <Link href="/platform/organizasyonlar/yeni">
              <Plus /> Yeni organizasyon
            </Link>
          </Button>
        }
      />
      <Panel bodyClassName="p-0 sm:p-0">
        <OrgTable orgs={orgs} plans={new Map(plans.map((p) => [p.id, p.name]))} />
      </Panel>
    </>
  );
}
