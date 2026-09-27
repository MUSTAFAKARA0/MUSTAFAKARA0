'use client';

import { useId } from 'react';
import { NumberInput } from '@/components/forms/number-input';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

type Errors = Record<string, string | undefined>;

export interface FieldCommon {
  label: string;
  name: string;
  errors?: Errors;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function TextField({
  value,
  onChange,
  maxLength,
  placeholder,
  counter,
  ...f
}: FieldCommon & { value: string | null; onChange: (v: string) => void; maxLength?: number; placeholder?: string; counter?: boolean }) {
  const id = `${f.name}-${useId()}`;
  const length = (value ?? '').length;
  return (
    <Field
      label={f.label}
      htmlFor={id}
      error={f.errors?.[f.name]}
      required={f.required}
      className={f.className}
      hint={
        counter && maxLength ? (
          <span className="flex justify-between gap-3">
            <span>{f.hint}</span>
            <span className={cn('numeric shrink-0', length > maxLength * 0.92 && 'font-semibold text-warning')}>
              {length}/{maxLength}
            </span>
          </span>
        ) : (
          f.hint
        )
      }
    >
      <Input
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={f.disabled}
        aria-invalid={Boolean(f.errors?.[f.name])}
      />
    </Field>
  );
}

export function TextAreaField({
  value,
  onChange,
  maxLength,
  rows = 8,
  placeholder,
  ...f
}: FieldCommon & { value: string | null; onChange: (v: string) => void; maxLength: number; rows?: number; placeholder?: string }) {
  const id = `${f.name}-${useId()}`;
  const length = (value ?? '').length;
  return (
    <Field
      label={f.label}
      htmlFor={id}
      error={f.errors?.[f.name]}
      required={f.required}
      className={f.className}
      hint={
        <span className="flex justify-between gap-3">
          <span>{f.hint}</span>
          <span className="numeric shrink-0">
            {length.toLocaleString('tr-TR')}/{maxLength.toLocaleString('tr-TR')}
          </span>
        </span>
      }
    >
      <Textarea
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        disabled={f.disabled}
        aria-invalid={Boolean(f.errors?.[f.name])}
      />
    </Field>
  );
}

/** Sayı alanı (binlik ayraçlı). `money` false ise küçük sayılar için düz giriş. */
export function NumberField({
  value,
  onChange,
  suffix,
  max,
  ...f
}: FieldCommon & { value: number | null; onChange: (v: number | null) => void; suffix?: string; max?: number }) {
  const id = `${f.name}-${useId()}`;
  return (
    <Field label={f.label} htmlFor={id} error={f.errors?.[f.name]} required={f.required} className={f.className} hint={f.hint}>
      <div className="relative">
        <NumberInput
          id={id}
          value={value === null || value === undefined ? '' : String(value)}
          onValueChange={(raw) => {
            if (!raw) return onChange(null);
            const n = Number(raw);
            onChange(max !== undefined ? Math.min(n, max) : n);
          }}
          disabled={f.disabled}
          aria-invalid={Boolean(f.errors?.[f.name])}
          className={suffix ? 'pr-12' : undefined}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </Field>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = 'Seçin',
  ...f
}: FieldCommon & {
  value: string | number | null;
  onChange: (v: string | null) => void;
  options: { value: string | number; label: string; group?: string }[];
  placeholder?: string;
}) {
  const id = `${f.name}-${useId()}`;
  const groups = [...new Set(options.map((o) => o.group).filter(Boolean))] as string[];
  return (
    <Field label={f.label} htmlFor={id} error={f.errors?.[f.name]} required={f.required} className={f.className} hint={f.hint}>
      <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} disabled={f.disabled} aria-invalid={Boolean(f.errors?.[f.name])}>
        <option value="">{placeholder}</option>
        {groups.length
          ? groups.map((g) => (
              <optgroup key={g} label={g}>
                {options
                  .filter((o) => o.group === g)
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ))
          : options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
      </Select>
    </Field>
  );
}

/** Evet / Hayır / Belirtilmemiş seçimi (null = bilgi girilmedi) */
export function TriState({ label, value, onChange, disabled }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
      <span id={id} className="text-[14px] font-medium text-foreground/90">
        {label}
      </span>
      <span className="inline-flex shrink-0 rounded-lg bg-surface-muted p-0.5">
        {[
          { v: true, l: 'Evet' },
          { v: false, l: 'Hayır' },
        ].map((o) => (
          <button
            key={o.l}
            type="button"
            disabled={disabled}
            aria-pressed={value === o.v}
            onClick={() => onChange(value === o.v ? null : o.v)}
            className={cn(
              'rounded-md px-3 py-1 text-[13px] font-semibold transition',
              value === o.v ? 'bg-surface text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.l}
          </button>
        ))}
      </span>
    </div>
  );
}

export function MultiChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-2 text-[13px] font-semibold text-foreground/85">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <ChoiceChip key={o.value} size="sm" pressed={on} onPressedChange={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}>
              {o.label}
            </ChoiceChip>
          );
        })}
      </div>
    </div>
  );
}

export function StepSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-7 first:border-t-0 first:pt-0">
      <h3 className="text-[15.5px] font-bold text-foreground">{title}</h3>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
