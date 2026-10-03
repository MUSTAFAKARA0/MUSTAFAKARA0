'use client';

import { useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceChip, SegmentedControl } from '@/components/ui/choice';
import { Dialog, DialogTrigger, SheetContent } from '@/components/ui/dialog';
import { Label, Select } from '@/components/ui/form-controls';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NumberInput } from '@/components/forms/number-input';
import { FiltersPanel } from '@/components/search/filters-panel';
import { FLAG_KEYS, FLAG_LABELS, fromDraft, toDraft, type FilterDraft } from '@/components/search/filter-state';
import { useListingSearch } from '@/components/search/search-context';
import type { SearchOptions } from '@/modules/properties/search-types';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  DEED_STATUS_LABELS,
  FLOOR_FILTER_OPTIONS,
  HEATING_LABELS,
  LISTING_TYPE_LABELS,
  ROOM_FILTER_OPTIONS,
  SORT_OPTIONS,
  type ListingType,
  type SortValue,
} from '@/modules/properties/constants';
import { countActiveFilters, listingHref, type ListingPreset, type ListingQuery } from '@/modules/properties/filters';

const pill =
  'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors data-[state=open]:border-foreground';

function PillTrigger({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(pill, active ? 'border-foreground bg-foreground text-background' : 'border-border-strong bg-surface hover:border-foreground/50')}
      >
        {children}
        <ChevronDown className="size-4 opacity-60" aria-hidden />
      </button>
    </PopoverTrigger>
  );
}

function PopoverFooter({ onClear, onApply }: { onClear: () => void; onApply: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
      <PopoverClose asChild>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Temizle
        </Button>
      </PopoverClose>
      <PopoverClose asChild>
        <Button size="sm" onClick={onApply}>
          Uygula
        </Button>
      </PopoverClose>
    </div>
  );
}

/**
 * İlan listesi araç çubuğu: masaüstünde hızlı filtreler (ilan türü, konum,
 * fiyat, oda) + "Tüm filtreler"; mobilde "Filtreler" paneli. Tüm değişiklikler
 * URL'ye yazılır.
 */
