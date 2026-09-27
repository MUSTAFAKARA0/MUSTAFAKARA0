import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { ActionButton } from '@/components/admin/action-controls';
import { AdminPageHeader, Panel } from '@/components/admin/ui';
import { PasswordForm } from '@/components/admin/password-form';
import { ProfileForm } from '@/components/admin/profile-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { removeMyMfa } from '@/app/actions/mfa';
import { firstParam } from '@/lib/utils';
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/platform/auth/permissions';
import { requirePageContext } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Hesabım' };

export default async function AccountPage({ searchParams }: PageProps<'/admin/hesap'>) {
  const ctx = await requirePageContext('/admin/hesap');
  const mustChange = firstParam((await searchParams).sifre) === 'degistir' || ctx.profile.passwordChangeRequired;
  const mfaEnabled = Boolean(ctx.mfa.factorId);
  const mfaLocked = ctx.memberships.some((m) => m.requireAdminMfa && (m.role === 'owner' || m.role === 'admin'));
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
          <Panel
            id="iki-adimli"
            title="İki adımlı doğrulama"
            description="Girişte şifrenize ek olarak telefonunuzdaki doğrulama uygulamasının ürettiği kod istenir. Hesabınız ele geçirilse bile panele erişilemez."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2.5 text-[14.5px] font-semibold">
                {mfaEnabled ? <ShieldCheck className="size-5 text-success" aria-hidden /> : <ShieldOff className="size-5 text-muted-foreground" aria-hidden />}
                {mfaEnabled ? 'Açık' : 'Kapalı'}
                {mfaLocked && <Badge variant="info">Ofis politikası: zorunlu</Badge>}
              </p>
              {mfaEnabled ? (
                !mfaLocked && (
                  <ActionButton
                    action={removeMyMfa}
                    confirm={{ title: 'İki adımlı doğrulama kapatılsın mı?', description: 'Hesabınız yalnızca şifreyle korunur.', confirmLabel: 'Kapat', destructive: true }}
                  >
                    Kapat
                  </ActionButton>
                )
              ) : (
                <Button asChild size="sm">
                  <Link href="/admin/dogrulama?kurulum=1&next=%2Fadmin%2Fhesap">
                    <ShieldCheck /> Kur
                  </Link>
                </Button>
              )}
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
