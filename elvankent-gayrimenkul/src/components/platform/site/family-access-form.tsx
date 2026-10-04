'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { setOrgDesignFamilies } from '@/app/actions/site-builder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/form-controls';

/**
 * KARAY › Site › Tema: ofis yöneticisinin kendi panelinde (Site tasarımı) seçebileceği aileler.
 * Global olarak kapatılmış aile izinli olsa bile ofise gösterilmez.
 */
export function FamilyAccessForm({ orgId, available, granted, families }: { orgId: string; available: boolean; granted: string[]; families: { id: string; name: string; disabled: boolean }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(granted));
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const dirty = [...selected].sort().join() !== [...granted].sort().join();
  return (
    <section aria-labelledby="ofis-aileleri" className="rounded-2xl border border-border bg-surface p-5">
      <h2 id="ofis-aileleri" className="flex items-center gap-2 text-[17px] font-semibold">
        <KeyRound className="size-4.5 text-primary-ink" aria-hidden /> Ofisin seçebileceği tasarımlar
      </h2>
      <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
        Ofis yöneticisi kendi panelindeki <strong className="font-semibold text-foreground">Site yönetimi › Tasarım</strong> sekmesinde yalnızca burada işaretli aileleri görür ve sitesine uygulayabilir.
      </p>
      {!available ? (
        <p className="mt-4 rounded-xl bg-warning-soft p-3 text-[13.5px] text-warning">Bu özellik için 20261004000001_design_family_access migration&apos;ı veritabanına uygulanmalıdır.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {families.map((f) => (
              <Checkbox
                key={f.id}
                checked={selected.has(f.id)}
                onChange={(e) =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(f.id);
                    else n.delete(f.id);
                    return n;
                  })
                }
                label={f.name}
                description={f.disabled ? 'Global olarak kapalı: ofise gösterilmez' : undefined}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              disabled={!dirty}
              loading={pending}
              onClick={async () => {
                setPending(true);
                const res = await setOrgDesignFamilies(orgId, [...selected]);
                setPending(false);
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.message ?? 'Kaydedildi.');
                startTransition(() => router.refresh());
              }}
            >
              İzinleri kaydet
            </Button>
            <Badge>{selected.size} aile</Badge>
          </div>
        </>
      )}
    </section>
  );
}
