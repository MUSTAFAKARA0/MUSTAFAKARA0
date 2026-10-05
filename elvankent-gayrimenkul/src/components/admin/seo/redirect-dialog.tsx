'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PencilLine, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { saveRedirect } from '@/app/actions/admin-content';

// Site, kalıcı kuralları 308, geçicileri 307 koduyla gönderir (arama motorları 308'i 301 gibi değerlendirir)
const TYPES = [
  { value: 308, label: 'Kalıcı (308) — adres kalıcı olarak taşındı' },
  { value: 307, label: 'Geçici (307) — kısa süreli yönlendirme' },
];

const normalizeCode = (code: number | undefined) => (code === 302 || code === 307 ? 307 : 308);

/** Yönlendirme ekleme / düzenleme penceresi */
export function RedirectDialog({ initial }: { initial?: { id: number; fromPath: string; toPath: string; statusCode: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setErrors({});
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {initial ? (
          <Button size="xs" variant="ghost">
            <PencilLine /> Düzenle
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Yeni yönlendirme
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={initial ? 'Yönlendirmeyi düzenle' : 'Yeni yönlendirme'} description="Eski bir adrese gelen ziyaretçileri ve arama motorlarını yeni adrese gönderir. Taslak yoktur: kaydedildiği anda sitede etkin olur." size="lg">
        <form
          className="mt-5 space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setPending(true);
            setErrors({});
            setFormError(null);
            const res = await saveRedirect(initial?.id ?? null, {
              from_path: String(fd.get('from_path') ?? ''),
              to_path: String(fd.get('to_path') ?? ''),
              status_code: Number(fd.get('status_code') ?? 308),
            });
            setPending(false);
            if (!res.ok) {
              const next: Record<string, string> = {};
              for (const [k, v] of Object.entries(res.fieldErrors ?? {})) next[k] = v[0];
              setErrors(next);
              if (!Object.keys(next).length) setFormError(res.error);
              return;
            }
            toast.success(res.message ?? 'Yönlendirme kaydedildi.');
            setOpen(false);
            router.refresh();
          }}
        >
          <Field label="Eski adres" htmlFor="rd-from" required error={errors.from_path} hint="Sitenizdeki yol; ör. /eski-ilanlar/ev-123">
            <Input id="rd-from" name="from_path" defaultValue={initial?.fromPath} maxLength={400} placeholder="/eski-sayfa" autoComplete="off" spellCheck={false} required />
          </Field>
          <Field label="Yeni adres" htmlFor="rd-to" required error={errors.to_path} hint="Yalnızca site içi adres; ör. /satilik veya /ilan/ornek-3-1-daire">
            <Input id="rd-to" name="to_path" defaultValue={initial?.toPath} maxLength={400} placeholder="/satilik" autoComplete="off" spellCheck={false} required />
          </Field>
          <Field label="Yönlendirme türü" htmlFor="rd-type" error={errors.status_code}>
            <Select id="rd-type" name="status_code" defaultValue={String(normalizeCode(initial?.statusCode))}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          {formError && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
              {formError}
            </p>
          )}
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
