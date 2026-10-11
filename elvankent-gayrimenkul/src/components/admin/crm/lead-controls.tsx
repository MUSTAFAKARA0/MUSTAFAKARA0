'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { addLeadActivity, createAppointment, updateLead } from '@/app/actions/admin-crm';
import { ACTIVITY_KIND_LABELS } from '@/modules/crm/constants';

/** Takip tarihi (datetime-local, Türkiye saati) */
export function FollowUpControl({ leadId, value, disabled }: { leadId: string; value: string | null; disabled?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(value ? toLocalInput(value) : '');
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  async function save(next: string) {
    setPending(true);
    const res = await updateLead(leadId, { next_follow_up_at: next ? fromLocalInput(next) : null });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(next ? 'Takip tarihi kaydedildi.' : 'Takip tarihi kaldırıldı.');
    startTransition(() => router.refresh());
  }
  return (
    <div>
      <label htmlFor="follow-up" className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
        Sonraki takip
      </label>
      <div className="flex gap-2">
        <Input id="follow-up" type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={disabled || pending} className="min-w-0" />
        <Button variant="outline" onClick={() => void save(draft)} loading={pending} disabled={disabled}>
          Kaydet
        </Button>
      </div>
      {value && !disabled && (
        <button type="button" className="mt-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => void save('')}>
          Takibi kaldır
        </button>
      )}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Tarayıcının saat dilimindeki değeri ISO (ofsetli) biçime çevirir */
function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

export function ActivityComposer({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<'note' | 'call' | 'whatsapp' | 'email' | 'meeting'>('note');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setPending(true);
        const res = await addLeadActivity(leadId, kind, body);
        setPending(false);
        if (!res.ok) return void toast.error(res.error);
        setBody('');
        toast.success('Kayıt eklendi.');
        startTransition(() => router.refresh());
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select aria-label="Kayıt türü" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="sm:w-52">
          {(['note', 'call', 'whatsapp', 'email', 'meeting'] as const).map((k) => (
            <option key={k} value={k}>
              {ACTIVITY_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </div>
      <label htmlFor="activity-body" className="sr-only">
        Not
      </label>
      <Textarea
        id="activity-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={kind === 'call' ? 'Görüşmenin özeti, müşterinin beklentileri…' : 'Not ekleyin…'}
      />
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!body.trim()}>
          {!pending && <MessageSquarePlus />} Kaydet
        </Button>
      </div>
    </form>
  );
}

export function NewAppointmentDialog({
  customers,
  properties,
  members,
  defaults,
  triggerLabel = 'Randevu oluştur',
  triggerVariant = 'outline',
}: {
  customers: { id: string; label: string }[];
  properties: { id: string; label: string }[];
  members: { id: string; name: string }[];
  defaults?: { customerId?: string; propertyId?: string | null; leadId?: string };
  triggerLabel?: string;
  triggerVariant?: 'outline' | 'primary';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <CalendarPlus /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent title="Yeni randevu" description="Onaylanmış bir gösterim veya görüşme randevusu oluşturun." size="lg">
        <form
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const date = String(fd.get('date') ?? '');
            const time = String(fd.get('time') ?? '');
            if (!date || !time) return setError('Tarih ve saat seçin.');
            setPending(true);
            setError(null);
            const res = await createAppointment({
              customer_id: String(fd.get('customer_id') ?? ''),
              property_id: String(fd.get('property_id') ?? '') || null,
              lead_id: defaults?.leadId ?? null,
              scheduled_at: new Date(`${date}T${time}`).toISOString(),
              duration_minutes: Number(fd.get('duration') ?? 45),
              note: String(fd.get('note') ?? '') || null,
              assigned_to: String(fd.get('assigned_to') ?? '') || null,
            });
            setPending(false);
            if (!res.ok) return setError(res.error);
            toast.success('Randevu oluşturuldu.');
            setOpen(false);
            router.refresh();
          }}
        >
          <Field label="Müşteri" htmlFor="ap-customer" required>
            <Select id="ap-customer" name="customer_id" defaultValue={defaults?.customerId ?? ''} required>
              <option value="">Seçin</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="İlan" htmlFor="ap-property" optional>
            <Select id="ap-property" name="property_id" defaultValue={defaults?.propertyId ?? ''}>
              <option value="">Genel görüşme</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tarih" htmlFor="ap-date" required>
              <Input id="ap-date" name="date" type="date" required />
            </Field>
            <Field label="Saat" htmlFor="ap-time" required>
              <Input id="ap-time" name="time" type="time" step={900} required />
            </Field>
            <Field label="Süre" htmlFor="ap-duration">
              <Select id="ap-duration" name="duration" defaultValue="45">
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} dk
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Sorumlu" htmlFor="ap-assigned" optional>
            <Select id="ap-assigned" name="assigned_to" defaultValue="">
              <option value="">Atanmadı</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Not" htmlFor="ap-note" optional>
            <Textarea id="ap-note" name="note" rows={2} maxLength={2000} />
          </Field>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" loading={pending}>
              Randevuyu kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
