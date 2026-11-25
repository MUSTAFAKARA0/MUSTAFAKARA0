/**
 * KATALOG SEGMENTLERİ (istemci tarafından içe aktarılabilen küçük, salt veri modülü): segment kimlikleri ve adları,
 * yoğunluk adları ve FamilyMeta tipi. Ailelerin metinleri (FAMILY_META) burada DEĞİL, sunucuya özel
 * catalog-meta.ts'tedir; istemciye yalnızca izinli ailelerin üst verisi prop olarak gider.
 */
export const SEGMENTS = [
  { id: 'konut', label: 'Konut' },
  { id: 'villa-luks', label: 'Villa ve lüks' },
  { id: 'sahil-yazlik', label: 'Sahil ve yazlık' },
  { id: 'proje', label: 'Proje' },
  { id: 'ticari', label: 'Ticari' },
  { id: 'arsa', label: 'Arsa ve tarla' },
  { id: 'kiralik', label: 'Kiralık' },
  { id: 'kurumsal', label: 'Kurumsal' },
  { id: 'butik', label: 'Butik' },
  { id: 'miras', label: 'Tarihi doku' },
  { id: 'koyu', label: 'Koyu tema' },
] as const;
export type SegmentId = (typeof SEGMENTS)[number]['id'];
export const SEGMENT_IDS: readonly SegmentId[] = SEGMENTS.map((s) => s.id);

export interface FamilyMeta {
  segments: SegmentId[];
  /** Kısa arama etiketleri */
  tags: string[];
  /** "Uygun: …" satırı */
  bestFor: string[];
  /** Uygun olmayan kullanım (varsa) */
  notFor?: string;
  mood: string[];
  density: 'airy' | 'balanced' | 'dense';
  contrast: 'light' | 'dark';
}

export const DENSITY_LABELS: Record<FamilyMeta['density'], string> = { airy: 'Ferah', balanced: 'Dengeli', dense: 'Sık' };

