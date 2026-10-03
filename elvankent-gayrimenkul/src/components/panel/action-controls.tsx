'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { VariantProps } from 'class-variance-authority';
import { Button, type buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select } from '@/components/ui/form-controls';
import type { ActionResult } from '@/platform/actions';

type AnyResult = ActionResult<unknown>;

/** Sunucu işlemini çalıştırır: yükleniyor durumu, onay, bildirim ve sayfa tazeleme */
export function ActionButton({
  action,
  children,
  confirm,
  successMessage,
  redirectTo,
  variant = 'outline',
  size = 'sm',
  className,
  disabled,
}: {
  action: () => Promise<AnyResult>;
  children: React.ReactNode;
  confirm?: { title: string; description?: string; confirmLabel?: string; destructive?: boolean };
  successMessage?: string;
  redirectTo?: string;
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function run(): Promise<boolean> {
    setPending(true);
    try {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      toast.success(successMessage ?? res.message ?? 'İşlem tamamlandı.');
      if (redirectTo) router.push(redirectTo);
      else startTransition(() => router.refresh());
      return true;
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} loading={pending} disabled={disabled} onClick={() => (confirm ? setOpen(true) : void run())}>
        {children}
      </Button>
      {confirm && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          destructive={confirm.destructive}
          onConfirm={run}
        />
      )}
    </>
  );
}

/** Değiştiği anda kaydedilen seçim kutusu (durum, atanan kişi...) */
export function AutoSaveSelect({
  label,
  value,
  options,
  onSave,
  disabled,
  allowEmpty,
  emptyLabel = 'Seçilmedi',
  className,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onSave: (value: string | null) => Promise<AnyResult>;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value ?? '');
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">{label}</span>
      <Select
        aria-label={label}
        value={current}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onChange={async (e) => {
          const next = e.target.value;
          const previous = current;
          setCurrent(next);
          setPending(true);
          const res = await onSave(next || null);
          setPending(false);
          if (!res.ok) {
            setCurrent(previous);
            toast.error(res.error);
            return;
          }
          toast.success(res.message ?? 'Kaydedildi.');
          startTransition(() => router.refresh());
        }}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
