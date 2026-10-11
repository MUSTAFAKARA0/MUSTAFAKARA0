'use client';

import { useActionState, useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import Link from '@/components/common/intent-link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { activateInvitation, inspectInvitation, type ActivationState, type InvitationPreview } from '@/app/actions/invitation';

/** Bağlantının #t= parçasındaki token; okunduktan sonra adres çubuğundan silinir */
function readToken(): string | null {
  const match = /(?:^#|&)t=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (match) window.history.replaceState(null, '', window.location.pathname);
  return match?.[1] ?? null;
}

export function ActivationForm() {
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [state, action, pending] = useActionState<ActivationState, FormData>(activateInvitation, {});
  const [show, setShow] = useState(false);

  useEffect(() => {
    const value = readToken();
    let cancelled = false;
    void inspectInvitation(value).then((res) => {
      if (cancelled) return;
      setToken(value);
      setPreview(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!preview) {
    return (
      <p className="text-center text-sm text-muted-foreground" role="status">
        Davet kontrol ediliyor…
      </p>
    );
  }

  if (!preview.ok || state.invalid) {
    return (
      <div className="text-center text-sm leading-relaxed text-muted-foreground" data-testid="invitation-invalid">
        <p role="alert">{preview.ok ? state.error : preview.error}</p>
        <Link href="/admin/giris" className="mt-4 inline-block font-semibold text-primary-ink hover:underline">
          Giriş sayfasına git
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" data-testid="activation-form">
      <input type="hidden" name="token" value={token ?? ''} />
      <div className="rounded-2xl bg-surface-muted px-4 py-3 text-[13.5px]">
        <p className="text-muted-foreground">{preview.organization}</p>
        <p className="mt-0.5 font-semibold break-all" data-testid="invitation-email">
          {preview.email}
        </p>
      </div>
      <Field label="Yeni şifre" htmlFor="password" hint="En az 10 karakter; harf ve rakam içermeli.">
        <div className="relative">
          <Input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={10} className="pr-11" />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-lg p-2.5 text-muted-foreground hover:text-foreground"
            aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Field label="Yeni şifre (tekrar)" htmlFor="confirm">
        <Input id="confirm" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={10} />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full">
        {!pending && <KeyRound />} Hesabımı etkinleştir
      </Button>
    </form>
  );
}
