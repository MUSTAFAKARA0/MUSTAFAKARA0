'use client';

import Link from 'next/link';
import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { CalendarCheck, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/choice';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { submitLead, type LeadFormState } from '@/app/actions/public';
import { useHydrated } from '@/hooks/use-local-list';
import { cn } from '@/lib/utils';
import { VALUATION_CONDITIONS } from '@/modules/crm/constants';

export type LeadFormKind = 'contact' | 'listing' | 'appointment' | 'valuation';

interface LeadFormProps {
  kind: LeadFormKind;
  property?: { id: string; title: string; referenceNo: string };
  compact?: boolean;
  className?: string;
}

const initialState: LeadFormState = { status: 'idle' };

const TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const minutes = 9 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

const QR_KEY = 'eg:qr-source';

/** QR kodla gelen ziyaretçinin taleplerini "QR kod" kaynağıyla işaretler (oturum boyunca) */
function readQrSource(): boolean {
  try {
    return window.sessionStorage.getItem(QR_KEY) === '1';
  } catch {
    return false;
  }
}

export function markQrSource() {
  try {
    window.sessionStorage.setItem(QR_KEY, '1');
  } catch {
    // depolama kapalı
  }
}

function tomorrowIso(): string {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SUBMIT_LABELS: Record<LeadFormKind, string> = {
  contact: 'Mesajı gönder',
  listing: 'Bilgi al',
  appointment: 'Randevu talep et',
  valuation: 'Değerleme talebi gönder',
};

/**
 * Web sitesi talep formu (iletişim, ilan bilgi, gösterim randevusu, değerleme).
 * Sunucuda doğrulanır; gizli alan + süre kontrolü + hız sınırı ile spam korunur.
 * Gönderim sürerken buton kilitlenir (çift gönderim olmaz); hata olursa girilen
 * bilgiler kaybolmaz.
 */
export function LeadForm({ kind, property, compact, className }: LeadFormProps) {
  const [state, formAction, pending] = useActionState(submitLead, initialState);
  const mountedAt = useRef(0);
  const elapsedRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();
  const id = `lf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [intent, setIntent] = useState<'sell' | 'let'>('sell');

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  if (state.status === 'success') {
    return (
      <div role="status" className={cn('flex flex-col items-center rounded-2xl bg-success-soft px-5 py-8 text-center', className)}>
        {kind === 'appointment' ? <CalendarCheck className="size-10 text-success" aria-hidden /> : <CheckCircle2 className="size-10 text-success" aria-hidden />}
        <p className="mt-3 font-display text-xl text-foreground">Teşekkürler!</p>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-foreground/80">{state.message}</p>
      </div>
    );
  }

  const err = state.errors ?? {};
  const v = state.values ?? {};
  const fid = (name: string) => `${id}-${name}`;
  const described = (name: string) => (err[name] ? `${fid(name)}-error` : undefined);
  const defaultMessage =
    kind === 'listing' && property ? `Merhaba, "${property.title}" ilanı hakkında bilgi almak istiyorum.` : '';

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // FormData bu işleyiciden sonra oluşturulur; değerleri doğrudan yazıyoruz
        // Sekme değişince form yeniden oluşur; süre, sayfanın açılışından itibaren de sayılır
        if (elapsedRef.current) elapsedRef.current.value = String(Math.round(Math.max(Date.now() - mountedAt.current, performance.now())));
        if (sourceRef.current) sourceRef.current.value = readQrSource() ? 'qr' : '';
      }}
      className={cn('space-y-4', className)}
      noValidate
    >
      <input type="hidden" name="kind" value={kind} />
      {property && <input type="hidden" name="propertyId" value={property.id} />}
      <input ref={elapsedRef} type="hidden" name="elapsed" defaultValue="0" />
      <input ref={sourceRef} type="hidden" name="source" defaultValue="" />
      {/* Bot tuzağı: kullanıcılardan ve ekran okuyuculardan gizli */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={fid('website')}>Web siteniz</label>
        <input id={fid('website')} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {kind === 'valuation' && (
        <>
          <input type="hidden" name="valuationIntent" value={intent} />
          <SegmentedControl<'sell' | 'let'>
            label="Gayrimenkulü ne yapmak istiyorsunuz?"
            value={intent}
            onValueChange={setIntent}
            options={[
              { value: 'sell', label: 'Satmak' },
              { value: 'let', label: 'Kiraya vermek' },
            ]}
            className="w-full"
          />
          <Field label="Gayrimenkulün konumu" htmlFor={fid('valuationLocation')} error={err.valuationLocation} required>
            <Input
              id={fid('valuationLocation')}
              name="valuationLocation"
              placeholder="ör. Elvankent Mah., Etimesgut"
              maxLength={160}
              defaultValue={v.valuationLocation}
              aria-invalid={Boolean(err.valuationLocation)}
              aria-describedby={described('valuationLocation')}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brüt alan (m²)" htmlFor={fid('valuationM2')} error={err.valuationM2} optional>
              <Input id={fid('valuationM2')} name="valuationM2" inputMode="numeric" maxLength={7} defaultValue={v.valuationM2} />
            </Field>
            <Field label="Oda sayısı" htmlFor={fid('valuationRooms')} optional>
              <Select id={fid('valuationRooms')} name="valuationRooms" defaultValue={v.valuationRooms ?? ''}>
                <option value="">Seçin</option>
                {['1+0', '1+1', '2+1', '3+1', '4+1', '5+1', '6+'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bina yaşı" htmlFor={fid('valuationAge')} error={err.valuationAge} optional>
              <Input id={fid('valuationAge')} name="valuationAge" inputMode="numeric" maxLength={3} defaultValue={v.valuationAge} />
            </Field>
            <Field label="Durumu" htmlFor={fid('valuationCondition')} optional>
              <Select id={fid('valuationCondition')} name="valuationCondition" defaultValue={v.valuationCondition ?? ''}>
                <option value="">Seçin</option>
                {VALUATION_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </>
      )}

      <Field label="Ad soyad" htmlFor={fid('fullName')} error={err.fullName} required>
        <Input
          id={fid('fullName')}
          name="fullName"
          autoComplete="name"
          maxLength={100}
          defaultValue={v.fullName}
          aria-invalid={Boolean(err.fullName)}
          aria-describedby={described('fullName')}
        />
      </Field>

      <div className={cn('grid gap-4', !compact && 'sm:grid-cols-2')}>
        <Field label="Telefon" htmlFor={fid('phone')} error={err.phone}>
          <Input
            id={fid('phone')}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05XX XXX XX XX"
            maxLength={20}
            defaultValue={v.phone}
            aria-invalid={Boolean(err.phone)}
            aria-describedby={described('phone')}
          />
        </Field>
        <Field label="E-posta" htmlFor={fid('email')} error={err.email}>
          <Input
            id={fid('email')}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="ornek@eposta.com"
            maxLength={160}
            defaultValue={v.email}
            aria-invalid={Boolean(err.email)}
            aria-describedby={described('email')}
          />
        </Field>
      </div>

      {kind === 'appointment' && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tarih" htmlFor={fid('appointmentDate')} error={err.appointmentDate} required>
            <Input
              id={fid('appointmentDate')}
              name="appointmentDate"
              type="date"
              min={hydrated ? tomorrowIso() : undefined}
              defaultValue={v.appointmentDate}
              aria-invalid={Boolean(err.appointmentDate)}
              aria-describedby={described('appointmentDate')}
            />
          </Field>
          <Field label="Saat" htmlFor={fid('appointmentTime')} error={err.appointmentTime} required>
            <Select
              id={fid('appointmentTime')}
              name="appointmentTime"
              defaultValue={v.appointmentTime ?? ''}
              aria-invalid={Boolean(err.appointmentTime)}
              aria-describedby={described('appointmentTime')}
            >
              <option value="">Seçin</option>
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <Field
        label={kind === 'contact' ? 'Mesajınız' : 'Notunuz'}
        htmlFor={fid('message')}
        error={err.message}
        required={kind === 'contact'}
        optional={kind !== 'contact'}
      >
        <Textarea
          id={fid('message')}
          name="message"
          maxLength={3000}
          rows={compact ? 3 : 4}
          defaultValue={v.message ?? defaultMessage}
          placeholder={
            kind === 'appointment'
              ? 'ör. Hafta içi akşam saatleri daha uygun.'
              : kind === 'valuation'
                ? 'Mülkünüzle ilgili eklemek istedikleriniz'
                : undefined
          }
          aria-invalid={Boolean(err.message)}
          aria-describedby={described('message')}
        />
      </Field>

      <div>
        <Checkbox
          name="kvkk"
          defaultChecked={v.kvkk === 'on'}
          aria-invalid={Boolean(err.kvkk)}
          label={
            <>
              Talebimin yanıtlanması amacıyla kişisel verilerimin işlenmesine ilişkin{' '}
              <Link href="/kvkk" target="_blank" className="font-semibold text-primary-ink underline underline-offset-2">
                KVKK Aydınlatma Metni
              </Link>
              &apos;ni okudum.
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
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {state.message}
        </p>
      )}

      <Button type="submit" loading={pending} className="w-full" size="lg">
        {!pending && (kind === 'appointment' ? <CalendarCheck aria-hidden /> : <Send aria-hidden />)}
        {pending ? 'Gönderiliyor…' : SUBMIT_LABELS[kind]}
      </Button>
      {kind === 'valuation' && (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Bu form otomatik bir fiyat hesaplamaz. Bilgilerinizi inceledikten sonra bölgedeki güncel ilanlar ve piyasa koşullarıyla
          birlikte değerlendirip size dönüş yapılır.
        </p>
      )}
    </form>
  );
}
