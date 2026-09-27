'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { NumberInput } from '@/components/forms/number-input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form-controls';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS } from '@/modules/properties/constants';

const SORTS = [
  { value: 'guncel', label: 'Son güncellenen' },
  { value: 'yeni', label: 'En yeni' },
  { value: 'eski', label: 'En eski' },
  { value: 'fiyat-artan', label: 'Fiyat (artan)' },
  { value: 'fiyat-azalan', label: 'Fiyat (azalan)' },
  { value: 'baslik', label: 'Başlık (A-Z)' },
];

/** İlan tablosu filtreleri: tüm durum URL'de tutulur (paylaşılabilir, geri tuşu çalışır) */
export function ListingsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [minPrice, setMinPrice] = useState(params.get('fiyat_min') ?? '');
  const [maxPrice, setMaxPrice] = useState(params.get('fiyat_max') ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('sayfa');
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onSearch(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: value.trim() || null }), 350);
  }

  const active = ['q', 'tip', 'kategori', 'tarih', 'fiyat_min', 'fiyat_max'].some((k) => params.get(k));

  return (
    <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
      <div className="relative flex-1 md:max-w-md 2xl:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="listing-search" className="sr-only">
          İlanlarda ara
        </label>
        <input
          id="listing-search"
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Başlık veya ilan no (EKG-2026-0001)"
          maxLength={60}
          className="h-11 w-full rounded-xl border border-border bg-surface pr-10 pl-10 text-base sm:text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
        />
        {pending && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Yükleniyor" />}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select aria-label="İlan türü" value={params.get('tip') ?? ''} onChange={(e) => update({ tip: e.target.value || null })} className="h-11 sm:w-36">
          <option value="">Tüm türler</option>
          {Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select aria-label="Kategori" value={params.get('kategori') ?? ''} onChange={(e) => update({ kategori: e.target.value || null })} className="h-11 sm:w-40">
          <option value="">Tüm kategoriler</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select aria-label="Eklenme tarihi" value={params.get('tarih') ?? ''} onChange={(e) => update({ tarih: e.target.value || null })} className="h-11 sm:w-40">
          <option value="">Tüm tarihler</option>
          <option value="7">Son 7 gün</option>
          <option value="30">Son 30 gün</option>
          <option value="90">Son 90 gün</option>
          <option value="365">Son 1 yıl</option>
        </Select>
        <Select aria-label="Sıralama" value={params.get('sirala') ?? 'guncel'} onChange={(e) => update({ sirala: e.target.value === 'guncel' ? null : e.target.value })} className="h-11 sm:w-44">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <div className="col-span-2 flex items-center gap-2">
          <NumberInput aria-label="En düşük fiyat" placeholder="Min ₺" value={minPrice} onValueChange={setMinPrice} onBlur={() => update({ fiyat_min: minPrice || null })} className="h-11 sm:w-28" />
          <span className="text-muted-foreground" aria-hidden>
            –
          </span>
          <NumberInput aria-label="En yüksek fiyat" placeholder="Max ₺" value={maxPrice} onValueChange={setMaxPrice} onBlur={() => update({ fiyat_max: maxPrice || null })} className="h-11 sm:w-28" />
        </div>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="col-span-2 sm:col-span-1"
            onClick={() => {
              setQ('');
              setMinPrice('');
              setMaxPrice('');
              const keep = new URLSearchParams();
              if (params.get('durum')) keep.set('durum', params.get('durum') as string);
              startTransition(() => router.replace(keep.size ? `${pathname}?${keep}` : pathname, { scroll: false }));
            }}
          >
            <X /> Filtreleri temizle
          </Button>
        )}
      </div>
    </div>
  );
}
