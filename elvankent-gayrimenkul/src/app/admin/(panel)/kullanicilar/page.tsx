import type { Metadata } from 'next';
import { ShieldCheck, Users } from 'lucide-react';
import { AutoSaveSelect } from '@/components/panel/action-controls';
import { MemberMenu, NewMemberDialog } from '@/components/admin/users/member-controls';
import { MfaPolicyToggle } from '@/components/admin/mfa/mfa-policy';
import { AdminPageHeader, EmptyPanel, Panel, TableWrap, td, th } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { updateMemberRole } from '@/app/actions/admin-users';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { assignableRoles, PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES, type OrgRole } from '@/platform/auth/permissions';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Kullanıcılar' };

export default async function UsersPage() {
  const ctx = await requirePagePermission('users.manage');
  const [{ data, error }, { data: mfaRows }, { data: org }] = await Promise.all([
    ctx.supabase.rpc('list_org_members', { p_org: ctx.org.id }),
    ctx.supabase.rpc('org_member_mfa_status', { p_org: ctx.org.id }),
    ctx.supabase.from('organizations').select('require_admin_mfa').eq('id', ctx.org.id).maybeSingle(),
  ]);
  const members = data ?? [];
  const mfaOn = new Set((mfaRows ?? []).filter((r) => r.mfa_enabled).map((r) => r.user_id));
  const active = members.filter((m) => m.status === 'active').length;
  const limit = ctx.plan.limits.users;
  const full = limit !== null && active >= limit;
  const roles = assignableRoles(ctx.role);

  return (
    <>
      <AdminPageHeader
        title="Kullanıcılar"
        description={`Ekibinizdeki kişiler ve rolleri · ${active} aktif kullanıcı${limit ? ` / plan sınırı ${limit}` : ''}`}
        actions={<NewMemberDialog roles={roles} disabledReason={full ? 'Planınızın kullanıcı limitine ulaşıldı.' : undefined} />}
      />
      <Panel bodyClassName="p-0 sm:p-0">
        {error ? (
          <EmptyPanel icon={Users} title="Kullanıcılar yüklenemedi" description="Sayfayı yenileyerek tekrar deneyin." />
        ) : (
          <TableWrap className="[&_table]:min-w-[820px]">
            <thead className="border-b border-border bg-surface-muted/50">
              <tr>
                <th className={th}>Kullanıcı</th>
                <th className={th}>Rol</th>
                <th className={th}>Durum</th>
                <th className={th}>Son giriş</th>
                <th className={th}>Eklenme</th>
                <th className={th}>
                  <span className="sr-only">İşlemler</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const self = m.user_id === ctx.user.id;
                const locked = self || (m.role === 'owner' && ctx.role !== 'owner');
                const name = m.full_name || m.email || 'Kullanıcı';
                return (
                  <tr key={m.user_id} className={cn(m.status === 'disabled' && 'bg-surface-muted/40')}>
                    <td className={cn(td, 'max-w-72')}>
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        <span className="truncate">{name}</span>
                        {self && <Badge variant="primary-soft">Siz</Badge>}
                        {m.password_change_required && <Badge variant="warning">Şifre değişikliği bekliyor</Badge>}
                        {mfaOn.has(m.user_id) ? (
                          <Badge variant="success">2 adımlı doğrulama</Badge>
                        ) : (
                          org?.require_admin_mfa && (m.role === 'owner' || m.role === 'admin') && <Badge variant="warning">2 adımlı doğrulama kurulmadı</Badge>
                        )}
                      </p>
                      {m.email && <p className="truncate text-[12.5px] text-muted-foreground">{m.email}</p>}
                    </td>
                    <td className={cn(td, 'w-48')}>
                      {locked ? (
                        <span className="text-[14px] font-medium">{ROLE_LABELS[m.role]}</span>
                      ) : (
                        <AutoSaveSelect
                          label="Rol"
                          className="[&>span]:sr-only"
                          value={m.role}
                          options={(roles.includes(m.role) ? roles : [m.role, ...roles]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                          onSave={async (value) => {
                            'use server';
                            return updateMemberRole(m.user_id, value ?? m.role);
                          }}
                        />
                      )}
                    </td>
                    <td className={td}>{m.status === 'active' ? <Badge variant="success">Aktif</Badge> : <Badge>Devre dışı</Badge>}</td>
                    <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{m.last_sign_in_at ? formatRelativeDate(m.last_sign_in_at) : 'Hiç giriş yapmadı'}</td>
                    <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{formatDate(m.created_at)}</td>
                    <td className={cn(td, 'text-right')}>
                      {!locked && <MemberMenu userId={m.user_id} name={name} email={m.email} status={m.status} canReset={m.role !== 'owner' || ctx.role === 'owner'} mfaEnabled={mfaOn.has(m.user_id)} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel
        className="mt-6"
        title="Güvenlik politikası"
        description="Sahip ve yönetici hesapları tüm ofis verisine erişir; bu hesaplarda iki adımlı doğrulama önerilir."
      >
        <MfaPolicyToggle
          enabled={org?.require_admin_mfa ?? false}
          canChange={ctx.role === 'owner'}
          selfHasMfa={Boolean(ctx.mfa.factorId)}
        />
      </Panel>

      <Panel className="mt-6" title="Roller ve yetkiler" description="Yetkiler veritabanında da uygulanır; bir düğmenin gizlenmesi tek başına koruma değildir.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((r: OrgRole) => (
            <details key={r} className="group rounded-xl border border-border p-4 open:bg-surface-muted/30">
              <summary className="flex cursor-pointer list-none items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden />
                <span>
                  <span className="block text-[14.5px] font-bold">{ROLE_LABELS[r]}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
                  <span className="mt-1.5 block text-[12.5px] font-semibold text-primary-ink group-open:hidden">Yetkileri göster ({ROLE_PERMISSIONS[r].length})</span>
                </span>
              </summary>
              <ul className="mt-3 space-y-1 pl-8 text-[13px] text-foreground/85">
                {ROLE_PERMISSIONS[r].map((p) => (
                  <li key={p} className="list-disc">
                    {PERMISSION_LABELS[p]}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Panel>
    </>
  );
}
