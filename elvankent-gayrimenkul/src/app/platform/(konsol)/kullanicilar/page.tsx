import type { Metadata } from 'next';
import { Search, Users } from 'lucide-react';
import { AdminPageHeader, EmptyPanel, Panel, TableWrap, td, th } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/form-controls';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { cn, firstParam } from '@/lib/utils';
import { ROLE_LABELS, type OrgRole } from '@/platform/auth/permissions';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Kullanıcılar' };

type Membership = { organization: string; slug: string; role: OrgRole; status: string };

export default async function PlatformUsersPage({ searchParams }: PageProps<'/platform/kullanicilar'>) {
  const session = await requireSuperAdminPage();
  const raw = (firstParam((await searchParams).q) ?? '').trim().slice(0, 80);
  const q = raw.replace(/[%_\\]/g, '');
  const { data, error } = await session.supabase.rpc('platform_users', { p_search: q.length >= 2 ? q : (null as unknown as string), p_limit: 200 });
  const users = data ?? [];

  return (
    <>
      <AdminPageHeader title="Kullanıcılar" description="Platformdaki tüm hesaplar ve organizasyon üyelikleri. Şifreler hiçbir zaman görüntülenmez." />
      <Panel bodyClassName="p-0 sm:p-0">
        <form action="/platform/kullanicilar" role="search" className="relative border-b border-border p-4 sm:px-6">
          <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground sm:left-9" aria-hidden />
          <label htmlFor="pu-q" className="sr-only">
            E-posta veya ad ile ara
          </label>
          <Input id="pu-q" name="q" defaultValue={raw} placeholder="E-posta veya ad ile ara" className="h-10 pl-10" />
        </form>
        {error ? (
          <EmptyPanel icon={Users} title="Kullanıcılar yüklenemedi" />
        ) : users.length === 0 ? (
          <EmptyPanel icon={Users} title="Kullanıcı bulunamadı" />
        ) : (
          <TableWrap className="[&_table]:min-w-[860px]">
            <thead className="border-b border-border bg-surface-muted/50">
              <tr>
                <th className={th}>Kullanıcı</th>
                <th className={th}>Üyelikler</th>
                <th className={th}>Son giriş</th>
                <th className={th}>Kayıt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const memberships = (u.memberships as Membership[]) ?? [];
                return (
                  <tr key={u.user_id}>
                    <td className={cn(td, 'max-w-72')}>
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        <span className="truncate">{u.full_name || '—'}</span>
                        {u.is_super_admin && <Badge variant="accent-soft">Süper admin</Badge>}
                      </p>
                      <p className="truncate text-[12.5px] text-muted-foreground">{u.email}</p>
                    </td>
                    <td className={td}>
                      {memberships.length === 0 ? (
                        <span className="text-[13px] text-muted-foreground">Üyelik yok</span>
                      ) : (
                        <ul className="space-y-0.5 text-[13px]">
                          {memberships.map((m) => (
                            <li key={m.slug}>
                              <span className="font-medium">{m.organization}</span>
                              <span className="text-muted-foreground">
                                {' '}
                                · {ROLE_LABELS[m.role] ?? m.role}
                                {m.status !== 'active' && ' · devre dışı'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{u.last_sign_in_at ? formatRelativeDate(u.last_sign_in_at) : 'Hiç'}</td>
                    <td className={cn(td, 'whitespace-nowrap text-muted-foreground')}>{formatDate(u.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
        <p className="border-t border-border px-6 py-3 text-[12.5px] text-muted-foreground">
          En fazla 200 sonuç gösterilir. Süper admin yetkisi arayüzden verilemez; yalnızca sunucuda <code>npm run create-admin</code> betiğiyle verilir (bkz. SETUP.md).
        </p>
      </Panel>
    </>
  );
}
