'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { MailCheck, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { requestPasswordReset, type AuthFormState } from '@/app/actions/auth';

export function ResetRequestForm({ scope }: { scope?: 'platform' }) {
  const loginHref = scope === 'platform' ? '/platform/giris' : '/admin/giris';
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  if (state.message) {
    return (
      <div role="status" className="text-center">
        <MailCheck className="mx-auto size-10 text-success" aria-hidden />
        <p className="mt-3 text-sm leading-relaxed text-foreground/85">{state.message}</p>
        <Link href={loginHref} className="mt-5 inline-block text-sm font-semibold text-primary-ink hover:underline">
          Giriş sayfasına dön
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      {scope && <input type="hidden" name="scope" value={scope} />}
      <Field label="E-posta" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} autoFocus />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {!pending && <Send />} Bağlantı gönder
      </Button>
      <p className="text-center text-sm">
        <Link href={loginHref} className="text-muted-foreground hover:text-foreground">
          Giriş sayfasına dön
        </Link>
      </p>
    </form>
  );
}
