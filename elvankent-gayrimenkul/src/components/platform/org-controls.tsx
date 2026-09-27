'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Copy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/form-controls';
import { addDomain, createOrganization, setOrganizationPlan } from '@/app/actions/platform';

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

export function DomainForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [host, setHost] = useState('');
  const [primary, setPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await addDomain(orgId, host, primary);
        setPending(false);
        if (!res.ok) {
          setError(res.fieldErrors?.hostname?.[0] ?? res.error);
          return;
        }
        toast.success(res.message ?? 'Alan adı eklendi.');
        setHost('');
        setPrimary(false);
        startTransition(() => router.refresh());
      }}
    >
      <Field label="Alan adı" htmlFor="org-domain" error={error}>
        <Input id="org-domain" value={host} onChange={(e) => setHost(e.target.value)} placeholder="www.ornekemlak.com" autoComplete="off" spellCheck={false} maxLength={253} />
      </Field>
      <Checkbox checked={primary} onChange={(e) => setPrimary(e.target.checked)} label="Birincil alan adı yap" description="Sitenin kanonik adresi (site haritası, paylaşım bağlantıları) bu alan adı olur." />
      <Button type="submit" size="sm" loading={pending} disabled={!host.trim()}>
        {!pending && <Plus />} Alan adı ekle
      </Button>
    </form>
  );
}

export function CreateOrgForm({ plans }: { plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ id: string; password: string | null; email: string } | null>(null);

  if (done) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-success-soft p-4 text-[14px] text-success">Organizasyon oluşturuldu.</p>
        {done.password ? (
          <div className="rounded-xl border border-border p-4">
            <p className="text-[13px] text-muted-foreground">Sahip hesabı oluşturuldu. Geçici şifre yalnızca şimdi gösterilir; güvenli bir kanaldan iletin. İlk girişte değiştirmesi istenir.</p>
            <p className="mt-3 text-[13px] font-semibold">{done.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="numeric flex-1 rounded-lg bg-surface-muted px-3 py-2 font-mono text-[16px] select-all">{done.password}</code>
              <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(done.password!).then(() => toast.success('Kopyalandı.'))}>
                <Copy /> Kopyala
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted-foreground">{done.email} adresli mevcut hesap sahip olarak eklendi.</p>
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
        setDone({ id: res.data.id, password: res.data.temporaryPassword, email: res.data.ownerEmail });
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
      <Field label="Sahip e-postası" htmlFor="co-owner-email" required error={errors.owner_email} hint="Hesap yoksa geçici şifreyle oluşturulur.">
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