export function ListingToolbar({
  query,
  preset,
  options,
}: {
  query: ListingQuery;
  preset: ListingPreset;
  options: SearchOptions;
}) {
  const { navigate, pending } = useListingSearch();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(query));
  const [quick, setQuick] = useState<FilterDraft>(() => toDraft(query));
  const activeCount = countActiveFilters(query, preset);

  const go = (next: ListingQuery) => navigate(listingHref(next));
  const openSheet = (open: boolean) => {
    if (open) setDraft(toDraft(query));
    setSheetOpen(open);
  };
  const resetQuick = () => setQuick(toDraft(query));

  const districts = options.districts;
  const neighborhoods = options.neighborhoods.filter((n) => n.districtSlug === quick.district);
  const locationLabel = query.neighborhood
    ? options.neighborhoods.find((n) => n.slug === query.neighborhood)?.name
    : query.district
      ? options.districts.find((d) => d.slug === query.district)?.name
      : undefined;
  const priceLabel =
    query.minPrice || query.maxPrice
      ? `${query.minPrice ? formatNumber(query.minPrice) : '0'} – ${query.maxPrice ? formatNumber(query.maxPrice) : '∞'} ₺`
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Masaüstü hızlı filtreler */}
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        <SegmentedControl<'' | ListingType>
          label="İlan türü"
          value={query.listingType ?? ''}
          onValueChange={(v) => go({ ...query, listingType: v || undefined, page: 1 })}
          options={[
            { value: '', label: 'Tümü' },
            { value: 'sale', label: 'Satılık' },
            { value: 'rent', label: 'Kiralık' },
          ]}
        />

        <Popover onOpenChange={(o) => o && resetQuick()}>
          <PillTrigger active={Boolean(locationLabel)}>{locationLabel ?? 'Konum'}</PillTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-3">
              <div>
                <Label htmlFor="tb-ilce">İlçe</Label>
                <Select
                  id="tb-ilce"
                  value={quick.district}
                  onChange={(e) => {
                    const d = districts.find((x) => x.slug === e.target.value);
                    setQuick({ ...quick, district: e.target.value, neighborhood: '', city: d?.citySlug ?? '' });
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
                <Label htmlFor="tb-mahalle">Mahalle</Label>
                <Select
                  id="tb-mahalle"
                  value={quick.neighborhood}
                  onChange={(e) => setQuick({ ...quick, neighborhood: e.target.value })}
                  disabled={!quick.district || neighborhoods.length === 0}
                >
                  <option value="">{quick.district ? 'Tüm mahalleler' : 'Önce ilçe seçin'}</option>
                  {neighborhoods.map((n) => (
                    <option key={n.slug} value={n.slug}>
                      {n.name} ({n.count})
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <PopoverFooter
              onClear={() => go({ ...query, city: undefined, district: undefined, neighborhood: undefined, page: 1 })}
              onApply={() =>
                go({ ...query, city: quick.city || undefined, district: quick.district || undefined, neighborhood: quick.neighborhood || undefined, page: 1 })
              }
            />
          </PopoverContent>
        </Popover>

        <Popover onOpenChange={(o) => o && resetQuick()}>
          <PillTrigger active={Boolean(priceLabel)}>{priceLabel ?? 'Fiyat'}</PillTrigger>
          <PopoverContent className="w-80">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tb-pmin">En az (₺)</Label>
                <NumberInput id="tb-pmin" placeholder="Min" value={quick.minPrice} onValueChange={(v) => setQuick({ ...quick, minPrice: v })} />
              </div>
              <div>
                <Label htmlFor="tb-pmax">En çok (₺)</Label>
                <NumberInput id="tb-pmax" placeholder="Max" value={quick.maxPrice} onValueChange={(v) => setQuick({ ...quick, maxPrice: v })} />
              </div>
            </div>
            <PopoverFooter
              onClear={() => go({ ...query, minPrice: undefined, maxPrice: undefined, page: 1 })}
              onApply={() => {
                const next = fromDraft({ ...toDraft(query), minPrice: quick.minPrice, maxPrice: quick.maxPrice }, query.sort);
                go({ ...query, minPrice: next.minPrice, maxPrice: next.maxPrice, page: 1 });
              }}
            />
          </PopoverContent>
        </Popover>

        {query.category !== 'arsa' && (
          <Popover onOpenChange={(o) => o && resetQuick()}>
            <PillTrigger active={Boolean(query.rooms?.length)}>{query.rooms?.length ? `Oda: ${query.rooms.join(', ')}` : 'Oda'}</PillTrigger>
            <PopoverContent>
              <div className="flex flex-wrap gap-2">
                {ROOM_FILTER_OPTIONS.map((r) => (
                  <ChoiceChip
                    key={r}
                    size="sm"
                    pressed={quick.rooms.includes(r)}
                    onPressedChange={(on) => setQuick({ ...quick, rooms: on ? [...quick.rooms, r] : quick.rooms.filter((x) => x !== r) })}
                  >
                    {r}
                  </ChoiceChip>
                ))}
              </div>
              <PopoverFooter
                onClear={() => go({ ...query, rooms: undefined, page: 1 })}
                onApply={() => go({ ...query, rooms: quick.rooms.length ? quick.rooms : undefined, page: 1 })}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Tüm filtreler (mobil + masaüstü) */}
      <Dialog open={sheetOpen} onOpenChange={openSheet}>
        <DialogTrigger asChild>
          <button type="button" className={cn(pill, 'border-border-strong bg-surface hover:border-foreground/50')}>
            <SlidersHorizontal className="size-4" aria-hidden />
            <span>
              <span className="lg:hidden">Filtreler</span>
              <span className="hidden lg:inline">Tüm filtreler</span>
            </span>
            {activeCount > 0 && (
              <span className="numeric flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                {activeCount}
              </span>
            )}
          </button>
        </DialogTrigger>
        <SheetContent
          title="Filtreler"
          description="Aradığınız gayrimenkulün özelliklerini seçin"
          side="right"
          className="max-sm:inset-x-0 max-sm:top-auto max-sm:h-[92dvh] max-sm:w-full max-sm:rounded-t-2xl"
          footer={
            <div className="flex gap-2 pb-1">
              <Button variant="outline" className="flex-1" onClick={() => setDraft(toDraft({ sort: query.sort, page: 1 }))}>
                Temizle
              </Button>
              <Button
                className="flex-[2]"
                loading={pending}
                onClick={() => {
                  go(fromDraft(draft, query.sort));
                  setSheetOpen(false);
                }}
              >
                Sonuçları göster
              </Button>
            </div>
          }
        >
          <FiltersPanel draft={draft} onChange={setDraft} options={options} />
        </SheetContent>
      </Dialog>

      <div className="ml-auto flex items-center gap-2">
        <label htmlFor="tb-sort" className="sr-only sm:not-sr-only sm:text-sm sm:text-muted-foreground">
          Sırala
        </label>
        <div className="w-[11.5rem]">
          <Select
            id="tb-sort"
            value={query.sort}
            onChange={(e) => go({ ...query, sort: e.target.value as SortValue, page: 1 })}
            className="h-10 rounded-full"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}

interface Chip {
  key: string;
  label: string;
  remove: Partial<ListingQuery>;
}

/** Seçili filtreler — tek dokunuşla kaldırılabilir */
export function ActiveFilterChips({ query, preset, options }: { query: ListingQuery; preset: ListingPreset; options: SearchOptions }) {
  const { navigate } = useListingSearch();
  const chips: Chip[] = [];
  if (query.listingType && !preset.listingType) chips.push({ key: 'lt', label: LISTING_TYPE_LABELS[query.listingType], remove: { listingType: undefined } });
  if (query.category && !preset.category) chips.push({ key: 'cat', label: CATEGORY_LABELS[query.category], remove: { category: undefined } });
  if (query.types?.length && !preset.types)
    for (const t of query.types)
      chips.push({ key: `t-${t}`, label: options.types.find((x) => x.slug === t)?.name ?? t, remove: { types: query.types.filter((x) => x !== t) } });
  if (query.neighborhood && !preset.neighborhood)
    chips.push({ key: 'n', label: options.neighborhoods.find((x) => x.slug === query.neighborhood)?.name ?? query.neighborhood, remove: { neighborhood: undefined } });
  else if (query.district && !preset.district)
    chips.push({ key: 'd', label: options.districts.find((x) => x.slug === query.district)?.name ?? query.district, remove: { district: undefined, neighborhood: undefined } });
  if (query.minPrice || query.maxPrice)
    chips.push({
      key: 'price',
      label: `${query.minPrice ? formatNumber(query.minPrice) : '0'} – ${query.maxPrice ? formatNumber(query.maxPrice) : '∞'} ₺`,
      remove: { minPrice: undefined, maxPrice: undefined },
    });
  if (query.minM2 || query.maxM2)
    chips.push({ key: 'm2', label: `${query.minM2 ?? 0} – ${query.maxM2 ?? '∞'} m²`, remove: { minM2: undefined, maxM2: undefined } });
  for (const r of query.rooms ?? []) chips.push({ key: `r-${r}`, label: r, remove: { rooms: query.rooms?.filter((x) => x !== r) } });
  if (query.maxAge !== undefined) chips.push({ key: 'age', label: query.maxAge === 0 ? 'Sıfır bina' : `≤ ${query.maxAge} yaş`, remove: { maxAge: undefined } });
  if (query.floor) chips.push({ key: 'floor', label: FLOOR_FILTER_OPTIONS.find((o) => o.value === query.floor)?.label ?? query.floor, remove: { floor: undefined } });
  if (query.heating) chips.push({ key: 'heat', label: HEATING_LABELS[query.heating] ?? query.heating, remove: { heating: undefined } });
  if (query.deed) chips.push({ key: 'deed', label: DEED_STATUS_LABELS[query.deed] ?? query.deed, remove: { deed: undefined } });
  for (const k of FLAG_KEYS) if (query[k]) chips.push({ key: k, label: FLAG_LABELS[k], remove: { [k]: undefined } });
  if (query.q) chips.push({ key: 'q', label: `“${query.q}”`, remove: { q: undefined } });

  if (!chips.length) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Seçili filtreler">
      {chips.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => navigate(listingHref({ ...query, ...c.remove, page: 1 }))}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-[13px] font-medium text-foreground transition hover:bg-surface-sunken"
          >
            {c.label}
            <X className="size-3.5 opacity-60" aria-label="kaldır" />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => navigate(listingHref({ ...preset, sort: query.sort, page: 1 }))}
          className="h-8 px-2 text-[13px] font-semibold text-primary-ink hover:underline"
        >
          Tümünü temizle
        </button>
      </li>
    </ul>
  );
}
