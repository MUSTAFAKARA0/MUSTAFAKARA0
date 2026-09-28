'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/form-controls';
import { setSiteStatus } from '@/app/actions/site-builder';
import type { SiteStatus } from '@/platform/site/schema';

/** Site durumu: yayında · bakım modu · yayında değil (ofis paneli her durumda çalışır) */
export function SiteStatusForm({ orgId, status, message }: { orgId: string; status: SiteStatus; message: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState<SiteStatus>(status);
  const [text, setText] = useState(message ?? '');
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const dirty = value !== status || text !== (message ?? '');
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await setSiteStatus(orgId, { status: value, message: text });
        setPending(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success(res.message ?? 'Kaydedildi.');
        startTransition(() => router.refresh());
      }}
    >
      <Field label="Site durumu" htmlFor="site-status" hint="Bakım modunda ziyaretçiler kısa bir bilgi sayfası görür; ofisin yönetim paneli çalışmaya devam eder. Anında geçerlidir.">
        <Select id="site-status" value={value} onChange={(e) => setValue(e.target.value as SiteStatus)}>
          <option value="active">Yayında</option>
          <option value="maintenance">Bakım modu</option>
          <option value="draft">Yayında değil (yakında)</option>
        </Select>
      </Field>
      {value !== 'active' && (
        <Field label="Ziyaretçiye gösterilecek mesaj" htmlFor="site-message" optional>
          <Textarea id="site-message" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Kısa süre içinde tekrar hizmetinizdeyiz." />
        </Field>
      )}
      <Button type="submit" size="sm" loading={pending} disabled={!dirty}>
        Durumu kaydet
      </Button>
    </form>
  );
}
