'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/form-controls';
import { setRequireAdminMfa } from '@/app/actions/mfa';

/** Sahip ve yöneticiler için iki adımlı doğrulama zorunluluğu (yalnızca ofis sahibi değiştirir) */
export function MfaPolicyToggle({ enabled, canChange, selfHasMfa }: { enabled: boolean; canChange: boolean; selfHasMfa: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(enabled);
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-3">
      <Switch
        checked={value}
        disabled={!canChange || pending || (!selfHasMfa && !value)}
        onCheckedChange={async (next) => {
          setPending(true);
          const res = await setRequireAdminMfa(next);
          setPending(false);
          if (!res.ok) return toast.error(res.error);
          setValue(next);
          toast.success(res.message ?? 'Kaydedildi.');
          router.refresh();
        }}
        label="Sahip ve yöneticiler için iki adımlı doğrulama zorunlu"
        description="Açıkken bu roldeki kişiler, doğrulamayı kurmadan ve girişte kodu girmeden panele erişemez. Kural veritabanında da uygulanır."
      />
      {!canChange && <p className="text-[12.5px] text-muted-foreground">Bu ayarı yalnızca ofis sahibi değiştirebilir.</p>}
      {canChange && !selfHasMfa && !value && (
        <p className="text-[12.5px] text-muted-foreground">
          Önce kendi hesabınızda{' '}
          <Link href="/admin/hesap#iki-adimli" className="font-semibold text-primary underline-offset-2 hover:underline">
            iki adımlı doğrulamayı kurun
          </Link>
          ; böylece kendinizi panelin dışında bırakmazsınız.
        </p>
      )}
    </div>
  );
}
