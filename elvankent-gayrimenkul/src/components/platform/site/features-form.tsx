'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { SaveBar } from '@/components/platform/site/site-actions';
import { setSiteFeatures } from '@/app/actions/site-builder';
import { cn } from '@/lib/utils';
import type { FeatureKey, FeatureOverrides } from '@/site-config/schema';

export interface FeatureRow {
  key: FeatureKey;
  label: string;
  description: string;
  /** Plan / sistem varsayılanı (geçersiz kılma yoksa geçerli değer) */
  base: boolean;
  baseLabel: string;
}

type Choice = 'default' | 'on' | 'off';
const toChoice = (v: boolean | undefined): Choice => (v === undefined ? 'default' : v ? 'on' : 'off');

/**
 * Kiracı bazlı özellik bayrakları: her özellik plan varsayılanını izler veya
 * süper admin tarafından açık/kapalı olarak zorlanır. Değişiklik anında geçerli olur
 * (sunucu tarafında da uygulanır: plan kontrolü ve site sayfaları aynı değeri kullanır).
 */
export function FeaturesForm({ orgId, rows, initial }: { orgId: string; rows: FeatureRow[]; initial: FeatureOverrides }) {
  const router = useRouter();
  const [values, setValues] = useState<FeatureOverrides>(initial);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  return (
    <div className="max-w-4xl">
      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {rows.map((r) => {
          const choice = toChoice(values[r.key]);
          const effective = values[r.key] ?? r.base;
          return (
            <li key={r.key} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold">
                  {r.label}
                  <Badge variant={effective ? 'success' : 'neutral'}>{effective ? 'Açık' : 'Kapalı'}</Badge>
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{r.description}</p>
              </div>
              <div role="radiogroup" aria-label={r.label} className="inline-flex shrink-0 rounded-xl border border-border bg-surface-muted p-0.5 text-[13px]">
                {(
                  [
                    ['default', `${r.baseLabel} (${r.base ? 'açık' : 'kapalı'})`],
                    ['on', 'Açık'],
                    ['off', 'Kapalı'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={choice === value}
                    onClick={() =>
                      setValues((v) => {
                        const next = { ...v };
                        if (value === 'default') delete next[r.key];
                        else next[r.key] = value === 'on';
                        return next;
                      })
                    }
                    className={cn('min-h-9 rounded-[10px] px-3 font-medium transition', choice === value ? 'bg-surface text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <SaveBar
        pending={pending}
        dirty={dirty}
        saveLabel="Kaydet"
        note="Özellik değişiklikleri kaydedildiğinde anında geçerli olur ve denetim kaydına yazılır."
        onReset={() => setValues(initial)}
        onSave={async () => {
          setPending(true);
          const payload: Record<string, boolean | null> = {};
          for (const r of rows) payload[r.key] = values[r.key] ?? null;
          const res = await setSiteFeatures(orgId, payload);
          setPending(false);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message ?? 'Kaydedildi.');
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
