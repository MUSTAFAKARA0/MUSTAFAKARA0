'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { signIn, type AuthFormState } from '@/app/actions/auth';

export function LoginForm({ next, scope }: { next?: string; scope?: 'platform' }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {});
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={action} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {scope && <input type="hidden" name="scope" value={scope} />}
      <Field label="E-posta" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} autoFocus />
      </Field>
      <div>
        <Field label="Şifre" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              minLength={6}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-1 -translate-y-1/2 rounded-lg p-2.5 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <p className="mt-2 text-right text-[13px]">
          <Link href="/admin/sifremi-unuttum" className="font-medium text-primary-ink hover:underline">
            Şifremi unuttum
          </Link>
        </p>
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {!pending && <LogIn />} Giriş yap
      </Button>
    </form>
  );
}
