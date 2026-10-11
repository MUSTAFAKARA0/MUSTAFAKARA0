'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { saveCustomer } from '@/app/actions/admin-crm';

interface CustomerValues {
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

function CustomerFields({ initial, errors }: { initial?: CustomerValues; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Ad soyad" htmlFor="c-name" error={errors.full_name} required className="sm:col-span-2">
        <Input id="c-name" name="full_name" defaultValue={initial?.full_name} maxLength={100} required />
      </Field>
      <Field label="Telefon" htmlFor="c-phone" error={errors.phone}>
        <Input id="c-phone" name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone ?? ''} maxLength={20} />
      </Field>
      <Field label="E-posta" htmlFor="c-email" error={errors.email}>
        <Input id="c-email" name="email" type="email" defaultValue={initial?.email ?? ''} maxLength={160} />
      </Field>
      <Field label="Notlar (yalnızca ekip görür)" htmlFor="c-notes" error={errors.notes} className="sm:col-span-2">
        <Textarea id="c-notes" name="notes" defaultValue={initial?.notes ?? ''} rows={4} maxLength={4000} />
      </Field>
    </div>
  );
}

function readForm(form: HTMLFormElement): CustomerValues {
  const fd = new FormData(form);
  const s = (k: string) => String(fd.get(k) ?? '').trim();
  return { full_name: s('full_name'), phone: s('phone') || null, email: s('email') || null, notes: s('notes') || null };
}

export function CustomerEditForm({ id, initial, disabled }: { id: string; initial: CustomerValues; disabled?: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await saveCustomer(id, readForm(e.currentTarget));
        setPending(false);
        if (!res.ok) {
          setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, v[0]])));
          return void toast.error(res.error);
        }
        setErrors({});
        toast.success('Müşteri bilgileri kaydedildi.');
        router.refresh();
      }}
    >
      <fieldset disabled={disabled} className="space-y-5">
        <CustomerFields initial={initial} errors={errors} />
        <Button type="submit" loading={pending}>
          {!pending && <Save />} Kaydet
        </Button>
      </fieldset>
    </form>
  );
}

export function NewCustomerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Yeni müşteri
        </Button>
      </DialogTrigger>
      <DialogContent title="Yeni müşteri" description="Telefon veya e-posta alanlarından en az biri gerekli." size="lg">
        <form
          className="mt-5 space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            const res = await saveCustomer(null, readForm(e.currentTarget));
            setPending(false);
            if (!res.ok) {
              setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, v[0]])));
              return void toast.error(res.error);
            }
            toast.success('Müşteri eklendi.');
            setOpen(false);
            router.push(`/admin/musteriler/${res.data.id}`);
          }}
        >
          <CustomerFields errors={errors} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" loading={pending}>
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
