'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { updatePassword, type AuthFormState } from '@/app/actions/auth';

function strength(value: string): { score: number; label: string } {
  let score = 0;
  if (value.length >= 10) score += 1;
  if (value.length >= 14) score += 1;
  if (/[a-zçğıöşü]/.test(value) && /[A-ZÇĞİÖŞÜ]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/.test(value)) score += 1;
  const label = score <= 1 ? 'Zayıf' : score <= 3 ? 'Orta' : 'Güçlü';
  return { score, label };
}

/** Yeni şifre formu (şifre yenileme sayfası ve hesap ayarları) */
export function PasswordForm({ onDoneHref }: { onDoneHref?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePassword, {});
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const s = strength(value);

  if (state.message) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-success-soft p-4 text-sm text-success">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{state.message}</p>
          {onDoneHref && (
            <a href={onDoneHref} className="mt-1 inline-block font-semibold underline underline-offset-2">
              Panele devam et
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <Field label="Yeni şifre" htmlFor="password" hint="En az 10 karakter; harf ve rakam içermeli.">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={10}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pr-11"
            aria-describedby="password-strength"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {value && (
          <div id="password-strength" className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < s.score ? (s.score <= 1 ? 'bg-danger' : s.score <= 3 ? 'bg-warning' : 'bg-success') : 'bg-border'}`}
                />
              ))}
            </div>
            <span className="text-[12px] font-semibold text-muted-foreground">{s.label}</span>
          </div>
        )}
      </Field>
      <Field label="Yeni şifre (tekrar)" htmlFor="confirm">
        <Input id="confirm" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={10} />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" loading={pending}>
        {!pending && <KeyRound />} Şifreyi kaydet
      </Button>
    </form>
  );
}
