'use client';

import { useActionState, useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form-controls';
import { submitContactForm, type ContactFormState } from '@/app/actions/contact';
import { cn } from '@/lib/utils';

interface ContactFormProps {
  propertyId?: string;
  propertyTitle?: string;
  listingNo?: number;
  compact?: boolean;
  className?: string;
}

const initialState: ContactFormState = { status: 'idle' };

export function ContactForm({ propertyId, propertyTitle, listingNo, compact, className }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(submitContactForm, initialState);
  const mountedAt = useRef<number>(0);
  const elapsedRef = useRef<HTMLInputElement>(null);
  // Aynı sayfada birden fazla form olabileceği için benzersiz alan kimlikleri
  const idPrefix = `cf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const defaultMessage = propertyTitle
    ? `Merhaba, "${propertyTitle}" (İlan No: ${listingNo}) ilanı hakkında bilgi almak istiyorum.`
    : '';

  if (state.status === 'success') {
    return (
      <div
        role="status"
        className={cn('flex flex-col items-center rounded-2xl bg-brand-50 px-5 py-8 text-center ring-1 ring-brand-100', className)}
      >
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <p className="mt-3 font-semibold text-ink">Teşekkürler!</p>
        <p className="mt-1 text-sm text-sand-700">{state.message}</p>
      </div>
    );
  }

  const err = state.errors ?? {};
  const v = state.values ?? {};
  const describedBy = (name: string) => (err[name] ? `${idPrefix}-${name}-error` : undefined);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // FormData, bu işleyiciden sonra oluşturulur; değeri doğrudan yazıyoruz
        if (elapsedRef.current) elapsedRef.current.value = String(Date.now() - mountedAt.current);
      }}
      className={cn('space-y-4', className)}
      noValidate
    >
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      <input ref={elapsedRef} type="hidden" name="elapsed" defaultValue="0" />
      {/* Bot tuzağı: ekran okuyuculardan ve kullanıcılardan gizli */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${idPrefix}-website`}>Web siteniz</label>
        <input id={`${idPrefix}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Ad Soyad" htmlFor={`${idPrefix}-fullName`} error={err.fullName} required>
        <Input
          id={`${idPrefix}-fullName`}
          name="fullName"
          autoComplete="name"
          required
          maxLength={100}
          defaultValue={v.fullName}
          aria-invalid={Boolean(err.fullName)}
          aria-describedby={describedBy('fullName')}
        />
      </Field>

      <div className={cn('grid gap-4', !compact && 'sm:grid-cols-2')}>
        <Field label="Telefon" htmlFor={`${idPrefix}-phone`} error={err.phone}>
          <Input
            id={`${idPrefix}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05XX XXX XX XX"
            maxLength={20}
            defaultValue={v.phone}
            aria-invalid={Boolean(err.phone)}
            aria-describedby={describedBy('phone')}
          />
        </Field>
        <Field label="E-posta" htmlFor={`${idPrefix}-email`} error={err.email}>
          <Input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="ornek@eposta.com"
            maxLength={160}
            defaultValue={v.email}
            aria-invalid={Boolean(err.email)}
            aria-describedby={describedBy('email')}
          />
        </Field>
      </div>

      {propertyTitle && (
        <p className="rounded-xl bg-sand-100 px-3.5 py-2.5 text-[13px] text-sand-700">
          <span className="font-semibold text-ink">İlgilenilen ilan:</span> {propertyTitle}{' '}
          <span className="text-sand-500">(No: {listingNo})</span>
        </p>
      )}

      <Field label="Mesajınız" htmlFor={`${idPrefix}-message`} error={err.message} required>
        <Textarea
          id={`${idPrefix}-message`}
          name="message"
          required
          maxLength={3000}
          rows={compact ? 3 : 5}
          defaultValue={v.message ?? defaultMessage}
          aria-invalid={Boolean(err.message)}
          aria-describedby={describedBy('message')}
        />
      </Field>

      <div>
        <Checkbox
          name="kvkk"
          required
          defaultChecked={v.kvkk === 'on'}
          aria-invalid={Boolean(err.kvkk)}
          label={
            <>
              Kişisel verilerimin iletişim talebimin yanıtlanması amacıyla işlenmesine ilişkin{' '}
              <Link href="/kvkk" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
                KVKK Aydınlatma Metni
              </Link>
              ’ni okudum.
            </>
          }
        />
        {err.kvkk && (
          <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
            {err.kvkk}
          </p>
        )}
      </div>

      {state.status === 'error' && state.message && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800 ring-1 ring-red-200">
          {state.message}
        </p>
      )}

      <Button type="submit" loading={pending} className="w-full" size="lg">
        {!pending && <Send aria-hidden />}
        {pending ? 'Gönderiliyor…' : 'Mesaj Gönder'}
      </Button>
    </form>
  );
}
