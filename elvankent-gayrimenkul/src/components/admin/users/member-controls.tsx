'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Mail, MoreHorizontal, Power, ShieldOff, UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { createMember, removeMember, resendMemberInvitation, resetMemberMfa, resetMemberPassword, setMemberStatus } from '@/app/actions/admin-users';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type OrgRole } from '@/platform/auth/permissions';

/** Geçici şifre yalnızca bir kez gösterilir; kaydedilmez ve loglanmaz */
function TemporaryPassword({ email, password, label = 'E-posta' }: { email: string; password: string; label?: string }) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-border bg-surface-muted/60 p-4">
        <p className="text-[12.5px] font-semibold text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[14.5px] font-semibold break-all">{email}</p>
        <p className="mt-3 text-[12.5px] font-semibold text-muted-foreground">Geçici şifre</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="numeric flex-1 rounded-lg bg-surface px-3 py-2 font-mono text-[16px] tracking-wide select-all">{password}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(password);
                toast.success('Şifre kopyalandı.');
              } catch {
                toast.error('Kopyalanamadı; şifreyi elle seçin.');
              }
            }}
          >
            <Copy /> Kopyala
          </Button>
        </div>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
        <li>Bu şifre yalnızca şimdi gösterilir; kaydedilmez. Kişiye güvenli bir kanaldan (yüz yüze, telefonla) iletin.</li>
        <li>İlk girişte kendi şifresini belirlemesi istenir.</li>
        <li>Giriş sayfası: yönetim panelinin /admin/giris adresi.</li>
      </ul>
    </div>
  );
}

