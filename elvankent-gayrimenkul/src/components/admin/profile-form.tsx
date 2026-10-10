'use client';

import { useActionState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { updateProfileName, type AuthFormState } from '@/app/actions/auth';

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updateProfileName, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Ad soyad" htmlFor="fullName">
        <Input id="fullName" name="fullName" defaultValue={fullName} autoComplete="name" required minLength={2} maxLength={100} />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm font-medium text-success">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="outline" loading={pending}>
        {!pending && <Save />} Kaydet
      </Button>
    </form>
  );
}
