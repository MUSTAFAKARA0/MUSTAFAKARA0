'use client';

import { useId } from 'react';
import { ChoiceChip, SegmentedControl } from '@/components/ui/choice';
import { Input, Label, Select } from '@/components/ui/form-controls';
import { NumberInput } from '@/components/ui/number-input';
import { FLAG_LABELS, type FilterDraft, type FlagKey } from '@/components/search/filter-state';
import type { SearchOptions } from '@/modules/properties/search-types';
import {
  CATEGORY_LABELS,
  DEED_STATUS_OPTIONS,
  FLOOR_FILTER_OPTIONS,
  HEATING_OPTIONS,
  ROOM_FILTER_OPTIONS,
  type ListingType,
  type PropertyCategory,
} from '@/modules/properties/constants';

const AGE_OPTIONS = [
  { value: '0', label: 'Sıfır bina' },
  { value: '5', label: '5 yaş ve altı' },
  { value: '10', label: '10 yaş ve altı' },
  { value: '20', label: '20 yaş ve altı' },
  { value: '30', label: '30 yaş ve altı' },
];

const FEATURE_FLAGS: FlagKey[] = ['credit', 'furnished', 'complex', 'elevator', 'parking', 'balcony', 'seaView', 'investment'];
const LISTING_FLAGS: FlagKey[] = ['isNew', 'priceDrop', 'featured'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-border py-6 first:pt-0 last:border-b-0 last:pb-0">
      <legend className="mb-3 text-[13px] font-bold tracking-wide text-foreground uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Tüm arama filtreleri. Mobilde alttan açılan panelde, masaüstünde
 * "Tüm filtreler" panelinde kullanılır.
 */
export function FiltersPanel({
  draft,
  onChange,
  options,
  lockedLocation,
}: {
  draft: FilterDraft;
  onChange: (next: FilterDraft) => void;
  options: SearchOptions;
  /** Bölge sayfalarında konum sabittir */
  lockedLocation?: boolean;
}) {
  const id = useId();
  const set = <K extends keyof FilterDraft>(key: K, value: FilterDraft[K]) => onChange({ ...draft, [key]: value });
  const setFlag = (key: FlagKey, value: boolean) => onChange({ ...draft, flags: { ...draft.flags, [key]: value } });

  const districts = options.districts.filter((d) => !draft.city || d.citySlug === draft.city);
  const neighborhoods = options.neighborhoods.filter((n) => n.districtSlug === draft.district);
  const categories = Object.entries(CATEGORY_LABELS) as [PropertyCategory, string][];
  const typesInCategory = options.types.filter((t) => !draft.category || t.category === draft.category);
  const isLandOnly = draft.category === 'arsa';

  return (
    <div>
      <Section title="İlan türü">
        <SegmentedControl<'' | ListingType>
          label="İlan türü"
          value={draft.listingType}
          onValueChange={(v) => set('listingType', v)}
          options={[
            { value: '', label: 'Tümü' },
            { value: 'sale', label: 'Satılık' },
            { value: 'rent', label: 'Kiralık' },
          ]}
          className="w-full"
        />
      </Section>

      <Section title="Gayrimenkul tipi">
        <div className="flex flex-wrap gap-2">
          <ChoiceChip pressed={!draft.category && draft.types.length === 0} onPressedChange={() => onChange({ ...draft, category: '', types: [] })}>
            Tümü
          </ChoiceChip>
          {categories.map(([value, label]) => (
            <ChoiceChip
              key={value}
              pressed={draft.category === value && draft.types.length === 0}
              onPressedChange={(on) => onChange({ ...draft, category: on ? value : '', types: [] })}
            >
              {label}
            </ChoiceChip>
          ))}
        </div>
        {typesInCategory.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {typesInCategory.map((t) => (
              <ChoiceChip
                key={t.slug}
                size="sm"
                pressed={draft.types.includes(t.slug)}
                onPressedChange={(on) =>
                  set('types', on ? [...draft.types, t.slug] : draft.types.filter((x) => x !== t.slug))
                }
              >
                {t.name}
              </ChoiceChip>
            ))}
          </div>
        )}
      </Section>

      {!lockedLocation && (
        <Section title="Konum">
          <div className="grid gap-3 sm:grid-cols-3">
            {options.cities.length > 1 && (
              <div>
                <Label htmlFor={`${id}-il`}>İl</Label>
                <Select
                  id={`${id}-il`}
                  value={draft.city}
                  onChange={(e) => onChange({ ...draft, city: e.target.value, district: '', neighborhood: '' })}
                >
                  <option value="">Tüm iller</option>
                  {options.cities.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor={`${id}-ilce`}>İlçe</Label>
              <Select
                id={`${id}-ilce`}
                value={draft.district}
                onChange={(e) => {
                  const d = districts.find((x) => x.slug === e.target.value);
                  onChange({ ...draft, district: e.target.value, neighborhood: '', city: d?.citySlug ?? draft.city });
                }}
              >
                <option value="">Tüm ilçeler</option>
                {districts.map((d) => (
                  <option key={`${d.citySlug}-${d.slug}`} value={d.slug}>
                    {d.name} ({d.count})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${id}-mahalle`}>Mahalle</Label>
              <Select
                id={`${id}-mahalle`}
                value={draft.neighborhood}
                onChange={(e) => set('neighborhood', e.target.value)}
                disabled={!draft.district || neighborhoods.length === 0}
              >
                <option value="">{draft.district ? 'Tüm mahalleler' : 'Önce ilçe seçin'}</option>
                {neighborhoods.map((n) => (
                  <option key={n.slug} value={n.slug}>
                    {n.name} ({n.count})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Section>
      )}

      <Section title="Fiyat (₺)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${id}-pmin`}>En az</Label>
            <NumberInput id={`${id}-pmin`} placeholder="Min" value={draft.minPrice} onValueChange={(v) => set('minPrice', v)} />
          </div>
          <div>
            <Label htmlFor={`${id}-pmax`}>En çok</Label>
            <NumberInput id={`${id}-pmax`} placeholder="Max" value={draft.maxPrice} onValueChange={(v) => set('maxPrice', v)} />
          </div>
        </div>
      </Section>

      <Section title="Alan (m²)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${id}-mmin`}>En az</Label>
            <NumberInput id={`${id}-mmin`} placeholder="Min" value={draft.minM2} onValueChange={(v) => set('minM2', v)} />
          </div>
          <div>
            <Label htmlFor={`${id}-mmax`}>En çok</Label>
            <NumberInput id={`${id}-mmax`} placeholder="Max" value={draft.maxM2} onValueChange={(v) => set('maxM2', v)} />
          </div>
        </div>
      </Section>

      {!isLandOnly && (
        <>
          <Section title="Oda sayısı">
            <div className="flex flex-wrap gap-2">
              {ROOM_FILTER_OPTIONS.map((r) => (
                <ChoiceChip
                  key={r}
                  pressed={draft.rooms.includes(r)}
                  onPressedChange={(on) => set('rooms', on ? [...draft.rooms, r] : draft.rooms.filter((x) => x !== r))}
                >
                  {r}
                </ChoiceChip>
              ))}
            </div>
          </Section>

          <Section title="Bina ve kat">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${id}-age`}>Bina yaşı</Label>
                <Select id={`${id}-age`} value={draft.maxAge} onChange={(e) => set('maxAge', e.target.value)}>
                  <option value="">Farketmez</option>
                  {AGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`${id}-floor`}>Kat</Label>
                <Select id={`${id}-floor`} value={draft.floor} onChange={(e) => set('floor', e.target.value)}>
                  <option value="">Farketmez</option>
                  {FLOOR_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`${id}-heating`}>Isıtma</Label>
                <Select id={`${id}-heating`} value={draft.heating} onChange={(e) => set('heating', e.target.value)}>
                  <option value="">Farketmez</option>
                  {HEATING_OPTIONS.filter((o) => o.value !== 'diger').map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`${id}-deed`}>Tapu durumu</Label>
                <Select id={`${id}-deed`} value={draft.deed} onChange={(e) => set('deed', e.target.value)}>
                  <option value="">Farketmez</option>
                  {DEED_STATUS_OPTIONS.filter((o) => o.value !== 'diger').map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Section>
        </>
      )}

      <Section title="Özellikler">
        <div className="flex flex-wrap gap-2">
          {FEATURE_FLAGS.map((k) => (
            <ChoiceChip key={k} size="sm" pressed={draft.flags[k]} onPressedChange={(v) => setFlag(k, v)}>
              {FLAG_LABELS[k]}
            </ChoiceChip>
          ))}
        </div>
      </Section>

      <Section title="İlanlar">
        <div className="flex flex-wrap gap-2">
          {LISTING_FLAGS.map((k) => (
            <ChoiceChip key={k} size="sm" pressed={draft.flags[k]} onPressedChange={(v) => setFlag(k, v)}>
              {FLAG_LABELS[k]}
            </ChoiceChip>
          ))}
        </div>
      </Section>

      <Section title="Kelime veya ilan no">
        <Label htmlFor={`${id}-q`} className="sr-only">
          Kelime veya ilan numarası
        </Label>
        <Input
          id={`${id}-q`}
          value={draft.q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="ör. bahçeli, EKG-2026-0012"
          maxLength={60}
        />
      </Section>
    </div>
  );
}


