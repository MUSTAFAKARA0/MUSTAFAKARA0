'use client';

import { useActionState, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/choice';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { createProperty, type CreatePropertyState } from '@/app/actions/admin-properties';
import { CATEGORY_LABELS, type ListingType, type PropertyCategory } from '@/modules/properties/constants';

export function NewListingForm({ types }: { types: { id: number; name: string; category: PropertyCategory }[] }) {
  const [state, action, pending] = useActionState<CreatePropertyState, FormData>(createProperty, {});
  const [listingType, setListingType] = useState<ListingType>('sale');
  const categories = [...new Set(types.map((t) => t.category))];
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="listing_type" value={listingType} />
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-foreground/85">İlan türü</p>
        <SegmentedControl<ListingType>
          label="İlan türü"
          value={listingType}
          onValueChange={setListingType}
          options={[
            { value: 'sale', label: 'Satılık' },
            { value: 'rent', label: 'Kiralık' },
          ]}
          className="w-full sm:w-80"
        />
      </div>
      <Field label="Emlak tipi" htmlFor="property_type_id" error={err.property_type_id} required>
        <Select id="property_type_id" name="property_type_id" defaultValue="" required aria-invalid={Boolean(err.property_type_id)}>
          <option value="" disabled>
            Seçin
          </option>
          {categories.map((c) => (
            <optgroup key={c} label={CATEGORY_LABELS[c]}>
              {types
                .filter((t) => t.category === c)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Field
        label="İlan başlığı"
        htmlFor="title"
        error={err.title}
        required
        hint="Sonradan değiştirebilirsiniz. Örnek: “Elvankent’te site içinde satılık 3+1 daire”"
      >
        <Input id="title" name="title" required minLength={3} maxLength={120} autoFocus aria-invalid={Boolean(err.title)} />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Taslağı oluştur ve devam et {!pending && <ArrowRight />}
      </Button>
    </form>
  );
}
