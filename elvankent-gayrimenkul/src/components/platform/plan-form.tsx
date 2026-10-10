'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/form-controls';
import { updatePlan } from '@/app/actions/platform';

export interface PlanValues {
  id: string;
  name: string;
  max_users: number | null;
  max_properties: number | null;
  max_storage_mb: number | null;
  crm_enabled: boolean;
  analytics_enabled: boolean;
  pdf_enabled: boolean;
  custom_domain_enabled: boolean;
  price_monthly: number | null;
}

export function PlanForm({ plan }: { plan: PlanValues }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: plan.name,
    max_users: plan.max_users?.toString() ?? '',
    max_properties: plan.max_properties?.toString() ?? '',
    max_storage_mb: plan.max_storage_mb?.toString() ?? '',
    price: plan.price_monthly?.toString() ?? '',
    crm: plan.crm_enabled,
    analytics: plan.analytics_enabled,
    pdf: plan.pdf_enabled,
    custom_domain: plan.custom_domain_enabled,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const id = (k: string) => `${plan.id}-${k}`;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setErrors({});
        const res = await updatePlan({ id: plan.id, ...v });
        setPending(false);
        if (!res.ok) {
          const next: Record<string, string> = {};
          for (const [k, m] of Object.entries(res.fieldErrors ?? {})) next[k] = m[0];
          setErrors(next);
          toast.error(res.error);
          return;
        }
        toast.success(res.message ?? 'Kaydedildi.');
        router.refresh();
      }}
    >
      <Field label="Plan adı" htmlFor={id('name')} error={errors.name}>
        <Input id={id('name')} value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} maxLength={60} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kullanıcı sınırı" htmlFor={id('users')} error={errors.max_users}>
          <Input id={id('users')} inputMode="numeric" value={v.max_users} onChange={(e) => setV((s) => ({ ...s, max_users: e.target.value }))} placeholder="Sınırsız" />
        </Field>
        <Field label="İlan sınırı" htmlFor={id('props')} error={errors.max_properties}>
          <Input id={id('props')} inputMode="numeric" value={v.max_properties} onChange={(e) => setV((s) => ({ ...s, max_properties: e.target.value }))} placeholder="Sınırsız" />
        </Field>
        <Field label="Depolama (MB)" htmlFor={id('storage')} error={errors.max_storage_mb}>
          <Input id={id('storage')} inputMode="numeric" value={v.max_storage_mb} onChange={(e) => setV((s) => ({ ...s, max_storage_mb: e.target.value }))} placeholder="Sınırsız" />
        </Field>
        <Field label="Aylık fiyat (₺)" htmlFor={id('price')} error={errors.price}>
          <Input id={id('price')} inputMode="decimal" value={v.price} onChange={(e) => setV((s) => ({ ...s, price: e.target.value }))} placeholder="Belirtilmedi" />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Checkbox checked={v.crm} onChange={(e) => setV((s) => ({ ...s, crm: e.target.checked }))} label="CRM" />
        <Checkbox checked={v.analytics} onChange={(e) => setV((s) => ({ ...s, analytics: e.target.checked }))} label="Analitik" />
        <Checkbox checked={v.pdf} onChange={(e) => setV((s) => ({ ...s, pdf: e.target.checked }))} label="PDF broşür" />
        <Checkbox checked={v.custom_domain} onChange={(e) => setV((s) => ({ ...s, custom_domain: e.target.checked }))} label="Özel alan adı" />
      </div>
      <Button type="submit" size="sm" loading={pending}>
        {!pending && <Save />} Kaydet
      </Button>
    </form>
  );
}