export function NewMemberDialog({ roles, disabledReason }: { roles: OrgRole[]; disabledReason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [role, setRole] = useState<OrgRole>(roles.includes('agent') ? 'agent' : roles[roles.length - 1]);
  const [result, setResult] = useState<{ email: string; password: string | null; existing: boolean; invited: boolean; invitationSent: boolean } | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setResult(null);
          setErrors({});
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={Boolean(disabledReason)} title={disabledReason}>
          <UserPlus /> Yeni kullanıcı
        </Button>
      </DialogTrigger>
      <DialogContent title={result ? 'Kullanıcı eklendi' : 'Yeni kullanıcı'} description={result ? undefined : 'Ekibinize danışman, editör veya yönetici ekleyin.'} size="lg">
        {result ? (
          <>
            {result.invited ? (
              result.invitationSent ? (
                <p className="mt-5 rounded-xl bg-success-soft p-4 text-[14px] text-success" data-member-invited>
                  {result.email} adresine tek kullanımlık davet bağlantısı gönderildi. Kişi bağlantıyla kendi şifresini belirleyip hesabını etkinleştirir; şifre kimseye gösterilmez.
                </p>
              ) : (
                <p className="mt-5 rounded-xl bg-warning-soft p-4 text-[14px] text-warning" data-member-invited>
                  Kullanıcı eklendi ancak davet e-postası gönderilemedi. Kullanıcı listesinden &quot;Daveti tekrar gönder&quot; ile yeniden deneyin.
                </p>
              )
            ) : result.password ? (
              <TemporaryPassword email={result.email} password={result.password} />
            ) : (
              <p className="mt-5 rounded-xl bg-success-soft p-4 text-[14px] text-success">
                Bu e-posta ile kayıtlı mevcut bir hesap ekibinize eklendi. Kişi mevcut şifresiyle giriş yapabilir.
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setOpen(false)}>Tamam</Button>
            </div>
          </>
        ) : (
          <form
            className="mt-5 space-y-4"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setPending(true);
              setErrors({});
              setFormError(null);
              const res = await createMember({ full_name: String(fd.get('full_name') ?? ''), email: String(fd.get('email') ?? ''), role });
              setPending(false);
              if (!res.ok) {
                const next: Record<string, string> = {};
                for (const [k, v] of Object.entries(res.fieldErrors ?? {})) next[k] = v[0];
                setErrors(next);
                if (!Object.keys(next).length) setFormError(res.error);
                return;
              }
              setResult({ email: res.data.email, password: res.data.temporaryPassword, existing: res.data.existing, invited: res.data.invited, invitationSent: res.data.invitationSent });
              router.refresh();
            }}
          >
            <Field label="Ad soyad" htmlFor="nm-name" required error={errors.full_name}>
              <Input id="nm-name" name="full_name" maxLength={100} autoComplete="off" required />
            </Field>
            <Field label="E-posta" htmlFor="nm-email" required error={errors.email} hint="Giriş için kullanılır.">
              <Input id="nm-email" name="email" type="email" maxLength={160} autoComplete="off" required />
            </Field>
            <Field label="Rol" htmlFor="nm-role" hint={ROLE_DESCRIPTIONS[role]} error={errors.role}>
              <Select id="nm-role" value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {formError && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" loading={pending}>
                Kullanıcıyı ekle
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MemberMenu({
  userId,
  name,
  email,
  status,
  canReset,
  mfaEnabled = false,
  canInvite = false,
}: {
  userId: string;
  name: string;
  email: string | null;
  status: 'active' | 'disabled';
  canReset: boolean;
  mfaEnabled?: boolean;
  /** Hesap henüz etkinleştirilmedi ve e-posta yapılandırılmış: davet (yeniden) gönderilebilir */
  canInvite?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | 'disable' | 'remove' | 'reset' | 'mfa'>(null);
  const [password, setPassword] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    const res = await fn();
    if (!res.ok) {
      toast.error(res.error ?? 'İşlem yapılamadı.');
      return false;
    }
    toast.success(res.message ?? 'İşlem tamamlandı.');
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-xs" variant="ghost" aria-label={`${name} için işlemler`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {status === 'active' ? (
            <DropdownMenuItem onSelect={() => setConfirm('disable')}>
              <Power /> Devre dışı bırak
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void run(() => setMemberStatus(userId, 'active'))}>
              <Power /> Yeniden etkinleştir
            </DropdownMenuItem>
          )}
          {canInvite && status === 'active' && (
            <DropdownMenuItem onSelect={() => void run(() => resendMemberInvitation(userId))}>
              <Mail /> Daveti tekrar gönder
            </DropdownMenuItem>
          )}
          {canReset && !canInvite && (
            <DropdownMenuItem onSelect={() => setConfirm('reset')}>
              <KeyRound /> Geçici şifre oluştur
            </DropdownMenuItem>
          )}
          {canReset && mfaEnabled && (
            <DropdownMenuItem onSelect={() => setConfirm('mfa')}>
              <ShieldOff /> İki adımlı doğrulamayı sıfırla
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirm('remove')}>
            <UserMinus /> Ekipten çıkar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm === 'disable'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`${name} devre dışı bırakılsın mı?`}
        description="Kişi yönetim paneline erişemez; kayıtları ve geçmişi korunur. Daha sonra yeniden etkinleştirebilirsiniz."
        confirmLabel="Devre dışı bırak"
        onConfirm={() => run(() => setMemberStatus(userId, 'disabled'))}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`${name} ekipten çıkarılsın mı?`}
        description="Kişinin bu ofisteki erişimi kalkar. Oluşturduğu ilan ve kayıtlar silinmez."
        confirmLabel="Ekipten çıkar"
        destructive
        onConfirm={() => run(() => removeMember(userId))}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`${name} için geçici şifre oluşturulsun mu?`}
        description="Mevcut şifresi geçersiz olur. Yeni geçici şifre yalnızca bir kez gösterilir; ilk girişte değiştirmesi istenir."
        confirmLabel="Şifre oluştur"
        onConfirm={async () => {
          const res = await resetMemberPassword(userId);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          setPassword(res.data.temporaryPassword);
          startTransition(() => router.refresh());
        }}
      />
      <ConfirmDialog
        open={confirm === 'mfa'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`${name} için iki adımlı doğrulama sıfırlansın mı?`}
        description="Telefonunu kaybeden veya değiştiren kişi için kullanın. Kişinin kimliğini doğruladığınızdan emin olun; bir sonraki girişte doğrulamayı yeniden kurması istenir."
        confirmLabel="Sıfırla"
        destructive
        onConfirm={() => run(() => resetMemberMfa(userId))}
      />
      <Dialog open={password !== null} onOpenChange={(v) => !v && setPassword(null)}>
        <DialogContent title="Geçici şifre" description={name} size="lg">
          {password && <TemporaryPassword email={email ?? name} label={email ? 'E-posta' : 'Kullanıcı'} password={password} />}
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setPassword(null)}>Tamam</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
