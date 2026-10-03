'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { NumberInput } from '@/components/forms/number-input';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/choice';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { createManualLead, type ManualLeadInput } from '@/app/actions/admin-crm';
import { LEAD_INTENT_LABELS, LEAD_SOURCE_LABELS } from '@/modules/crm/constants';

interface Option {
  id: string;
  label: string;
}

/** Telefonla / yüz yüze gelen talebi elle kaydetme */
export function NewLeadDialog({ customers, properties, members }: { customers: Option[]; properties: Option[]; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>(customers.length ? 'new' : 'new');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => (String(fd.get(k) ?? '').trim() || null);
    const input: ManualLeadInput = {
      customer_id: mode === 'existing' ? str('customer_id') : null,
      full_name: mode === 'new' ? (str('full_name') ?? undefined) : undefined,
      phone: mode === 'new' ? str('phone') : null,
      email: mode === 'new' ? str('email') : null,
      property_id: str('property_id'),
      source: (str('source') ?? 'manual') as ManualLeadInput['source'],
      intent: (str('intent') ?? 'buy') as ManualLeadInput['intent'],
      message: str('message'),
      budget_min: budgetMin ? Number(budgetMin) : null,
      budget_max: budgetMax ? Number(budgetMax) : null,
      desired_location: str('desired_location'),
      assigned_to: str('assigned_to'),
    };
    if (mode === 'existing' && !input.customer_id) {
      setErrors({ customer_id: 'Müşteri seçin.' });
      return;
    }
    setPending(true);
    const res = await createManualLead(input);
    setPending(false);
    if (!res.ok) {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.fieldErrors ?? {})) next[k] = v[0];
      setErrors(next);
      toast.error(res.error);
      return;
    }
    toast.success('Talep oluşturuldu.');
    setOpen(false);
    router.push(`/admin/talepler/${res.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Yeni talep
        </Button>
      </DialogTrigger>
      <DialogContent title="Yeni talep" description="Telefonla, WhatsApp'tan veya ofiste gelen bir talebi kaydedin." size="lg">
        <form onSubmit={onSubmit} className="mt-5 space-y-5" noValidate>
          {customers.length > 0 && (
            <SegmentedControl<'new' | 'existing'>
              label="Müşteri"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: 'new', label: 'Yeni müşteri' },
                { value: 'existing', label: 'Kayıtlı müşteri' },
              ]}
              className="w-full sm:w-80"
            />
          )}
          {mode === 'existing' ? (
            <Field label="Müşteri" htmlFor="nl-customer" error={errors.customer_id} required>
              <Select id="nl-customer" name="customer_id" defaultValue="">
                <option value="">Seçin</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ad soyad" htmlFor="nl-name" error={errors.full_name} required className="sm:col-span-3">
                <Input id="nl-name" name="full_name" maxLength={100} autoComplete="off" />
              </Field>
              <Field label="Telefon" htmlFor="nl-phone" error={errors.phone} className="sm:col-span-1">
                <Input id="nl-phone" name="phone" type="tel" inputMode="tel" maxLength={20} placeholder="05XX XXX XX XX" />
              </Field>
              <Field label="E-posta" htmlFor="nl-email" error={errors.email} className="sm:col-span-2">
                <Input id="nl-email" name="email" type="email" maxLength={160} />
              </Field>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Talep kaynağı" htmlFor="nl-source">
              <Select id="nl-source" name="source" defaultValue="phone">
                {(['phone', 'whatsapp', 'manual', 'website', 'qr'] as const).map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Talep türü" htmlFor="nl-intent">
              <Select id="nl-intent" name="intent" defaultValue="buy">
                {Object.entries(LEAD_INTENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="İlgilendiği ilan" htmlFor="nl-property" optional className="sm:col-span-2">
              <Select id="nl-property" name="property_id" defaultValue="">
                <option value="">İlan seçilmedi</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bütçe (en az)" htmlFor="nl-bmin" optional>
              <NumberInput id="nl-bmin" value={budgetMin} onValueChange={setBudgetMin} placeholder="₺" />
            </Field>
            <Field label="Bütçe (en fazla)" htmlFor="nl-bmax" optional>
              <NumberInput id="nl-bmax" value={budgetMax} onValueChange={setBudgetMax} placeholder="₺" />
            </Field>
            <Field label="İstenen bölge" htmlFor="nl-loc" optional>
              <Input id="nl-loc" name="desired_location" maxLength={160} placeholder="ör. istenen mahalle veya ilçe" />
            </Field>
            <Field label="Sorumlu" htmlFor="nl-assigned" optional>
              <Select id="nl-assigned" name="assigned_to" defaultValue="">
                <option value="">Atanmadı</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Not" htmlFor="nl-message" optional>
            <Textarea id="nl-message" name="message" maxLength={3000} rows={3} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" loading={pending}>
              Talebi kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
