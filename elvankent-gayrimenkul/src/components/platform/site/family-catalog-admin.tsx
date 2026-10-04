'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setDesignFamilyEnabled } from '@/app/actions/site-builder';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/form-controls';

interface CatalogFamily {
  id: string;
  name: string;
  description: string;
  audience: string;
  swatch: string[];
  heading: string;
  headingName: string;
  bodyName: string;
  parts: string[];
  enabled: boolean;
  sites: number;
}

export function FamilyCatalogAdmin({ available, families }: { available: boolean; families: CatalogFamily[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  return (
    <div>
      {[...new Set(families.map((f) => f.heading))].map((f) => (
        <link key={f} rel="stylesheet" href={`/fonts/site/${f}/preview.css`} precedence="default" />
      ))}
      {!available && <p className="mb-5 rounded-xl bg-warning-soft p-3 text-[13.5px] text-warning">Açma/kapama için 20261004000001_design_family_access migration&apos;ı veritabanına uygulanmalıdır.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {families.map((f) => (
          <li key={f.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex h-24 items-end justify-between px-5 pb-4" style={{ background: f.swatch[2], color: f.swatch[3], opacity: f.enabled ? 1 : 0.55 }}>
              <span className="text-[2.3rem] leading-none" style={{ fontFamily: `"${f.headingName}", serif` }} aria-hidden>
                Aa
              </span>
              <span className="flex gap-1.5" aria-hidden>
                {f.swatch.slice(0, 2).map((c) => (
                  <span key={c} className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                ))}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15.5px] font-semibold">{f.name}</h2>
                <Badge variant={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'Açık' : 'Kapalı'}</Badge>
                <Badge>{f.sites} site</Badge>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                {f.headingName} / {f.bodyName} · {f.audience}
              </p>
              <div className="mt-auto pt-4">
                <Switch
                  checked={f.enabled}
                  disabled={!available || pending !== null}
                  onCheckedChange={async (value) => {
                    setPending(f.id);
                    const res = await setDesignFamilyEnabled(f.id, value);
                    setPending(null);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(res.message ?? 'Kaydedildi.');
                    startTransition(() => router.refresh());
                  }}
                  label={`${f.name}: yeni siteler ve ofisler için açık`}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
