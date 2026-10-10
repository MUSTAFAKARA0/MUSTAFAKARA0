import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from '@/components/common/intent-link';
import { CheckCircle2, Circle, ExternalLink, Globe, Settings2 } from 'lucide-react';
import { AutoSaveSelect } from '@/components/panel/action-controls';
import { AuditList } from '@/components/panel/audit-list';
import { AdminPageHeader, EmptyPanel, Panel } from '@/components/panel/ui';
import { PlanForm } from '@/components/platform/org-controls';
import { OrgNoteForm } from '@/components/platform/karay-forms';
import { PlatformDomainsPanel } from '@/components/platform/domains-panel';
import { OwnerInvitationCard } from '@/components/platform/owner-invitation';
import { getOwnerInvitation } from '@/modules/platform/invitations/service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { setOrganizationStatus } from '@/app/actions/platform';
import { formatBytes, formatDate, formatDateTime, formatNumber, formatRelativeDate } from '@/lib/format';
import { isUuid } from '@/lib/utils';
import { listAuditLogs } from '@/modules/audit/queries';
import { listPlans, ORG_STATUS_LABELS, SUBSCRIPTION_LABELS } from '@/modules/platform/queries';
import { listCustomers } from '@/modules/platform/customers';
import { onboardingSteps } from '@/modules/platform/customer-status';
import { ROLE_LABELS, type OrgRole } from '@/platform/auth/permissions';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { getTenant } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Organizasyon' };

type Membership = { organization: string; slug: string; role: OrgRole; status: string };

export default async function PlatformOrgPage({ params }: PageProps<'/platform/organizasyonlar/[id]'>) {
  const session = await requireSuperAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [orgs, plans] = await Promise.all([listCustomers(session), listPlans(session)]);
  const org = orgs.find((o) => o.id === id);
  if (!org) notFound();

  const [usersRes, logs, tenant, invitation, notesRes] = await Promise.all([
    session.supabase.rpc('platform_users', { p_limit: 500 }),
    listAuditLogs(session.supabase, { orgId: id, page: 1 }),
    org.status === 'active' ? getTenant(org.slug) : Promise.resolve(null),
    getOwnerInvitation(session, id),
    session.supabase.from('platform_org_notes').select('id, body, created_at, author_id').eq('organization_id', id).order('created_at', { ascending: false }).limit(30),
  ]);
  const notes = notesRes.data ?? [];
  const emails = new Map((usersRes.data ?? []).map((u) => [u.user_id, u.email]));
  const steps = onboardingSteps(org.flags);
  const SITE_LABEL = { active: 'Ziyaretçiye açık', draft: 'Taslak — ziyaretçiye kapalı', maintenance: 'Bakımda' } as const;
  const members = (usersRes.data ?? [])
    .map((u) => ({ ...u, membership: (u.memberships as Membership[]).find((m) => m.slug === org.slug) }))
    .filter((u) => u.membership);
  const owner = members.find((u) => u.membership!.role === 'owner' && u.membership!.status === 'active');
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
          <div className="flex flex-wrap gap-2">
            {tenant?.siteAddress && (
              <Button asChild variant="outline">
                <a href={tenant.siteAddress} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Siteyi aç
                </a>
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Müşteri durumu"
            description="Kurulum adımları ofis panelindeki listeyle aynıdır. Kurulum bitince siteyi ziyaretçiye açmak KARAY'ın teslim adımıdır (Web sitesi › Yayın durumu › Yayında)."
          >
            <div className="flex flex-wrap items-center gap-2" data-customer-status={org.customer.key}>
              <Badge variant={org.customer.tone}>{org.customer.label}</Badge>
              <span className="text-[13.5px] text-muted-foreground">
                kurulum {org.progress.done}/{org.progress.total} · site: {SITE_LABEL[org.siteStatus]}
                {org.publishedVersion > 0 ? ` · yayın v${org.publishedVersion}${org.publishedAt ? ` (${formatRelativeDate(org.publishedAt)})` : ''}` : ' · hiç yayınlanmadı'}
              </span>
            </div>
            {org.customer.issues.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
                {org.customer.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {steps.map((st) => (
                <li key={st.key} className="flex items-start gap-2 text-[13.5px]" data-step={st.key} data-done={st.done}>
                  {st.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span>
                    <span className={st.done ? 'font-semibold' : ''}>{st.label}</span>
                    {!st.required && <span className="text-muted-foreground"> (isteğe bağlı)</span>}
                    <span className="block text-[12px] text-muted-foreground">{st.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href={`/platform/siteler/${org.id}`}>
                  <Settings2 /> Web sitesini yönet
                </Link>
              </Button>
            </div>
          </Panel>

          <Panel title="Plan ve abonelik" description="Plan değişikliği mevcut aboneliği kapatır ve yenisini başlatır; geçmiş korunur.">
            <p className="mb-4 flex flex-wrap items-center gap-2 text-[14px]">
              <span className="font-semibold">{plan?.name ?? org.plan_id ?? 'Plan yok'}</span>
              {sub && <Badge variant={sub.tone}>{sub.label}</Badge>}
              {org.trial_ends_at && org.subscription_status === 'trialing' && <span className="text-muted-foreground">deneme bitişi {formatDate(org.trial_ends_at)}</span>}
            </p>
            <PlanForm orgId={org.id} plans={plans.map((p) => ({ id: p.id, name: p.name }))} current={org.plan_id} status={org.subscription_status} />
          </Panel>

          <Panel title="Alan adları" description="TXT ile doğrulanan ve KARAY'a yönlendirilen (aktif) alan adında site açılır.">
            <PlatformDomainsPanel session={session} orgId={org.id} fallbackUrl={tenant?.siteAddress ?? null} />
          </Panel>

          <Panel title="KARAY notları" description="Destek, satış ve teslim notları. Yalnızca KARAY ekibi görür; notlar düzenlenmez ve silinmez.">
            <OrgNoteForm orgId={org.id} />
            {notes.length > 0 && (
              <ul className="mt-5 divide-y divide-border border-t border-border" data-org-notes>
                {notes.map((n) => (
                  <li key={n.id} className="py-3">
                    <p className="text-[12px] text-muted-foreground">
                      {formatDateTime(n.created_at)} · {(n.author_id && emails.get(n.author_id)) || 'silinmiş kullanıcı'}
                    </p>
                    <p className="mt-1 text-[14px] whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
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
          <Panel title="Sahip hesabı" description="Şifre kimseye gösterilmez; sahip tek kullanımlık davet bağlantısıyla kendisi belirler.">
            <OwnerInvitationCard
              orgId={org.id}
              email={invitation?.email ?? owner?.email ?? null}
              invitation={
                invitation
                  ? { status: invitation.status, expiresAt: invitation.expiresAt, lastSentAt: invitation.lastSentAt, acceptedAt: invitation.acceptedAt, accountPending: invitation.accountPending }
                  : null
              }
            />
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
