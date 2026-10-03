'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form-controls';
import { submitKarayLead, type KarayLeadState } from '@/app/actions/karay';
import { cn } from '@/lib/utils';

/**
 * KARAY "Bilgi al / Demo talep et" formu. Gönderim KARAY'ın kendi talep kaydına gider;
 * hiçbir emlak ofisinin CRM'ine düşmez. "#demo" bağlantısıyla gelinirse tür "Demo" seçili açılır.
 */
export function KarayLeadForm() {
  const [state, action, pending] = useActionState<KarayLeadState, FormData>(submitKarayLead, { status: 'idle' });
  const [kind, setKind] = useState<'info' | 'demo'>('info');
  const started = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    started.current = Date.now();
    const sync = () => {
      if (window.location.hash === '#demo') setKind('demo');
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const v = state.values ?? {};
  const e = state.errors ?? {};

  if (state.status === 'success') {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
        <CheckCircle2 className="size-7" aria-hidden />
        <p className="text-[17px] font-semibold">{state.message}</p>
        <p className="text-[14px] text-emerald-900/80">Bu talep KARAY ekibine iletilir; herhangi bir emlak ofisiyle paylaşılmaz.</p>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={() => setElapsed(Date.now() - started.current)} className="space-y-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-[#33415c]">Talep türü</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['info', 'Bilgi al'],
              ['demo', 'Demo talep et'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                'flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-[14.5px] font-semibold transition',
                kind === value ? 'border-[#0b1b3a] bg-[#0b1b3a] text-white' : 'border-[#d7deea] bg-white text-[#33415c] hover:border-[#9aa8c0]',
              )}
            >
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad soyad" htmlFor="k-name" required error={e.fullName}>
          <Input id="k-name" name="fullName" autoComplete="name" defaultValue={v.fullName} maxLength={120} aria-invalid={Boolean(e.fullName) || undefined} />
        </Field>
        <Field label="Emlak ofisi" htmlFor="k-company" optional error={e.company}>
          <Input id="k-company" name="company" autoComplete="organization" defaultValue={v.company} maxLength={160} />
        </Field>
        <Field label="E-posta" htmlFor="k-email" error={e.email} hint="E-posta veya telefondan en az biri gerekli.">
          <Input id="k-email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={v.email} maxLength={160} aria-invalid={Boolean(e.email) || undefined} />
        </Field>
        <Field label="Telefon" htmlFor="k-phone" error={e.phone}>
          <Input id="k-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={v.phone} maxLength={30} aria-invalid={Boolean(e.phone) || undefined} />
        </Field>
        <Field label="Şehir" htmlFor="k-city" optional error={e.city} className="sm:col-span-2">
          <Input id="k-city" name="city" autoComplete="address-level1" defaultValue={v.city} maxLength={80} />
        </Field>
        <Field label="Mesajınız" htmlFor="k-message" optional error={e.message} className="sm:col-span-2">
          <Textarea id="k-message" name="message" rows={4} defaultValue={v.message} maxLength={3000} placeholder="Ofisinizi ve ihtiyaçlarınızı kısaca anlatın (ör. ilan sayısı, mevcut web siteniz, alan adınız)." />
        </Field>
      </div>
      {/* Bot tuzağı: görünmez alan */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="k-website">Web sitesi</label>
        <input id="k-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="elapsed" value={elapsed} />
      <Checkbox
        name="kvkk"
        defaultChecked={v.kvkk === 'on'}
        aria-invalid={Boolean(e.kvkk) || undefined}
        label={
          <>
            <Link href="/karay/yasal/kvkk" className="font-semibold underline underline-offset-2" target="_blank">
              Aydınlatma metnini
            </Link>{' '}
            okudum; talebime yanıt verilmesi için bilgilerimin işlenmesini kabul ediyorum.
          </>
        }
      />
      {e.kvkk && <p className="text-[13px] font-medium text-danger">{e.kvkk}</p>}
      {state.status === 'error' && state.message && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
        {kind === 'demo' ? 'Demo talebini gönder' : 'Bilgi talebini gönder'}
      </Button>
    </form>
  );
}
