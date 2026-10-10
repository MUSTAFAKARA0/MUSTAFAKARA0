'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { TextAreaField, TextField } from '@/components/admin/editor/fields';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/form-controls';
import { saveSiteSettings } from '@/app/actions/admin-settings';

type Precision = 'exact' | 'approximate' | 'neighborhood';

const PRECISION_OPTIONS: { value: Precision; label: string; hint: string }[] = [
  { value: 'approximate', label: 'Yaklaşık konum (~200 m)', hint: 'Önerilen: adres güvenliği ve ziyaretçi ihtiyacı dengesi.' },
  { value: 'neighborhood', label: 'Sadece mahalle', hint: 'Haritada yalnızca mahalle alanı gösterilir.' },
  { value: 'exact', label: 'Tam konum', hint: 'Yalnızca mülk sahibinin onayı varsa kullanın.' },
];

export function SiteSettingsForm({ initial, defaults, draftToken = null }: { initial: { hero_title: string; hero_subtitle: string; default_location_precision: Precision }; defaults: { title: string; subtitle: string }; draftToken?: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const hint = PRECISION_OPTIONS.find((o) => o.value === v.default_location_precision)?.hint;

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setErrors({});
        const res = await saveSiteSettings(v, draftToken);
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
      <TextField
        label="Ana sayfa başlığı"
        name="hero_title"
        value={v.hero_title}
        onChange={(x) => setV((s) => ({ ...s, hero_title: x }))}
        maxLength={120}
        counter
        errors={errors}
        placeholder={defaults.title}
        hint="Boş bırakılırsa varsayılan başlık kullanılır."
      />
      <TextAreaField
        label="Ana sayfa alt başlığı"
        name="hero_subtitle"
        value={v.hero_subtitle}
        onChange={(x) => setV((s) => ({ ...s, hero_subtitle: x }))}
        maxLength={240}
        rows={2}
        errors={errors}
        placeholder={defaults.subtitle}
      />
      <Field label="Yeni ilanlarda konum gösterimi" htmlFor="default-precision" hint={hint} error={errors.default_location_precision}>
        <Select id="default-precision" value={v.default_location_precision} onChange={(e) => setV((s) => ({ ...s, default_location_precision: e.target.value as Precision }))}>
          {PRECISION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {!pending && <Save />} Kaydet
        </Button>
      </div>
    </form>
  );
}
