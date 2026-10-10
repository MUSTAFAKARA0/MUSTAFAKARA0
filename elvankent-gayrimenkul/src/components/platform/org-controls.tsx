'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { createOrganization, setOrganizationPlan } from '@/app/actions/platform';
import { OwnerInvitationCard } from '@/components/platform/owner-invitation';

export function PlanForm({ orgId, plans, current, status }: { orgId: string; plans: { id: string; name: string }[]; current: string | null; status: string | null }) {
  const router = useRouter();
  const [plan, setPlan] = useState(current ?? plans[0]?.id ?? '');
  const [sub, setSub] = useState(status && ['trialing', 'active', 'past_due'].includes(status) ? status : 'active');
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await setOrganizationPlan(orgId, plan, sub);
        setPending(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success(res.message ?? 'Plan güncellendi.');
        startTransition(() => router.refresh());
      }}
    >
      <Field label="Plan" htmlFor="org-plan">
        <Select id="org-plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Abonelik durumu" htmlFor="org-sub">
        <Select id="org-sub" value={sub} onChange={(e) => setSub(e.target.value)}>
          <option value="trialing">Deneme (14 gün)</option>
          <option value="active">Aktif</option>
          <option value="past_due">Ödeme gecikmiş</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending}>
        Uygula
      </Button>
    </form>
  );
}

export function CreateOrgForm({ plans }: { plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ id: string; email: string; ownerAccount: 'invitation_pending' | 'existing_account' } | null>(null);

  if (done) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-success-soft p-4 text-[14px] text-success">Organizasyon oluşturuldu.</p>
        {done.ownerAccount === 'invitation_pending' ? (
          <div className="rounded-xl border border-border p-4">
            <OwnerInvitationCard orgId={done.id} email={done.email} invitation={{ status: 'pending', expiresAt: null, lastSentAt: null, acceptedAt: null, accountPending: true }} />
            <p className="mt-3 text-[12.5px] text-muted-foreground">Sahip şifresini davet e-postasındaki tek kullanımlık bağlantıyla kendisi belirler; şifre kimseye gösterilmez.</p>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted-foreground">{done.email} adresli mevcut hesap sahip olarak eklendi; mevcut şifresiyle giriş yapar.</p>
        )}
        <Button onClick={() => router.push(`/platform/organizasyonlar/${done.id}`)}>Organizasyona git</Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setErrors({});
        setFormError(null);
        const res = await createOrganization({
          name: String(fd.get('name') ?? ''),
          slug: String(fd.get('slug') ?? ''),
          prefix: String(fd.get('prefix') ?? ''),
          plan: String(fd.get('plan') ?? ''),
          owner_name: String(fd.get('owner_name') ?? ''),
          owner_email: String(fd.get('owner_email') ?? ''),
        });
        setPending(false);
        if (!res.ok) {
          const next: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors ?? {})) next[k] = v[0];
          setErrors(next);
          if (!Object.keys(next).length) setFormError(res.error);
          return;
        }
        setDone({ id: res.data.id, email: res.data.ownerEmail, ownerAccount: res.data.ownerAccount });
        router.refresh();
      }}
    >
      <Field label="Organizasyon adı" htmlFor="co-name" required error={errors.name} className="sm:col-span-2">
        <Input id="co-name" name="name" maxLength={80} required placeholder="ör. Örnek Gayrimenkul" />
      </Field>
      <Field label="Kısa ad (alt alan adı)" htmlFor="co-slug" required error={errors.slug} hint="ornek → ornek.platformadresi.com">
        <Input id="co-slug" name="slug" maxLength={40} required placeholder="ornek" autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="İlan no öneki" htmlFor="co-prefix" required error={errors.prefix} hint="2–5 harf; ilan numaraları ABC-2026-0001 biçiminde üretilir.">
        <Input id="co-prefix" name="prefix" maxLength={5} required placeholder="ABC" className="uppercase" autoComplete="off" />
      </Field>
      <Field label="Plan" htmlFor="co-plan" error={errors.plan} hint="Yeni organizasyon 14 günlük deneme süresiyle başlar.">
        <Select id="co-plan" name="plan" defaultValue={plans[0]?.id}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="hidden sm:block" />
      <Field label="Sahip adı soyadı" htmlFor="co-owner-name" required error={errors.owner_name}>
        <Input id="co-owner-name" name="owner_name" maxLength={100} required autoComplete="off" />
      </Field>
      <Field label="Sahip e-postası" htmlFor="co-owner-email" required error={errors.owner_email} hint="Hesap yoksa oluşturulur; sahibe şifresini kendisinin belirleyeceği aktivasyon daveti gönderilir.">
        <Input id="co-owner-email" name="owner_email" type="email" maxLength={160} required autoComplete="off" />
      </Field>
      {formError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger sm:col-span-2">
          {formError}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          Organizasyonu oluştur
        </Button>
      </div>
    </form>
  );
}
