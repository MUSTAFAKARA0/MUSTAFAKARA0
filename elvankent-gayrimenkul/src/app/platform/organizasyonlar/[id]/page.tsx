import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExternalLink, Globe, Trash2 } from 'lucide-react';
import { ActionButton, AutoSaveSelect } from '@/components/admin/action-controls';
import { AuditList } from '@/components/admin/audit-list';
import { AdminPageHeader, EmptyPanel, Panel } from '@/components/admin/ui';
import { DomainForm, PlanForm } from '@/components/platform/org-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { removeDomain, setOrganizationStatus } from '@/app/actions/platform';
import { formatBytes, formatDate, formatNumber, formatRelativeDate } from '@/lib/format';
import { createServiceClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';
import { listAuditLogs } from '@/modules/audit/queries';
import { listPlans, listPlatformOrgs, ORG_STATUS_LABELS, SUBSCRIPTION_LABELS } from '@/modules/platform/queries';
import { ROLE_LABELS, type OrgRole } from '@/platform/auth/permissions';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Organizasyon' };

type Membership = { organization: string; slug: string; role: OrgRole; status: string };

export default async function PlatformOrgPage({ params }: PageProps<'/platform/organizasyonlar/[id]'>) {
  const session = await requireSuperAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [orgs, plans] = await Promise.all([listPlatformOrgs(session), listPlans(session)]);
  const org = orgs.find((o) => o.id === id);
  if (!org) notFound();

  // Alan adları: süper admin doğrulandıktan sonra (askıdaki organizasyonlar dâhil) sunucu istemcisiyle okunur
  const service = createServiceClient();
  const [domainsRes, usersRes, logs, tenant] = await Promise.all([
    service ? service.from('organization_domains').select('id, hostname, is_primary, created_at').eq('organization_id', id).order('created_at') : Promise.resolve({ data: [] }),
    session.supabase.rpc('platform_users', { p_limit: 500 }),
    listAuditLogs(session.supabase, { orgId: id, page: 1 }),
    org.status === 'active' ? getTenant(org.slug) : Promise.resolve(null),
  ]);
  const domains = domainsRes.data ?? [];
  const members = (usersRes.data ?? [])
    .map((u) => ({ ...u, membership: (u.memberships as Membership[]).find((m) => m.slug === org.slug) }))
    .filter((u) => u.membership);
  const plan = plans.find((p) => p.id === org.plan_id);
  const status = ORG_STATUS_LABELS[org.status];
  const sub = org.subscription_status ? SUBSCRIPTION_LABELS[org.subscription_status] : null;
  const storageLimit = plan?.max_storage_mb ? plan.max_storage_mb * 1024 * 1024 : null;

  return (
    <>
      <AdminPageHeader
        title={org.name}
        back={{ href: '/platform/organizasyonlar', label: 'Organizasyonlar' }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {status && <Badge variant={status.tone}>{status.label}</Badge>}
            {org.is_default && <Badge variant="primary-soft">Varsayılan kiracı</Badge>}
            <span>
              {org.slug} · önek {org.reference_prefix} · oluşturma {formatDate(org.created_at)}
            </span>
          </span>
        }
        actions={
          tenant && (
            <Button asChild variant="outline">
              <a href={tenant.baseUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Siteyi aç
              </a>
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Plan ve abonelik" description="Plan değişikliği mevcut aboneliği kapatır ve yenisini başlatır; geçmiş korunur.">
            <p className="mb-4 flex flex-wrap items-center gap-2 text-[14px]">
              <span className="font-semibold">{plan?.name ?? org.plan_id ?? 'Plan yok'}</span>
              {sub && <Badge variant={sub.tone}>{sub.label}</Badge>}
              {org.trial_ends_at && org.subscription_status === 'trialing' && <span className="text-muted-foreground">deneme bitişi {formatDate(org.trial_ends_at)}</span>}
            </p>
            <PlanForm orgId={org.id} plans={plans.map((p) => ({ id: p.id, name: p.name }))} current={org.plan_id} status={org.subscription_status} />
          </Panel>

          <Panel title="Alan adları" description="Alan adının DNS kaydı ve barındırma (Vercel) projesine eklenmesi ayrıca yapılmalıdır.">
            {domains.length === 0 ? (
              <p className="mb-4 text-sm text-muted-foreground">Özel alan adı yok; site {org.is_default ? 'ana adreste' : `${org.slug} alt alan adında`} yayınlanır.</p>
            ) : (
              <ul className="mb-5 divide-y divide-border rounded-xl border border-border">
                {domains.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Globe className="size-4 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{d.hostname}</span>
                    {d.is_primary && <Badge variant="primary-soft">Birincil</Badge>}
                    <ActionButton
                      size="xs"
                      variant="danger-ghost"
                      confirm={{ title: `${d.hostname} kaldırılsın mı?`, description: 'Bu alan adından gelen ziyaretçiler siteye ulaşamaz.', confirmLabel: 'Kaldır', destructive: true }}
                      action={async () => {
                        'use server';
                        return removeDomain(d.id, org.id);
                      }}
                    >
                      <Trash2 /> Kaldır
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
            <DomainForm orgId={org.id} />
          </Panel>

          <Panel title="Son işlemler" bodyClassName="p-0 sm:p-0">
            {logs.rows.length === 0 ? <EmptyPanel icon={Globe} title="Kayıt yok" /> : <AuditList rows={logs.rows.slice(0, 15)} linkTargets={false} />}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Hesap durumu">
            <AutoSaveSelect
              label="Durum"
              value={org.status}
              disabled={org.is_default}
              options={[
                { value: 'active', label: 'Aktif' },
                { value: 'suspended', label: 'Askıya alındı (site ve panel kapalı)' },
                { value: 'cancelled', label: 'Kapatıldı' },
              ]}
              onSave={async (value) => {
                'use server';
                return setOrganizationStatus(org.id, (value ?? 'active') as 'active' | 'suspended' | 'cancelled');
              }}
            />
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {org.is_default ? 'Varsayılan kiracı askıya alınamaz.' : 'Askıdaki organizasyonun sitesi yayından kalkar ve üyeleri panele giremez; veriler silinmez.'}
            </p>
          </Panel>
          <Panel title="Kullanım">
            <dl className="space-y-4 text-[13.5px]">
              <div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold">Kullanıcı</dt>
                  <dd className="numeric text-muted-foreground">
                    {formatNumber(Number(org.member_count))} / {plan?.max_users ?? 'sınırsız'}
                  </dd>
                </div>
                {plan?.max_users ? <Progress value={(Number(org.member_count) / plan.max_users) * 100} label="Kullanıcı kullanımı" className="mt-2" /> : null}
              </div>
              <div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold">İlan</dt>
                  <dd className="numeric text-muted-foreground">
                    {formatNumber(Number(org.property_count))} / {plan?.max_properties ?? 'sınırsız'}
                  </dd>
                </div>
                {plan?.max_properties ? <Progress value={(Number(org.property_count) / plan.max_properties) * 100} label="İlan kullanımı" className="mt-2" /> : null}
              </div>
              <div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold">Depolama</dt>
                  <dd className="numeric text-muted-foreground">
                    {formatBytes(Number(org.storage_bytes))} / {storageLimit ? formatBytes(storageLimit) : 'sınırsız'}
                  </dd>
                </div>
                {storageLimit ? <Progress value={(Number(org.storage_bytes) / storageLimit) * 100} label="Depolama kullanımı" className="mt-2" /> : null}
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt>Yayındaki ilan</dt>
                <dd className="numeric">{formatNumber(Number(org.published_count))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Talep (30 gün)</dt>
                <dd className="numeric">{formatNumber(Number(org.leads_30d))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Son etkinlik</dt>
                <dd>{org.last_activity_at ? formatRelativeDate(org.last_activity_at) : '—'}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Üyeler" bodyClassName="p-0 sm:p-0">
            {members.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Üye yok.</p>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((u) => (
                  <li key={u.user_id} className="px-5 py-3">
                    <p className="truncate text-[14px] font-semibold">{u.full_name || u.email}</p>
                    <p className="truncate text-[12.5px] text-muted-foreground">
                      {u.email} · {ROLE_LABELS[u.membership!.role] ?? u.membership!.role}
                      {u.membership!.status !== 'active' && ' · devre dışı'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
