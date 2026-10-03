import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const fieldBase =
  'w-full rounded-xl border border-border bg-surface px-3.5 text-foreground placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted-foreground aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, 'h-11', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, 'min-h-28 py-3 leading-relaxed', className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, 'h-11 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-[13px] font-semibold text-foreground/85', className)} {...props} />;
}

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
      {message}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">
      {children}
    </p>
  );
}

interface FieldProps {
  label: React.ReactNode;
  htmlFor: string;
  error?: string | null;
  hint?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Etiket + alan + ipucu + hata mesajını erişilebilir şekilde bir araya getirir */
export function Field({ label, htmlFor, error, hint, required, optional, className, children }: FieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(isteğe bağlı)</span>}
      </Label>
      {children}
      {hint && !error && <FieldHint id={`${htmlFor}-hint`}>{hint}</FieldHint>}
      <FieldError id={`${htmlFor}-error`} message={error} />
    </div>
  );
}

export function Checkbox({
  className,
  label,
  description,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; description?: React.ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm text-foreground/90 select-none', className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-[5px] border-border accent-[var(--primary)]"
        {...props}
      />
      <span className="leading-snug">
        {label}
        {description && <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

/** Açık/kapalı anahtarı (erişilebilir: role=switch) */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
  name,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
}) {
  const autoId = React.useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={switchId} className="cursor-pointer text-sm leading-snug">
        <span className="font-semibold text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{description}</span>}
      </label>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
      {name && <input type="hidden" name={name} value={checked ? '1' : '0'} />}
    </div>
  );
}
