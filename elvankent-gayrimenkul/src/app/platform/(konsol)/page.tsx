import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Building2, HardDrive, Home, Inbox, Plus, Users } from 'lucide-react';
import { AdminPageHeader, Panel, StatCard } from '@/components/admin/ui';
import { OrgTable } from '@/components/platform/org-table';
import { Button } from '@/components/ui/button';
import { formatBytes, formatNumber } from '@/lib/format';
import { listPlans, listPlatformOrgs } from '@/modules/platform/queries';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import { cn } from '@/lib/utils';

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
        description={`${PLATFORM_BRAND.name} ${PLATFORM_BRAND.product} — müşteri ofisleri, web siteleri, kullanım ve abonelik durumu.`}
        actions={
          <Button asChild>
            <Link href="/platform/organizasyonlar/yeni">
              <Plus /> Yeni organizasyon
            </Link>
          </Button>
        }
      />
      {/* Hiyerarşi: KARAY platform sahibi; emlak ofisleri müşteri (kiracı), her birinin kendi sitesi */}
      <section aria-label="Platform yapısı" className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- KARAY simgesi (logo paketi) */}
            <img src={PLATFORM_BRAND.icons.svg} alt="" width={40} height={40} className="size-10" />
            <div>
              <p className="text-[15px] font-bold text-foreground">{PLATFORM_BRAND.name}</p>
              <p className="text-[12.5px] text-muted-foreground">Platform sahibi · {PLATFORM_BRAND.product}</p>
            </div>
          </div>
          <span className="hidden text-muted-foreground sm:block" aria-hidden>
            →
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold tracking-wide text-muted-foreground uppercase">Müşteri ofisleri ({formatNumber(orgs.length)})</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[...orgs]
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .slice(0, 8)
                .map((o, i) => (
                  <li key={o.id}>
                    <Link href={`/platform/siteler/${o.id}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted/60 px-3 py-1.5 text-[13px] font-semibold hover:border-border-strong">
                      <span className={cn('size-2 rounded-full', o.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden />
                      {o.name}
                      {i === 0 && <span className="text-[11.5px] font-medium text-muted-foreground">· ilk müşteri</span>}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Müşteri ofisi" value={formatNumber(orgs.length)} icon={Building2} tone="primary" hint={`${formatNumber(active)} aktif · ${formatNumber(orgs.length - active)} pasif`} href="/platform/organizasyonlar" />
        <StatCard label="Kullanıcı hesabı" value={userCount >= 500 ? '500+' : formatNumber(userCount)} icon={Users} hint={`${formatNumber(sum('member_count'))} aktif üyelik`} href="/platform/kullanicilar" />
        <StatCard label="İlan" value={formatNumber(sum('property_count'))} icon={Home} hint={`${formatNumber(sum('published_count'))} yayında`} />
        <StatCard label="Depolama" value={formatBytes(sum('storage_bytes'))} icon={HardDrive} hint="orijinaller + boyutlar" />
        <StatCard label="Talep (30 gün)" value={formatNumber(sum('leads_30d'))} icon={Inbox} />
      </div>
      <Panel className="mt-6" title="Müşteri ofisleri (organizasyonlar)" bodyClassName="p-0 sm:p-0">
        <OrgTable orgs={orgs} plans={new Map(plans.map((p) => [p.id, p.name]))} />
      </Panel>
    </>
  );
}
