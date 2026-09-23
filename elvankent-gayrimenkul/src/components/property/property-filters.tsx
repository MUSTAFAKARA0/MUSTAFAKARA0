'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Label, Select } from '@/components/ui/form-controls';
import { Dialog, DialogTrigger, SheetContent } from '@/components/ui/dialog';
import { NumberInput } from '@/components/forms/number-input';
import { useListingNavigation } from './listing-navigation';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS, ROOM_FILTER_OPTIONS, SORT_OPTIONS, type SortValue } from '@/lib/constants';
import { canonicalListingPath, filtersToSearchParams, type ListingFilters, type ListingPreset } from '@/lib/listing-filters';
import { cn } from '@/lib/utils';
import type { City, District, ListingType, Neighborhood, PropertyCategory, PropertyType } from '@/types/database';

export interface FilterOptions {
  cities: Pick<City, 'id' | 'name' | 'slug'>[];
  districts: Pick<District, 'id' | 'city_id' | 'name' | 'slug'>[];
  neighborhoods: Pick<Neighborhood, 'id' | 'district_id' | 'name' | 'slug'>[];
  propertyTypes: Pick<PropertyType, 'id' | 'category' | 'name' | 'slug'>[];
}

interface FilterProps {
  filters: ListingFilters;
  preset: ListingPreset;
  /** Bölge sayfalarında yol sabittir; diğer sayfalarda yol filtrelere göre hesaplanır */
  basePath?: string;
  options: FilterOptions;
}

type FormState = {
  listingType: '' | ListingType;
  category: '' | PropertyCategory;
  typeSlug: string;
  city: string;
  district: string;
  neighborhood: string;
  minPrice: string;
  maxPrice: string;
  minM2: string;
  maxM2: string;
  rooms: string[];
  maxAge: string;
  furnished: boolean;
  credit: boolean;
  complex: boolean;
  elevator: boolean;
  parking: boolean;
  q: string;
};

function toForm(f: ListingFilters): FormState {
  return {
    listingType: f.listingType ?? '',
    category: f.category ?? '',
    typeSlug: f.typeSlug ?? '',
    city: f.city ?? '',
    district: f.district ?? '',
    neighborhood: f.neighborhood ?? '',
    minPrice: f.minPrice ? String(f.minPrice) : '',
    maxPrice: f.maxPrice ? String(f.maxPrice) : '',
    minM2: f.minM2 ? String(f.minM2) : '',
    maxM2: f.maxM2 ? String(f.maxM2) : '',
    rooms: f.rooms ?? [],
    maxAge: f.maxAge !== undefined ? String(f.maxAge) : '',
    furnished: Boolean(f.furnished),
    credit: Boolean(f.credit),
    complex: Boolean(f.complex),
    elevator: Boolean(f.elevator),
    parking: Boolean(f.parking),
    q: f.q ?? '',
  };
}

const num = (v: string) => (v ? Number(v) : undefined);

