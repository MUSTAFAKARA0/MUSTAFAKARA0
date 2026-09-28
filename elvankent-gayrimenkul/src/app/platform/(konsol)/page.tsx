import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Building2, HardDrive, Home, Inbox, Plus, Users } from 'lucide-react';
import { AdminPageHeader, Panel, StatCard } from '@/components/admin/ui';
import { OrgTable } from '@/components/platform/org-table';
import { Button } from '@/components/ui/button';
import { formatBytes, formatNumber } from '@/lib/format';
import { listPlans, listPlatformOrgs } from '@/modules/platform/queries';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Genel bakış' };

export default async function PlatformOverviewPage() {
  const session = await requireSuperAdminPage();
  const [orgs, plans, { data: users }] = await Promise.all([listPlatformOrgs(session), listPlans(session), session.supabase.rpc('platform_users', { p_limit: 500 })]);
  const sum = (key: 'property_count' | 'published_count' | 'storage_bytes' | 'leads_30d' | 'member_count') => orgs.reduce((acc, o) => acc + Number(o[key] ?? 0), 0);
  const active = orgs.filter((o) => o.status === 'active').length;
  const userCount = users?.length ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Genel bakış"
        description="Platformdaki tüm organizasyonlar, kullanım ve abonelik durumu."
        actions={
          <Button asChild>
            <Link href="/platform/organizasyonlar/yeni">
              <Plus /> Yeni organizasyon
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Organizasyon" value={formatNumber(orgs.length)} icon={Building2} tone="primary" hint={`${formatNumber(active)} aktif · ${formatNumber(orgs.length - active)} pasif`} href="/platform/organizasyonlar" />
        <StatCard label="Kullanıcı hesabı" value={userCount >= 500 ? '500+' : formatNumber(userCount)} icon={Users} hint={`${formatNumber(sum('member_count'))} aktif üyelik`} href="/platform/kullanicilar" />
        <StatCard label="İlan" value={formatNumber(sum('property_count'))} icon={Home} hint={`${formatNumber(sum('published_count'))} yayında`} />
        <StatCard label="Depolama" value={formatBytes(sum('storage_bytes'))} icon={HardDrive} hint="orijinaller + boyutlar" />
        <StatCard label="Talep (30 gün)" value={formatNumber(sum('leads_30d'))} icon={Inbox} />
      </div>
      <Panel className="mt-6" title="Organizasyonlar" bodyClassName="p-0 sm:p-0">
        <OrgTable orgs={orgs} plans={new Map(plans.map((p) => [p.id, p.name]))} />
      </Panel>
    </>
  );
}
