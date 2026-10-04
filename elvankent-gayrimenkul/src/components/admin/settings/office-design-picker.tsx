'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, Lock, Palette } from 'lucide-react';
import { applyOfficeDesign } from '@/app/actions/admin-design';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Sunucuda süzülmüş, ofise izinli bir ailenin görünen bilgileri (katalogun geri kalanı istemciye gelmez) */
export interface OfficeFamily {
  id: string;
  name: string;
  description: string;
  swatch: string[];
  heading: string;
  headingName: string;
  bodyName: string;
  parts: string[];
}

export function OfficeDesignPicker({ available, families, current }: { available: boolean; families: OfficeFamily[]; current: { id: string; name: string } | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!available || families.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-[15px] font-semibold">Tasarım seçimi kapalı</p>
        <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted-foreground">
          {current ? `Siteniz şu anda "${current.name}" tasarımını kullanıyor. ` : ''}Farklı bir tasarıma geçmek için KARAY ekibinin sizin için tasarım açması gerekir.
        </p>
      </div>
    );
  }

  async function apply(id: string) {
    setPending(id);
    const res = await applyOfficeDesign(id);
    setPending(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message ?? 'Tasarım uygulandı.');
    setConfirming(null);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {/* Yalnızca izinli ailelerin başlık yazı tipi, örnek "Aa" için */}
      {[...new Set(families.map((f) => f.heading))].map((f) => (
        <link key={f} rel="stylesheet" href={`/fonts/site/${f}/preview.css`} precedence="default" />
      ))}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted-foreground">
          Şu anki tasarım: <strong className="font-semibold text-foreground">{current?.name ?? 'Varsayılan'}</strong>
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/" target="_blank" rel="noopener">
            <ExternalLink /> Sitemi görüntüle
          </a>
        </Button>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Kullanabileceğiniz tasarımlar">
        {families.map((f) => {
          const active = current?.id === f.id;
          return (
            <li key={f.id} className={cn('flex flex-col overflow-hidden rounded-2xl border bg-surface', active ? 'border-foreground shadow-[0_0_0_1px_var(--color-foreground)]' : 'border-border')}>
              <div className="flex h-24 items-end justify-between px-5 pb-4" style={{ background: f.swatch[2], color: f.swatch[3] }}>
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
                  <h3 className="text-[15.5px] font-semibold">{f.name}</h3>
                  {active && (
                    <Badge variant="success">
                      <Check className="size-3" aria-hidden /> Kullanılıyor
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  {f.headingName} / {f.bodyName}
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {f.parts.map((p) => (
                    <li key={p} className="rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] text-muted-foreground">
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-5">
                  {active ? null : confirming === f.id ? (
                    <div className="rounded-xl bg-surface-muted p-3">
                      <p className="text-[13px]">Siteniz bu tasarımla hemen yayınlanır. İlanlarınız, metinleriniz ve markanız değişmez.</p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" loading={pending === f.id} onClick={() => apply(f.id)}>
                          Uygula ve yayınla
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={pending !== null}>
                          Vazgeç
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConfirming(f.id)} disabled={pending !== null}>
                      <Palette /> Bu tasarımı kullan
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
