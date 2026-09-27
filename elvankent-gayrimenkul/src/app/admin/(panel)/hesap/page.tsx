import type { Metadata } from 'next';
import { AdminPageHeader, Panel } from '@/components/admin/ui';
import { PasswordForm } from '@/components/admin/password-form';
import { ProfileForm } from '@/components/admin/profile-form';
import { Badge } from '@/components/ui/badge';
import { firstParam } from '@/lib/utils';
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/platform/auth/permissions';
import { requirePageContext } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Hesabım' };

export default async function AccountPage({ searchParams }: PageProps<'/admin/hesap'>) {
  const ctx = await requirePageContext('/admin/hesap');
  const mustChange = firstParam((await searchParams).sifre) === 'degistir' || ctx.profile.passwordChangeRequired;
  return (
    <>
      <AdminPageHeader title="Hesabım" description={ctx.user.email} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {mustChange && (
            <p role="alert" className="rounded-2xl border border-warning/25 bg-warning-soft px-5 py-3.5 text-sm font-medium text-warning">
              Hesabınız geçici bir şifreyle oluşturuldu. Devam etmeden önce kendinize ait yeni bir şifre belirleyin.
            </p>
          )}
          <Panel id="sifre" title="Şifre değiştir" description="Güçlü ve başka sitelerde kullanmadığınız bir şifre seçin.">
            <div className="max-w-md">
              <PasswordForm />
            </div>
          </Panel>
          <Panel title="Kişisel bilgiler">
            <div className="max-w-md">
              <ProfileForm fullName={ctx.profile.fullName ?? ''} />
            </div>
          </Panel>
        </div>
        <Panel title="Rolünüz ve yetkileriniz" description={ctx.org.name}>
          <p className="flex items-center gap-2">
            <Badge variant="primary-soft">{ROLE_LABELS[ctx.role]}</Badge>
            <span className="text-[13px] text-muted-foreground">{ROLE_DESCRIPTIONS[ctx.role]}</span>
          </p>
          <ul className="mt-4 space-y-1.5 text-[13.5px]">
            {[...ctx.permissions].map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-success" aria-hidden /> {PERMISSION_LABELS[p]}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
