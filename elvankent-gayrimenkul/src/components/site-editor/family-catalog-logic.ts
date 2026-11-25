import { SEGMENT_IDS, type FamilyMeta, type SegmentId } from '@/site-factory/catalog-segments';

/**
 * Aile kataloğunun SAF mantığı (filtre, sıralama, adres durumu, sayaç metni). Bileşenlerden
 * bağımsızdır; birim testle doğrulanır (tests/unit/family-picker-logic.test.mjs). Hem ofis/KARAY
 * aile seçicisi hem KARAY katalog yönetimi aynı fonksiyonları kullanır.
 */
export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  audience: string;
  meta: FamilyMeta;
  recommended?: boolean;
  /** Katalog yönetiminde "kullanan site sayısı" sıralaması */
  sites?: number;
}

export type SortKey = 'recommended' | 'az' | 'sites';
export interface CatalogState {
  segment: SegmentId | 'all';
  q: string;
  sort: SortKey;
  dark: boolean;
}

export const DEFAULT_STATE: CatalogState = { segment: 'all', q: '', sort: 'recommended', dark: false };
const SORT_KEYS: readonly SortKey[] = ['recommended', 'az', 'sites'];

/** Arama için: küçük harf (tr), aksan ve noktasız ı sadeleştirilir */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function haystack(f: CatalogItem): string {
  return fold([f.name, f.description, f.audience, ...f.meta.tags, ...f.meta.bestFor, ...f.meta.mood].join(' '));
}

export function filterFamilies<T extends CatalogItem>(items: readonly T[], state: CatalogState): T[] {
  const words = fold(state.q).split(/\s+/).filter(Boolean);
  return items.filter((f) => {
    if (state.segment !== 'all' && !f.meta.segments.includes(state.segment)) return false;
    if (state.dark && f.meta.contrast !== 'dark') return false;
    if (words.length === 0) return true;
    const h = haystack(f);
    return words.every((w) => h.includes(w));
  });
}

export function sortFamilies<T extends CatalogItem>(items: readonly T[], sort: SortKey): T[] {
  const indexed = items.map((f, i) => ({ f, i }));
  if (sort === 'az') indexed.sort((a, b) => a.f.name.localeCompare(b.f.name, 'tr') || a.i - b.i);
  else if (sort === 'sites') indexed.sort((a, b) => (b.f.sites ?? 0) - (a.f.sites ?? 0) || a.i - b.i);
  else indexed.sort((a, b) => Number(Boolean(b.f.recommended)) - Number(Boolean(a.f.recommended)) || a.i - b.i);
  return indexed.map((x) => x.f);
}

/** Segment başına aile sayısı (tüm liste üzerinden; arama/koyu süzgeci chip sayısını değiştirmez) */
export function segmentCounts(items: readonly CatalogItem[]): Record<SegmentId, number> {
  const out = Object.fromEntries(SEGMENT_IDS.map((s) => [s, 0])) as Record<SegmentId, number>;
  for (const f of items) for (const s of new Set(f.meta.segments)) out[s] += 1;
  return out;
}

// ----------------------------------------------------------------------------- Adres durumu
/** ?segment= &q= &sirala= &koyu= → durum (bilinmeyen değerler varsayılana düşer; HTML/URL enjeksiyonu yok) */
export function parseState(params: URLSearchParams | Record<string, string | undefined>): CatalogState {
  const get = (k: string) => (params instanceof URLSearchParams ? params.get(k) : params[k]) ?? '';
  const segment = get('segment');
  const sort = get('sirala');
  return {
    segment: (SEGMENT_IDS as readonly string[]).includes(segment) ? (segment as SegmentId) : 'all',
    q: get('q').slice(0, 60),
    sort: (SORT_KEYS as readonly string[]).includes(sort) ? (sort as SortKey) : 'recommended',
    dark: get('koyu') === '1',
  };
}

/** Durum → sorgu metni (varsayılanlar yazılmaz; boş durum = boş metin) */
export function serializeState(state: CatalogState): string {
  const p = new URLSearchParams();
  if (state.segment !== 'all') p.set('segment', state.segment);
  if (state.q.trim()) p.set('q', state.q.trim().slice(0, 60));
  if (state.sort !== 'recommended') p.set('sirala', state.sort);
  if (state.dark) p.set('koyu', '1');
  return p.toString();
}

export const isDefaultState = (s: CatalogState) => serializeState(s) === '';

// ----------------------------------------------------------------------------- Sayaç metni
const POSSESSIVE_UNITS = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'] as const;
const POSSESSIVE_TENS: Record<number, string> = { 10: 'u', 20: 'si', 30: 'u', 40: 'ı', 50: 'si', 60: 'ı', 70: 'i', 80: 'i', 90: 'ı' };

/** Sayıya iyelik eki: 5'i, 6'sı, 12'si, 18'i, 20'si … (yalnızca 0–99) */
export function withPossessive(n: number): string {
  const tens = n - (n % 10);
  const suffix = n % 10 === 0 && n >= 10 ? POSSESSIVE_TENS[tens] ?? 'i' : POSSESSIVE_UNITS[n % 10];
  return `${n}'${suffix}`;
}

/** aria-live metni: "18 aileden 5'i gösteriliyor" */
export function resultText(total: number, shown: number): string {
  if (shown === 0) return 'Eşleşen aile yok';
  if (shown === total) return `${total} aile gösteriliyor`;
  return `${total} aileden ${withPossessive(shown)} gösteriliyor`;
}
