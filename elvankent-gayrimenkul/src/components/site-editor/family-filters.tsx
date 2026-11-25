'use client';

import { Moon, Search, X } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { isDefaultState, type CatalogState, type SortKey } from '@/components/site-editor/family-catalog-logic';
import { SEGMENTS, type SegmentId } from '@/site-factory/catalog-segments';

/**
 * Aile kataloğu filtre çubuğu: segment çipleri (aria-pressed, sayılarla), metin araması, sıralama,
 * koyu tema anahtarı ve aria-live sonuç sayacı. Çip dokunma hedefi telefonda >= 44 px. Durum
 * üst bileşende (family-catalog) tutulur ve adres satırına yansıtılır.
 */
export function FamilyFilters({
  state,
  onChange,
  counts,
  total,
  resultText,
  sortOptions,
  showDark,
}: {
  state: CatalogState;
  onChange: (next: CatalogState) => void;
  counts: Record<SegmentId, number>;
  total: number;
  resultText: string;
  sortOptions: { value: SortKey; label: string }[];
  /** Koyu aile yoksa (ör. ofis için gizlendi) koyu tema anahtarı gösterilmez */
  showDark: boolean;
}) {
  const id = useId();
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition sm:min-h-9 sm:px-3',
      active ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface text-foreground/80 hover:border-border-strong hover:text-foreground',
    );
  const visible = SEGMENTS.filter((s) => counts[s.id] > 0);
  return (
    <div role="group" aria-label="Tasarım ailesi filtreleri" className="space-y-3 rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Segment">
        <button type="button" aria-pressed={state.segment === 'all'} className={chip(state.segment === 'all')} onClick={() => onChange({ ...state, segment: 'all' })}>
          Tümü <span className="numeric text-[11.5px] opacity-80">{total}</span>
        </button>
        {visible.map((s) => (
          <button key={s.id} type="button" aria-pressed={state.segment === s.id} className={chip(state.segment === s.id)} onClick={() => onChange({ ...state, segment: state.segment === s.id ? 'all' : s.id })}>
            {s.label} <span className="numeric text-[11.5px] opacity-80">{counts[s.id]}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div className="relative">
          <label htmlFor={`${id}-q`} className="sr-only">
            Tasarım ailelerinde ara
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id={`${id}-q`} type="search" aria-label="Tasarım ailelerinde ara" value={state.q} maxLength={60} placeholder="Ad, etiket veya kime uygun olduğu" className="pl-10" onChange={(e) => onChange({ ...state, q: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-sort`} className="text-[13px] font-semibold text-foreground/80">
            Sırala
          </label>
          <Select id={`${id}-sort`} value={state.sort} onChange={(e) => onChange({ ...state, sort: e.target.value as SortKey })} className="min-w-40">
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        {showDark && (
          <button type="button" aria-pressed={state.dark} className={chip(state.dark)} onClick={() => onChange({ ...state, dark: !state.dark })}>
            <Moon className="size-3.5" aria-hidden /> Koyu tema
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" role="status" className="text-[13px] font-medium text-muted-foreground" data-testid="family-result-count">
          {resultText}
        </p>
        {!isDefaultState(state) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ segment: 'all', q: '', sort: 'recommended', dark: false })}>
            <X /> Filtreleri temizle
          </Button>
        )}
      </div>
    </div>
  );
}