/** Form durumundan hedef URL'yi üretir */
function buildListingHref(form: FormState, sort: SortValue, basePath?: string, regionPreset?: ListingPreset): string {
  const listingType = form.listingType || undefined;
  const category = form.category || undefined;
  const typeSlug = form.typeSlug || undefined;
  let path: string;
  let preset: ListingPreset;
  if (basePath && regionPreset) {
    path = basePath;
    preset = regionPreset;
  } else {
    ({ path, preset } = canonicalListingPath({ listingType, category, typeSlug }));
  }
  const minPrice = num(form.minPrice);
  let maxPrice = num(form.maxPrice);
  if (minPrice && maxPrice && maxPrice < minPrice) maxPrice = undefined;
  const params = filtersToSearchParams(
    {
      listingType,
      category,
      typeSlug,
      city: form.city || undefined,
      district: form.district || undefined,
      neighborhood: form.neighborhood || undefined,
      minPrice,
      maxPrice,
      minM2: num(form.minM2),
      maxM2: num(form.maxM2),
      rooms: form.rooms,
      maxAge: form.maxAge === '' ? undefined : Number(form.maxAge),
      furnished: form.furnished,
      credit: form.credit,
      complex: form.complex,
      elevator: form.elevator,
      parking: form.parking,
      q: form.q.trim() || undefined,
      sort,
      page: 1,
    },
    preset,
  );
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function FilterForm({ filters, preset, basePath, options, onApplied }: FilterProps & { onApplied?: () => void }) {
  const { navigate, isPending } = useListingNavigation();
  const [form, setForm] = useState<FormState>(() => toForm(filters));
  const isRegionPage = Boolean(preset.city);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const city = options.cities.find((c) => c.slug === form.city);
  const districts = useMemo(
    () => (city ? options.districts.filter((d) => d.city_id === city.id) : []),
    [city, options.districts],
  );
  const district = districts.find((d) => d.slug === form.district);
  const neighborhoods = useMemo(
    () => (district ? options.neighborhoods.filter((n) => n.district_id === district.id) : []),
    [district, options.neighborhoods],
  );
  const types = options.propertyTypes.filter((t) => !form.category || t.category === form.category);
  const showRooms = form.category !== 'arsa' && form.category !== 'isyeri';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(buildListingHref(form, filters.sort, basePath, isRegionPage ? preset : undefined));
    onApplied?.();
  };

  const toggleRoom = (r: string) =>
    set('rooms', form.rooms.includes(r) ? form.rooms.filter((x) => x !== r) : [...form.rooms, r]);

  const resetHref = isRegionPage && basePath ? basePath : canonicalListingPath(preset).path;

  return (
    <form onSubmit={submit} className="space-y-5" aria-label="İlan filtreleri">
      <div>
        <Label htmlFor="f-q">Kelime veya ilan no</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-sand-400" aria-hidden />
          <Input
            id="f-q"
            value={form.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Ör. site içinde, 100001"
            className="pl-10"
            maxLength={60}
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-sand-700">İlan tipi</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-sand-100 p-1">
          {([['', 'Tümü'], ['sale', LISTING_TYPE_LABELS.sale], ['rent', LISTING_TYPE_LABELS.rent]] as const).map(([v, label]) => (
            <button
              key={v || 'all'}
              type="button"
              aria-pressed={form.listingType === v}
              onClick={() => set('listingType', v)}
              className={cn(
                'rounded-lg py-2 text-sm font-semibold text-sand-600 transition',
                form.listingType === v ? 'bg-surface text-brand-800 shadow-sm' : 'hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="f-category">Kategori</Label>
          <Select
            id="f-category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as FormState['category'], typeSlug: '' }))}
          >
            <option value="">Tümü</option>
            {(Object.keys(CATEGORY_LABELS) as PropertyCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-type">Emlak tipi</Label>
          <Select id="f-type" value={form.typeSlug} onChange={(e) => set('typeSlug', e.target.value)}>
            <option value="">Tümü</option>
            {types.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!isRegionPage && (
        <fieldset className="space-y-3">
          <legend className="mb-1.5 text-[13px] font-semibold text-sand-700">Konum</legend>
          <Select
            aria-label="İl"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value, district: '', neighborhood: '' }))}
          >
            <option value="">Tüm iller</option>
            {options.cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="İlçe"
            value={form.district}
            disabled={!city}
            onChange={(e) => setForm((f) => ({ ...f, district: e.target.value, neighborhood: '' }))}
          >
            <option value="">{city ? 'Tüm ilçeler' : 'Önce il seçin'}</option>
            {districts.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Mahalle"
            value={form.neighborhood}
            disabled={!district}
            onChange={(e) => set('neighborhood', e.target.value)}
          >
            <option value="">{district ? 'Tüm mahalleler' : 'Önce ilçe seçin'}</option>
            {neighborhoods.map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name}
              </option>
            ))}
          </Select>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-sand-700">Fiyat (₺)</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput aria-label="En düşük fiyat" placeholder="En az" value={form.minPrice} onValueChange={(v) => set('minPrice', v)} />
          <NumberInput aria-label="En yüksek fiyat" placeholder="En çok" value={form.maxPrice} onValueChange={(v) => set('maxPrice', v)} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-sand-700">Brüt m²</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput aria-label="En küçük m²" placeholder="En az" value={form.minM2} onValueChange={(v) => set('minM2', v)} />
          <NumberInput aria-label="En büyük m²" placeholder="En çok" value={form.maxM2} onValueChange={(v) => set('maxM2', v)} />
        </div>
      </fieldset>

      {showRooms && (
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-sand-700">Oda sayısı</legend>
          <div className="flex flex-wrap gap-1.5">
            {ROOM_FILTER_OPTIONS.map((r) => {
              const active = form.rooms.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleRoom(r)}
                  className={cn(
                    'h-9 min-w-12 rounded-lg border px-3 text-sm font-semibold transition',
                    active ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-surface text-sand-700 hover:border-brand-300',
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {form.category !== 'arsa' && (
        <div>
          <Label htmlFor="f-age">Bina yaşı</Label>
          <Select id="f-age" value={form.maxAge} onChange={(e) => set('maxAge', e.target.value)}>
            <option value="">Farketmez</option>
            <option value="0">Sıfır bina</option>
            <option value="5">5 yaşa kadar</option>
            <option value="10">10 yaşa kadar</option>
            <option value="20">20 yaşa kadar</option>
          </Select>
        </div>
      )}

      <fieldset className="space-y-2.5">
        <legend className="mb-1.5 text-[13px] font-semibold text-sand-700">Özellikler</legend>
        <Checkbox label="Krediye uygun" checked={form.credit} onChange={(e) => set('credit', e.target.checked)} />
        {form.category !== 'arsa' && (
          <>
            <Checkbox label="Site içerisinde" checked={form.complex} onChange={(e) => set('complex', e.target.checked)} />
            <Checkbox label="Asansörlü" checked={form.elevator} onChange={(e) => set('elevator', e.target.checked)} />
            <Checkbox label="Otoparklı" checked={form.parking} onChange={(e) => set('parking', e.target.checked)} />
            <Checkbox label="Eşyalı" checked={form.furnished} onChange={(e) => set('furnished', e.target.checked)} />
          </>
        )}
      </fieldset>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1" loading={isPending}>
          İlanları Göster
        </Button>
        <Button asChild variant="ghost">
          <Link href={resetHref} onClick={onApplied}>
            Temizle
          </Link>
        </Button>
      </div>
    </form>
  );
}

/** Masaüstünde sol sütunda sabit filtre paneli */
export function DesktopFilters(props: FilterProps) {
  return (
    <aside className="hidden lg:block" aria-label="Filtreler">
      <div className="sticky top-24 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ink">
          <SlidersHorizontal className="size-4 text-brand-700" aria-hidden /> Filtrele
        </h2>
        <FilterForm key={JSON.stringify(props.filters)} {...props} />
      </div>
    </aside>
  );
}

/** Mobilde açılır panel olarak filtreler */
export function MobileFilters({ activeCount, ...props }: FilterProps & { activeCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal /> Filtrele
          {activeCount > 0 && (
            <span className="rounded-full bg-brand-700 px-1.5 text-[11px] leading-5 text-white">{activeCount}</span>
          )}
        </Button>
      </DialogTrigger>
      <SheetContent title="Filtrele" side="right">
        <FilterForm key={JSON.stringify(props.filters)} {...props} onApplied={() => setOpen(false)} />
      </SheetContent>
    </Dialog>
  );
}

/** Sıralama seçimi (mevcut filtreleri koruyarak) */
export function SortSelect({ current, hrefFor }: { current: SortValue; hrefFor: Record<SortValue, string> }) {
  const { navigate } = useListingNavigation();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sirala" className="sr-only text-sm text-sand-600 sm:not-sr-only">
        Sırala
      </label>
      <select
        id="sirala"
        value={current}
        onChange={(e) => navigate(hrefFor[e.target.value as SortValue])}
        className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink focus:border-brand-500 focus:ring-3 focus:ring-brand-100 focus:outline-none"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
